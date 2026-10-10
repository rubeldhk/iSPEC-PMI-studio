/**
 * T859f — unresolvable references. `FR-EVS-014`, `SC-EVS-006`.
 *
 * A referenced item whose target no longer resolves reads **unresolvable** in
 * every read and **never** satisfies an item — whether the target was removed,
 * the provider is down, the provider throws, or no storage is bound at all.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor, type EvidenceContract, type EvidenceStorage, type ResolveResult } from '@pmi/evidence-contract';
import { assess, deriveStatus } from '../../src/modules/evidence/contract.status.js';
import type { StoredAttestation } from '../../src/modules/evidence/evidence.types.js';

const TEST = predicateTypeFor('test-result');

const referenced: StoredAttestation = {
  id: 'ref1',
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
  storage: 'referenced',
  payload: null,
  reference: { provider: 'fixture', location: 'runs/42/report.json' },
  attachedTo: { type: 'task', id: 'T-1' },
  integrity: { algorithm: 'sha256', value: 'cd' },
  integrityValid: true,
  createdAt: new Date(),
};

const contract: EvidenceContract = {
  workClass: 'task-completion',
  contractVersion: 1,
  items: [{ itemId: 'tests-pass', description: 'Tests pass', acceptingPredicateTypes: [TEST] }],
};

const storage = (answer: () => Promise<ResolveResult>): EvidenceStorage => ({ resolve: answer });

async function itemState(port: EvidenceStorage | null) {
  const evidence = await assess([referenced], port);
  return deriveStatus(contract, evidence, { artifactId: 'a1', version: 1 }).items[0]!.state;
}

describe('T859f · FR-EVS-014 — a reference that does not resolve is never satisfied', () => {
  it('satisfies the item while the target resolves', async () => {
    expect(await itemState(storage(async () => ({ resolved: true })))).toBe('met');
  });

  it.each(['destination_missing', 'provider_unavailable', 'authorisation_expired', 'unbound'] as const)(
    'reads %s as unresolvable',
    async (reason) => {
      expect(await itemState(storage(async () => ({ resolved: false, reason })))).toBe('unresolvable');
    },
  );

  it('reads a provider that throws as unresolvable', async () => {
    expect(
      await itemState(
        storage(async () => {
          throw new Error('boom');
        }),
      ),
    ).toBe('unresolvable');
  });

  it('reads every reference as unresolvable when no EvidenceStorage is bound — the port refuses', async () => {
    expect(await itemState(null)).toBe('unresolvable');
  });

  it('reads a resolved target whose digest no longer matches as integrity-failed', async () => {
    expect(await itemState(storage(async () => ({ resolved: true, digest: { sha256: 'different' } })))).toBe(
      'integrity-failed',
    );
  });

  it('reports unresolvable in 100% of 50 reads after the target is removed (SC-EVS-006)', async () => {
    const removed = storage(async () => ({ resolved: false, reason: 'destination_missing' }));
    const states = await Promise.all(Array.from({ length: 50 }, () => itemState(removed)));
    expect(new Set(states)).toEqual(new Set(['unresolvable']));
  });
});
