/**
 * T858c — binding at creation, written to fail first. `FR-EVS-021`,
 * `FR-EVS-023`.
 *
 * The Contract attaches when the work is **created**, with every item unmet —
 * not at closure, where it would be decided by whoever is closing. Its version
 * is fixed then: binding the same work again, to a new version of its subject,
 * keeps the class and the Contract version the work began under, even after a
 * newer Contract has shipped.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const TEST = predicateTypeFor('test-result');
const APPROVAL = predicateTypeFor('approval');
const v1 = {
  workClass: 'task-completion',
  contractVersion: 1,
  items: [{ itemId: 'tests-pass', description: 'Tests pass', acceptingPredicateTypes: [TEST] }],
};
const v2 = {
  ...v1,
  contractVersion: 2,
  items: [...v1.items, { itemId: 'approved', description: 'Approved', acceptingPredicateTypes: [APPROVAL] }],
};

const principal = { workspaceId: 'ws_bind', userId: 'u1' };
const allowAll = { canRead: async () => true };

function service(definitions: unknown[]) {
  const repository = new InMemoryEvidenceRepository();
  const catalog = ContractCatalog.fromDefinitions(definitions);
  const gate = new CompletionGate(repository, catalog, null);
  return { repository, svc: new EvidenceService(repository, catalog, gate, allowAll, null) };
}

const body = (version: number) => ({
  workRef: { type: 'task', id: 'T-1' },
  workClass: 'task-completion',
  projectId: 'p1',
  subject: { type: 'file', id: 'a1', version },
});

describe('T858c · FR-EVS-021 — the Contract attaches at creation, every item unmet', () => {
  it('binds to the latest Contract and reports every item unmet', async () => {
    const { svc } = service([v1]);
    const bound = await svc.bind(principal, body(1));
    expect(bound.contractVersion).toBe(1);
    expect(bound.status.unmet).toEqual(['tests-pass']);
    expect(bound.status.items.every((i) => i.state === 'unmet')).toBe(true);
  });

  it('refuses a work class with no Contract defined', async () => {
    const { svc } = service([v1]);
    await expect(svc.bind(principal, { ...body(1), workClass: 'unknown' })).rejects.toThrow(/No Evidence Contract/);
  });

  it('refuses a workRef that is not one of the four attachable kinds (FR-EVS-004)', async () => {
    const { svc } = service([v1]);
    await expect(svc.bind(principal, { ...body(1), workRef: { type: 'requirement', id: 'R' } })).rejects.toThrow(
      /artifact, task, decision, outcome/,
    );
  });
});

describe('T858c · FR-EVS-023 — judged against the version it began under', () => {
  it('keeps contractVersion 1 when re-bound after v2 has shipped', async () => {
    const before = service([v1]);
    await before.svc.bind(principal, body(1));

    // v2 ships; the same repository, a catalog that now has both versions.
    const catalog = ContractCatalog.fromDefinitions([v1, v2]);
    const svc = new EvidenceService(
      before.repository,
      catalog,
      new CompletionGate(before.repository, catalog, null),
      allowAll,
      null,
    );
    const rebound = await svc.bind(principal, body(2));
    expect(rebound.contractVersion).toBe(1);
    expect(rebound.subjectVersion).toBe(2);
    expect(rebound.status.unmet).toEqual(['tests-pass']);
  });

  it('refuses re-binding the same work under a different class', async () => {
    const { svc } = service([v1, { ...v1, workClass: 'other' }]);
    await svc.bind(principal, body(1));
    await expect(svc.bind(principal, { ...body(1), workClass: 'other' })).rejects.toThrow(/does not change/);
  });

  it('appends a binding rather than editing one — the history stays', async () => {
    const { svc, repository } = service([v1]);
    await svc.bind(principal, body(1));
    await svc.bind(principal, body(2));
    const bindings = await repository.bindings('ws_bind', { type: 'task', id: 'T-1' });
    expect(bindings.map((b) => b.subjectVersion)).toEqual([1, 2]);
  });
});
