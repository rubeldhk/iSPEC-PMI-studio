/**
 * `T1739` (EPIC-046, `R-037-5`, `FR-KAN-012`, `FR-KAN-072`) — the proposal is an
 * immutable **request**, and the verdict is an event.
 *
 * ## Why the row carries no verdict
 *
 * `R-037-5`, restated. A mutable verdict field becomes the audit authority the
 * first time somebody reads it instead of the event stream, and it can then
 * disagree with the record it was meant to summarise. So the row is the request,
 * written once; the verdict is an appended event and a projection over events.
 *
 * ## What is frozen, and why
 *
 * The proposer's identity. A later rename must not rewrite who asked for a move
 * — the whole value of an audit trail is that it says what was true at the time.
 *
 * Written to FAIL before `T1740`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  TaskProposalService,
  type ProposalContext,
  type ProposalEventPort,
  type TaskProposalDeps,
} from '../../../src/modules/task-sync/task-proposal.service.js';
import { InMemoryTaskSyncStore, type NewSyncedTask } from '../../../src/modules/task-sync/task-sync.store.js';

const WS = 'ws_a';

function task(over: Partial<NewSyncedTask> = {}): NewSyncedTask {
  return {
    workspaceId: WS,
    epicId: 'e_1',
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

describe('T1739 · the request is immutable and the verdict is an event (R-037-5)', () => {
  it('appends `status-transition-proposed`, recording the request and never a verdict', async () => {
    const h = await harness();
    await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    const call = h.events.append.mock.calls[0]?.[0] as { type: string; payload: Record<string, unknown> } | undefined;
    expect(call?.type).toBe('status-transition-proposed');
    expect(call?.payload).toMatchObject({ taskId: h.task.id, from: 'not_started', to: 'in_progress' });
    // The event records the REQUEST. A verdict on it would make two records of
    // one decision, and the second one wins by accident.
    expect(JSON.stringify(call?.payload)).not.toContain('verdict');
  });

  it('writes the proposal row once, and the store offers no way to change it', async () => {
    const h = await harness();
    await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    const [row] = await h.store.proposalsForTask(WS, h.task.id);
    expect(row?.reason).toBe('Started this morning');
    for (const forbidden of ['updateProposal', 'setVerdict', 'deleteProposal']) {
      expect((h.store as unknown as Record<string, unknown>)[forbidden], forbidden).toBeUndefined();
    }
  });

  it('freezes the proposer, so a later rename cannot rewrite who asked', async () => {
    const h = await harness();
    await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    const [row] = await h.store.proposalsForTask(WS, h.task.id);
    expect(row).toMatchObject({ proposerId: 'u_1', proposerType: 'user' });
  });

  it('is idempotent under a resubmitted identical move (F2)', async () => {
    const h = await harness();
    const move = { taskId: h.task.id, expectedCurrentStatus: 'not_started' as const, requestedStatus: 'in_progress' as const, reason: 'Started this morning' };
    const first = await h.service.propose(ctx(), move);
    const second = await h.service.propose(ctx(), move);
    expect(second.proposalId).toBe(first.proposalId);
    expect(await h.store.proposalsForTask(WS, h.task.id)).toHaveLength(1);
    // Each event is appended once, not once per click. `T1782` made this two
    // events rather than one — the request, then the verdict — so the
    // assertion counts BY TYPE: a total would pass tomorrow for the wrong
    // reason the moment a third kind of event is appended.
    const types = h.events.append.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types.filter((t) => t === 'status-transition-proposed')).toHaveLength(1);
    expect(types).toHaveLength(2);
    expect(new Set(types).size, 'the same event was appended twice').toBe(2);
  });

  it('records the verdict as an event, so a projection can find it (T1782, data-model §8)', async () => {
    // `data-model.md` §5 forbids a verdict column and §8 folds the proposal
    // state from its events. Without this append the verdict exists only in one
    // HTTP response, and no board can show a proposal awaiting approval.
    const h = await harness();
    await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    const verdictCall = h.events.append.mock.calls
      .map((c) => c[0] as { type: string; payload: Record<string, unknown>; idempotencyKey: string })
      .find((c) => c.type !== 'status-transition-proposed');
    expect(verdictCall, 'no verdict event was appended').toBeDefined();
    expect(verdictCall?.payload).toMatchObject({ taskId: h.task.id, verdict: 'applied' });
    // FR-KAN-012 stays true: the PROPOSED event still carries no verdict.
    const proposed = h.events.append.mock.calls
      .map((c) => c[0] as { type: string; payload: Record<string, unknown> })
      .find((c) => c.type === 'status-transition-proposed');
    expect(proposed?.payload).not.toHaveProperty('verdict');
  });

  it('records a genuine second move as its own proposal', async () => {
    const h = await harness();
    const first = await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started' });
    const second = await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'in_progress', requestedStatus: 'blocked', reason: 'Now waiting' });
    expect(second.proposalId).not.toBe(first.proposalId);
    expect(await h.store.proposalsForTask(WS, h.task.id)).toHaveLength(2);
  });
});

describe('T1739 · nothing here writes a file (FR-KAN-010)', () => {
  it('the module imports no filesystem API', () => {
    // `Object.keys` on an instance would prove nothing — it can never contain
    // `fs`, so the assertion would pass whatever the file did. This reads the
    // source. `T1743` is the real proof (the Epic's directory byte-identical
    // after a full board session); this is the cheap guard that fails the moment
    // somebody reaches for `fs` here.
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../src/modules/task-sync/task-proposal.service.ts'),
      'utf8',
    );
    for (const forbidden of ['node:fs', "from 'fs'", 'writeFile', 'appendFile', 'mkdir', 'rm(']) {
      expect(source, `task-proposal.service.ts must not reach for ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('T1739 · the audit (FR-KAN-072)', () => {
  it('records the proposal and its verdict, immediately or not', async () => {
    const h = await harness();
    await h.service.propose(ctx(), { taskId: h.task.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started this morning' });
    expect(h.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', targetType: 'task_status_proposal', outcome: 'success' }),
    );
    expect(h.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', targetType: 'task_status_proposal' }),
    );
  });
});
