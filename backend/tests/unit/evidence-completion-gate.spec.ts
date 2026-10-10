/**
 * T857e — the completion gate, written to fail first. `FR-EVS-030`,
 * `FR-EVS-032`, `FR-EVS-033`, `BR-0144`, `RULE-05`.
 *
 * *"Done" is not proof.* A declaration of completion by an agent or a user does
 * not substitute for required evidence, so:
 *
 * - the gate **refuses** with a **non-empty** unmet list while the Contract is
 *   unmet, and accepts once it is met;
 * - it **returns a `Result`** rather than throwing — a refusal that arrives as
 *   an exception can be swallowed by a caller's `catch`;
 * - every declaration is **recorded**, refusals included, and each re-evaluation
 *   is a new record rather than an edit of the last.
 *
 * `T862b`'s mutation proof targets this file: a bypass in the gate permitting
 * completion with an unmet Contract must turn it red.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import type { NewAttestation } from '../../src/modules/evidence/evidence.types.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const WS = 'ws_gate';
const work = { type: 'task', id: 'T-1' } as const;
const TEST = predicateTypeFor('test-result');

function catalog(): ContractCatalog {
  return ContractCatalog.fromDefinitions([
    {
      workClass: 'task-completion',
      contractVersion: 1,
      items: [{ itemId: 'tests-pass', description: 'Automated tests pass', acceptingPredicateTypes: [TEST] }],
    },
  ]);
}

function attestation(overrides: Partial<NewAttestation> = {}): NewAttestation {
  return {
    workspaceId: WS,
    projectId: 'p1',
    predicateType: TEST,
    subjectName: 'src/a.ts',
    subjectDigest: { gitCommit: 'a'.repeat(40) },
    attestedArtifactId: 'a1',
    attestedVersion: 1,
    producedAt: new Date('2026-10-07T00:00:00Z'),
    sourceUri: 'pmi:qa-suite',
    sourceVersion: null,
    storage: 'stored',
    payload: { result: 'PASSED' },
    reference: null,
    attachedTo: work,
    ...overrides,
  };
}

async function setup() {
  const repo = new InMemoryEvidenceRepository();
  const gate = new CompletionGate(repo, catalog(), null);
  await repo.appendBinding({
    workspaceId: WS,
    projectId: 'p1',
    workRef: work,
    workClass: 'task-completion',
    contractVersion: 1,
    subjectArtifactType: 'file',
    subjectArtifactId: 'a1',
    subjectVersion: 1,
  });
  return { repo, gate };
}

describe('T857e · FR-EVS-030 — a declaration does not complete anything', () => {
  it('refuses completion while the Contract is unmet', async () => {
    const { gate } = await setup();
    const result = await gate.complete(WS, work, 'agent:claude');
    expect(result).toEqual({ ok: false, unmet: ['tests-pass'] });
  });

  it('accepts completion once the evidence exists', async () => {
    const { repo, gate } = await setup();
    await repo.appendAttestation(attestation());
    await expect(gate.complete(WS, work, 'user:u1')).resolves.toEqual({ ok: true });
  });

  it('returns a result rather than throwing, for both outcomes', async () => {
    const { gate } = await setup();
    await expect(gate.complete(WS, work, 'agent:claude')).resolves.toBeDefined();
  });

  it('refuses work bound to no Contract, rather than treating "nothing required" as met (FR-EVS-021)', async () => {
    const { gate } = await setup();
    const result = await gate.complete(WS, { type: 'task', id: 'unbound' }, 'user:u1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.unmet[0]).toMatch(/no Evidence Contract is bound/);
  });

  it('never reads evidence across a workspace (FR-EVS-016)', async () => {
    const { repo, gate } = await setup();
    await repo.appendAttestation(attestation({ workspaceId: 'ws_other' }));
    await expect(gate.complete(WS, work, 'user:u1')).resolves.toEqual({ ok: false, unmet: ['tests-pass'] });
  });
});

describe('T857e · FR-EVS-032, FR-EVS-033 — a refusal names what is missing, and is recorded', () => {
  it('records the refusal with its unmet items and the Contract version', async () => {
    const { repo, gate } = await setup();
    await gate.complete(WS, work, 'agent:claude');
    const attempts = await repo.attempts(WS, work);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      outcome: 'refused',
      unmetItems: ['tests-pass'],
      contractVersion: 1,
      declaredBy: 'agent:claude',
      trigger: 'declaration',
    });
  });

  it('records each declaration as a new attempt, never an edit of the last', async () => {
    const { repo, gate } = await setup();
    await gate.complete(WS, work, 'agent:claude');
    await repo.appendAttestation(attestation());
    await gate.complete(WS, work, 'agent:claude');
    const attempts = await repo.attempts(WS, work);
    expect(attempts.map((a) => a.outcome)).toEqual(['refused', 'accepted']);
    expect(attempts[0]!.unmetItems).toEqual(['tests-pass']);
  });
});

describe('T858h · FR-EVS-031 — re-evaluated when evidence arrives, without a second declaration', () => {
  const contribution = {
    attestation: {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ name: 'src/a.ts', digest: { gitCommit: 'a'.repeat(40) } }],
      predicateType: TEST,
      predicate: { result: 'PASSED' },
    },
    attestedArtifact: { id: 'a1', version: 1 },
    attachedTo: work,
    producedAt: '2026-10-07T00:00:00Z',
    source: { uri: 'pmi:qa-suite' },
    projectId: 'p1',
  };

  async function withService() {
    const { repo, gate } = await setup();
    const svc = new EvidenceService(repo, catalog(), gate, { canRead: async () => true }, null);
    return { repo, gate, svc };
  }

  it('appends an accepted evidence-arrival attempt on behalf of whoever declared', async () => {
    const { repo, gate, svc } = await withService();
    await gate.complete(WS, work, 'agent:claude');
    await svc.contribute({ workspaceId: WS, userId: 'u1' }, contribution);
    const attempts = await repo.attempts(WS, work);
    expect(attempts.map((a) => [a.outcome, a.trigger, a.declaredBy])).toEqual([
      ['refused', 'declaration', 'agent:claude'],
      ['accepted', 'evidence-arrival', 'agent:claude'],
    ]);
  });

  it('declares nothing for work nobody has declared complete', async () => {
    const { repo, svc } = await withService();
    await svc.contribute({ workspaceId: WS, userId: 'u1' }, contribution);
    expect(await repo.attempts(WS, work)).toEqual([]);
  });

  it('stays refused, as a new attempt, when the evidence that arrived does not satisfy', async () => {
    const { repo, gate, svc } = await withService();
    await gate.complete(WS, work, 'agent:claude');
    await svc.contribute(
      { workspaceId: WS, userId: 'u1' },
      { ...contribution, attestedArtifact: { id: 'a1', version: 9 } },
    );
    const attempts = await repo.attempts(WS, work);
    expect(attempts.map((a) => [a.outcome, a.trigger])).toEqual([
      ['refused', 'declaration'],
      ['refused', 'evidence-arrival'],
    ]);
  });
});
