/**
 * T860c — a contribution naming no artifact version is refused. `FR-EVS-042`.
 *
 * Refused, never attached to whatever version is current: inferring the version
 * at write time is exactly how stale evidence comes to look current. Two ways to
 * name no version, both refused, and in both cases nothing is stored:
 *
 * - no subject digest in the in-toto Statement (the artifact's content identity);
 * - no `attestedArtifact.version` (the platform's version number).
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const principal = { workspaceId: 'ws_nover', userId: 'u1' };
const target = { type: 'task', id: 'T-1' } as const;

const good = {
  attestation: {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: 'src/a.ts', digest: { gitCommit: 'a'.repeat(40) } }],
    predicateType: predicateTypeFor('test-result'),
    predicate: { result: 'PASSED' },
  },
  attestedArtifact: { id: 'a1', version: 1 },
  attachedTo: target,
  producedAt: '2026-10-07T00:00:00Z',
  source: { uri: 'pmi:qa-suite' },
  projectId: 'p1',
};

function service() {
  const repository = new InMemoryEvidenceRepository();
  const catalog = ContractCatalog.fromDirectory();
  const svc = new EvidenceService(repository, catalog, new CompletionGate(repository, catalog, null), { canRead: async () => true }, null);
  return { repository, svc };
}

describe('T860c · FR-EVS-042 — no version, no evidence', () => {
  it.each([
    ['an empty subject list', { ...good, attestation: { ...good.attestation, subject: [] } }, /subject/],
    ['a subject with no digest', { ...good, attestation: { ...good.attestation, subject: [{ name: 'x' }] } }, /digest/],
    ['no attested version', { ...good, attestedArtifact: { id: 'a1' } }, /attestedArtifact.version/],
    ['a version of zero', { ...good, attestedArtifact: { id: 'a1', version: 0 } }, /attestedArtifact.version/],
    ['a version given as text', { ...good, attestedArtifact: { id: 'a1', version: 'current' } }, /attestedArtifact.version/],
  ])('refuses %s with validation_failed and stores nothing', async (_label, body, message) => {
    const { svc, repository } = service();
    await expect(svc.contribute(principal, body)).rejects.toMatchObject({ code: 'validation_failed' });
    await expect(svc.contribute(principal, body)).rejects.toThrow(message);
    expect(await repository.attachedTo(principal.workspaceId, target)).toEqual([]);
  });

  it('marks the no-digest refusal as FR-EVS-042 specifically, so a caller can tell it apart', async () => {
    const { svc } = service();
    await expect(
      svc.contribute(principal, { ...good, attestation: { ...good.attestation, subject: [] } }),
    ).rejects.toMatchObject({ details: { reason: 'no-subject-digest' } });
  });

  it('accepts the same contribution once it names its version — the refusals above are about the version', async () => {
    const { svc } = service();
    await expect(svc.contribute(principal, good)).resolves.toMatchObject({ attestedArtifact: { version: 1 } });
  });
});
