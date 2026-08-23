/**
 * T938, T944 — the configuration loader.
 * `FR-GEL-003`, `FR-GEL-007`, `FR-GEL-009`, `FR-GEL-016`, `FR-GEL-031`.
 *
 * PC-1: framework-free.
 *
 * **Every fault is a load-time refusal.** There is no `loadOrDefault`, no
 * partial load, no load-with-warnings. A configuration that loaded and then
 * misbehaved would already have declared a governed workflow type, possibly with
 * objects sitting in it; refusing at load means the bad configuration never
 * governs anything.
 *
 * **Every fault is reported, not the first.** A configuration with four
 * problems should take one round to fix, not four. The `engine-contract`
 * precedent is the same shape.
 */

import { LOOP_STAGES, isLoopStage, type LoopStage } from '@pmi/loop-contract';

export interface ConfigTransition {
  readonly from: LoopStage;
  readonly to: LoopStage;
  readonly requiredGates: readonly string[];
  readonly trigger: { readonly ruleId: string } | null;
}

export interface ResolvedLoopConfig {
  readonly workflowType: string;
  readonly stages: readonly LoopStage[];
  /** `FR-GEL-008` — visible, not absent. Computed once here so no caller derives it differently. */
  readonly omittedStages: readonly LoopStage[];
  readonly transitions: readonly ConfigTransition[];
  readonly approvedBy: string;
  readonly approvalRef: string;
  transitionFor(from: LoopStage, to: LoopStage): ConfigTransition | undefined;
}

/** A refusal carrying every violation, so one read tells an operator everything to fix. */
export class LoopConfigError extends Error {
  constructor(
    readonly workflowType: string,
    readonly violations: readonly string[],
  ) {
    super(`loop configuration "${workflowType}" refused: ${violations.join('; ')}`);
    this.name = 'LoopConfigError';
  }
}

export interface LoadOptions {
  /**
   * Which stages have a registered `StageHandler` (`R-030-5`).
   *
   * Required, with no default. An optional registry would make the commonest
   * mistake — forgetting to pass it — look like a configuration with every
   * stage handled, which is precisely the check being skipped.
   */
  readonly registeredStages: readonly string[];
  /**
   * `FR-GEL-009` — the tenant row's stages, when one exists.
   *
   * The programme file is authoritative. A tenant row whose `stages` differ is
   * **refused**, not merged and not preferred: `stages` is programme-defined,
   * and a tenant that could change them could quietly remove `Decide` from a
   * workflow that is supposed to have one.
   */
  readonly tenantStages?: readonly string[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function loadLoopConfig(raw: unknown, options: LoadOptions): ResolvedLoopConfig {
  const file = asRecord(raw);
  const declaredType = file['workflowType'];
  const hasType = typeof declaredType === 'string' && declaredType.length > 0;
  // Only for the refusal message. Note the shape deliberately NOT used here:
  // `workflowType === <literal>` anywhere in this module is what
  // `loop-new-workflow-type.spec.ts` forbids for SC-GEL-001, and a sentinel
  // comparison is that shape even when the literal is not a real type. Its own
  // check caught this line; the line was changed rather than the check.
  const workflowType = hasType ? (declaredType as string) : '(unnamed)';
  const violations: string[] = [];

  if (file['schemaVersion'] !== 1) violations.push('schemaVersion must be 1');
  if (!hasType) violations.push('workflowType is required');

  // FR-GEL-016 — both, or it does not load. Empty counts as absent: "" passes a
  // typeof check and approves nothing.
  for (const field of ['approvedBy', 'approvalRef'] as const) {
    const value = file[field];
    if (typeof value !== 'string' || value.length === 0) {
      violations.push(`${field} is required (FR-GEL-016)`);
    }
  }

  const rawStages = Array.isArray(file['stages']) ? file['stages'] : [];
  if (rawStages.length === 0) violations.push('stages must be a non-empty array');

  const stages: LoopStage[] = [];
  for (const candidate of rawStages) {
    if (typeof candidate !== 'string' || !isLoopStage(candidate)) {
      violations.push(`stage "${String(candidate)}" is not one of LOOP_STAGES (FR-GEL-007)`);
      continue;
    }
    // R-030-5 — named, in the vocabulary, and nothing can run it.
    if (!options.registeredStages.includes(candidate)) {
      violations.push(`stage "${candidate}" has no registered StageHandler (FR-GEL-007)`);
    }
    stages.push(candidate);
  }

  // FR-GEL-009 — programme order, so a progress projection cannot disagree with
  // the model.
  const positions = stages.map((s) => LOOP_STAGES.indexOf(s));
  if (positions.some((n, i) => i > 0 && n <= (positions[i - 1] ?? -1))) {
    violations.push('stages must appear in LOOP_STAGES order (FR-GEL-009)');
  }

  // T944 — the programme/tenant split. Refused rather than merged: see LoadOptions.
  if (options.tenantStages !== undefined) {
    const same =
      options.tenantStages.length === stages.length &&
      options.tenantStages.every((s, i) => s === stages[i]);
    if (!same) {
      violations.push(
        'the tenant row declares stages that differ from the programme file — ' +
          'stages are programme-defined and not tenant-writable (FR-GEL-009)',
      );
    }
  }

  const rawTransitions = Array.isArray(file['transitions']) ? file['transitions'] : [];
  const transitions: ConfigTransition[] = [];
  for (const rawTransition of rawTransitions) {
    const t = asRecord(rawTransition);
    const from = t['from'];
    const to = t['to'];
    let ok = true;

    for (const [label, value] of [
      ['from', from],
      ['to', to],
    ] as const) {
      if (typeof value !== 'string' || !stages.includes(value as LoopStage)) {
        violations.push(`transition ${label} "${String(value)}" is not a configured stage`);
        ok = false;
      }
    }

    const gates = Array.isArray(t['requiredGates']) ? (t['requiredGates'] as string[]) : undefined;
    if (gates === undefined) {
      // Empty is legal and explicit; absent is not. "No gates" and "nobody said"
      // must not look alike (FR-GEL-020).
      violations.push('transition requiredGates must be an array (FR-GEL-020)');
      ok = false;
    }

    // FR-GEL-031, RULE-11 — null, or a named rule. "Present but anonymous" is
    // the invisible automation the rule forbids.
    let trigger: { ruleId: string } | null = null;
    const rawTrigger = t['trigger'];
    if (rawTrigger !== null && rawTrigger !== undefined) {
      const ruleId = asRecord(rawTrigger)['ruleId'];
      if (typeof ruleId !== 'string' || ruleId.length === 0) {
        violations.push('an automated transition must name its trigger rule (FR-GEL-031)');
        ok = false;
      } else {
        trigger = { ruleId };
      }
    }

    if (ok) {
      transitions.push({
        from: from as LoopStage,
        to: to as LoopStage,
        requiredGates: Object.freeze([...(gates ?? [])]),
        trigger,
      });
    }
  }

  if (violations.length > 0) throw new LoopConfigError(workflowType, violations);

  const omittedStages = LOOP_STAGES.filter((stage) => !stages.includes(stage));

  return {
    workflowType,
    stages: Object.freeze(stages),
    omittedStages: Object.freeze(omittedStages),
    transitions: Object.freeze(transitions),
    approvedBy: file['approvedBy'] as string,
    approvalRef: file['approvalRef'] as string,
    transitionFor(from, to) {
      return transitions.find((t) => t.from === from && t.to === to);
    },
  };
}
