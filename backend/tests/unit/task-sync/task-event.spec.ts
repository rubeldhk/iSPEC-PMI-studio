/**
 * `T1723` (EPIC-046, `FR-KAN-040` to `FR-KAN-047`) — movement from execution
 * events. This is milestone `M4`'s whole mechanism.
 *
 * ## What a `progress-reported` event means
 *
 * `speckit.pmi.progress` appends one per task **newly `[X]`** since
 * registration. So the event means *this task got ticked*, and the only status
 * it can produce is `done`. Nothing else is inferred from it — `FR-KAN-041`
 * keeps `in_progress` and `blocked` reachable only through a proposal, because
 * the file has two states and guessing a third is what this Epic exists to stop.
 *
 * ## An unmatched report creates nothing
 *
 * `FR-KAN-042`. The hook's `tickedTasks` takes *the first token after a ticked
 * checkbox* and is deliberately more permissive than the platform's identifier
 * pattern, so a hook can report progress for a token the grammar rejects. That
 * is not a defect and not a task: it is listed, and matched later if the
 * identifier is ever parsed.
 *
 * ## Replay-safe
 *
 * `FR-KAN-047`. Reprocessing an execution's history must produce the same board,
 * because that is exactly what happens when a sync re-applies the events of a
 * run whose rows it has just rewritten.
 *
 * Written to FAIL before `T1724`.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  TaskEventService,
  type ProgressReport,
  type ProgressEventReader,
} from '../../../src/modules/task-sync/task-event.service.js';
import { InMemoryTaskSyncStore, type NewSyncedTask } from '../../../src/modules/task-sync/task-sync.store.js';

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

function at(minute: number): string {
  return `2026-09-07T10:0${minute}:00.000Z`;
}

async function harness(reports: ProgressReport[], tasks: NewSyncedTask[] = [task()]) {
  const store = new InMemoryTaskSyncStore();
  for (const t of tasks) await store.upsertTask(t);
  const events: ProgressEventReader = { progressReportsFor: vi.fn(async () => reports) };
  return { store, events, service: new TaskEventService({ store, events }) };
}

describe('T1723 · a progress report moves a card to Done (FR-KAN-040)', () => {
  it('matches by identifier within the Epic of the execution and attributes the move', async () => {
    const h = await harness([{ executionId: 'x_9', taskId: 'T1', occurredAt: at(1), emittedBy: 'cred_1' }]);
    await h.service.applyFor(WS, EPIC);
    const [row] = await h.store.tasksForEpic(WS, EPIC);
    expect(row).toMatchObject({ status: 'done', statusSource: 'event', lastMovedBy: null });
    expect(row?.lastMovedAt?.toISOString()).toBe(at(1));
  });

  it('moves several tasks from several reports', async () => {
    const tasks = ['T1', 'T2', 'T3'].map((taskKey, i) => task({ taskKey, sourceLine: i + 1 }));
    const h = await harness(['T1', 'T2', 'T3'].map((taskId, i) => ({ executionId: 'x_9', taskId, occurredAt: at(i), emittedBy: 'cred_1' })), tasks);
    await h.service.applyFor(WS, EPIC);
    expect((await h.store.tasksForEpic(WS, EPIC)).every((t) => t.status === 'done')).toBe(true);
  });

  it('leaves a task no report names untouched', async () => {
    const tasks = [task({ taskKey: 'T1' }), task({ taskKey: 'T2', sourceLine: 2 })];
    const h = await harness([{ executionId: 'x_9', taskId: 'T1', occurredAt: at(1), emittedBy: 'cred_1' }], tasks);
    await h.service.applyFor(WS, EPIC);
    const rows = await h.store.tasksForEpic(WS, EPIC);
    expect(rows.find((t) => t.taskKey === 'T1')?.status).toBe('done');
    expect(rows.find((t) => t.taskKey === 'T2')?.status).toBe('not_started');
  });
});

describe('T1723 · nothing else is inferred (FR-KAN-041)', () => {
  it.each(['in_progress', 'blocked'] as const)('never produces %s', async (forbidden) => {
    const h = await harness([{ executionId: 'x_9', taskId: 'T1', occurredAt: at(1), emittedBy: 'cred_1' }]);
    await h.service.applyFor(WS, EPIC);
    expect((await h.store.tasksForEpic(WS, EPIC))[0]?.status).not.toBe(forbidden);
  });

  it('does not overwrite a proposal-set status with anything but done', async () => {
    // The event says *this got ticked*, which outranks a person's in-progress
    // claim — the file has spoken. That is `reconcile`'s direction too.
    const h = await harness([{ executionId: 'x_9', taskId: 'T1', occurredAt: at(1), emittedBy: 'cred_1' }], [task({ status: 'in_progress', statusSource: 'proposal' })]);
    await h.service.applyFor(WS, EPIC);
    expect((await h.store.tasksForEpic(WS, EPIC))[0]).toMatchObject({ status: 'done', statusSource: 'event' });
  });
});

describe('T1723 · an unmatched report creates nothing (FR-KAN-042)', () => {
  it('lists it rather than inventing a task', async () => {
    const h = await harness([{ executionId: 'x_9', taskId: 'not-an-identifier', occurredAt: at(1), emittedBy: 'cred_1' }]);
    const outcome = await h.service.applyFor(WS, EPIC);
    expect(await h.store.tasksForEpic(WS, EPIC)).toHaveLength(1);
    expect(outcome.unmatched).toEqual([{ executionId: 'x_9', taskId: 'not-an-identifier', occurredAt: at(1), emittedBy: 'cred_1' }]);
    expect(outcome.applied).toEqual([]);
  });

  it('matches it once the identifier is parsed — the report was retained, not discarded', async () => {
    const reports = [{ executionId: 'x_9', taskId: 'T2', occurredAt: at(1), emittedBy: 'cred_1' }];
    const h = await harness(reports);
    expect((await h.service.applyFor(WS, EPIC)).unmatched).toHaveLength(1);

    // A later parse brings T2 into being; the same reports now match.
    await h.store.upsertTask(task({ taskKey: 'T2', sourceLine: 2 }));
    const second = await h.service.applyFor(WS, EPIC);
    expect(second.unmatched).toEqual([]);
    expect((await h.store.findTaskByKey(WS, EPIC, 'T2'))?.status).toBe('done');
  });

  it('does not match an identifier belonging to another Epic', async () => {
    const h = await harness([{ executionId: 'x_9', taskId: 'T1', occurredAt: at(1), emittedBy: 'cred_1' }], [task({ epicId: 'e_2' })]);
    const outcome = await h.service.applyFor(WS, EPIC);
    expect(outcome.applied).toEqual([]);
    expect((await h.store.tasksForEpic(WS, 'e_2'))[0]?.status).toBe('not_started');
  });
});

describe('T1723 · idempotent and replay-safe (FR-KAN-043, FR-KAN-047)', () => {
  it('a repeated report changes nothing the second time', async () => {
    const reports = [
      { executionId: 'x_9', taskId: 'T1', occurredAt: at(1), emittedBy: 'cred_1' },
      { executionId: 'x_9', taskId: 'T1', occurredAt: at(2), emittedBy: 'cred_1' },
    ];
    const h = await harness(reports);
    const first = await h.service.applyFor(WS, EPIC);
    expect(first.applied).toEqual(['T1']);
    const row = (await h.store.tasksForEpic(WS, EPIC))[0];

    const second = await h.service.applyFor(WS, EPIC);
    // Already done: nothing to apply, and the attribution does not drift to the
    // later event.
    expect(second.applied).toEqual([]);
    expect((await h.store.tasksForEpic(WS, EPIC))[0]?.lastMovedAt).toEqual(row?.lastMovedAt);
  });

  it('reprocessing the whole history produces the same board', async () => {
    const reports = ['T1', 'T2'].map((taskId, i) => ({ executionId: 'x_9', taskId, occurredAt: at(i), emittedBy: 'cred_1' }));
    const h = await harness(reports, [task({ taskKey: 'T1' }), task({ taskKey: 'T2', sourceLine: 2 })]);
    await h.service.applyFor(WS, EPIC);
    const once = await h.store.tasksForEpic(WS, EPIC);
    await h.service.applyFor(WS, EPIC);
    expect(await h.store.tasksForEpic(WS, EPIC)).toEqual(once);
  });

  it('uses the EARLIEST report for a task, so attribution does not depend on read order', async () => {
    const reports = [
      { executionId: 'x_9', taskId: 'T1', occurredAt: at(5), emittedBy: 'cred_1' },
      { executionId: 'x_8', taskId: 'T1', occurredAt: at(1), emittedBy: 'cred_1' },
    ];
    const h = await harness(reports);
    await h.service.applyFor(WS, EPIC);
    expect((await h.store.tasksForEpic(WS, EPIC))[0]?.lastMovedAt?.toISOString()).toBe(at(1));
  });
});
