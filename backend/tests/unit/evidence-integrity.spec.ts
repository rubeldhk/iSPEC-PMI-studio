/**
 * T859d — integrity verification. `FR-EVS-013`, `FR-EVS-034`.
 *
 * *Presence is not validity.* A stored payload that no longer matches its
 * recorded digest reads **integrity-failed**, and integrity-failed is **not
 * met**. Re-checked on every read, not trusted from the write: the row is
 * append-only, but the guarantee is the point and the check costs one hash.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor, type EvidenceContract } from '@pmi/evidence-contract';
import { assess, assessForRollup, deriveStatus } from '../../src/modules/evidence/contract.status.js';
import { digestOf } from '../../src/modules/evidence/integrity.js';
import type { StoredAttestation } from '../../src/modules/evidence/evidence.types.js';

const TEST = predicateTypeFor('test-result');
const payload = { result: 'PASSED', passedTests: ['a', 'b'] };

function stored(overrides: Partial<StoredAttestation> = {}): StoredAttestation {
  return {
    id: 'e1',
    workspaceId: 'ws',
    projectId: 'p1',
    predicateType: TEST,
    subjectName: 's',
    subjectDigest: { sha256: 'ab' },
    attestedArtifactId: 'a1',
    attestedVersion: 1,
    producedAt: new Date(),
    sourceUri: 'pmi:qa-suite',
    sourceVersion: null,
    storage: 'stored',
    payload,
    reference: null,
    attachedTo: { type: 'task', id: 'T-1' },
    integrity: digestOf(payload),
    integrityValid: true,
    createdAt: new Date(),
    ...overrides,
  };
}

const contract: EvidenceContract = {
  workClass: 'task-completion',
  contractVersion: 1,
  items: [{ itemId: 'tests-pass', description: 'Tests pass', acceptingPredicateTypes: [TEST] }],
};

describe('T859d · FR-EVS-034 — a corrupted payload is integrity-failed, and not met', () => {
  it('reads an intact payload as valid', async () => {
    const [assessed] = await assess([stored()], null);
    expect(assessed!.integrity).toBe('valid');
  });

  it('reads a payload whose content changed after it was digested as failed', async () => {
    const [assessed] = await assess([stored({ payload: { ...payload, result: 'FAILED' } })], null);
    expect(assessed!.integrity).toBe('failed');
  });

  it('is not fooled by key order — a reordering is not a substitution', async () => {
    const reordered = { passedTests: ['a', 'b'], result: 'PASSED' };
    const [assessed] = await assess([stored({ payload: reordered })], null);
    expect(assessed!.integrity).toBe('valid');
  });

  it('carries a write-time mismatch through to the read', async () => {
    const [assessed] = await assess([stored({ integrityValid: false })], null);
    expect(assessed!.integrity).toBe('failed');
  });

  it('leaves the Contract item integrity-failed, which the gate treats as unmet', async () => {
    const evidence = await assess([stored({ payload: { result: 'FORGED' } })], null);
    const status = deriveStatus(contract, evidence, { artifactId: 'a1', version: 1 });
    expect(status.items[0]!.state).toBe('integrity-failed');
    expect(status.satisfied).toBe(false);
  });
});

describe('the rollup reads the write-time verdict — a report, not a gate', () => {
  const row = {
    id: 'r1',
    predicateType: TEST,
    attestedArtifactId: 'a1',
    attestedVersion: 1,
    storage: 'stored' as const,
    reference: null,
    integrityValid: true,
    predicateResult: 'PASSED',
    attachedTo: { type: 'task' as const, id: 'T-1' },
  };

  it('counts a row whose integrity failed at write as integrity-failed', async () => {
    const [assessed] = await assessForRollup([{ ...row, integrityValid: false }], null);
    expect(assessed!.integrity).toBe('failed');
  });

  it('reads a FAILED test result from the column the database extracted (FR-EVS-036)', async () => {
    const [assessed] = await assessForRollup([{ ...row, predicateResult: 'FAILED' }], null);
    expect(assessed!.reportsFailure).toBe(true);
  });

  it('still resolves a reference live, and reads an unbound store as unresolvable', async () => {
    const referenced = { ...row, storage: 'referenced' as const, reference: { provider: 'p', location: 'x/y' } };
    expect((await assessForRollup([referenced], null))[0]!.resolution).toBe('unresolvable');
    expect((await assessForRollup([referenced], { resolve: async () => ({ resolved: true }) }))[0]!.resolution).toBe('resolved');
  });
});
