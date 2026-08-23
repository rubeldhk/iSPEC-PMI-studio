/**
 * T968, T970 — `satisfied` is unreachable by omission. `FR-GEL-021`,
 * `FR-GEL-022`, `BR-0060`.
 *
 * PC-1: framework-free.
 *
 * *"A skipped gate is a recorded violation or an explicit exception, and never
 * a silent pass."*
 *
 * The failure mode is not a bug anyone writes on purpose — it is an absence.
 * A gate declared in the configuration, a `GateProvider` that returns nothing
 * for it, and a `.every(g => g.result === 'satisfied')` over the outcomes that
 * *were* returned. Every gate that answered is satisfied, so the transition
 * proceeds, and the gate nobody evaluated is the one that mattered.
 *
 * So this evaluator starts from the **declared** gates, not from the returned
 * outcomes, and a declared gate with no outcome resolves to `violation`. That
 * is the one design decision in the file; everything else follows from it.
 */

import { GATE_RESULTS, type GateOutcome, type GateResult } from '@pmi/loop-contract';

/** An authorised departure from a gate. `FR-GEL-021` — both fields required. */
export interface GateException {
  readonly gateId: string;
  /** Who authorised it. An exception nobody granted is a violation. */
  readonly authorizedBy: string;
  /** Why. "Approved" is not a reason; this is what an auditor reads. */
  readonly reason: string;
}

export interface GateEvaluation {
  /** One entry per DECLARED gate, in declaration order. Never fewer. */
  readonly outcomes: readonly GateOutcome[];
  /** True only when every declared gate resolved `satisfied`. */
  readonly passed: boolean;
  /** The first gate that did not, for the refusal reason. */
  readonly blocking: GateOutcome | undefined;
}

export interface EvaluateGatesInput {
  /** From the configuration — the transition's `requiredGates`. */
  readonly declared: readonly string[];
  /** What the `GateProvider` actually returned. May be short, empty, or absent. */
  readonly reported: readonly GateOutcome[];
  /** Exceptions granted for this transition, if any. */
  readonly exceptions?: readonly GateException[];
}

/**
 * `FR-GEL-021` — evaluate the DECLARED gates, whatever was reported.
 *
 * Resolution, per gate, in this order:
 *
 *   1. an **exception** was granted, with an authorizer and a reason →
 *      `exception`;
 *   2. the provider **reported** an outcome → that outcome, unchanged;
 *   3. neither → **`violation`**.
 *
 * Step 3 is the whole point. An unevaluated gate is not an absence of
 * information — it is a gate that was required and did not happen, which
 * `BR-0060` says is a violation.
 */
export function evaluateGates(input: EvaluateGatesInput): GateEvaluation {
  const reported = new Map(input.reported.map((outcome) => [outcome.gateId, outcome]));
  const exceptions = new Map((input.exceptions ?? []).map((e) => [e.gateId, e]));

  const outcomes: GateOutcome[] = input.declared.map((gateId) => {
    const exception = exceptions.get(gateId);
    if (exception) {
      // Both fields are required by the type. Asserted here too, because an
      // exception arriving from JSON can satisfy a type and carry "".
      if (!exception.authorizedBy || !exception.reason) {
        return {
          gateId,
          result: 'violation',
          detail:
            'an exception was claimed without an authorizer or a reason — ' +
            'an exception nobody granted is a violation (FR-GEL-021)',
        };
      }
      return {
        gateId,
        result: 'exception',
        detail: `authorized by ${exception.authorizedBy}: ${exception.reason}`,
      };
    }

    const outcome = reported.get(gateId);
    if (outcome) {
      // Trusted, but checked for a value outside the four. A provider returning
      // `'skipped'` must not be read as anything at all.
      return (GATE_RESULTS as readonly string[]).includes(outcome.result)
        ? outcome
        : {
            gateId,
            result: 'violation',
            detail: `the gate provider returned "${String(outcome.result)}", which is not a GateResult`,
          };
    }

    return {
      gateId,
      result: 'violation',
      detail:
        'required by the transition and never evaluated — a skipped gate is a ' +
        'violation or an explicit exception, never a pass (BR-0060, FR-GEL-021)',
    };
  });

  const blocking = outcomes.find((outcome) => outcome.result !== 'satisfied');
  return { outcomes, passed: blocking === undefined, blocking };
}

/**
 * Outcomes the `exceptions` projection reports. `FR-GEL-022`.
 *
 * `refused` is not here. A refused gate stopped the transition and nothing
 * departed from the rules; an exception and a violation are the two ways the
 * rules were *departed from*, and mixing a plain refusal in would make
 * *"how often do we bypass our own gates?"* unanswerable.
 */
export const DEPARTURE_RESULTS: readonly GateResult[] = Object.freeze(['exception', 'violation']);

export function departures(outcomes: readonly GateOutcome[]): readonly GateOutcome[] {
  return outcomes.filter((outcome) => DEPARTURE_RESULTS.includes(outcome.result));
}
