/**
 * `T2394` (EPIC-048 Phase 9, amendment `A-032-1`, asserted in `EPIC-032`'s
 * suite) — `EvidenceService.resolve(workspaceId, ids)`: a by-id read.
 *
 * Evidence was reachable only through the work it is attached to. Governed
 * Learning cites evidence by id and digest (`FR-LRN-012`), so it needs the
 * item itself: per id, the `AttachedEvidence` view this Epic already computes
 * — integrity re-derived on the read, never trusted from the write — plus the
 * stored subject digest the citation is compared with and the attested target
 * an access check asks about. Never the payload.
 *
 * Additive: no existing capability changes. An id held by another workspace is
 * indistinguishable from an id held by nobody — absent from the answer.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';
import { ProviderUnavailableError } from '../../src/core/errors.js';

const WS = 'ws_res';
const principal = { workspaceId: WS, userId: 'u1' };
const work = { type: 'task', id: 'T-1' } as const;
const SHA = 'd'.repeat(64);

function setup(repository = new InMemoryEvidenceRepository()) {
  const catalog = ContractCatalog.fromDirectory();
  const svc = new EvidenceService(repository, catalog, new CompletionGate(repository, catalog, null), { canRead: async () => true }, null);
  return { svc, repository };
}

const contribution = (over: Record<string, unknown> = {}) => ({
  attestation: {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: 'src/a.ts', digest: { sha256: SHA } }],
    predicateType: predicateTypeFor('test-result'),
    predicate: { result: 'PASSED', secret: 'session=abc' },
  },
  attestedArtifact: { id: 'a1', version: 2 },
  attachedTo: work,
  producedAt: '2026-10-08T09:00:00Z',
  source: { uri: 'pmi:qa-suite' },
  projectId: 'p1',
  ...over,
});

describe('T2394 · A-032-1 — EvidenceService.resolve(workspaceId, ids)', () => {
  it('returns, per id, the AttachedEvidence view, the subject digest and the attested target — never the payload', async () => {
    const { svc } = setup();
    await svc.bind(principal, { workRef: work, workClass: 'task-completion', projectId: 'p1', subject: { type: 'specification', id: 'spec_1', version: 2 } });
    const stored = await svc.contribute(principal, contribution());

    const resolved = await svc.resolve(WS, [stored.id]);
    expect([...resolved.keys()]).toEqual([stored.id]);
    const item = resolved.get(stored.id)!;
    expect(item).toMatchObject({
      id: stored.id,
      predicateType: predicateTypeFor('test-result'),
      attestedArtifact: { id: 'a1', version: 2 },
      storage: 'stored',
      integrity: 'valid',
      resolution: 'resolved',
      subjectDigest: { sha256: SHA },
      // The work's subject is what an access check is about (FR-EVS-015).
      attestedTarget: { type: 'specification', id: 'spec_1' },
    });
    expect(JSON.stringify(item)).not.toContain('session=abc');
  });

  it('with no Contract bound to the work, the attested target is the work itself', async () => {
    const { svc } = setup();
    const stored = await svc.contribute(principal, contribution({ attachedTo: { type: 'decision', id: 'dec_9' } }));
    const item = (await svc.resolve(WS, [stored.id])).get(stored.id)!;
    expect(item.attestedTarget).toEqual({ type: 'decision', id: 'dec_9' });
    expect(item.current).toBe(false);
  });

  it('is absent for another workspace’s id and for an id nobody holds', async () => {
    const { svc } = setup();
    const theirs = await svc.contribute({ workspaceId: 'ws_other', userId: 'u2' }, contribution());
    const resolved = await svc.resolve(WS, [theirs.id, 'ev_missing']);
    expect(resolved.size).toBe(0);
  });

  it('re-derives integrity on the read: a stored payload altered after the write reads failed', async () => {
    const repository = new InMemoryEvidenceRepository();
    const { svc } = setup(repository);
    const stored = await svc.contribute(principal, contribution());
    const [row] = await repository.attachedTo(WS, work);
    (row as { payload: unknown }).payload = { tampered: true };
    expect((await svc.resolve(WS, [stored.id])).get(stored.id)).toMatchObject({ integrity: 'failed' });
  });

  it('answers an empty map for no ids without reading', async () => {
    const repository = new InMemoryEvidenceRepository();
    repository.byIds = async () => { throw new Error('should not be read'); };
    expect((await setup(repository).svc.resolve(WS, [])).size).toBe(0);
  });

  it('an unreachable store is a ProviderUnavailableError, never an empty answer', async () => {
    const repository = new InMemoryEvidenceRepository();
    repository.byIds = async () => { throw new Error('connection reset'); };
    await expect(setup(repository).svc.resolve(WS, ['ev_1'])).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});
