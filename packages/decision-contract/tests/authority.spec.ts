/**
 * T723 — the decision-authority record, written to fail first. `BR-0005`,
 * `FR-DPE-014`, published for `U-02`.
 *
 * Exactly the five elements `BR-0005` names — actor, authority basis, object
 * version, decision, timestamp — all required. A shape, not a class: adopting
 * it costs `U-02` nothing but an import.
 */
import { describe, expect, it } from 'vitest';
import { AUTHORITY_RECORD_FIELDS, type DecisionAuthorityRecord } from '../src/authority.js';

const record: DecisionAuthorityRecord = {
  actor: { kind: 'human', id: 'u1' },
  authorityBasis: 'workspace member, high band requires a human (FR-DPE-010)',
  objectVersion: '3',
  decision: 'approved',
  decidedAt: '2026-10-08T12:00:00.000Z',
};

describe('T723 · BR-0005 — the five elements, and only those', () => {
  it('names exactly actor, authority basis, object version, decision and timestamp', () => {
    expect([...AUTHORITY_RECORD_FIELDS].sort()).toEqual(
      ['actor', 'authorityBasis', 'decidedAt', 'decision', 'objectVersion'].sort(),
    );
    expect(Object.keys(record).sort()).toEqual([...AUTHORITY_RECORD_FIELDS].sort());
  });

  it.each(['actor', 'authorityBasis', 'objectVersion', 'decision', 'decidedAt'] as const)(
    'requires %s at compile time',
    (field) => {
      const { [field]: _dropped, ...rest } = record;
      // @ts-expect-error — every BR-0005 element is required.
      const bad: DecisionAuthorityRecord = rest;
      expect(bad).toBeDefined();
    },
  );

  it('accepts only a human or an automation actor (FR-DPE-032)', () => {
    // @ts-expect-error — an actor is human or automation; nothing else.
    const bad: DecisionAuthorityRecord = { ...record, actor: { kind: 'robot', id: 'x' } };
    expect(bad).toBeDefined();
  });
});
