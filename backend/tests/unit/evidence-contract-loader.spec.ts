/**
 * T858a — Contract loading, written to fail first. `FR-EVS-020`, `FR-EVS-024`.
 *
 * A required-evidence set decided at closure is decided by whoever is closing.
 * So a Contract version that **weakens** its predecessor — removes an item, or
 * widens the evidence types an item accepts — is **refused at load** while any
 * work is in flight under the predecessor. Refused when configuration is read,
 * not at the moment someone needs it to pass.
 *
 * Refused means *not loaded*: new work keeps binding to the predecessor, and the
 * refusal is listed so it is visible rather than silent. Throwing would take the
 * whole application down because some work happened to be in flight.
 *
 * `T862c`'s mutation proof targets this file.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { ContractCatalog, weakenings } from '../../src/modules/evidence/contract.loader.js';

const TEST = predicateTypeFor('test-result');
const SCAN = predicateTypeFor('scan');
const APPROVAL = predicateTypeFor('approval');

const v1 = {
  workClass: 'task-completion',
  contractVersion: 1,
  items: [
    { itemId: 'tests-pass', description: 'Tests pass', acceptingPredicateTypes: [TEST] },
    { itemId: 'scanned', description: 'Scanned', acceptingPredicateTypes: [SCAN] },
  ],
};
const removesItem = { ...v1, contractVersion: 2, items: [v1.items[0]] };
const widensType = {
  ...v1,
  contractVersion: 2,
  items: [{ ...v1.items[0], acceptingPredicateTypes: [TEST, APPROVAL] }, v1.items[1]],
};
const strengthens = {
  ...v1,
  contractVersion: 2,
  items: [...v1.items, { itemId: 'approved', description: 'Approved', acceptingPredicateTypes: [APPROVAL] }],
};

describe('T858a · weakenings — what counts as weakening a Contract', () => {
  it('names a removed item', () => {
    expect(weakenings(v1 as never, removesItem as never)).toEqual(['item scanned removed']);
  });

  it('names an item that now accepts a type it did not', () => {
    expect(weakenings(v1 as never, widensType as never)).toEqual([
      `item tests-pass now also accepts ${APPROVAL}`,
    ]);
  });

  it('finds nothing in a strengthened Contract', () => {
    expect(weakenings(v1 as never, strengthens as never)).toEqual([]);
  });
});

describe('T858a · FR-EVS-024 — a weakened Contract is refused at load while work is in flight', () => {
  const inFlightUnderV1 = new Set(['task-completion@1']);

  it.each([
    ['removes an item', removesItem],
    ['widens an accepted type', widensType],
  ])('refuses a v2 that %s', (_label, v2) => {
    const catalog = ContractCatalog.fromDefinitions([v1, v2], inFlightUnderV1);
    expect(catalog.latest('task-completion')!.contractVersion).toBe(1);
    expect(catalog.get('task-completion', 2)).toBeNull();
    expect(catalog.refusals()).toEqual([
      expect.objectContaining({ workClass: 'task-completion', contractVersion: 2 }),
    ]);
  });

  it('loads the same weakened v2 when nothing is in flight under v1', () => {
    const catalog = ContractCatalog.fromDefinitions([v1, removesItem], new Set());
    expect(catalog.latest('task-completion')!.contractVersion).toBe(2);
    expect(catalog.refusals()).toEqual([]);
  });

  it('loads a strengthened v2 even while work is in flight', () => {
    const catalog = ContractCatalog.fromDefinitions([v1, strengthens], inFlightUnderV1);
    expect(catalog.latest('task-completion')!.contractVersion).toBe(2);
  });

  it('keeps v1 readable after v2 loads, so in-flight work is still judged by it (FR-EVS-023)', () => {
    const catalog = ContractCatalog.fromDefinitions([v1, strengthens], inFlightUnderV1);
    expect(catalog.get('task-completion', 1)).not.toBeNull();
  });

  it('refuses a malformed definition at load by throwing — that is configuration, not work', () => {
    expect(() => ContractCatalog.fromDefinitions([{ ...v1, items: [] }])).toThrow(/zero-items-without-policy/);
  });
});

describe('T858a · the shipped definitions load', () => {
  it('loads every work class from packages/evidence-contract/contracts', () => {
    const catalog = ContractCatalog.fromDirectory();
    expect(catalog.workClasses()).toEqual([
      'change-closure',
      'defect-repair',
      'requirement-baseline',
      'task-completion',
    ]);
  });
});
