/**
 * `T1793` (EPIC-046, `quickstart.md` scenario 18, `FR-KAN-032`) — the tasks
 * nobody can attach to an Epic are still shown.
 *
 * ## What the third convergence pass found
 *
 * `TaskSyncStore.unboundSyncs` existed on both stores, was exercised by two
 * tests, and was called by **no production code**. So an execution whose target
 * names no Epic of the project stores its tasks correctly — `T1711` proves that
 * — and they appear on no screen at all. Stored, correct, and invisible.
 *
 * `FR-EPB-008`'s rule, which this Epic inherits: an unbound execution is
 * **listed, never attached**. `EPIC-045` did the artifact half on the Spec
 * Journey Board (`T1683`); the task half was specified in the quickstart and
 * never built.
 *
 * ## Why this read is per PROJECT and not per Epic
 *
 * There is no Epic to hang it on. That is the whole condition. A board read
 * keyed by Epic can never surface a sync that belongs to none, which is exactly
 * how it stayed invisible through three passes of checking Epic-scoped reads.
 *
 * Written to FAIL before the projection exists.
 */
import { describe, expect, it, vi } from 'vitest';
import { TaskBoardService } from '../../../src/modules/task-sync/task-board.service.js';
import {
  InMemoryTaskSyncStore,
  type NewTaskSync,
  type NewTaskSyncLine,
} from '../../../src/modules/task-sync/task-sync.store.js';

const WS = 'ws_a';
const PROJECT = 'p_a';

function sync(over: Partial<NewTaskSync> = {}): NewTaskSync {
  return {
    workspaceId: WS, projectId: PROJECT, epicId: null, executionId: 'x_1', actorId: 'cred_1',
    idempotencyKey: 'k1', tasksDigest: 'abc123def456', linesConsidered: 3, parsed: 2, refused: 1,
    duplicates: 0, added: 2, changed: 0, unchanged: 0, disappeared: 0, outOfBandEdit: false, ...over,
  };
}

function line(over: Partial<NewTaskSyncLine> = {}): NewTaskSyncLine {
  return {
    lineNumber: 1, rawText: '- [ ] T1 Do the thing', outcome: 'parsed', refusalCode: null,
    taskKey: 'T1', changeKind: 'added', previousStatus: null, newStatus: 'not_started', marker: null, ...over,
  };
}

async function seeded(syncs: NewTaskSync[] = [sync()]) {
  const store = new InMemoryTaskSyncStore();
  for (const s of syncs) await store.recordSync(s, [line(), line({ lineNumber: 2, taskKey: 'T2' })]);
  const service = new TaskBoardService({
    store,
    executions: { find: vi.fn(async () => ({ command: 'tasks', state: 'completed' })) },
  } as never);
  return { store, service };
}

describe('T1793 · the unbound task syncs (FR-KAN-032)', () => {
  it('lists a sync whose execution names no Epic of the project', async () => {
    const { service } = await seeded();
    const found = await service.unbound(WS, PROJECT);
    expect(found.projectId).toBe(PROJECT);
    expect(found.syncs).toHaveLength(1);
    expect(found.syncs[0]).toMatchObject({ executionId: 'x_1', tasksDigest: 'abc123def456' });
  });

  it('names the counts, so a reader can see what was parsed without opening it', async () => {
    const { service } = await seeded();
    const found = await service.unbound(WS, PROJECT);
    expect(found.syncs[0]?.counts).toEqual({ linesConsidered: 3, parsed: 2, refused: 1, duplicates: 0 });
  });

  it('names the task identifiers it parsed — the point is seeing what is stranded', async () => {
    const { service } = await seeded();
    const found = await service.unbound(WS, PROJECT);
    expect(found.syncs[0]?.taskKeys).toEqual(['T1', 'T2']);
  });

  it('lists newest first, so the most recent stranded run is the one in view', async () => {
    const { service } = await seeded([
      sync({ executionId: 'x_old', idempotencyKey: 'k_old' }),
      sync({ executionId: 'x_new', idempotencyKey: 'k_new' }),
    ]);
    const found = await service.unbound(WS, PROJECT);
    expect(found.syncs.map((s) => s.executionId)).toEqual(['x_new', 'x_old']);
  });

  it('returns an empty list for a project whose every sync found its Epic', async () => {
    const { service } = await seeded([sync({ epicId: 'e_1' })]);
    const found = await service.unbound(WS, PROJECT);
    expect(found.syncs).toEqual([]);
  });

  it('never attaches them to an Epic — listed is the whole of what happens (FR-EPB-008)', async () => {
    const { store, service } = await seeded();
    await service.unbound(WS, PROJECT);
    // Reading the list changes nothing: the sync is still unbound afterwards.
    expect((await store.unboundSyncs(WS, PROJECT))).toHaveLength(1);
  });

  it('does not leak another project sync', async () => {
    const { service } = await seeded([sync(), sync({ projectId: 'p_other', executionId: 'x_2', idempotencyKey: 'k2' })]);
    const found = await service.unbound(WS, PROJECT);
    expect(found.syncs).toHaveLength(1);
    expect(found.syncs[0]?.executionId).toBe('x_1');
  });
});
