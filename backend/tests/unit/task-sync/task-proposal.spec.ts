/**
 * `T1738` / `T1739` (EPIC-046, `FR-KAN-011` to `FR-KAN-018`, `R-046-5`,
 * `R-046-6`) — a manual move is a proposal, and what happens to it.
 *
 * ## The reading of "the existing adjudication contract"
 *
 * `FR-KAN-013` says a proposal must be adjudicated *through the existing
 * adjudication contract*. `EPIC-030`'s `AdjudicationProposal` is hard-typed to a
 * `specificationId` and a `SpecificationStatus`; a task move is neither, and
 * assembling an adjudicator over that Epic's unexported ports is the bypass
 * `FR-GEL-073` forbids. So *contract* is read as its **rules and verdict
 * vocabulary** — which this file imports and asserts against — and not as its
 * TypeScript interface. The requester ruled on that on 2026-09-06 (`F1`).
 *
 * ## Immediate is not unaudited
 *
 * `R-046-6`, `Q4`. A permitted member's own move applies at once, because
 * Constitution XII.6 forbids **AI** self-approval and does not require a second
 * human for every card. The proposal, its required reason and its verdict are
 * recorded either way — only the *waiting* differs.
 *
 * Written to FAIL before `T1740`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { ADJUDICATION_VERDICTS } from '@pmi/loop-contract';
import { ValidationFailedError } from '../../../src/core/errors.js';
import {
  TaskProposalService,
  type ProposalContext,
  type ProposalEventPort,
  type TaskProposalDeps,
} from '../../../src/modules/task-sync/task-proposal.service.js';
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

function ctx(over: Partial<ProposalContext> = {}): ProposalContext {
  return { workspaceId: WS, actorId: 'u_1', actorType: 'user', canMove: true, ...over };
}

async function harness(over: { seed?: NewSyncedTask; requiresApproval?: boolean } = {}) {
  const store = new InMemoryTaskSyncStore();
  const { row } = await store.upsertTask(over.seed ?? task());
  const events = { append: vi.fn(async (_input: Parameters<ProposalEventPort['append']>[0]) => ({ eventId: 'ev_1' })) };
  const audit = { record: vi.fn(async () => undefined) };
  const deps: TaskProposalDeps = {
    store,
    events,
    audit,
    policy: { requiresApproval: vi.fn(async () => over.requiresApproval ?? false) },
  };
  return { store, events, audit, task: row, service: new TaskProposalService(deps) };
}

describe('T1738 · the six verdicts (contracts/tasks-api.md §4)', () => {
  it('uses only names EPIC-030 already publishes — the vocabulary is borrowed, not invented', async () => {
    const h = await harness();
    const outcome = await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    expect(ADJUDICATION_VERDICTS).toContain(outcome.verdict);
  });

  it('applies immediately for a permitted member with no policy (R-046-6)', async () => {
    const h = await harness();
    const outcome = await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    expect(outcome.verdict).toBe('applied');
    const moved = await h.store.findTask(h.task.id);
    expect(moved).toMatchObject({ status: 'in_progress', statusSource: 'proposal', lastMovedBy: 'u_1' });
  });

  it('waits for a second person when the project policy says so', async () => {
    const h = await harness({ requiresApproval: true });
    const outcome = await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'blocked', reason: 'Waiting on an answer' });
    expect(outcome.verdict).toBe('approval_required');
    // The card has NOT moved.
    expect((await h.store.findTask(h.task.id))?.status).toBe('not_started');
  });

  it('is inconsistent when the expected status no longer holds (FR-KAN-016)', async () => {
    const h = await harness();
    await h.store.applyStatus(WS, h.task.id, { status: 'done', statusSource: 'event', at: new Date(), by: null });
    const outcome = await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    expect(outcome.verdict).toBe('inconsistent');
    expect(outcome.reason).toMatch(/moved/i);
    expect((await h.store.findTask(h.task.id))?.status).toBe('done');
  });

  it('refuses a principal without the move permission', async () => {
    const h = await harness();
    const outcome = await h.service.propose(ctx({ canMove: false }), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    expect(outcome.verdict).toBe('refused');
    expect((await h.store.findTask(h.task.id))?.status).toBe('not_started');
  });

  it('refuses an AGENT principal — it may propose, never approve its own (Constitution XII.6)', async () => {
    const h = await harness();
    const outcome = await h.service.propose(ctx({ actorType: 'agent' }), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'The run says so' });
    expect(outcome.verdict).toBe('refused');
    expect(outcome.reason).toMatch(/approve its own/i);
    expect((await h.store.findTask(h.task.id))?.status).toBe('not_started');
    // The PROPOSAL is still recorded: an agent may propose.
    expect(await h.store.proposalsForTask(WS, h.task.id)).toHaveLength(1);
  });

  it('refuses a move on a task that is not synced — EPIC-012 keeps its direct update (FR-KAN-017)', async () => {
    const h = await harness({ seed: task({ taskKey: null, sourceLine: null, sourceDigest: null, epicId: null, statusSource: 'engine' }) });
    const outcome = await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    expect(outcome.verdict).toBe('refused');
    expect(outcome.reason).toMatch(/not parsed from a tasks\.md/i);
  });
});

describe('T1738 · a reason is required BEFORE a proposal exists (FR-KAN-011)', () => {
  it.each(['', '   ', '\n'])('refuses %j without recording anything', async (reason) => {
    const h = await harness();
    await expect(
      h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason }),
    ).rejects.toBeInstanceOf(ValidationFailedError);
    expect(await h.store.proposalsForTask(WS, h.task.id)).toEqual([]);
    expect(h.events.append).not.toHaveBeenCalled();
  });
});
