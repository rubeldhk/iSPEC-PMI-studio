/**
 * T1798 — the attached typed evidence for one object. `FR-EVS-027`, US3/AC1,
 * `FR-EVS-015`.
 *
 * *"The system MUST expose, for one object, its attached typed evidence and the
 * unmet items of its Contract, as the projection a Room's Evidence region
 * renders."* The status already carried the unmet items; this is the other
 * half. US3/AC1: *"When it is read, it identifies its source, time, the artifact
 * it attests and that artifact's version"* — and whether it can be trusted,
 * because a Room that lists a tampered item without saying so is lying by
 * layout.
 *
 * The payload is **not** in the projection: the Evidence region lists proof; it
 * does not print a reproduction's HAR file to everyone who can see the work.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const principal = { workspaceId: 'ws_proj', userId: 'u1' };
const work = { type: 'task', id: 'T-1' } as const;

async function setup(canRead = true) {
  const repository = new InMemoryEvidenceRepository();
  const catalog = ContractCatalog.fromDirectory();
  const svc = new EvidenceService(repository, catalog, new CompletionGate(repository, catalog, null), { canRead: async () => canRead }, null);
  await new EvidenceService(repository, catalog, new CompletionGate(repository, catalog, null), { canRead: async () => true }, null).bind(principal, {
    workRef: work,
    workClass: 'task-completion',
    projectId: 'p1',
    subject: { type: 'file', id: 'a1', version: 2 },
  });
  return { svc, repository };
}

const contribution = (version: number, extra: Record<string, unknown> = {}) => ({
  attestation: {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: 'src/a.ts', digest: { gitCommit: 'e'.repeat(40) } }],
    predicateType: predicateTypeFor('test-result'),
    predicate: { result: 'PASSED', secret: 'session=abc' },
  },
  attestedArtifact: { id: 'a1', version },
  attachedTo: work,
  producedAt: '2026-10-08T09:00:00Z',
  source: { uri: 'pmi:qa-suite' },
  projectId: 'p1',
  ...extra,
});

describe('T1798 · FR-EVS-027 — the status projection lists the attached evidence', () => {
  it('lists each attestation with source, time, attested artifact, version and trust', async () => {
    const { svc } = await setup();
    const stored = await svc.contribute(principal, contribution(2));
    const status = await svc.status(principal, work);
    expect(status.evidence).toEqual([
      {
        id: stored.id,
        predicateType: predicateTypeFor('test-result'),
        kind: 'test-result',
        source: { uri: 'pmi:qa-suite', version: null },
        producedAt: '2026-10-08T09:00:00.000Z',
        attestedArtifact: { id: 'a1', version: 2 },
        storage: 'stored',
        integrity: 'valid',
        resolution: 'resolved',
        reportsFailure: false,
        current: true,
      },
    ]);
  });

  it('marks evidence for a superseded version as not current, rather than hiding it (FR-EVS-012)', async () => {
    const { svc } = await setup();
    await svc.contribute(principal, contribution(1));
    const [listed] = (await svc.status(principal, work)).evidence;
    expect(listed).toMatchObject({ attestedArtifact: { version: 1 }, current: false });
  });

  it('shows a write-time integrity mismatch as failed', async () => {
    const { svc } = await setup();
    await svc.contribute(principal, contribution(2, { integrity: { algorithm: 'sha256', value: 'f'.repeat(64) } }));
    expect((await svc.status(principal, work)).evidence[0]!.integrity).toBe('failed');
  });

  it('never carries the payload — the Evidence region lists proof, it does not print it', async () => {
    const { svc } = await setup();
    await svc.contribute(principal, contribution(2));
    expect(JSON.stringify(await svc.status(principal, work))).not.toContain('session=abc');
  });

  it('is refused, as absent, to a reader who cannot read the subject (FR-EVS-015)', async () => {
    const { svc } = await setup(false);
    await expect(svc.status(principal, work)).rejects.toMatchObject({ code: 'not_found' });
  });
});
