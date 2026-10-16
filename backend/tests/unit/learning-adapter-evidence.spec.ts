/**
 * `T2394` (EPIC-048 Phase 9, `R-048-8`, `R-048-9`) — `EvidenceReads` and
 * `ReaderAccess` over `EPIC-032`.
 *
 * `EvidenceReads` passes the ids to `EvidenceService.resolve` (`A-032-1`) and
 * maps each item to the port's shape: the stored **sha256** subject digest is
 * what a citation is compared with (`FR-LRN-012` cites by sha256), so an item
 * attested under another algorithm only can never read `verified`.
 *
 * `ReaderAccess` is `EPIC-032`'s own `AccessControlEvidencePolicy` over
 * `EPIC-024` — the same question reading the artifact would ask; this Epic
 * neither widens nor narrows it, and an error is a `false`.
 *
 * End to end through `EvidenceView`: a verified citation, a substituted one, and
 * one withheld from a reader without a grant.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { AccessControlEvidencePolicy } from '../../src/modules/evidence/access.adapter.js';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';
import { evidenceReadsAdapter, readerAccessAdapter } from '../../src/modules/learning/adapters/evidence.adapter.js';
import { EvidenceView } from '../../src/modules/learning/evidence.view.js';
import type { CitationRecord } from '../../src/modules/learning/learning.store.js';

const WS = 'ws_ev';
const principal = { workspaceId: WS, userId: 'u1' };
const SHA = 'e'.repeat(64);

function evidence() {
  const repository = new InMemoryEvidenceRepository();
  const catalog = ContractCatalog.fromDirectory();
  return new EvidenceService(repository, catalog, new CompletionGate(repository, catalog, null), { canRead: async () => true }, null);
}

const contribute = (svc: EvidenceService, digest: Record<string, string>, attachedTo = { type: 'task', id: 'T-1' }) =>
  svc.contribute(principal, {
    attestation: { _type: 'https://in-toto.io/Statement/v1', subject: [{ name: 'a', digest }], predicateType: predicateTypeFor('test-result'), predicate: { result: 'PASSED' } },
    attestedArtifact: { id: 'a1', version: 1 },
    attachedTo,
    producedAt: '2026-10-08T09:00:00Z',
    source: { uri: 'pmi:qa-suite' },
    projectId: 'p1',
  });

const citation = (evidenceId: string, digest = SHA): CitationRecord =>
  ({ id: `ce_${evidenceId}`, workspaceId: WS, candidateId: 'lc_1', corroborationId: null, evidenceId, digestAlgorithm: 'sha256', digest }) as CitationRecord;

describe('T2394 · EvidenceReads calls EvidenceService.resolve', () => {
  it('maps each resolved item to ResolvedEvidence, with the stored sha256 as the subject digest', async () => {
    const svc = evidence();
    const stored = await contribute(svc, { sha256: SHA });
    const out = await evidenceReadsAdapter(svc).resolve(WS, [stored.id, 'ev_none']);
    expect([...out.keys()]).toEqual([stored.id]);
    expect(out.get(stored.id)).toEqual({
      evidenceId: stored.id,
      integrity: 'valid',
      resolution: 'resolved',
      subjectDigest: SHA,
      predicateType: predicateTypeFor('test-result'),
      attestedArtifact: { id: 'a1', version: 1 },
      attestedTarget: { type: 'task', id: 'T-1' },
    });
  });

  it('an item attested under another algorithm only has no sha256 to compare, so it never verifies', async () => {
    const svc = evidence();
    const stored = await contribute(svc, { gitCommit: 'f'.repeat(40) });
    const view = new EvidenceView({ evidence: evidenceReadsAdapter(svc), readerAccess: { canRead: async () => true } });
    const [state] = await view.unfiltered(WS, [citation(stored.id)]);
    expect(state!.state).toBe('integrity-failed');
  });

  it('a store outage is thrown as itself — EvidenceView then reads every citation unresolvable', async () => {
    const view = new EvidenceView({
      evidence: evidenceReadsAdapter({ resolve: async () => { throw new Error('evidence store down'); } }),
      readerAccess: { canRead: async () => true },
    });
    const [state] = await view.unfiltered(WS, [citation('ev_1')]);
    expect(state).toMatchObject({ state: 'unresolvable', reason: 'evidence store down' });
  });
});

describe('T2394 · ReaderAccess is AccessControlEvidencePolicy over EPIC-024', () => {
  it('asks EPIC-024 about governed targets and answers its verdict', async () => {
    const asked: unknown[] = [];
    const access = readerAccessAdapter(new AccessControlEvidencePolicy({
      async effectivelyReadable(workspaceId, userId, artifact) { asked.push([workspaceId, userId, artifact]); return userId === 'u_granted'; },
    }));
    expect(await access.canRead({ workspaceId: WS, userId: 'u_granted' }, { type: 'specification', id: 's1' })).toBe(true);
    expect(await access.canRead({ workspaceId: WS, userId: 'u_other' }, { type: 'specification', id: 's1' })).toBe(false);
    expect(asked).toEqual([
      [WS, 'u_granted', { artifactType: 'specification', artifactId: 's1' }],
      [WS, 'u_other', { artifactType: 'specification', artifactId: 's1' }],
    ]);
  });

  it('an EPIC-024 error is a false, never a pass', async () => {
    const access = readerAccessAdapter(new AccessControlEvidencePolicy({ async effectivelyReadable() { throw new Error('down'); } }));
    expect(await access.canRead({ workspaceId: WS, userId: 'u' }, { type: 'project', id: 'p1' })).toBe(false);
  });

  it('end to end: a reader without a grant sees the citation withheld, with no id or digest, and counted', async () => {
    const svc = evidence();
    await svc.bind(principal, { workRef: { type: 'task', id: 'T-2' }, workClass: 'task-completion', projectId: 'p1', subject: { type: 'specification', id: 'spec_secret', version: 1 } });
    const hidden = await contribute(svc, { sha256: SHA }, { type: 'task', id: 'T-2' });
    const open = await contribute(svc, { sha256: SHA });
    const view = new EvidenceView({
      evidence: evidenceReadsAdapter(svc),
      readerAccess: readerAccessAdapter(new AccessControlEvidencePolicy({ async effectivelyReadable() { return false; } })),
    });
    const shown = await view.forReader(WS, { workspaceId: WS, userId: 'u_reader' }, [citation(hidden.id), citation(open.id)]);
    expect(shown.withheldEvidenceCount).toBe(1);
    expect(shown.citations[0]).toEqual({ state: 'withheld' });
    expect(shown.citations[1]).toMatchObject({ evidenceId: open.id, state: 'verified' });
  });
});
