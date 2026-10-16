/**
 * `T2388` (EPIC-048, Phase 9, `R-048-19`, `FR-LRN-025`) — `ApprovalAttestations`
 * over `EPIC-032`'s real `EvidenceService.contribute`.
 *
 * Against the real service and its in-memory repository: the attestation lands
 * through the **platform-source** branch (`pmi:learning`), attached to the
 * decision, attesting the entry and version, with the predicate body
 * `R-048-19` defines and nothing from the statement. The project is the
 * candidate's — read from this Epic's store, never guessed.
 *
 * A fault in the Evidence Store flags the version `attestation-missing` through
 * the materialiser's post-commit hook; it never throws into the approval.
 */
import { describe, expect, it } from 'vitest';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';
import { attestationsAdapter } from '../../src/modules/learning/adapters/attestations.adapter.js';
import { APPROVAL_PREDICATE, approvalAttestation } from '../../src/modules/learning/attestation.js';
import { InMemoryLearningStore, type VersionRecord } from '../../src/modules/learning/learning.store.js';
import type { ApprovalAttestationInput, ResolutionView } from '../../src/modules/learning/learning.tokens.js';

const WS = 'ws_att';
const DIGEST = 'c'.repeat(64);

const input: ApprovalAttestationInput = {
  workspaceId: WS,
  predicateType: APPROVAL_PREDICATE,
  sourceUri: 'pmi:learning',
  attachedTo: { type: 'decision', id: 'dec_1' },
  attestedArtifact: { id: 'ke_1', version: 2 },
  decisionId: 'dec_1',
  resolvingDecisionId: 'dec_1_r',
  candidateId: 'lc_1',
  entryId: 'ke_1',
  entryVersionId: 'kv_2',
  versionNumber: 2,
  outcome: 'approved',
  approvedByKind: 'human',
  approvedBy: 'u_rev',
  policyVersion: '4',
  matchedRule: null,
  effectiveClass: 'high',
  subjectDigest: DIGEST,
};

function evidence(repository = new InMemoryEvidenceRepository()) {
  const catalog = ContractCatalog.fromDirectory();
  return {
    repository,
    service: new EvidenceService(repository, catalog, new CompletionGate(repository, catalog, null), { canRead: async () => true }, null),
  };
}

const projectOf = async (workspaceId: string, candidateId: string) => (workspaceId === WS && candidateId === 'lc_1' ? 'p_origin' : null);

describe('T2388 · ApprovalAttestations calls EvidenceService.contribute (R-048-19)', () => {
  it('stores approval/v1 from the platform source, attached to the decision, attesting the entry version', async () => {
    const { repository, service } = evidence();
    const out = await attestationsAdapter({ evidence: service, projectOf }).contribute(input);

    const [stored, ...rest] = await repository.attachedTo(WS, { type: 'decision', id: 'dec_1' });
    expect(rest).toEqual([]);
    expect(out).toEqual({ evidenceId: stored!.id });
    expect(stored).toMatchObject({
      workspaceId: WS,
      projectId: 'p_origin',
      predicateType: 'https://pmi.studio/attestation/approval/v1',
      sourceUri: 'pmi:learning',
      attachedTo: { type: 'decision', id: 'dec_1' },
      attestedArtifactId: 'ke_1',
      attestedVersion: 2,
      subjectDigest: { sha256: DIGEST },
      storage: 'stored',
      integrityValid: true,
    });
  });

  it('carries exactly the R-048-19 body as the predicate — and no statement text', async () => {
    const { repository, service } = evidence();
    await attestationsAdapter({ evidence: service, projectOf }).contribute(input);
    const [stored] = await repository.attachedTo(WS, { type: 'decision', id: 'dec_1' });
    const statement = stored!.payload as { _type: string; subject: unknown[]; predicate: Record<string, unknown> };
    expect(statement._type).toBe('https://in-toto.io/Statement/v1');
    expect(Object.keys(statement.predicate).sort()).toEqual(
      ['decisionId', 'resolvingDecisionId', 'candidateId', 'entryVersionId', 'outcome', 'approvedByKind', 'approvedBy', 'policyVersion', 'matchedRule', 'effectiveClass'].sort(),
    );
    expect(statement.predicate).toMatchObject({ decisionId: 'dec_1', resolvingDecisionId: 'dec_1_r', candidateId: 'lc_1', entryVersionId: 'kv_2', outcome: 'approved', approvedByKind: 'human', approvedBy: 'u_rev', policyVersion: '4', matchedRule: null, effectiveClass: 'high' });
    expect(JSON.stringify(stored!.payload)).not.toContain('statement');
  });

  it('refuses rather than guessing a project for a candidate it cannot find', async () => {
    const { repository, service } = evidence();
    await expect(attestationsAdapter({ evidence: service, projectOf }).contribute({ ...input, candidateId: 'lc_unknown' })).rejects.toThrow(/lc_unknown/);
    expect(await repository.attachedTo(WS, { type: 'decision', id: 'dec_1' })).toEqual([]);
  });
});

describe('T2388 · a fault flags rather than throwing into the approval', () => {
  it('an Evidence Store outage becomes attestation-missing on the version, and the hook resolves', async () => {
    const broken = new InMemoryEvidenceRepository();
    broken.appendAttestation = async () => { throw new Error('connection reset'); };
    const { service } = evidence(broken);
    const store = new InMemoryLearningStore();
    const hook = approvalAttestation({ store, ports: { attestations: attestationsAdapter({ evidence: service, projectOf }) } });

    const version = {
      id: 'kv_2', workspaceId: WS, entryId: 'ke_1', version: 2, statement: 's', proposedStatement: 's',
      scope: { kind: 'project', projectIds: ['p_origin'] }, proposedScope: { kind: 'project', projectIds: ['p_origin'] },
      classification: 'internal', candidateId: 'lc_1', decisionId: 'dec_1', resolvingDecisionId: 'dec_1_r',
      approvedByKind: 'human', approvedBy: 'u_rev', approvedAt: new Date(),
    } as unknown as VersionRecord;
    const resolution = {
      decisionId: 'dec_1', resolvingDecisionId: 'dec_1_r', outcome: 'approved', actorKind: 'human', decidedBy: 'u_rev',
      actionType: 'learning.review.candidate', requestedBy: null, effectiveClass: 'high',
      explanation: { policyVersion: '4', matchedRule: null, riskClass: 'high', authorityApplied: 'human' },
    } as ResolutionView;

    await expect(hook({ version, deprecated: null, resolution, verdict: { approvedByKind: 'human', approvedBy: 'u_rev' } } as never)).resolves.toBeUndefined();
    const flags = await store.flags(WS, { versionId: 'kv_2' });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ kind: 'attestation-missing' });
    expect(flags[0]!.detail).toMatch(/evidence store could not be reached/i);
  });
});
