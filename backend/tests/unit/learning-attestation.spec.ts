/**
 * `T2356` (EPIC-048, `FR-LRN-025`, `R-048-19`) — every approval is evidenced.
 *
 * Automatic and human approvals alike contribute an `approval/v1` attestation to
 * the Evidence Store: platform source `pmi:learning`, attached to the decision,
 * attesting the entry and version, with the predicate body of `R-048-19`.
 *
 * It is contributed **after** the version commits. A failure flags the version
 * `attestation-missing` and does not roll it back — the approval is decided and
 * audited by `EPIC-031` already. A later retry clears the flag with a new row.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApproverGuard } from '../../src/modules/learning/approver.guard.js';
import { approvalAttestation, retryMissingAttestations, APPROVAL_PREDICATE } from '../../src/modules/learning/attestation.js';
import { InMemoryKnowledgeWriter } from '../../src/modules/learning/knowledge.writer.js';
import { InMemoryLearningStore, type CandidateRecord } from '../../src/modules/learning/learning.store.js';
import { LearningPolicyReader } from '../../src/modules/learning/learning-policy.js';
import type { ApprovalAttestationInput, ResolutionView } from '../../src/modules/learning/learning.tokens.js';
import { Materialiser, versionDigest } from '../../src/modules/learning/materialiser.js';
import { candidateRecord, citationFor } from '../helpers/learning-fixtures.js';
import { learningWorld, type LearningTestWorld } from '../helpers/learning-ports.js';

let world: LearningTestWorld;
let store: InMemoryLearningStore;

function materialiser(): Materialiser {
  const ports = world.ports;
  return new Materialiser({
    store,
    writer: new InMemoryKnowledgeWriter(store, ports.audit),
    ports,
    policy: new LearningPolicyReader(ports.policy),
    guard: new ApproverGuard(ports.principals),
    after: [approvalAttestation({ store, ports })],
  });
}

async function pending(over: Partial<CandidateRecord> = {}): Promise<CandidateRecord> {
  const c = candidateRecord(over);
  await store.transaction(async (tx) => {
    await tx.insertCandidate(c, [citationFor(c)], { workspaceId: 'ws_a', candidateId: c.id, state: 'proposed', reason: null, decisionId: null, actorKind: 'platform', actorId: 'learning-intake', at: new Date() });
    await tx.appendTransition({ workspaceId: 'ws_a', candidateId: c.id, state: 'pending-review', reason: null, decisionId: 'dec_1', actorKind: 'platform', actorId: 'learning-intake', at: new Date() });
  });
  return c;
}

const auto: ResolutionView = {
  decisionId: 'dec_1', resolvingDecisionId: null, outcome: 'auto-executed', actorKind: 'automation', decidedBy: 'learning-intake', actionType: 'learning.approve.test-setup', requestedBy: 'agent_1', effectiveClass: 'low',
  explanation: { policyVersion: '4', matchedRule: 'learning.approve.test-setup → low', riskClass: 'low', authorityApplied: 'auto-execute' },
};
const human: ResolutionView = { ...auto, resolvingDecisionId: 'dec_1_r', outcome: 'approved', actorKind: 'human', decidedBy: 'u_h', actionType: 'learning.review.candidate', effectiveClass: 'high', explanation: { ...auto.explanation, riskClass: 'high', matchedRule: null } };

beforeEach(() => {
  world = learningWorld();
  store = new InMemoryLearningStore();
});

describe('T2356 · approval/v1 for every approval (FR-LRN-025)', () => {
  it('an automatic approval contributes the attestation R-048-19 defines', async () => {
    const c = await pending({ category: 'test-setup' });
    const out = await materialiser().applyResolution('ws_a', c.id, auto);
    const version = (await store.version('ws_a', out.versionId!))!;
    const input = world.attestations[0] as ApprovalAttestationInput;
    expect(input).toMatchObject({
      predicateType: APPROVAL_PREDICATE,
      sourceUri: 'pmi:learning',
      attachedTo: { type: 'decision', id: 'dec_1' },
      attestedArtifact: { id: version.entryId, version: 1 },
      decisionId: 'dec_1',
      resolvingDecisionId: null,
      candidateId: c.id,
      entryId: version.entryId,
      entryVersionId: version.id,
      versionNumber: 1,
      outcome: 'auto-executed',
      approvedByKind: 'policy',
      approvedBy: 'policy:v4',
      policyVersion: '4',
      matchedRule: 'learning.approve.test-setup → low',
      effectiveClass: 'low',
      subjectDigest: versionDigest(version),
    });
    expect(APPROVAL_PREDICATE).toBe('https://pmi.studio/attestation/approval/v1');
  });

  it('a human approval contributes one too — uniformity costs one call', async () => {
    const c = await pending();
    await materialiser().applyResolution('ws_a', c.id, human);
    expect(world.attestations).toHaveLength(1);
    expect(world.attestations[0]).toMatchObject({ outcome: 'approved', approvedByKind: 'human', approvedBy: 'u_h', resolvingDecisionId: 'dec_1_r' });
  });

  it('no attestation for a refusal — nothing was approved', async () => {
    const c = await pending();
    await materialiser().applyResolution('ws_a', c.id, { ...human, decidedBy: 'agent_1' });
    expect(world.attestations).toEqual([]);
  });
});

describe('T2356 · a contribution failure flags and never rolls back', () => {
  it('flags attestation-missing; the version stands', async () => {
    world.attestationFails = true;
    const c = await pending();
    const out = await materialiser().applyResolution('ws_a', c.id, human);
    expect(out.state).toBe('approved');
    expect(await store.version('ws_a', out.versionId!)).not.toBeNull();
    const flags = await store.flags('ws_a', { versionId: out.versionId! });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ kind: 'attestation-missing' });
    expect(flags[0]!.detail).toMatch(/evidence store unavailable/);
  });

  it('a retry contributes it and clears the flag with a new row — nothing updated', async () => {
    world.attestationFails = true;
    const c = await pending();
    const out = await materialiser().applyResolution('ws_a', c.id, human);
    world.attestationFails = false;
    const report = await retryMissingAttestations({ store, ports: world.ports });
    expect(report).toMatchObject({ retried: 1, contributed: 1 });
    const flags = await store.flags('ws_a', { versionId: out.versionId! });
    expect(flags).toHaveLength(2);
    expect(flags[1]).toMatchObject({ kind: 'attestation-missing', clearsFlagId: flags[0]!.id });
    expect(flags[1]!.detail).toMatch(/att_1/);
    expect((await retryMissingAttestations({ store, ports: world.ports })).retried).toBe(0);
  });
});
