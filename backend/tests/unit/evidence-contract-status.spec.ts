/**
 * T857c — derived item state, written to fail first. `FR-EVS-030`, `FR-EVS-022`,
 * `FR-EVS-027`.
 *
 * met/unmet is **computed from evidence**, and there is no path that sets it.
 * The function under test is pure: it takes a Contract, the evidence attached
 * to a piece of work (already assessed for resolution and integrity) and the
 * subject the work is judged against, and returns the status. Nothing is read
 * from a field that says "met", because there is no such field.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor, type EvidenceContract } from '@pmi/evidence-contract';
import { deriveStatus, type AssessedEvidence } from '../../src/modules/evidence/contract.status.js';

const TEST = predicateTypeFor('test-result');
const APPROVAL = predicateTypeFor('approval');
const REVIEW = predicateTypeFor('review-finding');

const contract: EvidenceContract = {
  workClass: 'task-completion',
  contractVersion: 1,
  items: [
    { itemId: 'tests-pass', description: 'Automated tests pass', acceptingPredicateTypes: [TEST] },
    { itemId: 'reviewed', description: 'Reviewed', acceptingPredicateTypes: [REVIEW, APPROVAL] },
  ],
};

const subject = { artifactId: 'a1', version: 2 };

function evidence(overrides: Partial<AssessedEvidence> = {}): AssessedEvidence {
  return {
    id: 'e1',
    predicateType: TEST,
    attestedArtifactId: 'a1',
    attestedVersion: 2,
    resolution: 'resolved',
    integrity: 'valid',
    ...overrides,
  };
}

describe('T857c · FR-EVS-030 — state is derived from evidence', () => {
  it('reads every item unmet when no evidence is attached (FR-EVS-021)', () => {
    const status = deriveStatus(contract, [], subject);
    expect(status.satisfied).toBe(false);
    expect(status.unmet).toEqual(['tests-pass', 'reviewed']);
    expect(status.items.map((i) => i.state)).toEqual(['unmet', 'unmet']);
    expect(status.items[0]!.reason).toMatch(/no evidence/);
  });

  it('reads an item met when evidence of an accepting type attests the subject version', () => {
    const status = deriveStatus(contract, [evidence()], subject);
    expect(status.items[0]).toMatchObject({ itemId: 'tests-pass', state: 'met', evidenceId: 'e1' });
    expect(status.unmet).toEqual(['reviewed']);
  });

  it('is satisfied only when every item is met', () => {
    const status = deriveStatus(
      contract,
      [evidence(), evidence({ id: 'e2', predicateType: APPROVAL })],
      subject,
    );
    expect(status.satisfied).toBe(true);
    expect(status.unmet).toEqual([]);
  });

  it('carries the Contract identity, so a reader knows which version judged the work', () => {
    const status = deriveStatus(contract, [], subject);
    expect(status).toMatchObject({ workClass: 'task-completion', contractVersion: 1 });
  });
});

describe('T857c · presence is not validity — three ways evidence attached is still not met', () => {
  it('reads integrity-failed evidence as integrity-failed, not met (FR-EVS-034)', () => {
    const status = deriveStatus(contract, [evidence({ integrity: 'failed' })], subject);
    expect(status.items[0]!.state).toBe('integrity-failed');
    expect(status.unmet).toContain('tests-pass');
  });

  it('reads an unresolvable reference as unresolvable, not met (FR-EVS-014)', () => {
    const status = deriveStatus(contract, [evidence({ resolution: 'unresolvable' })], subject);
    expect(status.items[0]!.state).toBe('unresolvable');
    expect(status.unmet).toContain('tests-pass');
  });

  it('prefers a valid piece of evidence over an invalid one for the same item', () => {
    const status = deriveStatus(
      contract,
      [evidence({ id: 'bad', integrity: 'failed' }), evidence({ id: 'good' })],
      subject,
    );
    expect(status.items[0]).toMatchObject({ state: 'met', evidenceId: 'good' });
  });
});

describe('BR-0144 — evidence that reports failure does not satisfy the item it is evidence for', () => {
  it('leaves tests-pass unmet when the only test result says FAILED, and says why', () => {
    const status = deriveStatus(contract, [evidence({ reportsFailure: true })], subject);
    expect(status.items[0]).toMatchObject({ state: 'unmet' });
    expect(status.items[0]!.reason).toMatch(/reports a failure/);
  });

  it('is met by a later passing run beside the failing one', () => {
    const status = deriveStatus(
      contract,
      [evidence({ id: 'red', reportsFailure: true }), evidence({ id: 'green' })],
      subject,
    );
    expect(status.items[0]).toMatchObject({ state: 'met', evidenceId: 'green' });
  });
});

describe('T857c · the zero-item Contract (FR-EVS-026)', () => {
  it('is satisfied, and says it is empty on purpose', () => {
    const empty: EvidenceContract = {
      workClass: 'chore',
      contractVersion: 1,
      items: [],
      zeroItemPolicyRef: 'POLICY-X',
    };
    const status = deriveStatus(empty, [], subject);
    expect(status).toMatchObject({ satisfied: true, unmet: [], zeroItemPolicyRef: 'POLICY-X' });
  });
});
