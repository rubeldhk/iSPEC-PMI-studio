/**
 * `T1564` (EPIC-044, `FR-EPB-020`–`FR-EPB-029`, data-model.md §1–§2) — the Epic
 * entity: create allocates the next number and derives the slug; edit keeps
 * the number; close refuses on a split or closed Epic; requirements and
 * specifications belong to at most one Epic; every write is owner-gated and
 * audited; another project's Epic is absence. Written to FAIL before `T1565`.
 */
import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from '../../../src/core/errors.js';
import { OwnerGate } from '../../../src/modules/governance/owner-gate.js';
import { EpicService } from '../../../src/modules/epics/epic.service.js';
import { InMemoryEpicStore } from '../../../src/modules/epics/epic.store.js';
import { InMemoryRequirementAssignments, InMemorySpecificationAssignments } from '../../../src/modules/epics/assignment.ports.js';

const NOW = new Date('2026-09-05T12:00:00Z');
const OWNER = { workspaceId: 'ws_a', projectId: 'p_a', userId: 'u_owner' };
const WRITER = { ...OWNER, userId: 'u_writer' };
const OTHER = { workspaceId: 'ws_a', projectId: 'p_b', userId: 'u_owner' };

export function harness() {
  const audits: Record<string, unknown>[] = [];
  const audit = { record: async (row: Record<string, unknown>): Promise<void> => void audits.push(row) };
  const gate = new OwnerGate({
    projects: {
      get: async (workspaceId, id) => {
        if (workspaceId !== 'ws_a' || !['p_a', 'p_b'].includes(id)) throw new Error('not found');
        return { id, ownerUserId: 'u_owner' };
      },
    },
    grants: { activeGrants: async () => [] },
    audit,
  });
  const requirements = new InMemoryRequirementAssignments([
    { id: 'r1', workspaceId: 'ws_a', projectId: 'p_a', reference: 'REQ-001', status: 'active', epicId: null },
    { id: 'r2', workspaceId: 'ws_a', projectId: 'p_a', reference: 'REQ-002', status: 'active', epicId: null },
    { id: 'r3', workspaceId: 'ws_a', projectId: 'p_a', reference: 'REQ-003', status: 'retired', epicId: null },
    { id: 'rb', workspaceId: 'ws_a', projectId: 'p_b', reference: 'REQ-001', status: 'active', epicId: null },
  ]);
  const specifications = new InMemorySpecificationAssignments([{ id: 's1', workspaceId: 'ws_a', projectId: 'p_a', epicId: null }]);
  const store = new InMemoryEpicStore();
  const service = new EpicService({ store, requirements, specifications, decisions: { decisionsForProject: async () => [] }, gate, audit, now: () => NOW, newId: (() => { let n = 0; return () => `e_${++n}`; })() });
  return { service, store, requirements, specifications, audits };
}

describe('T1564 · create', () => {
  it('allocates the next free number per project, derives a kebab-case slug, and starts active', async () => {
    const { service } = harness();
    const a = await service.create(OWNER, { title: 'Intake & Triage!', description: 'First.' });
    const b = await service.create(OWNER, { title: 'Review' });
    const other = await service.create(OTHER, { title: 'Elsewhere' });
    expect(a).toMatchObject({ number: 1, slug: 'intake-triage', title: 'Intake & Triage!', description: 'First.', status: 'active', parentEpicId: null });
    expect(b).toMatchObject({ number: 2, slug: 'review', description: '' });
    expect(other.number).toBe(1);
  });

  it('keeps the slug to 40 ASCII characters', async () => {
    const { service } = harness();
    const e = await service.create(OWNER, { title: 'Ünïcode ' + 'very long title that goes on and on and on and on and on' });
    expect(e.slug).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(e.slug.endsWith('-')).toBe(false);
  });

  it.each([
    ['empty title', { title: '   ' }],
    ['title over 120', { title: 'x'.repeat(121) }],
  ])('refuses %s naming the field', async (_label, input) => {
    const { service } = harness();
    await expect(service.create(OWNER, input)).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it('is owner-gated: a writer without the grant is refused owner_grant_required and audited', async () => {
    const { service, audits } = harness();
    await expect(service.create(WRITER, { title: 'Nope' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(audits.some((a) => a['action'] === 'access_refused')).toBe(true);
  });

  it('audits the create with actor, project and the Epic', async () => {
    const { service, audits } = harness();
    const e = await service.create(OWNER, { title: 'Intake' });
    expect(audits.at(-1)).toMatchObject({ actorId: 'u_owner', action: 'create', targetType: 'epic', targetId: e.id, outcome: 'success', detail: { operation: 'epic.create', projectId: 'p_a', number: 1 } });
  });
});

describe('T1564 · edit and close', () => {
  it('edit keeps the number, follows the title with the slug, and records before and after', async () => {
    const { service, audits } = harness();
    const e = await service.create(OWNER, { title: 'Intake' });
    const edited = await service.edit(OWNER, e.id, { title: 'Intake and triage', description: 'Both.' });
    expect(edited).toMatchObject({ number: 1, slug: 'intake-and-triage', title: 'Intake and triage', description: 'Both.' });
    expect(audits.at(-1)).toMatchObject({ action: 'update', detail: { operation: 'epic.update', before: { title: 'Intake', slug: 'intake' }, after: { title: 'Intake and triage', slug: 'intake-and-triage' } } });
  });

  it('close sets closedAt; closing again, or closing a split Epic, is epic_not_active; the number is never reused', async () => {
    const { service, store } = harness();
    const e = await service.create(OWNER, { title: 'Intake' });
    const closed = await service.close(OWNER, e.id);
    expect(closed).toMatchObject({ status: 'closed', closedAt: NOW });
    await expect(service.close(OWNER, e.id)).rejects.toMatchObject({ details: { code: 'epic_not_active' } });
    await store.update(e.id, { status: 'split', updatedAt: NOW });
    await expect(service.close(OWNER, e.id)).rejects.toBeInstanceOf(ConflictError);
    const next = await service.create(OWNER, { title: 'Review' });
    expect(next.number).toBe(2);
  });

  it('another project\'s Epic is absence, for reads and writes alike', async () => {
    const { service } = harness();
    const e = await service.create(OTHER, { title: 'Elsewhere' });
    await expect(service.get(OWNER, e.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.edit(OWNER, e.id, { title: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('T1564 · assignment', () => {
  it('assigns a requirement, moves it, unassigns it, and audits before and after', async () => {
    const { service, requirements, audits } = harness();
    const a = await service.create(OWNER, { title: 'Intake' });
    const b = await service.create(OWNER, { title: 'Review' });
    await service.assignRequirement(OWNER, 'r1', a.id);
    expect((await requirements.find('ws_a', 'r1'))?.epicId).toBe(a.id);
    await service.assignRequirement(OWNER, 'r1', b.id);
    expect((await requirements.find('ws_a', 'r1'))?.epicId).toBe(b.id);
    expect(audits.at(-1)).toMatchObject({ action: 'update', targetType: 'requirement', targetId: 'r1', detail: { operation: 'requirement.assign_epic', before: { epicId: a.id }, after: { epicId: b.id } } });
    await service.assignRequirement(OWNER, 'r1', null);
    expect((await requirements.find('ws_a', 'r1'))?.epicId).toBeNull();
  });

  it('refuses assignment to a closed or split Epic (epic_not_active), and to another project\'s Epic (not found)', async () => {
    const { service } = harness();
    const a = await service.create(OWNER, { title: 'Intake' });
    await service.close(OWNER, a.id);
    await expect(service.assignRequirement(OWNER, 'r1', a.id)).rejects.toMatchObject({ details: { code: 'epic_not_active' } });
    const other = await service.create(OTHER, { title: 'Elsewhere' });
    await expect(service.assignRequirement(OWNER, 'r1', other.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.assignRequirement(OWNER, 'rb', a.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('assignment is owner-gated', async () => {
    const { service } = harness();
    const a = await service.create(OWNER, { title: 'Intake' });
    await expect(service.assignRequirement(WRITER, 'r1', a.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('assigns a specification the same way', async () => {
    const { service, specifications, audits } = harness();
    const a = await service.create(OWNER, { title: 'Intake' });
    await service.assignSpecification(OWNER, 's1', a.id);
    expect((await specifications.find('ws_a', 's1'))?.epicId).toBe(a.id);
    expect(audits.at(-1)).toMatchObject({ targetType: 'specification', detail: { operation: 'specification.assign_epic' } });
  });
});

describe('T1564 · list and get', () => {
  it('lists in number order with requirement and specification counts, and the unassigned count; a member reads', async () => {
    const { service } = harness();
    const a = await service.create(OWNER, { title: 'Intake' });
    await service.create(OWNER, { title: 'Review' });
    await service.assignRequirement(OWNER, 'r1', a.id);
    await service.assignSpecification(OWNER, 's1', a.id);
    const listed = await service.list(WRITER);
    expect(listed.epics.map((e) => [e.number, e.requirementCount, e.specificationCount])).toEqual([[1, 1, 1], [2, 0, 0]]);
    // r2 active and unassigned; r3 retired and unassigned — both listed, never omitted (FR-EPB-024).
    expect(listed.unassigned.map((r) => r.reference)).toEqual(['REQ-002', 'REQ-003']);
  });

  it('get returns the Epic with its requirements, specifications, parent and children', async () => {
    const { service } = harness();
    const a = await service.create(OWNER, { title: 'Intake' });
    await service.assignRequirement(OWNER, 'r1', a.id);
    const detail = await service.get(WRITER, a.id);
    expect(detail.requirements.map((r) => r.reference)).toEqual(['REQ-001']);
    expect(detail.children).toEqual([]);
    expect(detail.parent).toBeNull();
  });
});
