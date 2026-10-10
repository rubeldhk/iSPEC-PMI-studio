/**
 * T861a — every evidence type `BR-0140` names, through one mechanism.
 * `FR-EVS-001`, `FR-EVS-002`, `SC-EVS-004`.
 *
 * A per-type mechanism gives the gate nine code paths and nine ways to be wrong.
 * So each of the nine kinds is contributed through the **same** call, both
 * stored and referenced, attached to the same piece of work, and judged by **one**
 * gate against **one** Contract with an item per kind. Demonstrated, not
 * asserted: if any kind needed its own path, its item would stay unmet here.
 */
import { describe, expect, it } from 'vitest';
import { EVIDENCE_KINDS, predicateTypeFor, type EvidenceKind } from '@pmi/evidence-contract';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const principal = { workspaceId: 'ws_types', userId: 'u1' };
const work = { type: 'outcome', id: 'O-1' } as const;

const nineItemContract = {
  workClass: 'every-kind',
  contractVersion: 1,
  items: EVIDENCE_KINDS.map((kind) => ({
    itemId: kind,
    description: `a ${kind}`,
    acceptingPredicateTypes: [predicateTypeFor(kind)],
  })),
};

function contribution(kind: EvidenceKind, storage: 'stored' | 'referenced') {
  return {
    attestation: {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ name: 'release-1', digest: { sha256: 'cd'.repeat(32) } }],
      predicateType: predicateTypeFor(kind),
      predicate: kind === 'test-result' ? { result: 'PASSED' } : { note: `a ${kind}` },
    },
    attestedArtifact: { id: 'release-1', version: 1 },
    attachedTo: work,
    producedAt: '2026-10-07T00:00:00Z',
    source: { uri: 'pmi:producer' },
    projectId: 'p1',
    ...(storage === 'referenced'
      ? {
          reference: { provider: 'fixture', location: `evidence/${kind}.json` },
          integrity: { algorithm: 'sha256', value: 'ef'.repeat(32) },
        }
      : {}),
  };
}

async function run(storage: 'stored' | 'referenced') {
  const repository = new InMemoryEvidenceRepository();
  const catalog = ContractCatalog.fromDefinitions([nineItemContract]);
  const gate = new CompletionGate(repository, catalog, { resolve: async () => ({ resolved: true }) });
  const svc = new EvidenceService(repository, catalog, gate, { canRead: async () => true }, null);
  await svc.bind(principal, {
    workRef: work,
    workClass: 'every-kind',
    projectId: 'p1',
    subject: { type: 'release', id: 'release-1', version: 1 },
  });
  for (const kind of EVIDENCE_KINDS) await svc.contribute(principal, contribution(kind, storage));
  return { svc, gate, repository };
}

describe('T861a · SC-EVS-004 — nine kinds of proof, one mechanism, one gate', () => {
  it.each(['stored', 'referenced'] as const)('meets every one of the nine items with %s evidence', async (storage) => {
    const { svc } = await run(storage);
    const status = await svc.status(principal, work);
    expect(status.items.map((i) => [i.itemId, i.state])).toEqual(EVIDENCE_KINDS.map((k) => [k, 'met']));
  });

  it('opens one gate with all nine', async () => {
    const { gate } = await run('stored');
    await expect(gate.complete(principal.workspaceId, work, 'user:u1')).resolves.toEqual({ ok: true });
  });

  it('stores every kind in the same place, queryable the same way (FR-EVS-002)', async () => {
    const { repository } = await run('stored');
    const all = await repository.attachedTo(principal.workspaceId, work);
    expect(new Set(all.map((a) => a.predicateType)).size).toBe(9);
  });

  it('withholding any one kind leaves exactly that item unmet', async () => {
    for (const missing of EVIDENCE_KINDS) {
      const repository = new InMemoryEvidenceRepository();
      const catalog = ContractCatalog.fromDefinitions([nineItemContract]);
      const svc = new EvidenceService(repository, catalog, new CompletionGate(repository, catalog, null), { canRead: async () => true }, null);
      await svc.bind(principal, {
        workRef: work,
        workClass: 'every-kind',
        projectId: 'p1',
        subject: { type: 'release', id: 'release-1', version: 1 },
      });
      for (const kind of EVIDENCE_KINDS) if (kind !== missing) await svc.contribute(principal, contribution(kind, 'stored'));
      expect((await svc.status(principal, work)).unmet).toEqual([missing]);
    }
  });
});
