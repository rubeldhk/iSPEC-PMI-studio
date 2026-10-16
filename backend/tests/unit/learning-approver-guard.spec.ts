/**
 * `T2350` (EPIC-048, `FR-LRN-027`, `R-048-6` layer 2; `MP-3`'s target) — an AI
 * never approves, whatever `EPIC-031` records.
 *
 * `EPIC-031`'s `ActorRef` cannot say *agent*, and its HTTP service labels every
 * session principal `human`. So "approved by human X" is not taken at its word:
 *
 * Accepted:
 * - `approved`, actor kind `human`, and `decidedBy` resolving to a **User** that
 *   is none of the candidate's AI source identities;
 * - `auto-executed` on a `learning.approve.*` request made by `learning-intake`.
 *
 * **Not** accepted:
 * - `approved` by `{kind: 'human', id: <agent principal>}`;
 * - approval by the candidate's own agent, its Expert, or a corroborating agent;
 * - `auto-executed` on any `learning.review.*` (`policy-auto-executed-review`);
 * - `Principals` unbound — an approver whose kind is unknown is not a human.
 *
 * What a refusal does to the candidate (back to `proposed`, flagged, audited —
 * `I1`) is the materialiser's, asserted in `learning-materialiser.spec.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApproverGuard } from '../../src/modules/learning/approver.guard.js';
import { refusingPorts, type ResolutionView } from '../../src/modules/learning/learning.tokens.js';
import type { CorroborationRecord } from '../../src/modules/learning/learning.store.js';
import { candidateRecord } from '../helpers/learning-fixtures.js';
import { learningWorld, type LearningTestWorld } from '../helpers/learning-ports.js';

let world: LearningTestWorld;

function resolution(over: Partial<ResolutionView> = {}): ResolutionView {
  return {
    decisionId: 'dec_1',
    resolvingDecisionId: 'dec_1_r',
    outcome: 'approved',
    actorKind: 'human',
    decidedBy: 'u_h',
    actionType: 'learning.review.candidate',
    requestedBy: 'agent_1',
    effectiveClass: 'high',
    explanation: { policyVersion: '3', matchedRule: null, riskClass: 'high', authorityApplied: 'steering' },
    ...over,
  };
}

const corroboration = (over: Partial<CorroborationRecord>): CorroborationRecord => ({
  id: 'co_1', workspaceId: 'ws_a', candidateId: 'lc_x', sourceKind: 'execution', executionId: 'exe_2', sourcePrincipalId: 'agent_2', expertId: null, expertContractVersionId: null,
  statement: 's', confidenceLevel: 'low', confidenceBasis: 'b', late: false, idempotencyKey: 'k', correlationId: 'c', submittedAt: new Date(), objectDigest: null, ...over,
});

const candidate = candidateRecord({ sourcePrincipalId: 'agent_1', expertId: 'expert_1', expertContractVersionId: 'ecv', expertContractVersion: 1 });

beforeEach(() => {
  world = learningWorld();
});

describe('T2350 · accepted', () => {
  it('a human-kind approval by a User who is none of the AI sources', async () => {
    const v = await new ApproverGuard(world.ports.principals).judge({ candidate, corroborations: [], resolution: resolution() });
    expect(v).toEqual({ accepted: true, approvedByKind: 'human', approvedBy: 'u_h' });
  });

  it('auto-executed on a learning.approve.* request by learning-intake — policy, not an AI', async () => {
    const v = await new ApproverGuard(world.ports.principals).judge({
      candidate,
      corroborations: [],
      resolution: resolution({ outcome: 'auto-executed', actorKind: 'automation', decidedBy: 'learning-intake', actionType: 'learning.approve.test-setup', resolvingDecisionId: null }),
    });
    expect(v).toEqual({ accepted: true, approvedByKind: 'policy', approvedBy: 'policy:v3' });
  });
});

describe('T2350 · not accepted', () => {
  it('approved by {kind: human, id: <agent principal>} — what EPIC-031’s HTTP service records for any session', async () => {
    world.principals.set('agent_9', 'agent');
    const v = await new ApproverGuard(world.ports.principals).judge({ candidate, corroborations: [], resolution: resolution({ decidedBy: 'agent_9' }) });
    expect(v).toMatchObject({ accepted: false, reason: 'decision-not-accepted' });
    if (!v.accepted) expect(v.detail).toMatch(/agent_9.*agent/);
  });

  it.each(['service', 'connector'] as const)('approved by a %s principal', async (kind) => {
    world.principals.set('np_1', kind);
    const v = await new ApproverGuard(world.ports.principals).judge({ candidate, corroborations: [], resolution: resolution({ decidedBy: 'np_1' }) });
    expect(v.accepted).toBe(false);
  });

  it('an id that resolves to nothing is not a human', async () => {
    const v = await new ApproverGuard(world.ports.principals).judge({ candidate, corroborations: [], resolution: resolution({ decidedBy: 'nobody' }) });
    expect(v.accepted).toBe(false);
  });

  it.each([
    ['the candidate’s own agent', 'agent_1'],
    ['its Expert', 'expert_1'],
    ['a corroborating agent', 'agent_2'],
    ['a corroborating Expert', 'expert_2'],
  ])('approval by %s — even recorded as human', async (_name, id) => {
    world.principals.set(id, 'human');
    const v = await new ApproverGuard(world.ports.principals).judge({
      candidate,
      corroborations: [corroboration({ sourcePrincipalId: 'agent_2', expertId: 'expert_2' })],
      resolution: resolution({ decidedBy: id }),
    });
    expect(v).toMatchObject({ accepted: false, reason: 'decision-not-accepted' });
  });

  it('a corroborating person is not an AI identity — a different human may still approve', async () => {
    const v = await new ApproverGuard(world.ports.principals).judge({
      candidate,
      corroborations: [corroboration({ sourceKind: 'person', executionId: null, sourcePrincipalId: 'u_h2' })],
      resolution: resolution({ decidedBy: 'u_h' }),
    });
    expect(v.accepted).toBe(true);
  });

  it('auto-executed on any learning.review.* — flagged policy-auto-executed-review (RK-5)', async () => {
    const v = await new ApproverGuard(world.ports.principals).judge({
      candidate,
      corroborations: [],
      resolution: resolution({ outcome: 'auto-executed', actorKind: 'automation', decidedBy: 'learning-intake', actionType: 'learning.review.supersede' }),
    });
    expect(v).toMatchObject({ accepted: false, reason: 'policy-auto-executed-review' });
  });

  it('auto-executed by anyone but learning-intake', async () => {
    const v = await new ApproverGuard(world.ports.principals).judge({
      candidate,
      corroborations: [],
      resolution: resolution({ outcome: 'auto-executed', actorKind: 'automation', decidedBy: 'someone-else', actionType: 'learning.approve.test-setup' }),
    });
    expect(v.accepted).toBe(false);
  });

  it('an automation-kind approval', async () => {
    const v = await new ApproverGuard(world.ports.principals).judge({ candidate, corroborations: [], resolution: resolution({ actorKind: 'automation' }) });
    expect(v.accepted).toBe(false);
  });

  it('Principals unbound — refused, not assumed human', async () => {
    const v = await new ApproverGuard(refusingPorts().principals).judge({ candidate, corroborations: [], resolution: resolution() });
    expect(v).toMatchObject({ accepted: false, reason: 'decision-not-accepted' });
    if (!v.accepted) expect(v.detail).toMatch(/Principals/);
  });

  it('a refusal or a pending decision is not an approval at all', async () => {
    for (const outcome of ['refused', 'exception'] as const) {
      const v = await new ApproverGuard(world.ports.principals).judge({ candidate, corroborations: [], resolution: resolution({ outcome }) });
      expect(v.accepted).toBe(false);
    }
  });
});
