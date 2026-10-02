/**
 * `T1792` (EPIC-046, `US4` scenario 3, `FR-KAN-013`, `FR-KAN-014`) — the
 * second person's verdict.
 *
 * ## What the third convergence pass found
 *
 * `approval_required` was **terminal**. It was returned, recorded, evented and
 * shown on the card — and nothing could answer it. A project that set
 * `projects.taskMoveRequiresApproval` did not *gate* a move; it **froze the
 * card permanently**.
 *
 * `US4` scenario 3 is explicit: the card *moves only when a second person's
 * verdict applies it*. Everything around the waiting state was built and the
 * thing that ends it was not, which is why three passes over the requirements
 * missed it — every artifact describes the waiting correctly.
 *
 * ## The rules, and why each one
 *
 * A second verdict is a full adjudication, not a rubber stamp:
 *
 *   - **a different person** — the whole content of *requires an approver* is
 *     that the proposer is not it. Letting them approve their own would make
 *     the policy a no-op that looks like a control;
 *   - **never an agent** — Constitution XII.6, unchanged, and it applies to the
 *     approving side at least as much as the proposing one;
 *   - **holding the move permission** — approving a move is making it;
 *   - **the task still where the proposal expected it** — otherwise the
 *     approver is applying a decision about a card that has since moved
 *     (`FR-KAN-016`);
 *   - **only a proposal that is actually waiting** — re-adjudicating a decided
 *     one would make the second answer authoritative over a recorded first.
 *
 * The proposal row is **not updated**: the second verdict is another event, as
 * the first was (`data-model.md` §5).
 *
 * Written to FAIL before the route and the service method exist.
 */
import { describe, expect, it, vi } from 'vitest';
import { TaskProposalService } from '../../../src/modules/task-sync/task-proposal.service.js';
import { InMemoryTaskSyncStore, type NewSyncedTask } from '../../../src/modules/task-sync/task-sync.store.js';

const WS = 'ws_a';

function task(over: Partial<NewSyncedTask> = {}): NewSyncedTask {
  return {
    workspaceId: WS, epicId: 'e_1', specificationId: null, taskKey: 'T1',
    description: 'Do the thing', status: 'not_started', statusSource: 'parse',
    engineName: 'claude', engineVersion: '1', sourceLine: 1, sourceDigest: 'abc',
    parallel: false, sourcePaths: [], presentInLatestParse: true,
    lastParsedExecutionId: 'x_1', lastMovedAt: null, lastMovedBy: null, ...over,
  };
}

/** A project that wants a second person, and a proposal already waiting on one. */
async function waiting(opts: { verdicts?: { proposalId: string; verdict: string; occurredAt: string }[] } = {}) {
  const store = new InMemoryTaskSyncStore();
  const { row } = await store.upsertTask(task());
  const events = { append: vi.fn(async (_input: Record<string, unknown>) => ({ eventId: 'ev_1' })) };
  const audit = { record: vi.fn(async (_row: Record<string, unknown>) => undefined) };
  const recorded: { proposalId: string; verdict: string; occurredAt: string }[] = [];

  const service = new TaskProposalService({
    store,
    events,
    audit,
    policy: { requiresApproval: async () => true },
    verdicts: {
      forProposal: async (_ws: string, proposalId: string) =>
        opts.verdicts ?? recorded.filter((v) => v.proposalId === proposalId),
    },
  } as never);

  const proposed = await service.propose(
    { workspaceId: WS, actorId: 'u_ana', actorType: 'user', canMove: true },
    { taskId: row.id, expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started it' },
  );
  expect(proposed.verdict, 'the fixture must leave a proposal WAITING').toBe('approval_required');
  recorded.push({ proposalId: proposed.proposalId, verdict: 'approval_required', occurredAt: '2026-09-07T10:00:00.000Z' });

  return { store, service, events, audit, task: row, proposalId: proposed.proposalId };
}

const approver = { workspaceId: WS, actorId: 'u_bo', actorType: 'user' as const, canMove: true };

describe('T1792 · a second person applies the move (US4 sc. 3)', () => {
  it('applies it, and the card moves', async () => {
    const h = await waiting();
    const outcome = await h.service.adjudicatePending(approver, h.proposalId, { approve: true });
    expect(outcome.verdict).toBe('applied');
    expect((await h.store.findTask(h.task.id))?.status).toBe('in_progress');
  });

  it('attributes the move to the proposal, not to the approver personally', async () => {
    const h = await waiting();
    await h.service.adjudicatePending(approver, h.proposalId, { approve: true });
    const moved = await h.store.findTask(h.task.id);
    expect(moved?.statusSource).toBe('proposal');
  });

  it('records the second verdict as an EVENT and leaves the proposal row untouched', async () => {
    const h = await waiting();
    const before = await h.store.proposalsForTask(WS, h.task.id);
    await h.service.adjudicatePending(approver, h.proposalId, { approve: true });
    expect(await h.store.proposalsForTask(WS, h.task.id)).toEqual(before);
    const types = h.events.append.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types).toContain('transition-applied');
  });

  it('records who approved on BOTH rows — the verdict and the move it caused', async () => {
    // Two audit actions, two facts (`data-model.md` §11): what was decided, and
    // what changed. Each names the approver, because the proposal row itself
    // cannot say who answered it and the move row cannot say why it moved.
    const h = await waiting();
    await h.service.adjudicatePending(approver, h.proposalId, { approve: true });
    const rows = h.audit.record.mock.calls.map(
      (c) => c[0] as unknown as { actorId: string | null; targetType: string; detail: Record<string, unknown> },
    );

    // The LAST proposal row: the fixture's `propose` wrote the first one
    // (`approval_required`, by the proposer), and this is the answer to it.
    const verdict = rows.filter((r) => r.targetType === 'task_status_proposal').at(-1);
    expect(verdict?.actorId).toBe('u_bo');
    expect(verdict?.detail).toMatchObject({ approver: 'u_bo', verdict: 'applied', immediate: false });

    const move = rows.find((r) => r.targetType === 'task');
    expect(move?.detail).toMatchObject({ from: 'not_started', to: 'in_progress', source: 'proposal', approver: 'u_bo' });
    expect(move?.detail['causeId']).toBe(h.proposalId);
  });
});

describe('T1792 · a second person declines', () => {
  it('refuses the move and leaves the card where it was', async () => {
    const h = await waiting();
    const outcome = await h.service.adjudicatePending(approver, h.proposalId, { approve: false, reason: 'Not yet' });
    expect(outcome.verdict).toBe('refused');
    expect((await h.store.findTask(h.task.id))?.status).toBe('not_started');
  });

  it('states the decline reason back, so the proposer learns why', async () => {
    const h = await waiting();
    const outcome = await h.service.adjudicatePending(approver, h.proposalId, { approve: false, reason: 'Not yet' });
    expect(outcome.reason).toContain('Not yet');
  });
});

describe('T1792 · who may not adjudicate', () => {
  it('refuses the PROPOSER — that is the whole content of requiring an approver', async () => {
    const h = await waiting();
    const outcome = await h.service.adjudicatePending(
      { workspaceId: WS, actorId: 'u_ana', actorType: 'user', canMove: true },
      h.proposalId,
      { approve: true },
    );
    expect(outcome.verdict).toBe('refused');
    expect(outcome.reason).toMatch(/second person|own proposal/i);
    expect((await h.store.findTask(h.task.id))?.status).toBe('not_started');
  });

  it('refuses an AGENT principal (Constitution XII.6)', async () => {
    const h = await waiting();
    const outcome = await h.service.adjudicatePending(
      { workspaceId: WS, actorId: 'agent_1', actorType: 'agent', canMove: true },
      h.proposalId,
      { approve: true },
    );
    expect(outcome.verdict).toBe('refused');
    expect((await h.store.findTask(h.task.id))?.status).toBe('not_started');
  });

  it('refuses a person without the move permission — approving a move is making it', async () => {
    const h = await waiting();
    const outcome = await h.service.adjudicatePending({ ...approver, canMove: false }, h.proposalId, { approve: true });
    expect(outcome.verdict).toBe('refused');
    expect((await h.store.findTask(h.task.id))?.status).toBe('not_started');
  });
});

describe('T1792 · a proposal that is not waiting', () => {
  it('answers inconsistent for one already applied, rather than applying it twice', async () => {
    const h = await waiting({ verdicts: [{ proposalId: 'any', verdict: 'applied', occurredAt: '2026-09-07T10:00:00.000Z' }] });
    const outcome = await h.service.adjudicatePending(approver, h.proposalId, { approve: true });
    expect(outcome.verdict).toBe('inconsistent');
  });

  it('answers inconsistent for one with no recorded verdict at all', async () => {
    const h = await waiting({ verdicts: [] });
    const outcome = await h.service.adjudicatePending(approver, h.proposalId, { approve: true });
    expect(outcome.verdict).toBe('inconsistent');
  });

  it('answers inconsistent when the task has moved since the proposal (FR-KAN-016)', async () => {
    const h = await waiting();
    // Something else moved the card — a parse, an event, another proposal.
    await h.store.applyStatus(WS, h.task.id, { status: 'done', statusSource: 'parse', at: new Date(), by: null });
    const outcome = await h.service.adjudicatePending(approver, h.proposalId, { approve: true });
    expect(outcome.verdict).toBe('inconsistent');
    expect((await h.store.findTask(h.task.id))?.status).toBe('done');
  });

  it('refuses a proposal of another workspace as absence', async () => {
    const h = await waiting();
    await expect(
      h.service.adjudicatePending({ ...approver, workspaceId: 'ws_other' }, h.proposalId, { approve: true }),
    ).rejects.toThrow();
  });
});
