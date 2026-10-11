/**
 * `T2215` (EPIC-039, `R-039-11`, `FR-HUB-051`) — the Hub's `EvidenceSink` over
 * `EPIC-032`'s `CompletionGate` and `EvidenceService`. Unit test: `T2214`.
 *
 * - **`bindingExists`** asks `CompletionGate.evaluate` first (`DEF-032-002`:
 *   evidence counts only against a bound work item). True only for an
 *   evaluated binding whose Contract names the item. A binding that **cannot
 *   be evaluated** — an unreachable store, an unloaded Contract — is a
 *   refusal, never a quiet *no binding* (`FR-EVS-035`).
 * - **`contribute`** calls `EvidenceService.contribute` as the intake's
 *   principal, attached to the work item, with the in-toto Statement **inline**:
 *   no `reference` is ever sent, so the predicate's `result` stays readable at
 *   the gate — which closes the residual `DEF-032-004` deferred here. When the
 *   intake named no attested artifact, the binding's subject is named; with
 *   neither, it refuses rather than invent one. Any fault propagates.
 */
import type { EvidenceContribution, EvidenceSink } from '../integrations.tokens.js';

/** `CompletionGate.evaluate`, by shape. */
export interface EvidenceGateReader {
  evaluate(
    workspaceId: string,
    workRef: never,
  ): Promise<
    | { readonly evaluated: true; readonly binding: { readonly subjectArtifactId: string; readonly subjectVersion: number }; readonly status: { readonly items: readonly { readonly itemId: string }[] } }
    | { readonly evaluated: false; readonly reason: string; readonly binding: { readonly subjectArtifactId: string; readonly subjectVersion: number } | null }
  >;
}

/** `EvidenceService.contribute`, by shape. */
export interface EvidenceContributor {
  contribute(principal: { workspaceId: string; userId: string }, body: unknown): Promise<{ readonly id: string }>;
}

export function evidenceServiceSink(service: EvidenceContributor, gate: EvidenceGateReader, clock: () => Date): EvidenceSink {
  const evaluate = (workspaceId: string, workRef: Readonly<Record<string, unknown>>) => gate.evaluate(workspaceId, workRef as never);

  return {
    async bindingExists(workspaceId, workRef, contractItemId) {
      const evaluation = await evaluate(workspaceId, workRef);
      if (!evaluation.evaluated) {
        if (evaluation.binding === null) return false;
        throw new Error(`the bound Evidence Contract cannot be evaluated: ${evaluation.reason}`);
      }
      return evaluation.status.items.some((item) => item.itemId === contractItemId);
    },

    async contribute(contribution: EvidenceContribution) {
      let attested = contribution.attestedArtifact;
      if (attested === null) {
        const evaluation = await evaluate(contribution.workspaceId, contribution.workRef);
        if (evaluation.binding === null) {
          throw new Error('no attested artifact was named and no binding names one; evidence is never attached to an invented subject');
        }
        attested = { id: evaluation.binding.subjectArtifactId, version: evaluation.binding.subjectVersion };
      }
      const summary = await service.contribute(
        { workspaceId: contribution.workspaceId, userId: contribution.principalId },
        {
          projectId: contribution.projectId,
          attestation: contribution.attestation,
          attestedArtifact: attested,
          attachedTo: contribution.workRef,
          source: contribution.source,
          producedAt: clock().toISOString(),
        },
      );
      return { attestationId: summary.id };
    },
  };
}
