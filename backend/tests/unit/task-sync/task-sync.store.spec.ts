/**
 * `T1689` (EPIC-046, data-model.md §12) — the task-sync store's invariants.
 *
 * Four things this store must be, each of which a later service would otherwise
 * have to be careful about instead:
 *
 * 1. **Idempotent by index, not by check.** `recordSync` never asks "does this
 *    key exist?" and then inserts — two syncs running at once would both be told
 *    *no*. It inserts and reads back on the unique violation (`DEF-045-002`).
 * 2. **One row per `(epicId, taskKey)`.** `FR-KAN-031` — identity is the
 *    identifier within its Epic, so a re-sync updates the row and the proposals
 *    attached to it survive.
 * 3. **Nothing is deleted.** `markAbsent` sets a flag (`FR-KAN-025`).
 * 4. **A proposal is written once.** No update method exists on the interface;
 *    the verdict is an event (`R-037-5`).
 *
 * Written to FAIL before `T1690`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  InMemoryTaskSyncStore,
  isUniqueViolation,
  type NewSyncedTask,
  type NewTaskSync,
  type NewTaskSyncLine,
  type TaskSyncStore,
} from '../../../src/modules/task-sync/task-sync.store.js';

const WS = 'ws_a';

function sync(overrides: Partial<NewTaskSync> = {}): NewTaskSync {
  return {
    workspaceId: WS,
    projectId: 'p_a',
    epicId: 'e_1',
    executionId: 'x_1',
    actorId: 'cred_1',
    idempotencyKey: 'tasks-sync:x_1:abc',
    tasksDigest: 'abc',
    linesConsidered: 1,
    parsed: 1,
    refused: 0,
    duplicates: 0,
    added: 1,
    changed: 0,
    unchanged: 0,
    disappeared: 0,
    outOfBandEdit: false,
    ...overrides,
  };
}

function line(overrides: Partial<NewTaskSyncLine> = {}): NewTaskSyncLine {
  return { lineNumber: 1, rawText: '- [ ] T1 Do the thing in `a/b.ts`', outcome: 'parsed', refusalCode: null, taskKey: 'T1', changeKind: 'added', previousStatus: null, newStatus: 'not_started', marker: null, ...overrides };
}

function task(overrides: Partial<NewSyncedTask> = {}): NewSyncedTask {
  return {
    workspaceId: WS,
    epicId: 'e_1',
    specificationId: null,
    taskKey: 'T1',
    description: 'Do the thing in `a/b.ts`',
    status: 'not_started',
    statusSource: 'parse',
    engineName: 'claude',
    engineVersion: 'unknown',
    sourceLine: 1,
    sourceDigest: 'abc',
    parallel: false,
    sourcePaths: ['a/b.ts'],
    presentInLatestParse: true,
    lastParsedExecutionId: 'x_1',
    lastMovedAt: null,
    lastMovedBy: null,
    ...overrides,
  };
}

function fresh(): TaskSyncStore & InMemoryTaskSyncStore {
  return new InMemoryTaskSyncStore();
}

describe('T1689 · TaskSyncStore', () => {
  describe('recordSync — the unique index is the arbiter (FR-KAN-038)', () => {
    it('writes the sync and its manifest together', async () => {
      const store = fresh();
      const { row, replayed } = await store.recordSync(sync(), [line()]);
      expect(replayed).toBe(false);
      expect(row.id).toBeTruthy();
      expect(await store.linesFor(row.id)).toHaveLength(1);
    });

    it('returns the stored sync for a replayed key and writes nothing more', async () => {
      const store = fresh();
      const first = await store.recordSync(sync(), [line()]);
      const second = await store.recordSync(sync({ parsed: 99 }), [line(), line({ lineNumber: 2 })]);
      expect(second.replayed).toBe(true);
      expect(second.row.id).toBe(first.row.id);
      expect(second.row.parsed).toBe(1);
      expect(await store.linesFor(first.row.id)).toHaveLength(1);
    });

    it('survives two simultaneous syncs of the same key — both resolve, one row', async () => {
      const store = fresh();
      const [a, b] = await Promise.all([store.recordSync(sync(), [line()]), store.recordSync(sync(), [line()])]);
      expect(a.row.id).toBe(b.row.id);
      expect([a.replayed, b.replayed].filter(Boolean)).toHaveLength(1);
    });

    it('throws the P2002 shape the driver throws, so the unit suites see the race', async () => {
      const store = fresh();
      await store.recordSync(sync(), [line()]);
      await expect(store.insertSync(sync(), [line()])).rejects.toSatisfy((err: unknown) =>
        isUniqueViolation(err, 'idempotencyKey'),
      );
    });
  });

  describe('upsertTask — one row per (epicId, taskKey) (FR-KAN-031)', () => {
    it('inserts, then updates the same row on a re-sync', async () => {
      const store = fresh();
      const first = await store.upsertTask(task());
      const second = await store.upsertTask(task({ description: 'Do the thing differently', sourceLine: 7 }));
      expect(second.row.id).toBe(first.row.id);
      expect(second.created).toBe(false);
      expect(second.row.description).toBe('Do the thing differently');
      expect(second.row.sourceLine).toBe(7);
      expect(await store.tasksForEpic(WS, 'e_1')).toHaveLength(1);
    });

    it('survives two simultaneous upserts of the same key', async () => {
      const store = fresh();
      const [a, b] = await Promise.all([store.upsertTask(task()), store.upsertTask(task())]);
      expect(a.row.id).toBe(b.row.id);
      expect(await store.tasksForEpic(WS, 'e_1')).toHaveLength(1);
    });

    it('keeps the same identifier in two Epics apart — identity is scoped to the Epic', async () => {
      const store = fresh();
      await store.upsertTask(task());
      await store.upsertTask(task({ epicId: 'e_2' }));
      expect(await store.tasksForEpic(WS, 'e_1')).toHaveLength(1);
      expect(await store.tasksForEpic(WS, 'e_2')).toHaveLength(1);
    });

    it('throws the P2002 shape on the raw insert', async () => {
      const store = fresh();
      await store.upsertTask(task());
      await expect(store.insertTask(task())).rejects.toSatisfy((err: unknown) => isUniqueViolation(err, 'taskKey'));
    });
  });

  describe('markAbsent — nothing parsed is ever deleted (FR-KAN-025)', () => {
    it('flags the keys the latest parse omitted and deletes nothing', async () => {
      const store = fresh();
      await store.upsertTask(task({ taskKey: 'T1' }));
      await store.upsertTask(task({ taskKey: 'T2' }));
      await store.markAbsent(WS, 'e_1', ['T1']);
      const rows = await store.tasksForEpic(WS, 'e_1');
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.taskKey === 'T1')?.presentInLatestParse).toBe(true);
      expect(rows.find((r) => r.taskKey === 'T2')?.presentInLatestParse).toBe(false);
    });

    it('restores the flag when a later parse contains the key again', async () => {
      const store = fresh();
      await store.upsertTask(task({ taskKey: 'T2' }));
      await store.markAbsent(WS, 'e_1', []);
      await store.upsertTask(task({ taskKey: 'T2' }));
      const rows = await store.tasksForEpic(WS, 'e_1');
      expect(rows[0]?.presentInLatestParse).toBe(true);
    });
  });

  describe('the absences the interface asserts', () => {
    it('exposes no way to delete a task', () => {
      const store = fresh() as unknown as Record<string, unknown>;
      for (const forbidden of ['deleteTask', 'removeTask', 'deleteTasksForEpic', 'clear']) {
        expect(store[forbidden], `${forbidden} must not exist`).toBeUndefined();
      }
    });

    it('exposes no way to update a proposal — the verdict is an event (R-037-5)', () => {
      const store = fresh() as unknown as Record<string, unknown>;
      for (const forbidden of ['updateProposal', 'setVerdict', 'applyProposal', 'deleteProposal']) {
        expect(store[forbidden], `${forbidden} must not exist`).toBeUndefined();
      }
    });
  });

  describe('recordProposal', () => {
    it('writes once and returns the stored row for a replayed key', async () => {
      const store = fresh();
      const input = {
        workspaceId: WS,
        taskId: 't_1',
        expectedCurrentStatus: 'not_started' as const,
        requestedStatus: 'in_progress' as const,
        reason: 'Started it this morning',
        proposerId: 'u_1',
        proposerType: 'user' as const,
        executionId: 'x_1',
        eventId: null,
        idempotencyKey: 'task-proposal:t_1:u_1:not_started:in_progress',
      };
      const first = await store.recordProposal(input);
      const second = await store.recordProposal({ ...input, reason: 'different words' });
      expect(second.replayed).toBe(true);
      expect(second.row.id).toBe(first.row.id);
      expect(second.row.reason).toBe('Started it this morning');
      expect(await store.proposalsForTask(WS, 't_1')).toHaveLength(1);
    });
  });

  describe('applyStatus — every change names its cause (FR-KAN-027)', () => {
    it('records the status, its source, when and by whom', async () => {
      const store = fresh();
      const { row } = await store.upsertTask(task());
      const at = new Date('2026-09-07T10:00:00.000Z');
      const moved = await store.applyStatus(WS, row.id, { status: 'in_progress', statusSource: 'proposal', at, by: 'u_1' });
      expect(moved.status).toBe('in_progress');
      expect(moved.statusSource).toBe('proposal');
      expect(moved.lastMovedAt).toEqual(at);
      expect(moved.lastMovedBy).toBe('u_1');
    });
  });

  describe('latestSyncForEpic — the header of every board read', () => {
    it('returns the newest sync, and null before any', async () => {
      const store = fresh();
      expect(await store.latestSyncForEpic(WS, 'e_1')).toBeNull();
      await store.recordSync(sync({ idempotencyKey: 'k1' }), [line()]);
      const second = await store.recordSync(sync({ idempotencyKey: 'k2', tasksDigest: 'def' }), [line()]);
      expect((await store.latestSyncForEpic(WS, 'e_1'))?.id).toBe(second.row.id);
    });
  });
});


/**
 * `T1794` (EPIC-046) — every read on this interface earns its place.
 *
 * The third convergence pass flagged `findProposal` as `unrequested`: no
 * production code called it and no test exercised it. It was neither a seam nor
 * a proof, which is the definition of dead.
 *
 * It is **not removed**, because `T1792` — implemented in the same pass, and
 * higher priority — needed exactly that read: a second person adjudicating a
 * waiting proposal starts by finding it by id. So the finding resolved by the
 * method acquiring a caller rather than by deletion, which is the honest
 * outcome and is recorded rather than quietly dropped.
 *
 * This test is what stops it going dead again: if the adjudication route is
 * ever removed, this fails and the method has to be justified afresh.
 */
describe('T1794 · the store offers no read nothing uses', () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/modules/task-sync/task-proposal.service.ts'),
    'utf8',
  );

  it('findProposal has a production caller — T1792 acquired it', () => {
    expect(source).toContain('this.deps.store.findProposal(');
  });

  it('and that caller is the second-person adjudication, not a passing use', () => {
    expect(source).toContain('async adjudicatePending(');
    expect(source).toContain('async locateProposal(');
  });

  it('reads it back correctly, so the caller is not merely present but right', async () => {
    const store = new InMemoryTaskSyncStore();
    const { row } = await store.recordProposal({
      workspaceId: 'ws_a', taskId: 't_1', expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress',
      reason: 'Started it', proposerId: 'u_ana', proposerType: 'user', executionId: 'x_1', eventId: null,
      idempotencyKey: 'k_find',
    });
    expect(await store.findProposal(row.id)).toMatchObject({ id: row.id, taskId: 't_1', proposerId: 'u_ana' });
    expect(await store.findProposal('pr_absent')).toBeNull();
  });
});
