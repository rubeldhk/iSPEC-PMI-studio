/**
 * `T740` — the classifier. `FR-DPE-001`, `FR-DPE-002`, `FR-DPE-004`,
 * `FR-DPE-012`, reading steering-resolved rules (`R-031-1`).
 *
 * Pure. It takes the action, its target and the ruleset `resolveSteering()`
 * chose, and returns the band with everything an explanation needs. It takes
 * **no actor**, so `FR-DPE-002` — *a property of the action and its target, not
 * of the requester* — holds by signature rather than by discipline.
 *
 * ## Two of Cedar's properties, adopted (`R-031-2`)
 *
 * - **Default deny** → an action no rule matches takes the most restrictive
 *   band (`FR-DPE-004`).
 * - **Forbid overrides permit** → the floor. An irreducibly-high action is high
 *   whatever a tenant rule says (`FR-DPE-012`); a permit can never outrank it.
 *
 * The third — skip a rule that errors — is rejected: an unreadable ruleset
 * makes the steering adapter throw, and the evaluator refuses (`FR-DPE-050`).
 */
import {
  MOST_RESTRICTIVE_BAND,
  type ClassificationRule,
  type ResolvedRuleset,
  type RiskBand,
  type SteeringRuleRef,
} from '@pmi/decision-contract';
import { IRREDUCIBLY_HIGH as SLICE_FLOOR } from '../policy/classification.js';

/**
 * `FR-DPE-012` — baseline change, release promotion and loop configuration
 * change. **One list**: the scoped slice (`T1197`) declared it first, and this
 * re-exports it rather than restating it, so the two classifiers cannot
 * disagree about the floor.
 */
export const IRREDUCIBLY_HIGH: readonly string[] = SLICE_FLOOR;

export interface ClassifiedAction {
  readonly actionType: string;
  readonly target: { readonly type: string; readonly id: string };
}

export interface Classification {
  readonly band: RiskBand;
  readonly matchedRule: ClassificationRule | null;
  /** The steering document the rule came from — `null` when none applied. */
  readonly source: SteeringRuleRef | null;
  /** Why this band, in a sentence a Room can render. */
  readonly reason: string;
  /** When the floor decided it (`FR-DPE-012`). */
  readonly constraintCited?: string;
}

/** Higher is more specific. `null` when the pattern does not match. */
function specificity(rule: ClassificationRule, action: ClassifiedAction): number | null {
  if (rule.targetType !== undefined && rule.targetType !== action.target.type) return null;
  const targetBonus = rule.targetType !== undefined ? 0.5 : 0;
  if (rule.actionPattern === action.actionType) return 10_000 + targetBonus;
  if (rule.actionPattern.endsWith('.*')) {
    const prefix = rule.actionPattern.slice(0, -1); // keep the dot: "docs." never matches "docsets"
    if (action.actionType.startsWith(prefix)) return prefix.length + targetBonus;
  }
  return null;
}

export function classifyAction(action: ClassifiedAction, ruleset: ResolvedRuleset): Classification {
  let matched: ClassificationRule | null = null;
  let best = -1;
  for (const rule of ruleset.rules) {
    const score = specificity(rule, action);
    if (score !== null && score > best) {
      best = score;
      matched = rule;
    }
  }

  if (IRREDUCIBLY_HIGH.includes(action.actionType)) {
    return {
      band: 'high',
      matchedRule: matched,
      source: matched === null ? null : ruleset.source,
      reason:
        `"${action.actionType}" is high risk under every tenant policy` +
        (matched !== null && matched.band !== 'high' ? `; the rule classifying it ${matched.band} does not lower it` : ''),
      constraintCited: 'high band not configurable away (FR-DPE-012)',
    };
  }

  if (matched === null) {
    return {
      band: MOST_RESTRICTIVE_BAND,
      matchedRule: null,
      source: null,
      reason: `no classification rule matches "${action.actionType}", so it takes the most restrictive band (FR-DPE-004)`,
    };
  }

  return {
    band: matched.band,
    matchedRule: matched,
    source: ruleset.source,
    reason:
      `classified ${matched.band} by rule "${matched.actionPattern}"` +
      (matched.targetType !== undefined ? ` for ${matched.targetType}` : ''),
  };
}
