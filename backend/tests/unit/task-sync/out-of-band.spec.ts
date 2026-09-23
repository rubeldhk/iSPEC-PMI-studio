/**
 * `T1749` (EPIC-046, `FR-KAN-023`, `R-05`) — the out-of-band edit.
 *
 * ## What the rule actually detects
 *
 * `FR-KAN-023`: a `tasks.md` whose digest differs from the last sync's *while no
 * governed command ran between them*. In the shipped flow one governed command
 * produces exactly one task sync — `runFinish` calls the tool once — so:
 *
 *   - two syncs from **different** executions mean a command ran between them,
 *     and a changed digest is that command's work. Not out of band.
 *   - two syncs from the **same** execution with a **changed** digest mean the
 *     file moved with no new command to account for it. That is the signal.
 *
 * ## What it deliberately does not claim
 *
 * It cannot see a hand-edit made *between* two governed commands, because the
 * second command's own sync is the first observation of the new content and a
 * legitimate edit by that command is indistinguishable from a hand-edit before
 * it. `FR-KAN-036`'s digest cross-check against the artifact version is the
 * other half of that story. Saying so here is better than a detector that
 * quietly under-reports and is believed to be complete.
 *
 * ## And it never resolves anything
 *
 * `R-05`. The content is accepted either way — the file is authoritative. The
 * flag is recorded so the board can say so; nothing is reverted or repaired.
 *
 * Written to FAIL before `T1750`.
 */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TASK_GRAMMAR } from '../../../src/modules/task-sync/task-grammar.js';
import {
  TaskSyncService,
  type ExecutionLookupRow,
  type SyncContext,
  type SyncCommentPort,
  type TaskSyncDeps,
} from '../../../src/modules/task-sync/task-sync.service.js';
import { InMemoryTaskSyncStore } from '../../../src/modules/task-sync/task-sync.store.js';
import { DEFAULT_MAX_TASK_LINES, DEFAULT_TASKS_MAX_BYTES } from '../../../src/modules/task-sync/task-validation.js';

const CTX: SyncContext = { workspaceId: 'ws_a', projectId: 'p_a', actorId: 'cred_1' };

function execution(id: string): ExecutionLookupRow {
  return {
    executionId: id,
    workspaceId: 'ws_a',
    projectId: 'p_a',
    command: 'tasks',
    initiatorId: 'u_1',
    state: 'completed',
    registeredAt: '2026-09-07T09:00:00.000Z',
    completedAt: '2026-09-07T09:05:00.000Z',
    completionComment: 'done',
    targetType: 'epic',
    targetId: '3',
    agentAdapter: 'claude',
    agentVersion: '1.2.3',
  };
}

function harness() {
  const store = new InMemoryTaskSyncStore();
  const executions = new Map<string, ExecutionLookupRow>();
  const comments = { add: vi.fn(async (_i: Parameters<SyncCommentPort['add']>[0]) => ({ commentId: 'c_1' })) };
  const deps: TaskSyncDeps = {
    store,
    executions: { find: vi.fn(async (_ws: string, id: string) => executions.get(id) ?? null) },
    epics: { list: vi.fn(async () => [{ id: 'e_3', number: 3, parentNumber: null, splitSuffix: null, slug: 'reports' }] as never) },
    comments,
    audit: { record: vi.fn(async () => undefined) },
    grammar: DEFAULT_TASK_GRAMMAR,
    limits: () => ({ maxBytes: DEFAULT_TASKS_MAX_BYTES, maxTaskLines: DEFAULT_MAX_TASK_LINES }),
  };
  const register = (id: string): void => {
    executions.set(id, execution(id));
  };
  return { store, register, service: new TaskSyncService(deps) };
}

const ONE = '- [ ] T1 Do the thing in `a/b.ts`\n';
const TWO = '- [X] T1 Do the thing in `a/b.ts`\n';

describe('T1749 · the same execution, a changed file (FR-KAN-023)', () => {
  it('flags it — no new command accounts for the change', async () => {
    const h = harness();
    h.register('x_1');
    await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
    const second = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: TWO });
    expect(second.outOfBandEdit).toBe(true);
  });

  it('accepts the content anyway — the file is authoritative (R-05)', async () => {
    const h = harness();
    h.register('x_1');
    await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
    await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: TWO });
    // Nothing was reverted or repaired: the checkbox is honoured.
    expect((await h.store.tasksForEpic('ws_a', 'e_3'))[0]?.status).toBe('done');
  });

  it('records the flag on the sync row, so the board can say so later', async () => {
    const h = harness();
    h.register('x_1');
    await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
    await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: TWO });
    expect((await h.store.latestSyncForEpic('ws_a', 'e_3'))?.outOfBandEdit).toBe(true);
  });
});

describe('T1749 · what is NOT an out-of-band edit', () => {
  it('a first sync — there is nothing to have changed from', async () => {
    const h = harness();
    h.register('x_1');
    expect((await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE })).outOfBandEdit).toBe(false);
  });

  it('a replay of the same execution and the same content', async () => {
    const h = harness();
    h.register('x_1');
    await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
    expect((await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE })).outOfBandEdit).toBe(false);
  });

  it('a NEW governed command changing the file — that command is what changed it', async () => {
    const h = harness();
    h.register('x_1');
    h.register('x_2');
    await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
    const second = await h.service.sync(CTX, { executionId: 'x_2', tasksMarkdown: TWO });
    // The whole point of the rule: a command ran between the two syncs, so the
    // change is attributable and flagging it would cry wolf on every implement.
    expect(second.outOfBandEdit).toBe(false);
  });

  it('a new command that changed nothing', async () => {
    const h = harness();
    h.register('x_1');
    h.register('x_2');
    await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
    expect((await h.service.sync(CTX, { executionId: 'x_2', tasksMarkdown: ONE })).outOfBandEdit).toBe(false);
  });
});
