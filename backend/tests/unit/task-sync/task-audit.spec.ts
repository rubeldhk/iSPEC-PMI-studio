/**
 * `T1774` (EPIC-046, `FR-KAN-072`, data-model.md §11) — the four audited
 * actions.
 *
 * ## Why a board needs an audit trail at all
 *
 * Everything this Epic writes is a claim about someone else's file. The rows
 * say a task is done; the file is what actually says so. When the two are read
 * a month later by someone deciding whether a milestone was met, the question
 * is never *what does the board say* but **what moved this card, and who**.
 *
 * §11 answers that with four actions, and this test pins each one to the fact it
 * must carry:
 *
 *   1. `create task_sync` — the execution, the digest, the counts, the diff and
 *      the refusal codes: enough to re-derive the parse without the file.
 *   2. `update task` — from, to, source and the **cause id**. A move with no
 *      cause is the one thing an audit trail cannot tolerate, because it is
 *      indistinguishable from a move nobody made.
 *   3. `create task_status_proposal` — what a person asked for.
 *   4. `update task_status_proposal` — what was decided, and whether it applied
 *      at once.
 *
 * `PP-010`: the trail is append-only. The port offers `record` and nothing
 * else, and this test asserts the absence rather than trusting it — an audit
 * row that could be amended would record the last story told, not the events.
 *
 * Written to FAIL before `T1775`.
 */
import { describe, expect, it } from 'vitest';
import { TaskEventService } from '../../../src/modules/task-sync/task-event.service.js';
import { TaskProposalService } from '../../../src/modules/task-sync/task-proposal.service.js';
import { TaskSyncService } from '../../../src/modules/task-sync/task-sync.service.js';
import { DEFAULT_TASK_GRAMMAR } from '../../../src/modules/task-sync/task-grammar.js';
import { InMemoryTaskSyncStore } from '../../../src/modules/task-sync/task-sync.store.js';

interface AuditRow {
  workspaceId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  outcome: string;
  detail: Record<string, unknown>;
}

function recorder(): { rows: AuditRow[]; port: { record(row: AuditRow): Promise<void> } } {
  const rows: AuditRow[] = [];
  return { rows, port: { record: async (row: AuditRow) => void rows.push(row) } };
}

const EXECUTION = {
  executionId: 'x_1',
  workspaceId: 'ws_a',
  projectId: 'p_a',
  command: 'implement',
  initiatorId: 'cred_1',
  state: 'started',
  registeredAt: '2026-09-07T09:00:00.000Z',
  completedAt: null,
  completionComment: null,
  targetType: 'epic',
  targetId: '3',
  agentAdapter: 'claude',
  agentVersion: '1.0',
};

const OPEN = ['- [ ] T9001 First in `a/one.ts`', '- [ ] T9002 Second in `a/two.ts`', '- [ ] Tidy up', ''].join('\n');
const TICKED = ['- [X] T9001 First in `a/one.ts`', '- [ ] T9002 Second in `a/two.ts`', ''].join('\n');

function syncService(store: InMemoryTaskSyncStore, audit: { record(row: AuditRow): Promise<void> }) {
  return new TaskSyncService({
    store,
    executions: { find: async () => EXECUTION },
    epics: { list: async () => [{ id: 'e_1', number: 3, slug: 'reports', parentEpicId: null, splitSuffix: null }] },
    grammar: DEFAULT_TASK_GRAMMAR,
    limits: () => ({ maxBytes: 1_000_000, maxTaskLines: 5_000 }),
    audit: audit as never,
    comments: { add: async () => ({ commentId: 'c_1' }) },
  } as never);
}

async function sync(store: InMemoryTaskSyncStore, audit: { record(row: AuditRow): Promise<void> }, tasksMarkdown: string) {
  return syncService(store, audit).sync(
    { workspaceId: 'ws_a', projectId: 'p_a', actorId: 'cred_1' },
    { executionId: 'x_1', tasksMarkdown },
  );
}

describe('T1774 · create task_sync (FR-KAN-072)', () => {
  it('records the execution, digest, counts, diff and refusal codes', async () => {
    const store = new InMemoryTaskSyncStore();
    const audit = recorder();
    const answer = await sync(store, audit.port, OPEN);

    const row = audit.rows.find((r) => r.targetType === 'task_sync');
    expect(row, 'no task_sync audit row was written').toBeDefined();
    expect(row).toMatchObject({ action: 'create', outcome: 'success', targetId: answer.syncId, actorId: 'cred_1' });
    expect(row?.detail).toMatchObject({
      executionId: 'x_1',
      tasksDigest: answer.tasksDigest,
      counts: { linesConsidered: 3, parsed: 2, refused: 1, duplicates: 0 },
      diff: { added: 2, changed: 0, unchanged: 0, disappeared: 0 },
      refusalCodes: ['identifier_not_matched'],
    });
  });
});

describe('T1774 · update task (data-model.md §11)', () => {
  it('records a move made by a parse, naming the sync as its cause', async () => {
    const store = new InMemoryTaskSyncStore();
    await sync(store, recorder().port, OPEN);

    const audit = recorder();
    const second = await sync(store, audit.port, TICKED);

    const moves = audit.rows.filter((r) => r.targetType === 'task' && r.action === 'update');
    expect(moves, 'a parse moved a card and recorded nothing').toHaveLength(1);
    expect(moves[0]?.detail).toMatchObject({
      from: 'not_started',
      to: 'done',
      source: 'parse',
      causeId: second.syncId,
    });
  });

  it('records a move made by an event, naming the execution as its cause', async () => {
    const store = new InMemoryTaskSyncStore();
    await sync(store, recorder().port, OPEN);

    const audit = recorder();
    const events = new TaskEventService({
      store,
      events: { progressReportsFor: async () => [{ executionId: 'x_7', taskId: 'T9002', occurredAt: '2026-09-07T11:00:00.000Z', emittedBy: 'cred_1' }] },
      audit: audit.port as never,
    } as never);
    await events.applyFor('ws_a', 'e_1');

    const moves = audit.rows.filter((r) => r.targetType === 'task' && r.action === 'update');
    expect(moves, 'an event moved a card and recorded nothing').toHaveLength(1);
    expect(moves[0]?.detail).toMatchObject({ from: 'not_started', to: 'done', source: 'event', causeId: 'x_7' });
  });

  it('records a move made by a proposal, naming the proposal as its cause', async () => {
    const store = new InMemoryTaskSyncStore();
    await sync(store, recorder().port, OPEN);
    const task = (await store.tasksForEpic('ws_a', 'e_1')).find((t) => t.taskKey === 'T9001');

    const audit = recorder();
    const service = new TaskProposalService({
      store,
      events: { append: async () => undefined },
      audit: audit.port as never,
      policy: { requiresApproval: async () => false },
    } as never);
    const outcome = await service.propose(
      { workspaceId: 'ws_a', actorId: 'u_1', actorType: 'user', canMove: true },
      { taskId: task?.id ?? '', expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started it' },
    );
    expect(outcome.verdict).toBe('applied');

    const moves = audit.rows.filter((r) => r.targetType === 'task' && r.action === 'update');
    expect(moves, 'a proposal moved a card and recorded nothing').toHaveLength(1);
    expect(moves[0]?.detail).toMatchObject({
      from: 'not_started',
      to: 'in_progress',
      source: 'proposal',
      causeId: outcome.proposalId,
    });
  });

  it('records nothing for a task the parse left where it was — an unchanged row is not a move', async () => {
    const store = new InMemoryTaskSyncStore();
    await sync(store, recorder().port, OPEN);
    const audit = recorder();
    await sync(store, audit.port, OPEN);
    expect(audit.rows.filter((r) => r.targetType === 'task')).toHaveLength(0);
  });
});

describe('T1774 · the proposal, requested and decided (R-046-5)', () => {
  it('records the request with its task, statuses, reason presence and proposer type', async () => {
    const store = new InMemoryTaskSyncStore();
    await sync(store, recorder().port, OPEN);
    const task = (await store.tasksForEpic('ws_a', 'e_1')).find((t) => t.taskKey === 'T9001');

    const audit = recorder();
    const service = new TaskProposalService({
      store,
      events: { append: async () => undefined },
      audit: audit.port as never,
      policy: { requiresApproval: async () => false },
    } as never);
    const outcome = await service.propose(
      { workspaceId: 'ws_a', actorId: 'u_1', actorType: 'user', canMove: true },
      { taskId: task?.id ?? '', expectedCurrentStatus: 'not_started', requestedStatus: 'blocked', reason: 'Waiting on the vendor' },
    );

    const created = audit.rows.find((r) => r.targetType === 'task_status_proposal' && r.action === 'create');
    expect(created).toMatchObject({ targetId: outcome.proposalId, actorId: 'u_1', outcome: 'success' });
    expect(created?.detail).toMatchObject({
      taskId: task?.id,
      from: 'not_started',
      to: 'blocked',
      reasonPresent: true,
      proposerType: 'user',
    });
  });

  it('records the verdict and whether it was immediate', async () => {
    const store = new InMemoryTaskSyncStore();
    await sync(store, recorder().port, OPEN);
    const task = (await store.tasksForEpic('ws_a', 'e_1')).find((t) => t.taskKey === 'T9001');

    const audit = recorder();
    const service = new TaskProposalService({
      store,
      events: { append: async () => undefined },
      audit: audit.port as never,
      // A project that wants a second person: the verdict is not immediate.
      policy: { requiresApproval: async () => true },
    } as never);
    const outcome = await service.propose(
      { workspaceId: 'ws_a', actorId: 'u_1', actorType: 'user', canMove: true },
      { taskId: task?.id ?? '', expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started it' },
    );
    expect(outcome.verdict).toBe('approval_required');

    const decided = audit.rows.find((r) => r.targetType === 'task_status_proposal' && r.action === 'update');
    expect(decided?.detail).toMatchObject({ verdict: 'approval_required', immediate: false });
    // And no move was recorded, because none was made.
    expect(audit.rows.filter((r) => r.targetType === 'task')).toHaveLength(0);
  });
});

describe('T1774 · the trail is append-only (PP-010)', () => {
  it('offers record and nothing that could amend what it recorded', async () => {
    const store = new InMemoryTaskSyncStore();
    const audit = recorder();
    const service = syncService(store, audit.port);
    const port = (service as unknown as { deps: { audit: object } }).deps.audit;
    const names = new Set<string>();
    for (const key of Object.keys(port)) names.add(key);
    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(port) ?? {})) names.add(key);
    names.delete('constructor');
    expect([...names].filter((n) => /update|amend|delete|remove|patch/i.test(n))).toEqual([]);
    expect(names.has('record')).toBe(true);
  });

  it('never rewrites a row it has written — the second sync appends, it does not amend', async () => {
    const store = new InMemoryTaskSyncStore();
    const audit = recorder();
    await sync(store, audit.port, OPEN);
    const first = structuredClone(audit.rows);
    await sync(store, audit.port, TICKED);
    expect(audit.rows.slice(0, first.length)).toEqual(first);
    expect(audit.rows.length).toBeGreaterThan(first.length);
  });
});

describe('T1774 · every audited action carries an actor', () => {
  it('names the connector credential for a sync and the person for a proposal', async () => {
    const store = new InMemoryTaskSyncStore();
    const audit = recorder();
    await sync(store, audit.port, OPEN);
    expect(audit.rows.every((r) => r.actorId !== null)).toBe(true);
    expect(audit.rows.every((r) => r.workspaceId === 'ws_a')).toBe(true);
  });
});
