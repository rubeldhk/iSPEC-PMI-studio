/**
 * T859a — attestation persistence. `FR-EVS-004`, `FR-EVS-010`, `FR-EVS-011`,
 * `SC-EVS-002`.
 *
 * Every stored attestation identifies its **source**, the **time** it was
 * produced, the **artifact** it attests and that artifact's **version**, and
 * carries integrity metadata. It attaches to an artifact, a task, a decision or
 * an outcome. And the store offers no way to change or remove one — the
 * repository port has no update and no delete, which is the in-process half of
 * the database trigger `evidence-append-only.spec.ts` asserts.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { digestOf } from '../../src/modules/evidence/integrity.js';
import { ATTACHABLE_KINDS, type NewAttestation } from '../../src/modules/evidence/evidence.types.js';

function input(overrides: Partial<NewAttestation> = {}): NewAttestation {
  return {
    workspaceId: 'ws',
    projectId: 'p1',
    predicateType: predicateTypeFor('test-result'),
    subjectName: 'src/a.ts',
    subjectDigest: { gitCommit: 'a'.repeat(40) },
    attestedArtifactId: 'a1',
    attestedVersion: 3,
    producedAt: new Date('2026-10-07T10:00:00Z'),
    sourceUri: 'pmi:qa-suite',
    sourceVersion: null,
    storage: 'stored',
    payload: { result: 'PASSED' },
    reference: null,
    attachedTo: { type: 'task', id: 'T-1' },
    ...overrides,
  };
}

describe('T859a · SC-EVS-002 — provenance is complete on every stored attestation', () => {
  it('records source, time, attested artifact, version and integrity', async () => {
    const stored = await new InMemoryEvidenceRepository().appendAttestation(input());
    expect(stored).toMatchObject({
      sourceUri: 'pmi:qa-suite',
      producedAt: new Date('2026-10-07T10:00:00Z'),
      attestedArtifactId: 'a1',
      attestedVersion: 3,
      subjectDigest: { gitCommit: 'a'.repeat(40) },
    });
    expect(stored.integrity).toEqual(digestOf({ result: 'PASSED' }));
    expect(stored.integrityValid).toBe(true);
  });

  it.each(ATTACHABLE_KINDS)('attaches to a %s (FR-EVS-004)', async (kind) => {
    const repository = new InMemoryEvidenceRepository();
    await repository.appendAttestation(input({ attachedTo: { type: kind, id: 'X' } }));
    expect(await repository.attachedTo('ws', { type: kind, id: 'X' })).toHaveLength(1);
  });

  it('records a contributor digest that disagrees with what arrived, and marks it not valid (FR-EVS-034)', async () => {
    const stored = await new InMemoryEvidenceRepository().appendAttestation(
      input({ claimedIntegrity: { algorithm: 'sha256', value: 'f'.repeat(64) } }),
    );
    expect(stored.integrityValid).toBe(false);
  });
});

describe('T859a · append-only — the port offers no way to change history', () => {
  it('has no update or delete on the repository', () => {
    const repository = new InMemoryEvidenceRepository() as unknown as Record<string, unknown>;
    const mutators = Object.getOwnPropertyNames(Object.getPrototypeOf(repository)).filter((name) =>
      /^(update|delete|remove|set|edit|prune|purge)/i.test(name),
    );
    expect(mutators).toEqual([]);
  });

  it('keeps every attestation, superseded or not — nothing is pruned (R-032-7)', async () => {
    const repository = new InMemoryEvidenceRepository();
    await repository.appendAttestation(input({ attestedVersion: 1 }));
    await repository.appendAttestation(input({ attestedVersion: 2 }));
    const all = await repository.attachedTo('ws', { type: 'task', id: 'T-1' });
    expect(all.map((a) => a.attestedVersion)).toEqual([1, 2]);
  });
});
