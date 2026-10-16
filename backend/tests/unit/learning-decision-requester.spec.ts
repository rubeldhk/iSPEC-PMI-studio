/**
 * `T2348` (EPIC-048, `FR-LRN-020`, `-021`, `-023`, `-024`, `-030`; `R-048-5`,
 * `R-048-12`) — every candidate decision is an `EPIC-031` `DecisionRequest`.
 *
 * The request:
 * - targets `{type: 'learning-candidate', id}`, `objectVersion` = the digest of
 *   the canonical core;
 * - asks `learning.approve.<category>` only on the automatic path, else
 *   `learning.review.<kind>`;
 * - is made by `{kind: 'automation', id: 'learning-intake'}`, `requestedBy` the
 *   submitter, `triggeredBy` the candidate;
 * - carries `proposedClass` only when the submitter proposed one.
 *
 * Outcomes: `pending` → `pending-review`; `refused` → stays `proposed` with the
 * explanation; an unreachable engine → `proposed` with
 * `decision-path-unavailable`, and **never** approved.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { DecisionRequester } from '../../src/modules/learning/decision.requester.js';
import { InMemoryLearningStore, type CandidateRecord } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import { candidateRecord, citationFor, DIGEST } from '../helpers/learning-fixtures.js';
import { learningWorld, verified, type LearningTestWorld } from '../helpers/learning-ports.js';

let world: LearningTestWorld;
let store: InMemoryLearningStore;

function requester(ports = world.ports): DecisionRequester {
  return new DecisionRequester({ store, ports, policy: new LearningPolicyReader(ports.policy) });
}

async function seeded(over: Partial<CandidateRecord> = {}): Promise<CandidateRecord> {
  const c = candidateRecord({ category: 'test-setup', objectDigest: 'c'.repeat(64), ...over });
  await store.transaction((tx) =>
    tx.insertCandidate(c, [citationFor(c, { evidenceId: 'ev_1', digest: DIGEST })], { workspaceId: c.workspaceId, candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() }),
  );
  return c;
}

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
});

describe('T2348 · the DecisionRequest', () => {
  it('targets the candidate at its digest, as the intake automation, for the submitter, triggered by the candidate', async () => {
    const c = await seeded({ category: 'architecture' });
    await requester().request(c);
    expect(world.decisions.requests[0]).toEqual({
      workspaceId: 'ws_a',
      projectId: 'p1',
      actionType: 'learning.review.candidate',
      target: { type: 'learning-candidate', id: c.id },
      objectVersion: 'c'.repeat(64),
      actor: { kind: 'automation', id: 'learning-intake' },
      requiredGates: [],
      requestedBy: 'agent_1',
      triggeredBy: { ruleId: 'learning.candidate-submitted', eventId: c.id },
    });
  });

  it('T2676 · an open source-invalid flag sends it to review, naming source-invalid; a cleared one does not', async () => {
    const c = await seeded();
    await store.transaction((tx) => tx.appendFlag({ id: 'kf_src', workspaceId: 'ws_a', versionId: null, candidateId: c.id, kind: 'source-invalid', detail: 'validation-failed', raisedAt: new Date(), clearsFlagId: null }));
    const out = await requester().request(c);
    expect(out.eligibility).toEqual({ automatic: false, failedConditions: ['source-invalid'] });
    expect(world.decisions.requests[0]!.actionType).toBe('learning.review.candidate');
    await store.transaction((tx) => tx.appendFlag({ id: 'kf_src_clear', workspaceId: 'ws_a', versionId: null, candidateId: c.id, kind: 'source-invalid', detail: 'cleared', raisedAt: new Date(), clearsFlagId: 'kf_src' }));
    expect((await requester().eligibility(c)).automatic).toBe(true);
  });

  it('asks learning.approve.<category> only on the automatic path', async () => {
    const c = await seeded();
    const out = await requester().request(c);
    expect(world.decisions.requests[0]!.actionType).toBe('learning.approve.test-setup');
    expect(out.eligibility).toEqual({ automatic: true, failedConditions: [] });
  });

  it.each([
    ['supersede', 'learning.review.supersede'],
    ['deprecate', 'learning.review.deprecate'],
    ['widen-scope', 'learning.review.widen-scope'],
  ] as const)('a %s candidate asks %s', async (kind, actionType) => {
    const c = await seeded({ kind, targetVersionId: 'kv_1' });
    await requester().request(c);
    expect(world.decisions.requests[0]!.actionType).toBe(actionType);
  });

  it('an integrity-failed citation sends it to review (eligibility reads the unfiltered state)', async () => {
    world.evidence.set('ev_1', verified('ev_1', { integrity: 'failed' }));
    const out = await requester().request(await seeded());
    expect(world.decisions.requests[0]!.actionType).toBe('learning.review.candidate');
    expect(out.eligibility.failedConditions).toContain('evidence-not-verified');
  });

  it('carries proposedClass only when the submitter proposed one (FR-LRN-023)', async () => {
    await requester().request(await seeded({ proposedBand: 'low' }));
    await requester().request(await seeded({ proposedBand: null, idempotencyKey: 'other' }));
    expect(world.decisions.requests[0]!.proposedClass).toBe('low');
    expect(world.decisions.requests[1]).not.toHaveProperty('proposedClass');
  });
});

describe('T2348 · outcomes', () => {
  it('pending → pending-review, naming the decision', async () => {
    const c = await seeded({ category: 'architecture' });
    const out = await requester().request(c);
    expect(out).toMatchObject({ state: 'pending-review', decisionId: 'dec_1' });
    expect(await store.currentTransition('ws_a', c.id)).toMatchObject({ state: 'pending-review', decisionId: 'dec_1', actorKind: 'platform' });
  });

  it('refused by policy → stays proposed with the explanation, naming the decision', async () => {
    world.decisions.next = 'refused';
    const c = await seeded({ category: 'architecture' });
    const out = await requester().request(c);
    expect(out.state).toBe('proposed');
    expect(out.reason).toMatch(/automation not permitted/);
    expect(await store.currentTransition('ws_a', c.id)).toMatchObject({ state: 'proposed', reason: 'decision-refused-by-policy', decisionId: 'dec_1' });
  });

  it('an unreachable engine → proposed, decision-path-unavailable, never approved (FR-LRN-030)', async () => {
    world.decisions.next = 'unreachable';
    const c = await seeded();
    const out = await requester().request(c);
    expect(out.state).toBe('proposed');
    expect(await store.currentTransition('ws_a', c.id)).toMatchObject({ state: 'proposed', reason: 'decision-path-unavailable' });
  });

  it('an unbound decision port is the same: proposed, never approved', async () => {
    const c = await seeded();
    const out = await requester({ ...world.ports, decisions: refusingPorts().decisions }).request(c);
    expect(out.state).toBe('proposed');
    expect((await store.transitions('ws_a', c.id)).map((t) => t.state)).not.toContain('approved');
  });

  it('auto-executed is handed to the resolution path — never approved here (R-048-4)', async () => {
    world.decisions.next = 'auto-executed';
    const handed: string[] = [];
    const c = await seeded();
    const r = new DecisionRequester({
      store,
      ports: world.ports,
      policy: new LearningPolicyReader(world.ports.policy),
      applyResolution: async (cand, resolution) => {
        handed.push(`${cand.id}:${resolution.outcome}`);
        return { state: 'approved' };
      },
    });
    const out = await r.request(c);
    expect(handed).toEqual([`${c.id}:auto-executed`]);
    expect(out.state).toBe('approved');
    expect(await store.currentTransition('ws_a', c.id)).toMatchObject({ state: 'pending-review', decisionId: 'dec_1' });
  });

  it('counts decision attempts as the distinct decisions on a candidate’s transitions (R-048-6, I1)', async () => {
    const c = await seeded({ category: 'architecture' });
    await requester().request(c);
    expect(await requester().attempts(c)).toBe(1);
  });
});
