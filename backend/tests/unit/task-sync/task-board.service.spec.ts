/**
 * `T1712` (EPIC-046, data-model.md §8, `contracts/board-contract.md`) — the
 * board projection.
 *
 * Everything the board shows is derived on read: the columns, the header naming
 * the latest parse, the counts, the refused lines. Nothing is stored as a board
 * (`FR-KAN-056`), and nothing here loads a `tasks.md` — the content lives in
 * `EPIC-045`'s artifact store and the board has no business fetching it.
 *
 * Written to FAIL before `T1713`.
 */
import { describe, expect, it } from 'vitest';
import { TaskBoardService } from '../../../src/modules/task-sync/task-board.service.js';
import {
  InMemoryTaskSyncStore,
  type NewSyncedTask,
  type NewTaskSync,
  type NewTaskSyncLine,
  type StatusSource,
  type TaskStatusValue,
} from '../../../src/modules/task-sync/task-sync.store.js';

const WS = 'ws_a';
const EPIC = 'e_1';

function task(over: Partial<NewSyncedTask> = {}): NewSyncedTask {
  return {
    workspaceId: WS,
    epicId: EPIC,
    specificationId: null,
    taskKey: 'T1',
    description: 'Do the thing in `a/b.ts`',
    status: 'not_started',
    statusSource: 'parse',
    engineName: 'claude',
    engineVersion: '1.2.3',
    sourceLine: 1,
    sourceDigest: 'abc',
    parallel: false,
    sourcePaths: ['a/b.ts'],
    presentInLatestParse: true,
    lastParsedExecutionId: 'x_1',
    lastMovedAt: null,
    lastMovedBy: null,
    ...over,
  };
}

function sync(over: Partial<NewTaskSync> = {}): NewTaskSync {
  return {
    workspaceId: WS,
    projectId: 'p_a',
    epicId: EPIC,
    executionId: 'x_1',
    actorId: 'cred_1',
    idempotencyKey: 'k1',
    tasksDigest: 'abc',
    linesConsidered: 3,
    parsed: 1,
    refused: 1,
    duplicates: 1,
    added: 1,
    changed: 0,
    unchanged: 0,
    disappeared: 0,
    outOfBandEdit: false,
    ...over,
  };
}

function line(over: Partial<NewTaskSyncLine> = {}): NewTaskSyncLine {
  return {
    lineNumber: 1,
    rawText: '- [ ] T1 Do the thing in `a/b.ts`',
    outcome: 'parsed',
    refusalCode: null,
    taskKey: 'T1',
    changeKind: 'added',
    previousStatus: null,
    newStatus: 'not_started',
    marker: null,
    ...over,
  };
}

async function seeded(opts: { tasks?: NewSyncedTask[]; sync?: NewTaskSync | null; lines?: NewTaskSyncLine[] } = {}) {
  const store = new InMemoryTaskSyncStore();
  for (const t of opts.tasks ?? [task()]) await store.upsertTask(t);
  if (opts.sync !== null) await store.recordSync(opts.sync ?? sync(), opts.lines ?? [line()]);
  return { store, service: new TaskBoardService({ store }) };
}

describe('T1712 · the board projection', () => {
  describe('the columns (FR-KAN-051)', () => {
    it('returns the four columns in the order the contract names', async () => {
      const { service } = await seeded();
      const board = await service.board(WS, EPIC);
      expect(board.columns.map((c) => c.status)).toEqual(['not_started', 'in_progress', 'done', 'blocked']);
    });

    it('puts every task in exactly one column', async () => {
      const statuses: TaskStatusValue[] = ['not_started', 'in_progress', 'done', 'blocked'];
      const { service } = await seeded({
        tasks: statuses.map((status, i) => task({ taskKey: `T${i + 1}`, sourceLine: i + 1, status, statusSource: status === 'not_started' ? 'parse' : 'proposal' })),
      });
      const board = await service.board(WS, EPIC);
      expect(board.columns.map((c) => c.taskKeys.length)).toEqual([1, 1, 1, 1]);
      const placed = board.columns.flatMap((c) => c.taskKeys);
      expect(new Set(placed).size).toBe(4);
      expect(placed).toHaveLength(board.tasks.length);
    });

    it('keeps an empty column rather than dropping it', async () => {
      const { service } = await seeded();
      const board = await service.board(WS, EPIC);
      expect(board.columns).toHaveLength(4);
      expect(board.columns.find((c) => c.status === 'blocked')?.taskKeys).toEqual([]);
    });
  });

  describe('the cards (FR-KAN-054)', () => {
    it('carry the identifier, description, marker, source line, paths and what last moved them', async () => {
      const movedAt = new Date('2026-09-07T10:00:00.000Z');
      const { service } = await seeded({
        tasks: [task({ parallel: true, status: 'in_progress', statusSource: 'proposal', lastMovedAt: movedAt, lastMovedBy: 'u_1' })],
      });
      const [card] = (await service.board(WS, EPIC)).tasks;
      expect(card).toMatchObject({
        taskKey: 'T1',
        description: 'Do the thing in `a/b.ts`',
        parallel: true,
        sourceLine: 1,
        status: 'in_progress',
        movedBy: 'proposal',
        movedByActorId: 'u_1',
      });
      expect(card?.sourcePaths).toEqual(['a/b.ts']);
      expect(card?.movedAt).toEqual(movedAt);
    });

    it.each<[StatusSource, string]>([
      ['parse', 'parse'],
      ['event', 'event'],
      ['proposal', 'proposal'],
      ['engine', 'engine'],
    ])('names %s as what moved the card', async (source, expected) => {
      const { service } = await seeded({ tasks: [task({ statusSource: source })] });
      expect((await service.board(WS, EPIC)).tasks[0]?.movedBy).toBe(expected);
    });

    it('marks a task the latest parse no longer contains, and still lists it (FR-KAN-025)', async () => {
      const { service } = await seeded({ tasks: [task(), task({ taskKey: 'T2', sourceLine: 2, presentInLatestParse: false })] });
      const board = await service.board(WS, EPIC);
      expect(board.tasks).toHaveLength(2);
      expect(board.tasks.find((t) => t.taskKey === 'T2')?.notInLatestParse).toBe(true);
      expect(board.tasks.find((t) => t.taskKey === 'T1')?.notInLatestParse).toBe(false);
    });
  });

  describe('the header (FR-KAN-052)', () => {
    it('names the execution, digest, time and counts of the latest parse', async () => {
      const { service } = await seeded();
      const board = await service.board(WS, EPIC);
      expect(board.latestParse).toMatchObject({ executionId: 'x_1', digest: 'abc' });
      // Absent reader means UNKNOWN, not a fabricated outcome.
      expect(board.latestParse?.command).toBeNull();
      expect(board.latestParse?.outcome).toBeNull();
      expect(board.latestParse?.syncedAt).toBeInstanceOf(Date);
      expect(board.counts).toEqual({ linesConsidered: 3, parsed: 1, refused: 1, duplicates: 1 });
      expect(board.diff).toEqual({ added: 1, changed: 0, unchanged: 0, disappeared: 0 });
    });

    it('reports the NEWEST sync when several exist', async () => {
      const { store, service } = await seeded();
      await store.recordSync(sync({ idempotencyKey: 'k2', tasksDigest: 'def', executionId: 'x_2' }), [line()]);
      expect((await service.board(WS, EPIC)).latestParse?.digest).toBe('def');
    });

    it('is null before any sync, and the counts are zero — distinct from a file with no task lines', async () => {
      const { service } = await seeded({ tasks: [], sync: null });
      const board = await service.board(WS, EPIC);
      expect(board.latestParse).toBeNull();
      expect(board.counts).toEqual({ linesConsidered: 0, parsed: 0, refused: 0, duplicates: 0 });
      expect(board.tasks).toEqual([]);
    });

    it('distinguishes a synced file that contains no task lines', async () => {
      const { service } = await seeded({ tasks: [], sync: sync({ linesConsidered: 0, parsed: 0, refused: 0, duplicates: 0, added: 0 }), lines: [] });
      const board = await service.board(WS, EPIC);
      // A sync happened; it just found nothing. US1 scenario 5's second state.
      expect(board.latestParse).not.toBeNull();
      expect(board.counts.linesConsidered).toBe(0);
      expect(board.tasks).toEqual([]);
    });

    it('surfaces an out-of-band edit (FR-KAN-023)', async () => {
      const { service } = await seeded({ sync: sync({ outOfBandEdit: true }) });
      expect((await service.board(WS, EPIC)).outOfBandEdit).toBe(true);
    });
  });

  describe('the refused lines (FR-KAN-003, contracts §2a)', () => {
    it('lists them with number, text and code', async () => {
      const { service } = await seeded({
        lines: [
          line(),
          line({ lineNumber: 2, rawText: '- [ ] Tidy up', outcome: 'refused', refusalCode: 'identifier_not_matched', taskKey: null, changeKind: null, newStatus: null }),
          line({ lineNumber: 3, rawText: '- [ ] T1 Again', outcome: 'duplicate', refusalCode: 'duplicate_identifier', changeKind: null, newStatus: null }),
        ],
      });
      const board = await service.board(WS, EPIC);
      expect(board.refusedLines).toHaveLength(2);
      expect(board.refusedLines.map((r) => r.code).sort()).toEqual(['duplicate_identifier', 'identifier_not_matched']);
      expect(board.refusedLines.every((r) => r.line > 0 && r.text.length > 0)).toBe(true);
    });

    it('is empty when the parse read every line', async () => {
      const { service } = await seeded();
      expect((await service.board(WS, EPIC)).refusedLines).toEqual([]);
    });
  });

  describe('what the board must NOT do', () => {
    it('loads no tasks.md content — the board reads rows, not files', async () => {
      const { store, service } = await seeded();
      // The store has no content method at all; asserting the absence is the
      // point, because a later "convenience" read is exactly how SC-KAN-007
      // would quietly regress.
      expect((store as unknown as Record<string, unknown>)['contentFor']).toBeUndefined();
      const board = await service.board(WS, EPIC);
      expect(Object.keys(board)).not.toContain('tasksMarkdown');
    });

    it('refuses another workspace as absence (FR-KAN-074)', async () => {
      const { service } = await seeded();
      const board = await service.board('ws_other', EPIC);
      expect(board.tasks).toEqual([]);
      expect(board.latestParse).toBeNull();
    });
  });
});

describe('T1727 · the run and what it left (FR-KAN-044, FR-KAN-045)', () => {
  it('counts the tasks still unchecked, from the rows', async () => {
    const { service } = await seeded({
      tasks: [task({ taskKey: 'T1' }), task({ taskKey: 'T2', sourceLine: 2, status: 'done' }), task({ taskKey: 'T3', sourceLine: 3 })],
    });
    expect((await service.board(WS, EPIC)).remainingUnchecked).toBe(2);
  });

  it('excludes a task the latest parse no longer contains', async () => {
    const { service } = await seeded({
      tasks: [task({ taskKey: 'T1' }), task({ taskKey: 'T2', sourceLine: 2, presentInLatestParse: false })],
    });
    expect((await service.board(WS, EPIC)).remainingUnchecked).toBe(1);
  });

  it('lists the unmatched progress reports when an event source is present', async () => {
    const store = new InMemoryTaskSyncStore();
    await store.upsertTask(task());
    await store.recordSync(sync(), [line()]);
    const report = { executionId: 'x_9', taskId: 'not-an-identifier', occurredAt: '2026-09-07T10:00:00.000Z', emittedBy: 'cred_1' };
    const service = new TaskBoardService({ store, events: { unmatched: async () => [report] } });
    expect((await service.board(WS, EPIC)).unmatchedProgress).toEqual([report]);
  });

  it('is empty rather than absent when there is no event source', async () => {
    const { service } = await seeded();
    expect((await service.board(WS, EPIC)).unmatchedProgress).toEqual([]);
  });
});

describe('T1728 · the run behind the latest parse (FR-KAN-044, FR-KAN-045)', () => {
  it('names the command and its outcome when the execution can be read', async () => {
    const store = new InMemoryTaskSyncStore();
    await store.upsertTask(task());
    await store.recordSync(sync(), [line()]);
    const service = new TaskBoardService({
      store,
      executions: {
        find: async () => ({
          executionId: 'x_1', workspaceId: WS, projectId: 'p_a', command: 'implement', initiatorId: 'u_1',
          state: 'partially-completed', registeredAt: '', completedAt: null, completionComment: null,
          targetType: 'epic', targetId: '3', agentAdapter: null, agentVersion: null,
        }),
      },
    });
    const board = await service.board(WS, EPIC);
    expect(board.latestParse).toMatchObject({ command: 'implement', outcome: 'partially-completed' });
  });

  it('does not let a terminal outcome move a card (FR-KAN-045)', async () => {
    const store = new InMemoryTaskSyncStore();
    await store.upsertTask(task());
    await store.recordSync(sync(), [line()]);
    const service = new TaskBoardService({
      store,
      executions: {
        find: async () => ({
          executionId: 'x_1', workspaceId: WS, projectId: 'p_a', command: 'implement', initiatorId: 'u_1',
          state: 'completed', registeredAt: '', completedAt: null, completionComment: null,
          targetType: 'epic', targetId: '3', agentAdapter: null, agentVersion: null,
        }),
      },
    });
    const board = await service.board(WS, EPIC);
    // The run says `completed`; the file says the task is not ticked. The file wins.
    expect(board.latestParse?.outcome).toBe('completed');
    expect(board.tasks[0]?.status).toBe('not_started');
    expect(board.remainingUnchecked).toBe(1);
  });
});
