/**
 * T859h — superseded-version evidence. `FR-EVS-012`, `SC-EVS-007`, and `T859k`'s
 * version-scoped matching.
 *
 * The most plausible route by which stale evidence passes a gate: a test run
 * against `v1` of an artifact, still attached, after the artifact moved to `v2`.
 * Evidence for `v1` stays **readable** and is **not** evidence for `v2`. Nor is
 * evidence for a different artifact that happens to share a version number.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const TEST = predicateTypeFor('test-result');
const principal = { workspaceId: 'ws_sup', userId: 'u1' };
const work = { type: 'task', id: 'T-1' } as const;

function contribution(artifactId: string, version: number) {
  return {
    attestation: {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ name: 'src/a.ts', digest: { gitCommit: `${version}`.repeat(40).slice(0, 40) } }],
      predicateType: TEST,
      predicate: { result: 'PASSED' },
    },
    attestedArtifact: { id: artifactId, version },
    attachedTo: work,
    producedAt: '2026-10-07T00:00:00Z',
    source: { uri: 'pmi:qa-suite' },
    projectId: 'p1',
  };
}

async function setup() {
  const repository = new InMemoryEvidenceRepository();
  const catalog = ContractCatalog.fromDefinitions([
    {
      workClass: 'task-completion',
      contractVersion: 1,
      items: [{ itemId: 'tests-pass', description: 'Tests pass', acceptingPredicateTypes: [TEST] }],
    },
  ]);
  const svc = new EvidenceService(repository, catalog, new CompletionGate(repository, catalog, null), { canRead: async () => true }, null);
  const bind = (version: number) =>
    svc.bind(principal, {
      workRef: work,
      workClass: 'task-completion',
      projectId: 'p1',
      subject: { type: 'file', id: 'a1', version },
    });
  return { repository, svc, bind };
}

describe('T859h · FR-EVS-012 — evidence for v1 is not evidence for v2', () => {
  it('is met for v1 while the work is judged against v1', async () => {
    const { svc, bind } = await setup();
    await bind(1);
    await svc.contribute(principal, contribution('a1', 1));
    expect((await svc.status(principal, work)).satisfied).toBe(true);
  });

  it('stops counting the moment the work is judged against v2 (SC-EVS-007)', async () => {
    const { svc, bind } = await setup();
    await bind(1);
    await svc.contribute(principal, contribution('a1', 1));
    await bind(2);
    const status = await svc.status(principal, work);
    expect(status.satisfied).toBe(false);
    expect(status.items[0]!.reason).toMatch(/attests a1 v1, not a1 v2/);
  });

  it('keeps the v1 evidence readable — superseded is not deleted', async () => {
    const { repository, svc, bind } = await setup();
    await bind(1);
    await svc.contribute(principal, contribution('a1', 1));
    await bind(2);
    const all = await repository.attachedTo(principal.workspaceId, work);
    expect(all.map((a) => a.attestedVersion)).toEqual([1]);
  });

  it('is met again by evidence for v2', async () => {
    const { svc, bind } = await setup();
    await bind(1);
    await svc.contribute(principal, contribution('a1', 1));
    await bind(2);
    await svc.contribute(principal, contribution('a1', 2));
    expect((await svc.status(principal, work)).satisfied).toBe(true);
  });

  it('does not count evidence for another artifact at the same version number (T859k)', async () => {
    const { svc, bind } = await setup();
    await bind(1);
    await svc.contribute(principal, contribution('other-artifact', 1));
    expect((await svc.status(principal, work)).satisfied).toBe(false);
  });
});
