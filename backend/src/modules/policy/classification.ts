/**
 * `T1197` (EPIC-031, scoped to the Requirement Room's `decide` path) — risk
 * classification and the three bands.
 *
 * Written because `DEF-033-002` found `PolicyProvider` unbound: `decide` refused
 * with an unbound-seam error and `SC-RQR-008` could not be reached. This is the
 * narrow slice that answers *"what band is this action, and may it proceed?"* —
 * not the whole Epic, which has 92 open tasks and a Decision Inbox this does not
 * touch.
 *
 * ## The default is the design
 *
 * `FR-DPE-004`: an action with no matching rule receives the **most restrictive**
 * band. That is the opposite of what a lookup miss usually does, and it is the
 * reason an unconfigured engine is safe rather than permissive — the same
 * instinct `FR-GEL-062` applies to an absent provider and `evaluateAuthority`
 * applies to an unconfigured transition.
 *
 * ## Classification never sees the requester
 *
 * `FR-DPE-002`: *"Modifying an approved baseline is high risk regardless of who
 * asks."* `classify` takes an action and a scope, and there is deliberately
 * nowhere to put an actor — a signature that accepted one would eventually be
 * used to classify by who was asking.
 *
 * ## And the floor is not negotiable
 *
 * `FR-DPE-011` lets a tenant tune the approval burden; `FR-DPE-012` stops that
 * reaching the actions `PMI-DOC-004` marks as requiring authorization. So the
 * floor is applied **after** the rule matches, not as a rule that could itself
 * be overridden.
 */

/** `FR-DPE-010` — exactly three. */
export const BANDS = Object.freeze(['low', 'medium', 'high'] as const);

export type Band = (typeof BANDS)[number];

/**
 * `FR-DPE-012` — actions whose band cannot be lowered by any policy.
 *
 * Baseline changes and release promotion come from `PMI-DOC-004`; loop
 * configuration changes from `EPIC-030` `FR-GEL-016`, which is why a Room that
 * never promotes a release still carries that entry.
 */
export const IRREDUCIBLY_HIGH: readonly string[] = Object.freeze([
  'requirement-room.baseline',
  'release.promote',
  'loop.configuration.change',
]);

/**
 * A rule as a steering document declares it.
 *
 * `FR-DPE-003` — policy-declared, never model-inferred. `declaredBy` names the
 * document so a classification can be traced to the thing that decided it, and
 * `FR-DPE-006` can hold: a decision records the rule it matched, so a later
 * edit does not reclassify it retrospectively.
 */
export interface ClassificationRule {
  readonly actionType: string;
  readonly band: Band;
  /** `FR-DPE-005` — organization, workspace, project, repository or path. */
  readonly scopePath: string;
  readonly declaredBy: string;
}

export interface ClassificationInput {
  readonly actionType: string;
  /** Where the action is happening, as a scope path. */
  readonly scopePath: string;
}

export interface Classification {
  readonly band: Band;
  /** `null` when nothing matched — which is a fact worth recording, not an absence. */
  readonly matchedRule: ClassificationRule | null;
  readonly explanation: string;
}

/** `/org/ws` is inside `/org`; `/org/ws_b` is not inside `/org/ws_a`. */
function covers(rulePath: string, actionPath: string): boolean {
  return actionPath === rulePath || actionPath.startsWith(`${rulePath}/`);
}

/**
 * Classify an action.
 *
 * Two parameters, and the arity is asserted by `T1196`: there is nowhere to pass
 * a requester.
 */
export function classify(
  input: ClassificationInput,
  rules: readonly ClassificationRule[],
): Classification {
  const applicable = rules
    .filter((rule) => rule.actionType === input.actionType && covers(rule.scopePath, input.scopePath))
    // Narrowest wins. Longer path = more specific declaration.
    .sort((a, b) => b.scopePath.length - a.scopePath.length);

  const matched = applicable[0] ?? null;

  if (IRREDUCIBLY_HIGH.includes(input.actionType)) {
    return {
      band: 'high',
      matchedRule: matched,
      explanation:
        `"${input.actionType}" is high risk and cannot be configured away (FR-DPE-012)` +
        (matched ? `; the rule declared by ${matched.declaredBy} does not lower it` : ''),
    };
  }

  if (matched === null) {
    return {
      band: 'high',
      matchedRule: null,
      explanation:
        `no classification rule matches "${input.actionType}" at ${input.scopePath}, ` +
        'so it takes the most restrictive band (FR-DPE-004)',
    };
  }

  return {
    band: matched.band,
    matchedRule: matched,
    explanation: `classified ${matched.band} by ${matched.declaredBy} at ${matched.scopePath}`,
  };
}
