/**
 * T2503 — closing a pending decision without approving it. `FR-DPE-017`
 * (amendment `A-031-1`, for `EPIC-048`).
 *
 * Three closures, each a new resolving row with outcome `refused` — never an
 * update, never an approval:
 *
 * - **rejected** by an authorized human who is not the requester;
 * - **withdrawn** by the requester, human or automation;
 * - **expired** by the requesting automation, for its own request only.
 *
 * Anything else is an unauthorized attempt: it is audited, nothing is recorded
 * as a resolution, and the decision stays pending for someone entitled to
 * close or approve it — the same shape as an unauthorized approval.
 */
import { describe, expect, it } from 'vitest';
import type { ActorRef, ClosureKind } from '@pmi/decision-contract';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../src/core/errors.js';
import { AuditServiceSink } from '../../src/modules/decision/adapters.js';
import { engine, policy, request, WS } from '../helpers/decision-engine.js';

const human = (id: string): ActorRef => ({ kind: 'human', id });
const bot = (id: string): ActorRef => ({ kind: 'automation', id });

/** A high-band request awaiting a human — by a person, or by permitted automation. */
async function scene() {
  const harness = engine({
    policies: policy({ automatedActions: [{ actionPattern: 'learning.*', ruleId: 'rule-learn' }] }),
  });
  const byAlice = await harness.engine.decide(
    request({ actionType: 'release.promote', requestedBy: 'u_alice', actor: human('u_alice') }),
  );
  const byBot = await harness.engine.decide(
    request({
      actionType: 'learning.promote',
      target: { type: 'learning-candidate', id: 'c-1' },
      actor: bot('svc-learning'),
      triggeredBy: { ruleId: 'rule-learn', eventId: 'evt-1' },
    }),
  );
  expect(byAlice.outcome).toBe('pending');
  expect(byBot).toMatchObject({ outcome: 'pending', effectiveClass: 'high' });
  const close = (decisionId: string, by: ActorRef, kind: ClosureKind, reason = 'stated reason') =>
    harness.engine.refuse({ workspaceId: WS, decisionId, by, kind, reason });
  return { ...harness, byAlice, byBot, close };
}

describe('T2503 · FR-DPE-017 — the three closures, each a resolving refused row', () => {
  it('records a rejection by another human, with its kind, reason and actor', async () => {
    const { byAlice, close, repository, audit } = await scene();
    const result = await close(byAlice.decisionId, human('u_bob'), 'rejected', 'the release notes are incomplete');
    expect(result).toMatchObject({
      outcome: 'refused',
      effectiveClass: 'high',
      explanation: expect.objectContaining({ closure: { kind: 'rejected', reason: 'the release notes are incomplete' } }),
    });
    const row = (await repository.resolutionOf(WS, byAlice.decisionId))!;
    expect(row).toMatchObject({
      id: result.decisionId,
      outcome: 'refused',
      decidedBy: 'u_bob',
      actorKind: 'human',
      actorId: 'u_bob',
      resolvesDecisionId: byAlice.decisionId,
      objectVersion: '7',
    });
    expect(row.explanation.authorityApplied).toMatch(/rejected by u_bob/);
    expect(audit.entries.at(-1)).toMatchObject({ decisionId: result.decisionId, outcome: 'refused', actor: 'u_bob' });
  });

  it('records a withdrawal by its human requester', async () => {
    const { byAlice, close } = await scene();
    const result = await close(byAlice.decisionId, human('u_alice'), 'withdrawn', 'no longer needed');
    expect(result.explanation.closure).toEqual({ kind: 'withdrawn', reason: 'no longer needed' });
  });

  it.each(['withdrawn', 'expired'] as const)(
    'records %s by the requesting automation, on its own high-band request',
    async (kind) => {
      const { byBot, close, repository } = await scene();
      const result = await close(byBot.decisionId, bot('svc-learning'), kind, 'review window elapsed');
      expect(result.outcome).toBe('refused');
      expect(await repository.resolutionOf(WS, byBot.decisionId)).toMatchObject({
        actorKind: 'automation',
        decidedBy: 'svc-learning',
        explanation: expect.objectContaining({ closure: { kind, reason: 'review window elapsed' } }),
      });
    },
  );

  it('never records anything but refused — a closure cannot approve', async () => {
    const { byAlice, byBot, close, repository } = await scene();
    await close(byAlice.decisionId, human('u_bob'), 'rejected');
    await close(byBot.decisionId, bot('svc-learning'), 'expired');
    const closures = (await repository.list(WS)).filter((d) => d.explanation.closure !== undefined);
    expect(closures.map((d) => d.outcome)).toEqual(['refused', 'refused']);
  });
});

describe('T2503 · FR-DPE-017 — an unauthorized closure is audited and leaves the decision pending', () => {
  it.each([
    ['self-reject: the requester rejecting their own request', 'byAlice', human('u_alice'), 'rejected', /u_alice requested this.*withdraw/],
    ['automation closing a request it did not make', 'byAlice', bot('svc-learning'), 'withdrawn', /only its own request/],
    ['automation rejecting — even its own request', 'byBot', bot('svc-learning'), 'rejected', /only an authorized human may reject/],
    ['a human expiring a request', 'byAlice', human('u_bob'), 'expired', /expired only by the automation that requested it/],
    ['a human withdrawing someone else’s request', 'byAlice', human('u_bob'), 'withdrawn', /only u_alice, who requested it, may withdraw/],
  ] as const)('refuses %s', async (_label, which, by, kind, why) => {
    const s = await scene();
    const target = s[which];
    const before = s.audit.entries.length;
    const result = await s.close(target.decisionId, by, kind);
    expect(result.outcome).toBe('refused');
    expect(result.decisionId).toBe(target.decisionId);
    expect(result.explanation.closure).toBeUndefined();
    expect(result.explanation.authorityApplied).toMatch(why);
    expect(await s.repository.resolutionOf(WS, target.decisionId)).toBeNull();
    expect((await s.repository.get(WS, target.decisionId))!.outcome).toBe('pending');
    expect(s.audit.entries.slice(before)).toEqual([
      { workspaceId: WS, decisionId: target.decisionId, actionType: expect.any(String), outcome: 'closure-refused', actor: by.id },
    ]);
  });

  it('audits an unauthorized closure to EPIC-004 as refused', async () => {
    const recorded: Array<{ outcome: string; detail?: Record<string, unknown> }> = [];
    const sink = new AuditServiceSink({ record: async (input) => void recorded.push(input) });
    await sink.record({ workspaceId: WS, decisionId: 'd1', actionType: 'release.promote', outcome: 'closure-refused', actor: 'u_alice' });
    expect(recorded).toEqual([expect.objectContaining({ outcome: 'refused', detail: expect.objectContaining({ decisionOutcome: 'closure-refused' }) })]);
  });
});

describe('T2503 · FR-DPE-017 — caller errors and the decision’s state', () => {
  it('refuses an empty reason, and an unknown kind, as caller errors', async () => {
    const { byAlice, close } = await scene();
    await expect(close(byAlice.decisionId, human('u_bob'), 'rejected', '   ')).rejects.toBeInstanceOf(ValidationFailedError);
    await expect(close(byAlice.decisionId, human('u_bob'), 'cancelled' as ClosureKind)).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it('refuses closing a decision twice, or one that was approved', async () => {
    const { byAlice, byBot, close, engine: e } = await scene();
    await close(byAlice.decisionId, human('u_bob'), 'rejected');
    await expect(close(byAlice.decisionId, human('u_carol'), 'rejected')).rejects.toBeInstanceOf(ConflictError);
    await e.approve({ workspaceId: WS, decisionId: byBot.decisionId, approver: human('u_bob') });
    await expect(close(byBot.decisionId, bot('svc-learning'), 'expired')).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuses closing a decision that is not pending, or does not exist', async () => {
    const { close, engine: e } = await scene();
    const auto = await e.decide(request({ actionType: 'release.promote', requiredGates: ['g-missing'] }));
    expect(auto.outcome).toBe('refused');
    await expect(close(auto.decisionId, human('u_bob'), 'rejected')).rejects.toBeInstanceOf(ConflictError);
    await expect(close('nope', human('u_bob'), 'rejected')).rejects.toBeInstanceOf(NotFoundError);
  });
});
