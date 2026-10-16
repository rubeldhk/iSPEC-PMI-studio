/**
 * `T2389` (EPIC-048, Phase 9, `R-048-19`) — `ApprovalAttestations` over
 * `EPIC-032`'s `EvidenceService.contribute`.
 *
 * The platform-source branch (`pmi:learning`, `evidence.service.ts`'s
 * `PLATFORM_SOURCE`), so no external-tool authorisation is involved. The
 * attestation is an in-toto Statement whose one subject is the approved
 * version, by its canonical digest, and whose predicate is the `R-048-19` body
 * (`A-032-2`, proposed to `EPIC-032`). Nothing of the statement text is copied:
 * the version holds it, and the digest protects it.
 *
 * `EvidenceService.contribute` needs a project; the port's input does not carry
 * one, so the candidate's project is read from this Epic's store. A candidate
 * that cannot be found is refused, never attributed to a guessed project. A
 * refusal here is caught by `approvalAttestation`, which flags the version
 * `attestation-missing` and lets the sweep retry — it never reaches the approval.
 *
 * Framework-free (PC-1).
 */
import { IN_TOTO_STATEMENT_TYPE } from '@pmi/evidence-contract';
import { NotFoundError } from '../../../core/errors.js';
import type { ApprovalAttestationInput, ApprovalAttestationsPort } from '../learning.tokens.js';

/** The slice of `EvidenceService` this adapter calls. */
export interface EvidenceContributor {
  contribute(principal: { workspaceId: string; userId: string }, body: unknown): Promise<{ id: string }>;
}

export interface AttestationsAdapterDeps {
  readonly evidence: EvidenceContributor;
  /** The candidate's project, from this Epic's store; `null` when there is no such candidate. */
  readonly projectOf: (workspaceId: string, candidateId: string) => Promise<string | null>;
}

/** The principal the platform contributes as. Not a user: the source names the producer. */
export const LEARNING_CONTRIBUTOR = 'learning-intake';

/** `R-048-19` — the predicate body, and only it. */
export function approvalPredicate(input: ApprovalAttestationInput): Record<string, unknown> {
  return {
    decisionId: input.decisionId,
    resolvingDecisionId: input.resolvingDecisionId,
    candidateId: input.candidateId,
    entryVersionId: input.entryVersionId,
    outcome: input.outcome,
    approvedByKind: input.approvedByKind,
    approvedBy: input.approvedBy,
    policyVersion: input.policyVersion,
    matchedRule: input.matchedRule,
    effectiveClass: input.effectiveClass,
  };
}

export function attestationsAdapter(deps: AttestationsAdapterDeps): ApprovalAttestationsPort {
  return {
    async contribute(input) {
      const projectId = await deps.projectOf(input.workspaceId, input.candidateId);
      if (projectId === null) {
        throw new NotFoundError(`No candidate ${input.candidateId} in this workspace, so no project to attest approval/v1 under.`);
      }
      const stored = await deps.evidence.contribute(
        { workspaceId: input.workspaceId, userId: LEARNING_CONTRIBUTOR },
        {
          projectId,
          attestation: {
            _type: IN_TOTO_STATEMENT_TYPE,
            subject: [{ name: `knowledge-entry:${input.entryId}@${input.versionNumber}`, digest: { sha256: input.subjectDigest } }],
            predicateType: input.predicateType,
            predicate: approvalPredicate(input),
          },
          attestedArtifact: { id: input.attestedArtifact.id, version: input.attestedArtifact.version },
          attachedTo: { type: input.attachedTo.type, id: input.attachedTo.id },
          source: { uri: input.sourceUri },
          producedAt: new Date().toISOString(),
        },
      );
      return { evidenceId: stored.id };
    },
  };
}
