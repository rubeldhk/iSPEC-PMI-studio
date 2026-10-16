/**
 * `T2390` (EPIC-048 Phase 9, `R-048-5`, `R-048-7`; `FR-LRN-020`, `-027`,
 * `-030`) — `LearningDecisions` over `EPIC-031`'s **real** `DecisionEngine`.
 *
 * - `decide`, `approve`, `refuse` and `resolutionOf` pass straight to the
 *   engine; nothing is decided here;
 * - the request this Epic builds **is** `packages/decision-contract`'s
 *   `DecisionRequest` (asserted at the type level, so a drift fails `tsc`);
 * - an approval or closure the engine **refuses** (self-approval, an
 *   automation approving, a rejection by the requester) is not a resolution:
 *   the decision stays pending, and the adapter throws `403` with the engine's
 *   reason rather than handing back a `refused` that would reject the candidate;
 * - `resolutionOf` reads `null` while pending, the resolving row once resolved
 *   (closure included, `A-031-1`), and the request itself when it was
 *   concluded on the spot.
 *
 * `A-031-3`'s `DecisionEngine.resolutionOf` export is asserted in `EPIC-031`'s
 * suite, `decision-resolution-of.spec.ts`.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { DecisionRequest } from '@pmi/decision-contract';
import { ForbiddenError, NotFoundError } from '../../src/core/errors.js';
import { decisionsAdapter } from '../../src/modules/learning/adapters/decisions.adapter.js';
import type { LearningDecisionRequest } from '../../src/modules/learning/learning.tokens.js';
import { engine, policy, rules, WS } from '../helpers/decision-engine.js';

function learningRequest(over: Partial<LearningDecisionRequest> = {}): LearningDecisionRequest {
  return {
    workspaceId: WS,
    projectId: 'p1',
    actionType: 'learning.review.new',
    target: { type: 'learning-candidate', id: 'lc_1' },
    objectVersion: 'sha256:abc',
    actor: { kind: 'automation', id: 'learning-intake' },
    requiredGates: [],
    requestedBy: 'agent_7',
    triggeredBy: { ruleId: 'learning.candidate-submitted', eventId: 'lc_1' },
    ...over,
  };
}

/** A real engine: learning.approve.* low and automatable, everything else high. */
function world() {
  const harness = engine({
    steering: rules([{ actionPattern: 'learning.approve.*', band: 'low' }]),
    policies: policy({ automatedActions: [{ actionPattern: 'learning.*', ruleId: 'learning.candidate-submitted' }] }),
  });
  return { ...harness, port: decisionsAdapter(harness.engine, harness.repository) };
}

describe('T2390 · the request is decision-contract’s DecisionRequest', () => {
  it('LearningDecisionRequest is assignable to DecisionRequest', () => {
    expectTypeOf<LearningDecisionRequest>().toMatchTypeOf<DecisionRequest>();
  });
});

describe('T2390 · decide passes straight to DecisionEngine.decide', () => {
  it('a high-band review waits for a human, and the view names the rule it was classified under', async () => {
    const { port, repository } = world();
    const view = await port.decide(learningRequest());
    expect(view).toMatchObject({ outcome: 'pending', effectiveClass: 'high', actionType: 'learning.review.new' });
    expect(typeof view.explanation.policyVersion).toBe('string');
    const row = await repository.get(WS, view.decisionId);
    expect(row).toMatchObject({ actionType: 'learning.review.new', target: { type: 'learning-candidate', id: 'lc_1' }, requestedBy: 'agent_7', actorKind: 'automation', actorId: 'learning-intake' });
  });

  it('a low-band approval under a permitting tenant policy is auto-executed, and resolutionOf reads the request itself', async () => {
    const { port } = world();
    const view = await port.decide(learningRequest({ actionType: 'learning.approve.test-setup' }));
    expect(view.outcome).toBe('auto-executed');
    expect(view.explanation.matchedRule).toBe('lin-risk@v4');
    await expect(port.resolutionOf(WS, view.decisionId)).resolves.toMatchObject({
      decisionId: view.decisionId, resolvingDecisionId: null, outcome: 'auto-executed', actorKind: 'automation', decidedBy: 'learning-intake', requestedBy: 'agent_7',
    });
  });
});

describe('T2390 · approve and refuse pass straight through; a refused attempt is not a resolution', () => {
  it('approval by another human resolves it; resolutionOf then reads the resolving row', async () => {
    const { port } = world();
    const { decisionId } = await port.decide(learningRequest());
    await expect(port.resolutionOf(WS, decisionId)).resolves.toBeNull();
    const resolution = await port.approve({ workspaceId: WS, decisionId, approver: { kind: 'human', id: 'u_reviewer' } });
    expect(resolution).toMatchObject({ decisionId, outcome: 'approved', actorKind: 'human', decidedBy: 'u_reviewer', actionType: 'learning.review.new', requestedBy: 'agent_7', effectiveClass: 'high' });
    expect(resolution.resolvingDecisionId).not.toBeNull();
    expect(resolution.resolvingDecisionId).not.toBe(decisionId);
    await expect(port.resolutionOf(WS, decisionId)).resolves.toEqual(resolution);
  });

  it('self-approval (FR-DPE-015) is refused with 403 and the engine’s reason — the decision stays pending', async () => {
    const { port } = world();
    const { decisionId } = await port.decide(learningRequest({ requestedBy: 'u_self' }));
    const err = await port.approve({ workspaceId: WS, decisionId, approver: { kind: 'human', id: 'u_self' } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as Error).message).toMatch(/FR-DPE-015/);
    await expect(port.resolutionOf(WS, decisionId)).resolves.toBeNull();
  });

  it('a rejection by another human is a closure with its kind and reason (A-031-1)', async () => {
    const { port } = world();
    const { decisionId } = await port.decide(learningRequest());
    const resolution = await port.refuse({ workspaceId: WS, decisionId, by: { kind: 'human', id: 'u_reviewer' }, kind: 'rejected', reason: 'not true of p2' });
    expect(resolution).toMatchObject({ outcome: 'refused', actorKind: 'human', decidedBy: 'u_reviewer', closure: { kind: 'rejected', reason: 'not true of p2' } });
    await expect(port.resolutionOf(WS, decisionId)).resolves.toEqual(resolution);
  });

  it('expiry and withdrawal by the requesting automation close its own request', async () => {
    const { port } = world();
    for (const kind of ['expired', 'withdrawn'] as const) {
      const { decisionId } = await port.decide(learningRequest({ target: { type: 'learning-candidate', id: `lc_${kind}` } }));
      const resolution = await port.refuse({ workspaceId: WS, decisionId, by: { kind: 'automation', id: 'learning-intake' }, kind, reason: `${kind} by learning` });
      expect(resolution).toMatchObject({ outcome: 'refused', actorKind: 'automation', closure: { kind } });
    }
  });

  it('a rejection by the requester is refused 403 — never read as a refusal of the candidate', async () => {
    const { port } = world();
    const { decisionId } = await port.decide(learningRequest({ requestedBy: 'u_self' }));
    const err = await port.refuse({ workspaceId: WS, decisionId, by: { kind: 'human', id: 'u_self' }, kind: 'rejected', reason: 'changed my mind' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as Error).message).toMatch(/withdraw/);
    await expect(port.resolutionOf(WS, decisionId)).resolves.toBeNull();
  });

  it('resolutionOf a decision EPIC-031 does not hold is a fault, never “pending”', async () => {
    const { port } = world();
    await expect(port.resolutionOf(WS, 'dec_none')).rejects.toBeInstanceOf(NotFoundError);
  });
});
