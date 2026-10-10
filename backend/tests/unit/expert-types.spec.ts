/**
 * `T1903` (EPIC-047) — the Expert vocabulary.
 *
 * Each constant below is a decision the clarification session took, encoded so
 * that widening it is an edit someone has to make on purpose: the memory policy
 * admits only `none` (`FR-EXP-020`), unenforceable limits have exactly two
 * postures (`FR-EXP-043`), and a contract version carries **no** status — its
 * approval is read from `EPIC-031`, never cached here (`R-047-5`).
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  CONTRACT_ELEMENTS,
  LIMIT_KINDS,
  MEMORY_POLICIES,
  RISK_BANDS,
  UNENFORCEABLE_POSTURES,
  defaultPosture,
  type ContractVersion,
} from '../../src/modules/experts/expert.types.js';

describe('T1903 · Expert types', () => {
  it('risk bands are exactly EPIC-031’s three, most restrictive last', () => {
    expect(RISK_BANDS).toEqual(['low', 'medium', 'high']);
  });

  it('the memory policy admits only none (FR-EXP-020)', () => {
    expect(MEMORY_POLICIES).toEqual(['none']);
  });

  it('an unenforceable limit is either refused or proceeds-and-records (FR-EXP-043)', () => {
    expect(UNENFORCEABLE_POSTURES).toEqual(['refuse', 'proceed']);
  });

  it('there are four limits, and the clarified defaults refuse on money and proceed on time', () => {
    expect(LIMIT_KINDS).toEqual(['time', 'resource', 'tokens', 'cost']);
    expect(defaultPosture('tokens')).toBe('refuse');
    expect(defaultPosture('cost')).toBe('refuse');
    expect(defaultPosture('time')).toBe('proceed');
    expect(defaultPosture('resource')).toBe('proceed');
  });

  it('BR-0102 names twelve contract elements', () => {
    expect(CONTRACT_ELEMENTS).toHaveLength(12);
  });

  it('a contract version has no status field — status is derived (R-047-5)', () => {
    expectTypeOf<ContractVersion>().not.toHaveProperty('status');
  });
});
