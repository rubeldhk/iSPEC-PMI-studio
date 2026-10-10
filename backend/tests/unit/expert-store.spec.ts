/**
 * `T1907` (EPIC-047) — the store cannot rewrite history.
 *
 * `FR-EXP-004`, `FR-EXP-008`, `FR-EXP-055`, `R-047-14`. An approved contract
 * version is immutable, so the store offers no way to change one: the only
 * write after insert is the decision id, and that happens once. Assignments are
 * superseded, never edited. And every read is scoped by workspace, so an
 * Expert in another workspace is indistinguishable from one that is absent.
 */
import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../src/core/errors.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { expert, version } from '../helpers/expert-fixtures.js';

describe('T1907 · the in-memory experts store', () => {
  it('scopes every read by workspace', async () => {
    const store = new InMemoryExpertsStore();
    await store.addExpert(expert());
    await store.addVersion(version());
    expect(await store.findExpert('ws_other', 'ex_test')).toBeNull();
    expect(await store.findExpertByKey('ws_other', 'test-engineer')).toBeNull();
    expect(await store.listExperts('ws_other')).toEqual([]);
    expect(await store.versionsFor('ws_other', 'ex_test')).toEqual([]);
    expect((await store.findExpert('ws_1', 'ex_test'))?.key).toBe('test-engineer');
  });

  it('refuses a second Expert with the same key in one workspace, but not in another', async () => {
    const store = new InMemoryExpertsStore();
    await store.addExpert(expert());
    await expect(store.addExpert(expert({ id: 'ex_2' }))).rejects.toBeInstanceOf(ConflictError);
    await expect(store.addExpert(expert({ id: 'ex_3', workspaceId: 'ws_2' }))).resolves.toBeTruthy();
  });

  it('offers no method that rewrites a contract version', () => {
    const store = new InMemoryExpertsStore() as unknown as Record<string, unknown>;
    expect(Object.keys(Object.getPrototypeOf(store) as object).concat(
      Object.getOwnPropertyNames(Object.getPrototypeOf(store)),
    ).filter((m) => /update.*version|version.*update|setContract/i.test(m))).toEqual([]);
  });

  it('records a decision on a version once, and refuses a second', async () => {
    const store = new InMemoryExpertsStore();
    await store.addExpert(expert());
    await store.addVersion(version());
    await store.recordDecision('ws_1', 'cv_1', 'd_1');
    expect((await store.versionsFor('ws_1', 'ex_test'))[0]?.decisionId).toBe('d_1');
    await expect(store.recordDecision('ws_1', 'cv_1', 'd_2')).rejects.toBeInstanceOf(ConflictError);
  });

  it('returns copies, so a caller mutating a read cannot change the record', async () => {
    const store = new InMemoryExpertsStore();
    await store.addExpert(expert());
    await store.addVersion(version());
    const [read] = await store.versionsFor('ws_1', 'ex_test');
    (read!.contract as { rolePurpose: string }).rolePurpose = 'changed';
    expect((await store.versionsFor('ws_1', 'ex_test'))[0]?.contract.rolePurpose).not.toBe('changed');
  });

  it('retires once, keeping who and when', async () => {
    const store = new InMemoryExpertsStore();
    await store.addExpert(expert());
    await store.retireExpert('ws_1', 'ex_test', 'u_2', '2026-10-10T00:00:00.000Z');
    await store.retireExpert('ws_1', 'ex_test', 'u_3', '2026-10-11T00:00:00.000Z');
    const row = await store.findExpert('ws_1', 'ex_test');
    expect([row?.status, row?.retiredBy, row?.retiredAt]).toEqual(['retired', 'u_2', '2026-10-10T00:00:00.000Z']);
  });

  it('supersedes an assignment once and never edits it otherwise', async () => {
    const store = new InMemoryExpertsStore();
    await store.addAssignment({
      id: 'as_1', workspaceId: 'ws_1', taskId: 't_1', assigneeKind: 'expert', assigneeId: 'ex_test',
      rule: 'capabilities cover the task', state: 'standing', decisionId: null,
      assignedBy: 'u_1', assignedAt: '2026-10-09T09:00:00.000Z', supersededAt: null, supersededBy: null,
    });
    await store.supersedeAssignment('ws_1', 'as_1', 'u_2', '2026-10-10T00:00:00.000Z');
    await expect(store.supersedeAssignment('ws_1', 'as_1', 'u_3', '2026-10-11T00:00:00.000Z')).rejects.toBeInstanceOf(
      ConflictError,
    );
    const [row] = await store.assignmentsFor('ws_1', 't_1');
    expect([row?.supersededBy, row?.assigneeId]).toEqual(['u_2', 'ex_test']);
    expect(await store.assignmentsFor('ws_other', 't_1')).toEqual([]);
  });

  it('keeps one delegation policy per workspace, replacing it whole', async () => {
    const store = new InMemoryExpertsStore();
    expect(await store.policyFor('ws_1')).toBeNull();
    const policy = {
      workspaceId: 'ws_1', maxDepth: 3, maxFanOut: 5, allowedPairs: [], maxUnattendedBand: 'medium' as const,
      updatedBy: 'u_1', updatedAt: '2026-10-09T09:00:00.000Z',
    };
    await store.putPolicy(policy);
    await store.putPolicy({ ...policy, maxDepth: 2 });
    expect((await store.policyFor('ws_1'))?.maxDepth).toBe(2);
    expect(await store.policyFor('ws_2')).toBeNull();
  });
});
