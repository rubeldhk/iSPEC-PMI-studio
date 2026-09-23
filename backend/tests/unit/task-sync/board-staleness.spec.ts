/**
 * `T1772` (EPIC-046, `FR-KAN-048`) — the board says when it is behind.
 *
 * ## The case this exists for
 *
 * A governed command that ran while PMI Studio was unreachable is recorded
 * **provisionally** and syncs nothing — `runFinish` skips every sync for such a
 * run. So the Epic has a newer execution than its newest parse, and a reader
 * looking at the board has no way to know that unless the board says so.
 *
 * The requester ruled on this on 2026-09-06 (`Q5`): no tasks are synced for a
 * provisional run, the next governed command's sync brings the board level, and
 * **the board states when its latest parse is older than the Epic's latest
 * execution**. Replay of a provisional run's task sync waits for `EPIC-037`'s
 * provisional intake and is out of scope here.
 *
 * A stale board is not a wrong board. It is an out-of-date one, and the
 * difference matters: nothing is guessed, nothing is partially parsed, and the
 * only thing added is the sentence that stops a reader trusting it as current.
 *
 * Written to FAIL before `T1773`.
 */
import { describe, expect, it, vi } from 'vitest';
import { TaskBoardService } from '../../../src/modules/task-sync/task-board.service.js';
import {
  InMemoryTaskSyncStore,
  type NewSyncedTask,
  type NewTaskSync,
  type NewTaskSyncLine,
} from '../../../src/modules/task-sync/task-sync.store.js';

const WS = 'ws_a';
const EPIC = 'e_1';

function task(): NewSyncedTask {
  return {
    workspaceId: WS, epicId: EPIC, specificationId: null, taskKey: 'T1',
    description: 'Do the thing', status: 'not_started', statusSource: 'parse',
    engineName: 'claude', engineVersion: '1', sourceLine: 1, sourceDigest: 'abc',
    parallel: false, sourcePaths: [], presentInLatestParse: true,
    lastParsedExecutionId: 'x_1', lastMovedAt: null, lastMovedBy: null,
  };
}

function sync(over: Partial<NewTaskSync> = {}): NewTaskSync {
  return {
    workspaceId: WS, projectId: 'p_a', epicId: EPIC, executionId: 'x_1', actorId: 'cred_1',
    idempotencyKey: 'k1', tasksDigest: 'abc', linesConsidered: 1, parsed: 1, refused: 0,
    duplicates: 0, added: 1, changed: 0, unchanged: 0, disappeared: 0, outOfBandEdit: false, ...over,
  };
}

function line(): NewTaskSyncLine {
  return {
    lineNumber: 1, rawText: '- [ ] T1 Do the thing', outcome: 'parsed', refusalCode: null,
    taskKey: 'T1', changeKind: 'added', previousStatus: null, newStatus: 'not_started', marker: null,
  };
}

async function seeded(latestExecution: { executionId: string; command: string; at: string } | null, opts: { synced?: boolean } = {}) {
  const store = new InMemoryTaskSyncStore();
  await store.upsertTask(task());
  if (opts.synced !== false) await store.recordSync(sync(), [line()]);
  const service = new TaskBoardService({
    store,
    runs: { latestForEpic: vi.fn(async () => latestExecution) },
  });
  return { store, service };
}

describe('T1772 · the board is behind (FR-KAN-048)', () => {
  it('says so when an execution completed after the latest parse', async () => {
    // The provisional case: a run happened and synced nothing.
    const { service } = await seeded({ executionId: 'x_9', command: 'implement', at: '2999-01-01T00:00:00.000Z' });
    const board = await service.board(WS, EPIC);
    expect(board.staleness).not.toBeNull();
    expect(board.staleness).toMatchObject({ executionId: 'x_9', command: 'implement' });
  });

  it('names both times, so a reader can see the gap rather than take it on trust', async () => {
    const { service } = await seeded({ executionId: 'x_9', command: 'implement', at: '2999-01-01T00:00:00.000Z' });
    const board = await service.board(WS, EPIC);
    expect(board.staleness?.executionAt).toBe('2999-01-01T00:00:00.000Z');
    expect(board.staleness?.parsedAt).toEqual(board.latestParse?.syncedAt);
  });

  it('does NOT guess or partially parse anything — the rows are exactly what the parse left', async () => {
    const { store, service } = await seeded({ executionId: 'x_9', command: 'implement', at: '2999-01-01T00:00:00.000Z' });
    const before = await store.tasksForEpic(WS, EPIC);
    await service.board(WS, EPIC);
    expect(await store.tasksForEpic(WS, EPIC)).toEqual(before);
  });
});

describe('T1772 · the board is current', () => {
  it('reports no staleness when the latest execution is the one that parsed', async () => {
    const { service, store } = await seeded(null);
    const latest = await store.latestSyncForEpic(WS, EPIC);
    const service2 = new TaskBoardService({
      store,
      runs: { latestForEpic: vi.fn(async () => ({ executionId: 'x_1', command: 'tasks', at: latest!.syncedAt.toISOString() })) },
    });
    expect((await service2.board(WS, EPIC)).staleness).toBeNull();
    expect((await service.board(WS, EPIC)).staleness).toBeNull();
  });

  it('reports no staleness when an execution predates the latest parse', async () => {
    const { service } = await seeded({ executionId: 'x_0', command: 'specify', at: '2000-01-01T00:00:00.000Z' });
    expect((await service.board(WS, EPIC)).staleness).toBeNull();
  });

  it('reports no staleness when nothing has synced at all — that is the empty state, not a stale one', async () => {
    const { service } = await seeded({ executionId: 'x_9', command: 'implement', at: '2999-01-01T00:00:00.000Z' }, { synced: false });
    const board = await service.board(WS, EPIC);
    expect(board.latestParse).toBeNull();
    expect(board.staleness).toBeNull();
  });

  it('reports no staleness when no run source is wired — absence is not a claim', async () => {
    const store = new InMemoryTaskSyncStore();
    await store.upsertTask(task());
    await store.recordSync(sync(), [line()]);
    expect((await new TaskBoardService({ store }).board(WS, EPIC)).staleness).toBeNull();
  });
});
