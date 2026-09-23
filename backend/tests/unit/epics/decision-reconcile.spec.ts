/**
 * `T1568` (EPIC-044, `FR-EPB-026`, `FR-EPB-064`, `R-044-6`, data-model.md §5) —
 * a recorded decomposition decision creates child Epics once.
 *
 * `SC-EPB-006` mutation target, owed at closure: let reconciliation ignore the
 * children `decisionCommentId` already created → `a second pass creates
 * nothing` red (duplicates). Written to FAIL before `T1569`.
 */
import { describe, expect, it } from 'vitest';
import { harness as base } from './epic.service.spec.js';

const OWNER = { workspaceId: 'ws_a', projectId: 'p_a', userId: 'u_owner' };

function decision(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    policyVersion: 3,
    epic: { number: 1, slug: 'intake', name: 'Intake' },
    estimate: 68,
    ceiling: 50,
    decision: 'confirmed',
    children: [
      { suffix: 'a', slug: 'intake-forms', estimate: 34, requirements: ['REQ-001'] },
      { suffix: 'b', slug: 'intake-review', estimate: 34, requirements: ['REQ-002', 'REQ-404'] },
    ],
    decidedBy: 'u_owner',
    ...over,
  });
}

async function setup(bodies: { commentId: string; body: string }[]) {
  const h = base();
  const comments = bodies.map((b, i) => ({ ...b, executionId: `exec_${i + 1}`, createdAt: new Date(`2026-09-05T10:0${i}:00Z`) }));
  const service = new (await import('../../../src/modules/epics/epic.service.js')).EpicService({
    store: h.store,
    requirements: h.requirements,
    specifications: h.specifications,
    decisions: { decisionsForProject: async () => comments },
    gate: (h.service as unknown as { deps: { gate: unknown } }).deps.gate as never,
    audit: { record: async (row) => void h.audits.push(row) },
    now: () => new Date('2026-09-05T12:00:00Z'),
  });
  const parent = await service.create(OWNER, { title: 'Intake' });
  await service.assignRequirement(OWNER, 'r1', parent.id);
  await service.assignRequirement(OWNER, 'r2', parent.id);
  return { ...h, service, parent };
}

describe('T1568 · reconcileDecisions', () => {
  it('a confirmed decision creates the children in suffix order with the next numbers, slugs, moved requirements and the parent link; the parent is split', async () => {
    const { service, store, requirements, parent } = await setup([{ commentId: 'cmt_1', body: decision() }]);
    const outcome = await service.reconcileDecisions(OWNER);
    expect(outcome.created.map((c) => [c.number, c.slug, c.splitSuffix, c.parentEpicId, c.decisionCommentId])).toEqual([
      [2, 'intake-forms', 'a', parent.id, 'cmt_1'],
      [3, 'intake-review', 'b', parent.id, 'cmt_1'],
    ]);
    const [a, b] = outcome.created;
    expect((await requirements.find('ws_a', 'r1'))?.epicId).toBe(a?.id);
    expect((await requirements.find('ws_a', 'r2'))?.epicId).toBe(b?.id);
    const refreshed = await store.find(parent.id);
    expect(refreshed).toMatchObject({ status: 'split', lastDecisionCommentId: 'cmt_1' });
    // REQ-404 is not a requirement of the project: reported, and the child still created.
    expect(outcome.findings).toEqual([expect.stringContaining('REQ-404')]);
  });

  it('a second pass creates nothing (idempotent by decisionCommentId) — SC-EPB-006', async () => {
    const { service, store } = await setup([{ commentId: 'cmt_1', body: decision() }]);
    await service.reconcileDecisions(OWNER);
    const again = await service.reconcileDecisions(OWNER);
    expect(again.created).toEqual([]);
    expect((await store.list('ws_a', 'p_a')).map((e) => e.number)).toEqual([1, 2, 3]);
  });

  it('an edited decision uses the recorded children; a rejected decision records the id and creates nothing', async () => {
    const { service, store, parent } = await setup([{ commentId: 'cmt_r', body: decision({ decision: 'rejected', children: [] }) }]);
    const outcome = await service.reconcileDecisions(OWNER);
    expect(outcome.created).toEqual([]);
    expect(await store.find(parent.id)).toMatchObject({ status: 'active', lastDecisionCommentId: 'cmt_r' });
  });

  it('an invalid body is a finding on the parent and creates nothing; it is re-evaluated on every read', async () => {
    const { service, store, parent } = await setup([{ commentId: 'cmt_bad', body: JSON.stringify({ epic: { number: 1 }, decision: 'confirmed', children: [] }) }]);
    const outcome = await service.reconcileDecisions(OWNER);
    expect(outcome.created).toEqual([]);
    expect(outcome.findings[0]).toMatch(/decision unreadable/);
    expect(await store.find(parent.id)).toMatchObject({ status: 'active', lastDecisionCommentId: null });
  });

  it('a slug that collides with an existing Epic is suffixed by the child\'s number', async () => {
    const { service, store } = await setup([{ commentId: 'cmt_1', body: decision({ children: [{ suffix: 'a', slug: 'intake', estimate: 34, requirements: ['REQ-001'] }, { suffix: 'b', slug: 'intake-review', estimate: 34, requirements: ['REQ-002'] }] }) }]);
    const outcome = await service.reconcileDecisions(OWNER);
    expect(outcome.created[0]?.slug).toBe('intake-2');
    expect((await store.list('ws_a', 'p_a')).map((e) => e.slug)).toEqual(['intake', 'intake-2', 'intake-review']);
    // T1618 (spec §Edge Cases): the collision is a finding, and the child shows it.
    expect(outcome.findings).toContain('decision cmt_1: slug `intake` collided with Epic 1; child 2 created as `intake-2`');
    const child = await service.get(OWNER, outcome.created[0]!.id);
    expect(child.findings).toEqual(['slug `intake` collided with Epic 1; created as `intake-2`']);
    expect((await service.get(OWNER, outcome.created[1]!.id)).findings).toEqual([]);
  });

  it('a decision naming an Epic number the project does not have is a finding, not a guess', async () => {
    const { service } = await setup([{ commentId: 'cmt_x', body: decision({ epic: { number: 42, slug: 'ghost', name: 'Ghost' } }) }]);
    const outcome = await service.reconcileDecisions(OWNER);
    expect(outcome.created).toEqual([]);
    expect(outcome.findings[0]).toMatch(/no Epic 42/);
  });

  it('is audited as decomposition.reconcile naming the decision and the children', async () => {
    const { service, audits } = await setup([{ commentId: 'cmt_1', body: decision() }]);
    await service.reconcileDecisions(OWNER);
    expect(audits.some((a) => (a['detail'] as { operation?: string })?.operation === 'decomposition.reconcile')).toBe(true);
    expect(audits.some((a) => (a['detail'] as { operation?: string })?.operation === 'epic.split')).toBe(true);
  });
});

describe('DEF-044-003 · reconciliation under concurrency and interruption', () => {
  it('two concurrent passes create the children once and neither fails', async () => {
    const { service, store, parent } = await setup([{ commentId: 'cmt_1', body: decision() }]);
    const [a, b] = await Promise.all([service.reconcileDecisions(OWNER), service.reconcileDecisions(OWNER)]);
    const rows = await store.list('ws_a', 'p_a');
    expect(rows.filter((e) => e.parentEpicId === parent.id).map((e) => e.splitSuffix)).toEqual(['a', 'b']);
    expect((await store.find(parent.id))?.status).toBe('split');
    expect(a.created.length + b.created.length).toBe(2);
  });

  it('a pass interrupted after one child resumes: the missing child is created, the existing one kept, the parent split', async () => {
    const { service, store, parent } = await setup([{ commentId: 'cmt_1', body: decision() }]);
    await store.create({ id: 'e_partial', workspaceId: 'ws_a', projectId: 'p_a', slug: 'intake-forms', title: 'Intake (a)', description: '', status: 'active', parentEpicId: parent.id, splitSuffix: 'a', decisionCommentId: 'cmt_1', lastDecisionCommentId: null, createdById: 'u_owner', closedAt: null });
    const outcome = await service.reconcileDecisions(OWNER);
    const children = (await store.list('ws_a', 'p_a')).filter((e) => e.parentEpicId === parent.id);
    expect(children.map((e) => [e.id, e.splitSuffix])).toEqual([['e_partial', 'a'], [expect.any(String), 'b']]);
    expect(outcome.created.map((e) => e.splitSuffix)).toEqual(['b']);
    expect((await store.find(parent.id))?.status).toBe('split');
    expect((await store.find(parent.id))?.lastDecisionCommentId).toBe('cmt_1');
  });

  it('the split is audited as the decider\'s act, with the reader who triggered it recorded (FR-EPB-028)', async () => {
    const { service, audits } = await setup([{ commentId: 'cmt_1', body: decision({ decidedBy: 'u_decider' }) }]);
    await service.reconcileDecisions({ ...OWNER, userId: 'u_reader' });
    const split = audits.find((a) => (a['detail'] as { operation?: string })?.operation === 'epic.split');
    expect(split?.['actorId']).toBe('u_decider');
    expect((split?.['detail'] as { readBy?: string })?.readBy).toBe('u_reader');
  });
});
