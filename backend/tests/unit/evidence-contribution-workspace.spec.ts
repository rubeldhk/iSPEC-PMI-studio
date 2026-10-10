/**
 * T1995 — a contribution cannot be written into another workspace.
 * `FR-EVS-016` (`BR-0001`), Edge Cases: *"An external tool contributes evidence
 * for an artifact in another workspace — refused."*
 *
 * `evidence-access.spec.ts` proves the read routes never find work bound in
 * another workspace. Nothing asserted the write path: a body naming a foreign
 * `workspaceId` must not put evidence there, and evidence contributed against
 * the same work reference must not satisfy work bound in the other workspace.
 *
 * The workspace is the session's, never the body's — the controller strips the
 * field and the service writes under the principal. The first case drives the
 * route end to end; the second drives the service alone, so it fails if the
 * service ever reads a workspace from the body even while the controller still
 * strips it (observed 2026-10-09: that mutation fails the second case, 1 of 2).
 *
 * Active *refusal* of a contribution naming work governed only elsewhere would
 * need a cross-workspace existence lookup — itself an oracle across the
 * boundary `BR-0001` draws, and `EPIC-001`/`EPIC-004`'s to own. What this Epic
 * guarantees is the outcome the edge case exists for: the evidence cannot reach
 * the other workspace, so it cannot satisfy anything there.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import type { WorkspaceContext } from '../../src/core/workspace.guard.js';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { EvidenceController } from '../../src/modules/evidence/evidence.controller.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const TEST = predicateTypeFor('test-result');
const OURS = 'ws_ours';
const FOREIGN = 'ws_foreign';
const work = { type: 'task', id: 'T-shared' } as const;

const contract = {
  workClass: 'task-completion',
  contractVersion: 1,
  items: [{ itemId: 'tests-pass', description: 'Tests pass', acceptingPredicateTypes: [TEST] }],
};

const contribution = {
  attestation: {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: 'src/a.ts', digest: { sha256: 'cd'.repeat(32) } }],
    predicateType: TEST,
    predicate: { result: 'PASSED' },
  },
  attestedArtifact: { id: 'a1', version: 1 },
  attachedTo: work,
  producedAt: '2026-10-09T00:00:00Z',
  source: { uri: 'pmi:qa-suite' },
  projectId: 'p1',
};

async function setup() {
  const repository = new InMemoryEvidenceRepository();
  const catalog = ContractCatalog.fromDefinitions([contract]);
  const gate = new CompletionGate(repository, catalog, null);
  const svc = new EvidenceService(repository, catalog, gate, { canRead: async () => true }, null);
  // The same work reference, governed in another tenant.
  await repository.appendBinding({
    workspaceId: FOREIGN,
    projectId: 'p_foreign',
    workRef: work,
    workClass: 'task-completion',
    contractVersion: 1,
    subjectArtifactType: 'file',
    subjectArtifactId: 'a1',
    subjectVersion: 1,
  });
  return { repository, gate, svc };
}

describe('T1995 · FR-EVS-016 — a contribution never lands in another workspace', () => {
  it('through the route: a body naming a foreign workspace writes only to the session’s', async () => {
    const { repository, gate, svc } = await setup();
    const ctx = { workspaceId: OURS, userId: 'u1' } as unknown as WorkspaceContext;
    await new EvidenceController(svc).contribute(ctx, { ...contribution, workspaceId: FOREIGN });

    expect(await repository.attachedTo(FOREIGN, work)).toEqual([]);
    expect(await repository.attachedTo(OURS, work)).toHaveLength(1);
    const foreign = await gate.evaluate(FOREIGN, work);
    expect(foreign.evaluated && foreign.status.unmet).toEqual(['tests-pass']);
  });

  it('in the service: the principal’s workspace is the only one written, whatever the body says', async () => {
    const { repository, gate, svc } = await setup();
    await svc.contribute({ workspaceId: OURS, userId: 'u1' }, { ...contribution, workspaceId: FOREIGN });

    expect(await repository.attachedTo(FOREIGN, work)).toEqual([]);
    const foreign = await gate.complete(FOREIGN, work, 'user:u_foreign');
    expect(foreign).toEqual({ ok: false, unmet: ['tests-pass'] });
  });
});
