/**
 * T337p — the epistemic token mapping. `FR-RQR-011`, `UX-0031`, `R-033-4`.
 *
 * **The visual treatment is derived from the discriminant, never chosen beside
 * it.** `UX-0031` calls an unlabelled recommendation *"a governance failure
 * expressed as a styling choice"*, and the corollary is that a mislabelled one
 * is the same failure — so this component takes the `Labelled<T>` and nothing
 * else. There is no `variant`, no `className`, no override. A caller cannot mark
 * something a recommendation and paint it like a fact, because there is no
 * parameter through which to try.
 *
 * **Total by construction.** `TOKENS` is a `Record<Epistemic, string>`, so a
 * fifth kind added to `@pmi/room-contract` fails to compile here rather than
 * falling through to a default style — which is how a new kind would otherwise
 * ship looking exactly like a fact.
 *
 * **Shared, so three Rooms cannot drift.** `EPIC-034` and `EPIC-035` import
 * this. A per-Room mapping would let one Room render an AI recommendation
 * differently from another, which is `UX-0035`'s failure one layer below the
 * regions.
 */
import type { ReactElement, ReactNode } from 'react';
import type { Epistemic, Labelled } from '@pmi/room-contract';

/**
 * One token per kind, four distinct.
 *
 * Two kinds sharing a token is the failure that looks like it works: the label
 * is right, the mapping exists, and a reader cannot tell an inference from a
 * recommendation. Styled against `EPIC-029`'s system — the class names are its
 * vocabulary, not new ones invented here.
 */
const TOKENS: Record<Epistemic, string> = {
  fact: 'epistemic--fact',
  inference: 'epistemic--inference',
  recommendation: 'epistemic--recommendation',
  'open-question': 'epistemic--open-question',
};

/**
 * Which kinds are AI output.
 *
 * `UX-0031`'s actual distinction: what the system **observed** versus what a
 * model **produced**. A reader scanning a Room needs that in one glance, and it
 * is not the same question as which of the four kinds this is.
 */
const AI_OUTPUT: ReadonlySet<Epistemic> = new Set<Epistemic>([
  'inference',
  'recommendation',
  'open-question',
]);

const ACCESSIBLE_NAMES: Record<Epistemic, string> = {
  fact: 'Recorded fact',
  inference: 'AI inference',
  recommendation: 'AI recommendation',
  'open-question': 'Unresolved question',
};

export function epistemicToken(kind: Epistemic): string {
  return TOKENS[kind];
}

export interface EpistemicMarkProps {
  readonly value: Labelled<ReactNode>;
}

export function EpistemicMark({ value }: EpistemicMarkProps): ReactElement {
  const isAi = AI_OUTPUT.has(value.epistemic);
  return (
    <span
      className={`epistemic ${epistemicToken(value.epistemic)}`}
      data-testid="epistemic-mark"
      data-epistemic={value.epistemic}
      // Not colour alone: "distinguishable" fails for a colour-blind reader and
      // for a screen reader entirely if the kind lives only in a token.
      aria-label={ACCESSIBLE_NAMES[value.epistemic]}
      {...(isAi ? { 'data-ai-output': 'true' } : {})}
    >
      {value.value}
    </span>
  );
}
