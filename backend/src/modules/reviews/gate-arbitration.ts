/**
 * T288 — gate arbitration (FR-ENH-014, SC-ENH-004). A PURE function.
 *
 * "Does this outcome permit advancement?" — answerable without invoking a
 * model. A null human decision BLOCKS, whatever the findings say: an
 * automated verdict alone never transitions a specification. A FAILED gate
 * never advances, decision or not — failure is not approvable (E-R3).
 */
import type { AttributedFinding } from './gate-execution.service.js';

export interface ArbitrationInput {
  gateFailed: boolean;
  findings: readonly AttributedFinding[];
  humanDecision: 'approved' | 'rejected' | null;
}

export interface Verdict {
  advance: boolean;
  reason: string;
}

export function arbitrate(input: ArbitrationInput): Verdict {
  if (input.gateFailed) {
    return {
      advance: false,
      reason: 'The gate failed — one or more reviewing roles did not complete. A failed gate is never a pass; re-run it.',
    };
  }
  if (input.humanDecision === null) {
    return {
      advance: false,
      reason: 'No human decision has been recorded. An automated verdict alone never advances a gated transition.',
    };
  }
  if (input.humanDecision === 'rejected') {
    return { advance: false, reason: 'A human rejected this transition.' };
  }
  return {
    advance: true,
    reason:
      input.findings.length > 0
        ? `Approved by a human over ${input.findings.length} outstanding finding(s) — the override is recorded.`
        : 'Approved by a human with no outstanding findings.',
  };
}
