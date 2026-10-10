/**
 * `T2357` (EPIC-048, `FR-LRN-025`, `R-048-19`) — every approval is evidenced in
 * `EPIC-032`'s store with `approval/v1`.
 *
 * Contributed **after** the version commits. A failure leaves the version flagged
 * `attestation-missing` and is retried; the version is never rolled back — the
 * approval is already decided by `EPIC-031` and audited here.
 *
 * The attestation is found by the decision it is attached to; the version does
 * not carry its id, because the version is immutable and the attestation comes
 * after it (data-model §7, implementation note).
 *
 * The predicate **body** is defined here and proposed to `EPIC-032` (`A-032-2`):
 * `{decisionId, resolvingDecisionId, candidateId, entryVersionId, outcome,
 * approvedByKind, approvedBy, policyVersion, matchedRule, effectiveClass}`.
 *
 * Framework-free (PC-1).
 */
import { newLearningId, type LearningStore, type VersionRecord } from './learning.store.js';
import type { ApprovalAttestationInput, LearningPorts } from './learning.tokens.js';
import { versionDigest, type AfterMaterialise } from './materialiser.js';

export const APPROVAL_PREDICATE = 'https://pmi.studio/attestation/approval/v1';
const RETRY_MARK = ' — retry input ';

export interface AttestationDeps {
  readonly store: LearningStore;
  readonly ports: Pick<LearningPorts, 'attestations'>;
  readonly now?: () => Date;
}

function inputFor(
  version: VersionRecord,
  resolution: { decisionId: string; resolvingDecisionId: string | null; outcome: string; explanation: { policyVersion: string; matchedRule: string | null }; effectiveClass: ApprovalAttestationInput['effectiveClass'] },
  verdict: { approvedByKind: 'human' | 'policy'; approvedBy: string },
): ApprovalAttestationInput {
  return {
    workspaceId: version.workspaceId,
    predicateType: APPROVAL_PREDICATE,
    sourceUri: 'pmi:learning',
    attachedTo: { type: 'decision', id: resolution.decisionId },
    attestedArtifact: { id: version.entryId, version: version.version },
    decisionId: resolution.decisionId,
    resolvingDecisionId: resolution.resolvingDecisionId,
    candidateId: version.candidateId,
    entryId: version.entryId,
    entryVersionId: version.id,
    versionNumber: version.version,
    outcome: resolution.outcome === 'auto-executed' ? 'auto-executed' : 'approved',
    approvedByKind: verdict.approvedByKind,
    approvedBy: verdict.approvedBy,
    policyVersion: resolution.explanation.policyVersion,
    matchedRule: resolution.explanation.matchedRule,
    effectiveClass: resolution.effectiveClass,
    subjectDigest: versionDigest(version),
  };
}

/** The materialiser's post-commit hook. Never throws into the approval. */
export function approvalAttestation(deps: AttestationDeps): AfterMaterialise {
  const now = deps.now ?? ((): Date => new Date());
  return async ({ version, deprecated, resolution, verdict }) => {
    const attested = version ?? deprecated;
    if (attested === null) return;
    const input = inputFor(attested, resolution, verdict);
    try {
      await deps.ports.attestations.contribute(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'the Evidence Store refused the contribution';
      await deps.store.transaction((tx) =>
        tx.appendFlag({
          id: newLearningId('kf'),
          workspaceId: attested.workspaceId,
          versionId: attested.id,
          candidateId: null,
          kind: 'attestation-missing',
          detail: `approval/v1 not contributed: ${message}${RETRY_MARK}${JSON.stringify(input)}`,
          raisedAt: now(),
          clearsFlagId: null,
        }),
      );
    }
  };
}

/** The sweep half (`learning.flags`): contribute what is missing, clear the flag with a new row. */
export async function retryMissingAttestations(deps: AttestationDeps, workspaceId?: string): Promise<{ retried: number; contributed: number; failed: string[] }> {
  const now = deps.now ?? ((): Date => new Date());
  const open = await deps.store.openFlags('attestation-missing', workspaceId);
  let contributed = 0;
  const failed: string[] = [];
  for (const flag of open) {
    const at = flag.detail.indexOf(RETRY_MARK);
    if (at < 0 || flag.versionId === null) continue;
    try {
      const input = JSON.parse(flag.detail.slice(at + RETRY_MARK.length)) as ApprovalAttestationInput;
      const { evidenceId } = await deps.ports.attestations.contribute(input);
      await deps.store.transaction((tx) =>
        tx.appendFlag({
          id: newLearningId('kf'),
          workspaceId: flag.workspaceId,
          versionId: flag.versionId,
          candidateId: null,
          kind: 'attestation-missing',
          detail: `approval/v1 contributed on retry as ${evidenceId}`,
          raisedAt: now(),
          clearsFlagId: flag.id,
        }),
      );
      contributed += 1;
    } catch (err) {
      failed.push(`${flag.versionId}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }
  return { retried: open.length, contributed, failed };
}
