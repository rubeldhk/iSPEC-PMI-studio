/**
 * T860a — external contribution. `FR-EVS-040`, `FR-EVS-041`, `BR-0146`.
 *
 * Specialist tools contribute through **the adapter mechanism** — the
 * `AttestationSource` port, filled by the `EPIC-013` / `U-13` registry — never a
 * bespoke route per tool. The contributing tool **and its version** are recorded
 * alongside ordinary provenance, and the version recorded is the one the
 * registry authorised, not whatever the body claimed.
 *
 * The platform's own producers (`pmi:` sources, such as `EPIC-015`'s QA suite)
 * contribute in-process and do not pass through the registry.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor, type AttestationSource } from '@pmi/evidence-contract';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const principal = { workspaceId: 'ws_contrib', userId: 'u1' };
const SCANNER = 'https://github.com/aquasecurity/trivy';

const body = (sourceVersion?: string) => ({
  attestation: {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: 'image', digest: { sha256: 'ab'.repeat(32) } }],
    predicateType: predicateTypeFor('scan'),
    predicate: { scanner: { uri: SCANNER, version: '0.45.0' }, result: [] },
  },
  attestedArtifact: { id: 'image-1', version: 4 },
  attachedTo: { type: 'artifact', id: 'image-1' },
  producedAt: '2026-10-07T00:00:00Z',
  source: { uri: SCANNER, ...(sourceVersion !== undefined ? { version: sourceVersion } : {}) },
  projectId: 'p1',
});

function service(sources: AttestationSource | null) {
  const repository = new InMemoryEvidenceRepository();
  const catalog = ContractCatalog.fromDirectory();
  const gate = new CompletionGate(repository, catalog, null);
  return { repository, svc: new EvidenceService(repository, catalog, gate, { canRead: async () => true }, sources) };
}

const registry: AttestationSource = {
  authorise: async (uri) => (uri === SCANNER ? { uri, version: '0.45.0' } : null),
};

describe('T860a · FR-EVS-041 — the contributing tool and its version are recorded', () => {
  it('records the authorised source and the version the registry vouched for', async () => {
    const { svc, repository } = service(registry);
    await svc.contribute(principal, body('9.9.9-claimed'));
    const [stored] = await repository.attachedTo(principal.workspaceId, { type: 'artifact', id: 'image-1' });
    expect(stored).toMatchObject({ sourceUri: SCANNER, sourceVersion: '0.45.0' });
    // ...alongside ordinary provenance (FR-EVS-010, FR-EVS-011).
    expect(stored).toMatchObject({ attestedArtifactId: 'image-1', attestedVersion: 4 });
    expect(stored!.producedAt).toEqual(new Date('2026-10-07T00:00:00Z'));
  });
});

describe('T860a · FR-EVS-040 — through the adapter mechanism, never a bespoke path', () => {
  it('refuses a tool the registry does not authorise, and stores nothing', async () => {
    const { svc, repository } = service({ authorise: async () => null });
    await expect(svc.contribute(principal, body())).rejects.toThrow(/not an authorised evidence source/);
    expect(await repository.attachedTo(principal.workspaceId, { type: 'artifact', id: 'image-1' })).toEqual([]);
  });

  it('refuses every external tool while no AttestationSource is bound — the port refuses', async () => {
    const { svc } = service(null);
    await expect(svc.contribute(principal, body())).rejects.toMatchObject({ code: 'governance_seam_unbound' });
  });

  it('accepts the platform’s own producers in-process, without the registry', async () => {
    const { svc } = service(null);
    const stored = await svc.contribute(principal, { ...body(), source: { uri: 'pmi:qa-suite' } });
    expect(stored.predicateType).toBe(predicateTypeFor('scan'));
  });
});
