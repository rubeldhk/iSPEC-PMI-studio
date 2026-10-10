/**
 * `T2351` (EPIC-048, `FR-LRN-027`, `R-048-6` layer 2) — accept or refuse a
 * resolution. **`MP-3`'s target.**
 *
 * The load-bearing layer of "an AI never approves": approval can also happen in
 * `EPIC-031`'s generic Inbox route, which this Epic does not own, and whose HTTP
 * service records **every** session principal as `{kind: 'human'}`
 * (`decision.service.ts:57-59` on its branch). So `actorKind = 'human'` is a
 * claim, and this guard checks it against `EPIC-028`'s principal model, where an
 * agent, a service and a connector are each distinguishable from a person.
 *
 * Accepted:
 * - `approved`, `actorKind = 'human'`, `decidedBy` resolving to a **User** (and
 *   to no `NonHumanPrincipal`), and none of the candidate's AI source
 *   identities — its agent principal, its Expert, every corroborating agent and
 *   Expert;
 * - `auto-executed` of a `learning.approve.*` request made by `learning-intake`
 *   — policy, on the eligibility-checked automatic path (`R-048-12`).
 *
 * Everything else is not accepted. Separation of duties **between people** is
 * `EPIC-031`'s `selfApprovalAllowed`, consumed rather than re-implemented.
 *
 * Framework-free (PC-1).
 */
import type { CandidateRecord, CorroborationRecord } from './learning.store.js';
import type { PrincipalsPort, ResolutionView } from './learning.tokens.js';
import { INTAKE_AUTOMATION } from './decision.requester.js';

export type Verdict =
  | { readonly accepted: true; readonly approvedByKind: 'human' | 'policy'; readonly approvedBy: string }
  | { readonly accepted: false; readonly reason: 'decision-not-accepted' | 'policy-auto-executed-review'; readonly detail: string };

export interface JudgeInput {
  readonly candidate: CandidateRecord;
  readonly corroborations: readonly CorroborationRecord[];
  readonly resolution: ResolutionView;
}

/** The candidate's AI source identities (`R-048-6` layer 1 and 2). People are not on it. */
export function aiSourceIdentities(candidate: CandidateRecord, corroborations: readonly CorroborationRecord[]): Set<string> {
  const ids = new Set<string>();
  if (candidate.sourceKind === 'execution') ids.add(candidate.sourcePrincipalId);
  if (candidate.expertId !== null) ids.add(candidate.expertId);
  for (const c of corroborations) {
    if (c.sourceKind === 'execution') ids.add(c.sourcePrincipalId);
    if (c.expertId !== null) ids.add(c.expertId);
  }
  return ids;
}

const refuse = (detail: string, reason: 'decision-not-accepted' | 'policy-auto-executed-review' = 'decision-not-accepted'): Verdict => ({
  accepted: false,
  reason,
  detail,
});

export class ApproverGuard {
  constructor(private readonly principals: PrincipalsPort) {}

  async judge(input: JudgeInput): Promise<Verdict> {
    const { candidate, resolution } = input;

    if (resolution.outcome === 'auto-executed') {
      if (resolution.actionType.startsWith('learning.review.')) {
        return refuse(
          `EPIC-031 auto-executed ${resolution.actionType}; a review action is never approved by policy (FR-LRN-034). ` +
            'The workspace classifies learning review as low — it waits for a human (RK-5).',
          'policy-auto-executed-review',
        );
      }
      if (!resolution.actionType.startsWith('learning.approve.') || resolution.actorKind !== 'automation' || resolution.decidedBy !== INTAKE_AUTOMATION) {
        return refuse(`auto-executed ${resolution.actionType} by ${resolution.actorKind}:${resolution.decidedBy} is not this Epic's automatic path (R-048-12).`);
      }
      return { accepted: true, approvedByKind: 'policy', approvedBy: `policy:v${resolution.explanation.policyVersion}` };
    }

    if (resolution.outcome !== 'approved') {
      return refuse(`a ${resolution.outcome} decision is not an approval.`);
    }
    if (resolution.actorKind !== 'human') {
      return refuse(`approved by ${resolution.actorKind}:${resolution.decidedBy} — only a person approves a learning candidate (FR-LRN-027).`);
    }

    let kind;
    try {
      kind = await this.principals.kindOf(candidate.workspaceId, resolution.decidedBy);
    } catch (err) {
      return refuse(`the approver's kind cannot be checked (${err instanceof Error ? err.message : 'Principals failed'}); an approver whose kind is unknown is not a human.`);
    }
    if (kind !== 'human') {
      return refuse(
        `approved by ${resolution.decidedBy}, recorded by EPIC-031 as human, which resolves to ${kind === null ? 'no user of this workspace' : `a ${kind} principal`} (FR-LRN-027).`,
      );
    }
    if (aiSourceIdentities(candidate, input.corroborations).has(resolution.decidedBy)) {
      return refuse(`approved by ${resolution.decidedBy}, one of the candidate's own AI sources; an AI never approves what it proposed (FR-LRN-027).`);
    }
    return { accepted: true, approvedByKind: 'human', approvedBy: resolution.decidedBy };
  }
}
