/**
 * T339n — options for a material decision. `FR-RQR-020`–`FR-RQR-022`,
 * `BR-0023`, `RULE-03`. Unit test: `T339m`.
 *
 * **None is pre-selected, and there is nowhere to put a selection.**
 * `PresentedOption` has no `selected`, `recommended`, `default` or `preferred`
 * member. A boolean somewhere would eventually default to true for whichever
 * option the model liked, and the human decision would quietly become a
 * confirmation — `RULE-03` inverted at the point it matters most. The set is
 * also returned in the order it was given: a "best first" ordering is a
 * pre-selection nobody has to admit to.
 *
 * **The recommendation marking is the shared epistemic label**, computed here
 * from one line and never read from a caller. A second vocabulary for *"this is
 * a suggestion, not a fact"* is how the marking and the label would come to
 * disagree — and `UX-0031` derives the visual treatment from the label, so they
 * would disagree on screen.
 *
 * **Not persisted, and that is the data model's decision, not an omission.**
 * There is no options table: `RequirementDecision` records the `chosenOption`
 * and the `declinedOptions` (data-model §4), which is what `FR-RQR-023` asks to
 * retain. Options exist to be weighed; what survives is the weighing.
 *
 * Framework-free (PC-1). No store, no clock, no dependencies at all.
 */
import { labelled, type Labelled } from '@pmi/room-contract';
import { ValidationFailedError } from '../../core/errors.js';

/**
 * What a proposer submits.
 *
 * All three of `tradeOffs`, `dependencies` and `risks` are **required lists**,
 * so *"none"* is a stated answer (`[]`) rather than an unstated one. There is
 * deliberately no way to simply not say — `FR-RQR-021` asks for all four, and
 * an optional field is how three of them would go missing on a busy day.
 */
export interface ProposedOption {
  readonly id: string;
  readonly summary: string;
  readonly tradeOffs: readonly string[];
  readonly dependencies: readonly string[];
  readonly risks: readonly string[];
  readonly reasoning: string;
}

/** Identical to `ProposedOption`. Named separately because it is what leaves. */
export type PresentedOption = ProposedOption;

export class OptionsService {
  /**
   * `FR-RQR-020` — two or more, each fully stated, each a recommendation.
   *
   * A single option presented for approval is a decision already taken asking
   * to be rubber-stamped, which is exactly what `BR-0023` exists to prevent. So
   * fewer than two is refused rather than passed through.
   */
  present(proposed: readonly ProposedOption[]): Labelled<PresentedOption>[] {
    if (proposed.length < 2) {
      throw new ValidationFailedError(
        `a material decision presents two or more options; ${proposed.length} were proposed ` +
          '(FR-RQR-020)',
      );
    }
    const seen = new Set<string>();
    for (const option of proposed) {
      assertStated(option);
      if (seen.has(option.id)) {
        throw new ValidationFailedError(
          `two options share the id "${option.id}" — a decision naming it would be ambiguous, ` +
            'and the ambiguity would land in declinedOptions where nobody looks again',
        );
      }
      seen.add(option.id);
    }
    // Rebuilt field by field rather than spread: a `selected` or `recommended`
    // key smuggled past the type never reaches what is presented.
    return proposed.map((option) =>
      labelled('recommendation', {
        id: option.id,
        summary: option.summary.trim(),
        tradeOffs: [...option.tradeOffs],
        dependencies: [...option.dependencies],
        risks: [...option.risks],
        reasoning: option.reasoning.trim(),
      }),
    );
  }
}

function assertStated(option: ProposedOption): void {
  const missing: string[] = [];
  if (!option?.id?.trim()) missing.push('id');
  if (!option?.summary?.trim()) missing.push('summary');
  if (!option?.reasoning?.trim()) missing.push('reasoning');
  for (const field of ['tradeOffs', 'dependencies', 'risks'] as const) {
    if (!Array.isArray(option?.[field])) missing.push(field);
  }
  if (missing.length > 0) {
    throw new ValidationFailedError(
      `option "${option?.id ?? '(unnamed)'}" is missing: ${missing.join(', ')} (FR-RQR-021)`,
    );
  }
  // Each list may be empty — "no dependencies" is an answer. All three empty at
  // once is not: nothing was analysed, and a set of titles satisfies "two or
  // more" while giving the decider nothing to weigh.
  const analysed =
    option.tradeOffs.length + option.dependencies.length + option.risks.length > 0;
  if (!analysed) {
    throw new ValidationFailedError(
      `option "${option.id}" states no trade-offs, no dependencies and no risks — that is a ` +
        'title, not an option (FR-RQR-021)',
    );
  }
}
