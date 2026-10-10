/**
 * T856e — the Evidence Contract types, written to fail first.
 *
 * Three guarantees, moved out of service code and into the types:
 *
 * - `ContractItem` has **no `met` field** (`FR-EVS-030`). State is derived, so
 *   satisfying an item by assignment is not expressible.
 * - `acceptingPredicateTypes` is non-empty (`FR-EVS-025`).
 * - `zeroItemPolicyRef` is required when `items` is empty (`FR-EVS-026`).
 *
 * `validateContract` is the runtime half, for JSON definitions read from disk.
 */
import { describe, expect, it } from 'vitest';
import { validateContract, type ContractItem, type EvidenceContract } from '../src/contract.js';

const item: ContractItem = {
  itemId: 'tests-pass',
  description: 'Automated tests pass',
  acceptingPredicateTypes: ['https://in-toto.io/attestation/test-result/v0.1'],
};

describe('T856e · FR-EVS-030 — an item cannot be marked met', () => {
  it('has no met field to set', () => {
    // @ts-expect-error — `met` is not a property of ContractItem.
    const bad: ContractItem = { ...item, met: true };
    expect(bad).toBeDefined();
  });

  it('requires at least one accepting predicateType (FR-EVS-025)', () => {
    // @ts-expect-error — `acceptingPredicateTypes` is a non-empty tuple.
    const bad: ContractItem = { ...item, acceptingPredicateTypes: [] };
    expect(bad).toBeDefined();
  });
});

describe('T856e · FR-EVS-026 — an empty Contract must say so on purpose', () => {
  it('rejects a zero-item Contract with no policy reference at compile time', () => {
    // @ts-expect-error — an empty `items` requires `zeroItemPolicyRef`.
    const bad: EvidenceContract = { workClass: 'chore', contractVersion: 1, items: [] };
    expect(bad).toBeDefined();
  });

  it('accepts a zero-item Contract that names its policy', () => {
    const ok: EvidenceContract = {
      workClass: 'chore',
      contractVersion: 1,
      items: [],
      zeroItemPolicyRef: 'POLICY-chore-no-evidence',
    };
    expect(validateContract(ok).ok).toBe(true);
  });
});

describe('T856e · validateContract — the runtime fence for definitions read from disk', () => {
  const good = { workClass: 'feature', contractVersion: 1, items: [item] };

  it('accepts a well-formed Contract', () => {
    expect(validateContract(good)).toMatchObject({ ok: true });
  });

  it.each([
    [
      'an item with no accepting predicateType',
      { ...good, items: [{ ...item, acceptingPredicateTypes: [] }] },
      'item-accepts-nothing',
    ],
    ['a zero-item Contract with no policy', { ...good, items: [] }, 'zero-items-without-policy'],
    ['a duplicated itemId', { ...good, items: [item, item] }, 'duplicate-item'],
    ['a non-positive contractVersion', { ...good, contractVersion: 0 }, 'malformed'],
    ['a missing workClass', { ...good, workClass: '' }, 'malformed'],
    ['an item carrying a met field', { ...good, items: [{ ...item, met: true }] }, 'item-declares-state'],
  ])('refuses %s', (_label, body, reason) => {
    expect(validateContract(body)).toMatchObject({ ok: false, reason });
  });
});
