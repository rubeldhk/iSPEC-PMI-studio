/**
 * T725 — the decide types, written to fail first. `FR-DPE-003`, `FR-DPE-040`.
 *
 * - `explanation` is **non-optional** on `DecisionResult`: `FR-DPE-040` covers
 *   blocked and allowed alike, so a result without one is unrepresentable.
 * - `proposedClass` is **separate** from `effectiveClass`: an Engineering Expert
 *   may propose; policy classifies. Merging them is how a model-assigned class
 *   would enter without anyone deciding to allow it.
 * - Gate results are the same four words as `EPIC-030`'s loop contract.
 */
import { describe, expect, it } from 'vitest';
import {
  CLOSURE_KINDS,
  DECISION_OUTCOMES,
  GATE_RESULTS,
  type DecisionRequest,
  type DecisionResult,
  type Explanation,
} from '../src/types.js';

const explanation: Explanation = {
  policyVersion: '1',
  matchedRule: { lineageId: 'l1', version: 2 },
  riskClass: 'medium',
  authorityApplied: 'gates required',
};

const result: DecisionResult = {
  decisionId: 'd1',
  outcome: 'refused',
  effectiveClass: 'medium',
  explanation,
  gateOutcomes: [],
};

describe('T725 · FR-DPE-040 — every result explains itself', () => {
  it('rejects a result with no explanation at compile time', () => {
    const { explanation: _dropped, ...rest } = result;
    // @ts-expect-error — explanation is not optional.
    const bad: DecisionResult = rest;
    expect(bad).toBeDefined();
  });

  it('lets matchedRule be null only by saying so — no rule matched is a fact, not an absence', () => {
    const none: Explanation = { ...explanation, matchedRule: null };
    expect(none.matchedRule).toBeNull();
    // @ts-expect-error — matchedRule is required, even when it is null.
    const bad: Explanation = { policyVersion: '1', riskClass: 'high', authorityApplied: 'x' };
    expect(bad).toBeDefined();
  });
});

describe('T725 · FR-DPE-003 — proposing a class is not assigning one', () => {
  it('carries proposedClass on the request and effectiveClass on the result, never the reverse', () => {
    const request: DecisionRequest = {
      workspaceId: 'ws',
      projectId: 'p',
      actionType: 'deploy',
      target: { type: 'service', id: 's1' },
      objectVersion: '1',
      actor: { kind: 'automation', id: 'expert-1' },
      proposedClass: 'low',
      requiredGates: [],
    };
    expect(request.proposedClass).toBe('low');
    // @ts-expect-error — a request cannot carry an effective class.
    const bad: DecisionRequest = { ...request, effectiveClass: 'low' };
    expect(bad).toBeDefined();
  });
});

describe('T725 · the vocabularies', () => {
  it('has the five outcomes the contract names', () => {
    expect(DECISION_OUTCOMES).toEqual(['auto-executed', 'approved', 'refused', 'pending', 'exception']);
  });

  it('has the same four gate results as EPIC-030, and no fifth', () => {
    expect(GATE_RESULTS).toEqual(['satisfied', 'refused', 'exception', 'violation']);
    expect(Object.isFrozen(GATE_RESULTS)).toBe(true);
  });
});

describe('T2501 · FR-DPE-017 — closing a pending decision without approving it', () => {
  it('has exactly three closure kinds, frozen', () => {
    expect(CLOSURE_KINDS).toEqual(['rejected', 'withdrawn', 'expired']);
    expect(Object.isFrozen(CLOSURE_KINDS)).toBe(true);
  });

  it('carries a closure on the explanation only as a kind and a reason together', () => {
    const closed: Explanation = { ...explanation, closure: { kind: 'withdrawn', reason: 'superseded by a newer candidate' } };
    expect(closed.closure?.kind).toBe('withdrawn');
    // @ts-expect-error — a closure states its reason.
    const noReason: Explanation = { ...explanation, closure: { kind: 'rejected' } };
    // @ts-expect-error — and its kind is one of the three.
    const unknownKind: Explanation = { ...explanation, closure: { kind: 'cancelled', reason: 'x' } };
    expect([noReason, unknownKind]).toHaveLength(2);
  });

  it('leaves closure absent on every explanation that is not a closure', () => {
    expect(explanation.closure).toBeUndefined();
  });
});
