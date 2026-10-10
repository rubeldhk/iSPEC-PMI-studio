/**
 * `T765`, `T767`, `T769`, `T774` — the explanation. `FR-DPE-040`–`FR-DPE-044`,
 * `FR-DPE-003`.
 *
 * Built once, when the decision is taken, and **stored** — never recomputed
 * (`R-031-8`, `FR-DPE-044`). A later policy or rule change therefore cannot
 * rewrite what a past decision said about itself.
 *
 * - `precedenceResolution` is the steering source's string **verbatim**
 *   (`FR-DPE-042`): it quotes `resolveSteering()`'s `SteeringOverride` rather
 *   than restating it, so it cannot drift from `EPIC-019`.
 * - `proposalDisagreement` makes an Engineering Expert's differing proposal
 *   visible rather than silently dropped (`FR-DPE-003`).
 */
import type { Explanation, RiskBand, SteeringRuleRef } from '@pmi/decision-contract';

export interface ExplanationInput {
  readonly policyVersion: number;
  readonly matchedRule: SteeringRuleRef | null;
  readonly riskClass: RiskBand;
  readonly precedence?: string | undefined;
  readonly authorityApplied: string;
  readonly constraintCited?: string | undefined;
  readonly proposedClass?: RiskBand | undefined;
  readonly triggeredBy?: { readonly ruleId: string; readonly eventId: string } | undefined;
}

export function buildExplanation(input: ExplanationInput): Explanation {
  return {
    policyVersion: String(input.policyVersion),
    matchedRule: input.matchedRule,
    riskClass: input.riskClass,
    authorityApplied: input.authorityApplied,
    ...(input.precedence !== undefined ? { precedenceResolution: input.precedence } : {}),
    ...(input.constraintCited !== undefined ? { constraintCited: input.constraintCited } : {}),
    ...(input.proposedClass !== undefined && input.proposedClass !== input.riskClass
      ? {
          proposalDisagreement:
            `an Engineering Expert proposed ${input.proposedClass}; policy classifies ${input.riskClass}, ` +
            'and policy decides (FR-DPE-003)',
        }
      : {}),
    ...(input.triggeredBy !== undefined
      ? { triggerRule: `${input.triggeredBy.ruleId} (event ${input.triggeredBy.eventId})` }
      : {}),
  };
}
