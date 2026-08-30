/**
 * `T1201`, `T1202` (EPIC-032, scoped) — evaluating an Evidence Contract.
 *
 * The last seam between the Requirement Room and an approved baseline
 * (`DEF-033-002`). `BaselineService.approve` asks one question — *is this
 * Contract satisfied?* — and refuses until something can answer it.
 *
 * Every rule here is a requirement, and most of them are about the ways an
 * unsatisfied Contract can be made to look satisfied:
 *
 * - **`FR-EVS-025`** an item names the evidence types that satisfy it; evidence
 *   of another type leaves it unmet **and says why**.
 * - **`FR-EVS-011`/`FR-EVS-012`** evidence attests an artifact *and its version*,
 *   and evidence for a superseded version is not evidence for the current one.
 * - **`FR-EVS-034`** *presence is not validity* — an item whose evidence fails
 *   its integrity check is unmet.
 * - **`FR-EVS-014`** a reference that no longer resolves reads as unresolvable,
 *   never as satisfied.
 * - **`FR-EVS-026`** a Contract with zero items is satisfied **only** where
 *   policy declared it needs none, and that emptiness must be visible.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateContract,
  type EvidenceContract,
  type EvidenceItem,
} from '../../../src/modules/evidence/contract-evaluation.js';

const contract = (over: Partial<EvidenceContract> = {}): EvidenceContract => ({
  ref: 'ev_1',
  version: 1,
  declaredEmptyByPolicy: false,
  items: [
    { id: 'item-tests', description: 'Automated tests pass', acceptedTypes: ['test-run'] },
  ],
  ...over,
});

const item = (over: Partial<EvidenceItem> = {}): EvidenceItem => ({
  id: 'e1',
  type: 'test-run',
  satisfiesItemId: 'item-tests',
  attestsArtifactId: 'spec_1',
  attestsArtifactVersion: 3,
  integrityValid: true,
  resolvable: true,
  ...over,
});

const target = { artifactId: 'spec_1', artifactVersion: 3 };

describe('T1201 · the ordinary cases', () => {
  it('is satisfied when every item has valid evidence of an accepted type', () => {
    const result = evaluateContract(contract(), [item()], target);
    expect(result.satisfied).toBe(true);
    expect(result.unmet).toEqual([]);
  });

  it('is unsatisfied when an item has no evidence at all', () => {
    const result = evaluateContract(contract(), [], target);
    expect(result.satisfied).toBe(false);
    expect(result.unmet).toHaveLength(1);
    // `FR-EVS-032` — a refusal names the unmet items, and `FR-EVS-022` wants
    // them enumerable without opening each one.
    expect(result.unmet[0]).toMatch(/item-tests/);
    expect(result.unmet[0]).toMatch(/no evidence/i);
  });

  it('names every unmet item, not just the first', () => {
    const two = contract({
      items: [
        { id: 'item-tests', description: 'Tests', acceptedTypes: ['test-run'] },
        { id: 'item-review', description: 'Review', acceptedTypes: ['review-finding'] },
      ],
    });
    const result = evaluateContract(two, [], target);
    expect(result.unmet).toHaveLength(2);
  });
});

describe('T1201 · the ways an unmet item can look met', () => {
  it('evidence of the WRONG type leaves the item unmet, and says why', () => {
    // `FR-EVS-025`. Typed by what it proves (`FR-EVS-003`), so a screenshot does
    // not satisfy an item that asks for a test run.
    const result = evaluateContract(contract(), [item({ type: 'screenshot' })], target);
    expect(result.satisfied).toBe(false);
    expect(result.unmet[0]).toMatch(/screenshot/);
    expect(result.unmet[0]).toMatch(/test-run/);
  });

  it('evidence for a SUPERSEDED version does not satisfy the current one', () => {
    // `FR-EVS-012` — it remains readable, and it is not evidence for this
    // version. The most plausible way stale evidence passes a gate.
    const result = evaluateContract(contract(), [item({ attestsArtifactVersion: 2 })], target);
    expect(result.satisfied).toBe(false);
    expect(result.unmet[0]).toMatch(/version 2/);
  });

  it('evidence for a DIFFERENT artifact does not satisfy it', () => {
    const result = evaluateContract(contract(), [item({ attestsArtifactId: 'spec_other' })], target);
    expect(result.satisfied).toBe(false);
  });

  it('evidence that fails its integrity check is UNMET — presence is not validity', () => {
    // `FR-EVS-034`, quoted because the wording is the rule.
    const result = evaluateContract(contract(), [item({ integrityValid: false })], target);
    expect(result.satisfied).toBe(false);
    expect(result.unmet[0]).toMatch(/integrity/i);
  });

  it('an unresolvable reference reads as unresolvable, never as satisfied', () => {
    // `FR-EVS-014`.
    const result = evaluateContract(contract(), [item({ resolvable: false })], target);
    expect(result.satisfied).toBe(false);
    expect(result.unmet[0]).toMatch(/unresolvable/i);
  });

  it('evidence attached to a DIFFERENT contract item does not satisfy this one', () => {
    const result = evaluateContract(contract(), [item({ satisfiesItemId: 'item-elsewhere' })], target);
    expect(result.satisfied).toBe(false);
  });
});

describe('T1201 · the empty Contract', () => {
  it('is NOT satisfied when it has no items and policy did not say so', () => {
    // `FR-EVS-026`. An empty Contract is the easiest possible way to make
    // completion reachable, so emptiness alone must not permit it.
    const result = evaluateContract(contract({ items: [], declaredEmptyByPolicy: false }), [], target);
    expect(result.satisfied).toBe(false);
    expect(result.unmet[0]).toMatch(/no items/i);
    expect(result.unmet[0]).toMatch(/policy/i);
  });

  it('is satisfied when policy declared the work class needs none — and says so VISIBLY', () => {
    const result = evaluateContract(contract({ items: [], declaredEmptyByPolicy: true }), [], target);
    expect(result.satisfied).toBe(true);
    // "that emptiness MUST be visible" — so it is reported rather than silent.
    expect(result.note).toMatch(/no evidence items/i);
    expect(result.note).toMatch(/policy/i);
  });
});

describe('T1201 · a missing Contract cannot be satisfied', () => {
  it('refuses when the Contract is null', () => {
    // `FR-EVS-035` — where the Contract cannot be evaluated, the gate refuses.
    // An unevaluated Contract is not a satisfied one (`BR-0144`).
    const result = evaluateContract(null, [item()], target);
    expect(result.satisfied).toBe(false);
    expect(result.unmet[0]).toMatch(/cannot be evaluated|not found/i);
  });
});
