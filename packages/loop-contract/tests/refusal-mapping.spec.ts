/**
 * T1096 (EPIC-030 C2A closure) — X1: refusal maps to exactly one EPIC-037 event.
 *
 * The finding this closes: `refused` was one verdict with three candidate
 * class-4 events — `validation-failed`, `approval-refused`, `transition-refused`
 * — and nothing but prose to choose between them. A consumer would have had to
 * read `reason` to pick, which is not a contract.
 *
 * The correction models refusal as two **orthogonal** concepts: a stage (when),
 * which selects the event, and a reason code (why), which never does. These
 * tests assert the properties that make the mapping usable rather than merely
 * present: **totality**, **determinism**, and **agreement** between the two.
 */
import { describe, expect, it } from 'vitest';
import {
  ADJUDICATION_VERDICTS,
  RECONCILIATION_CAUSES,
  REFUSAL_EVENT_OF,
  REFUSAL_REASON_CODES,
  REFUSAL_STAGE_OF,
  isRefusalReasonCode,
  refusalEventFor,
  type RefusalStage,
} from '../src/index.js';

const STAGES: RefusalStage[] = ['validation', 'approval', 'transition'];

describe('T1096 · the stage vocabulary', () => {
  it('is exactly the three the project owner specified', () => {
    expect(Object.keys(REFUSAL_EVENT_OF).sort()).toEqual([...STAGES].sort());
  });

  it('maps each stage to exactly one event, and to three distinct events', () => {
    const events = STAGES.map(refusalEventFor);
    expect(events).toEqual(['validation-failed', 'approval-refused', 'transition-refused']);
    // Distinctness is the property that makes the mapping useful: two stages
    // sharing an event would put the consumer back to disambiguating.
    expect(new Set(events).size).toBe(3);
  });

  it('is deterministic — the same stage always yields the same event', () => {
    for (const stage of STAGES) {
      expect(refusalEventFor(stage)).toBe(refusalEventFor(stage));
    }
  });
});

describe('T1096 · the reason vocabulary', () => {
  it('covers every code the authorisation required', () => {
    for (const required of [
      'invalid_lifecycle_transition',
      'gate_failed',
      'unauthorized_actor',
      'self_approval_prohibited',
      'distinct_approver_required',
      'approval_authority_missing',
      'lifecycle_application_refused',
    ]) {
      expect(REFUSAL_REASON_CODES, `missing required reason code ${required}`).toContain(required);
    }
  });

  it('assigns EVERY reason code a stage — no code can be unmappable', () => {
    // Totality is the whole point. A code with no stage would reach EPIC-037
    // as a refusal it cannot turn into an event.
    for (const code of REFUSAL_REASON_CODES) {
      expect(REFUSAL_STAGE_OF[code], `${code} has no stage`).toBeDefined();
      expect(STAGES, `${code} maps to a stage outside the vocabulary`).toContain(
        REFUSAL_STAGE_OF[code],
      );
    }
    expect(Object.keys(REFUSAL_STAGE_OF).sort()).toEqual([...REFUSAL_REASON_CODES].sort());
  });

  it('places each reason in the stage its meaning demands', () => {
    // Stated explicitly so a future code cannot be filed under a convenient
    // stage rather than a true one.
    expect(REFUSAL_STAGE_OF.invalid_lifecycle_transition).toBe('validation');
    expect(REFUSAL_STAGE_OF.gate_failed).toBe('validation');
    expect(REFUSAL_STAGE_OF.gate_outcomes_unavailable).toBe('validation');
    expect(REFUSAL_STAGE_OF.self_approval_prohibited).toBe('approval');
    expect(REFUSAL_STAGE_OF.distinct_approver_required).toBe('approval');
    expect(REFUSAL_STAGE_OF.unauthorized_actor).toBe('approval');
    expect(REFUSAL_STAGE_OF.approval_authority_missing).toBe('approval');
    expect(REFUSAL_STAGE_OF.lifecycle_application_refused).toBe('transition');
  });

  it('recognises its own codes and rejects anything else', () => {
    for (const code of REFUSAL_REASON_CODES) expect(isRefusalReasonCode(code)).toBe(true);
    for (const junk of ['', 'refused', 'gate-failed', 'GATE_FAILED', 'application'])
      expect(isRefusalReasonCode(junk), `${junk} was accepted`).toBe(false);
  });
});

describe('T1096 · what refusal must NOT absorb', () => {
  it('keeps stale state and unknown outcomes out of the refusal vocabulary', () => {
    // `inconsistent` and `reconciliation_required` are verdicts in their own
    // right. A reason code for either would let a caller report drift or an
    // unobserved outcome as a refusal, which asserts a decision nobody made.
    expect(ADJUDICATION_VERDICTS).toContain('inconsistent');
    expect(ADJUDICATION_VERDICTS).toContain('reconciliation_required');
    for (const code of REFUSAL_REASON_CODES) {
      expect(code).not.toMatch(/inconsisten|stale|unknown|reconcil/i);
    }
  });

  it('gives reconciliation its own structured causes', () => {
    expect([...RECONCILIATION_CAUSES]).toEqual([
      'application_outcome_unknown',
      'application_state_unconfirmed',
      'application_transition_unidentified',
    ]);
  });
});
