/**
 * `T1479` (EPIC-042, `FR-EXT-021`, data-model.md §1) — owner-authored entries
 * the constitution is rendered from: create, edit (version + 1), reorder,
 * retire (status only, never delete), list by kind and status; validation.
 *
 * Written to FAIL before `T1480`.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError, NotFoundError } from '../../../src/core/errors.js';
import { ProjectConstraintService } from '../../../src/modules/governance/project-constraint.service.js';
import { InMemoryProjectConstraintStore } from '../../../src/modules/governance/project-constraint.store.js';

const NOW = new Date('2026-09-04T12:00:00Z');
const CTX = { workspaceId: 'ws_a', projectId: 'p_a', userId: 'u_owner' };

function harness() {
  const audits: Record<string, unknown>[] = [];
  const service = new ProjectConstraintService({
    store: new InMemoryProjectConstraintStore(),
    audit: { record: async (row) => void audits.push(row) },
    now: () => NOW,
  });
  return { service, audits };
}

describe('T1479 · create', () => {
  it('creates an entry of a kind with order = max + 1 within that kind, version 1, active', async () => {
    const { service } = harness();
    const a = await service.create(CTX, { kind: 'principle', title: 'Spec first', body: 'Write it down.' });
    const b = await service.create(CTX, { kind: 'principle', title: 'Then build', body: 'Only then.' });
    const c = await service.create(CTX, { kind: 'constraint', title: 'Postgres 16', body: 'Nothing else.' });
    expect(a).toMatchObject({ kind: 'principle', order: 1, version: 1, status: 'active' });
    expect(b.order).toBe(2);
    expect(c.order).toBe(1);
  });

  it('honours an explicit order', async () => {
    const { service } = harness();
    const a = await service.create(CTX, { kind: 'non_goal', title: 'No mobile', body: '', order: 7 });
    expect(a.order).toBe(7);
  });

  it.each([
    ['kind outside the three', { kind: 'rule', title: 'x', body: 'y' }, 'kind'],
    ['empty title', { kind: 'principle', title: '', body: 'y' }, 'title'],
    ['title over 120', { kind: 'principle', title: 'x'.repeat(121), body: 'y' }, 'title'],
    ['body over 20 000', { kind: 'principle', title: 'x', body: 'y'.repeat(20_001) }, 'body'],
  ])('refuses %s naming the field', async (_label, input, field) => {
    const { service } = harness();
    const err = await service.create(CTX, input as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    expect(JSON.stringify((err as ValidationFailedError).details)).toContain(field);
  });

  it('writes an audit entry naming actor, project, operation and the entry', async () => {
    const { service, audits } = harness();
    const a = await service.create(CTX, { kind: 'principle', title: 'Spec first', body: 'Write it down.' });
    expect(audits[0]).toMatchObject({ workspaceId: 'ws_a', actorId: 'u_owner', action: 'create', targetType: 'project_constraint', targetId: a.id, outcome: 'success', detail: { projectId: 'p_a', operation: 'constraint.create' } });
  });
});

describe('T1479 · edit, reorder, retire', () => {
  it('edit bumps the version and keeps the rest', async () => {
    const { service } = harness();
    const a = await service.create(CTX, { kind: 'principle', title: 'Spec first', body: 'Write it down.' });
    const edited = await service.edit(CTX, a.id, { body: 'Write it down, then build.' });
    expect(edited).toMatchObject({ id: a.id, version: 2, title: 'Spec first', body: 'Write it down, then build.' });
  });

  it('reorder changes the order only', async () => {
    const { service } = harness();
    const a = await service.create(CTX, { kind: 'principle', title: 'A', body: '' });
    const b = await service.create(CTX, { kind: 'principle', title: 'B', body: '' });
    await service.edit(CTX, b.id, { order: 1 });
    await service.edit(CTX, a.id, { order: 2 });
    const list = await service.list(CTX, { kind: 'principle' });
    expect(list.map((e) => e.title)).toEqual(['B', 'A']);
  });

  it('retire sets status retired and never deletes', async () => {
    const { service } = harness();
    const a = await service.create(CTX, { kind: 'principle', title: 'A', body: '' });
    const retired = await service.retire(CTX, a.id);
    expect(retired.status).toBe('retired');
    expect(await service.list(CTX, { status: 'retired' })).toHaveLength(1);
    expect(await service.list(CTX, { status: 'active' })).toHaveLength(0);
    expect(await service.list(CTX, {})).toHaveLength(1);
  });

  it('an id of another project is not found, never revealed', async () => {
    const { service } = harness();
    const a = await service.create(CTX, { kind: 'principle', title: 'A', body: '' });
    await expect(service.edit({ ...CTX, projectId: 'p_b' }, a.id, { body: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.retire({ ...CTX, projectId: 'p_b' }, a.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('T1479 · list', () => {
  it('lists by kind in order, active by default filter none', async () => {
    const { service } = harness();
    await service.create(CTX, { kind: 'constraint', title: 'C1', body: '' });
    await service.create(CTX, { kind: 'principle', title: 'P1', body: '' });
    await service.create(CTX, { kind: 'principle', title: 'P2', body: '' });
    const principles = await service.list(CTX, { kind: 'principle' });
    expect(principles.map((e) => e.title)).toEqual(['P1', 'P2']);
    const all = await service.list(CTX, {});
    expect(all).toHaveLength(3);
    expect(await service.list({ ...CTX, projectId: 'p_b' }, {})).toEqual([]);
  });
});
