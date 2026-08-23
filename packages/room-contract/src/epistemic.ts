/**
 * T337i — the epistemic label. `FR-RQR-011`, `UX-0031`, `R-033-4`.
 *
 * *"Every AI output element MUST carry exactly one epistemic label: fact,
 * inference, recommendation, or unresolved question. An unlabelled element MUST
 * NOT be presentable."*
 *
 * `FR-RQR-011` says an unlabelled element must not be **presentable**. This
 * makes it **unconstructible**, which is one step earlier and one fewer thing to
 * remember: there is no code path that builds an element and forgets, because
 * the type has no shape for one.
 *
 * `UX-0031` is why the strength is worth it — an unlabelled recommendation is
 * *"a governance failure expressed as a styling choice"*. A failure that a
 * styling choice can introduce should not be prevented only by one.
 *
 * **Four members and no fifth.** No `unknown`, no `unlabelled`, no `other`. A
 * kind meaning *"we did not decide"* is an unlabelled element wearing a label,
 * and it would render as whatever the fallback style happens to be.
 *
 * The visual treatment is **derived** from this discriminant by an `EPIC-029`
 * token mapping (`R-033-4`), so the label and the styling cannot disagree: one
 * is computed from the other.
 */

export const EPISTEMIC_KINDS = Object.freeze([
  'fact',
  'inference',
  'recommendation',
  'open-question',
] as const);

export type Epistemic = (typeof EPISTEMIC_KINDS)[number];

export interface Labelled<T> {
  /** Required. No default, no optional variant — see the note above. */
  readonly epistemic: Epistemic;
  readonly value: T;
}

export function isEpistemic(candidate: string): candidate is Epistemic {
  return (EPISTEMIC_KINDS as readonly string[]).includes(candidate);
}

/**
 * Construct a labelled value.
 *
 * The label comes first deliberately. A signature taking the value first invites
 * a caller to write the interesting half and reach for a default for the rest —
 * and there is no default to reach for.
 */
export function labelled<T>(epistemic: Epistemic, value: T): Labelled<T> {
  return { epistemic, value };
}
