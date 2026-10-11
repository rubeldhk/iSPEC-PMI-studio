/**
 * `T2214` (EPIC-039, `R-039-11`, `FR-HUB-051`, `FR-HUB-052`) — the two
 * `EPIC-032` seams this Epic fills.
 *
 * - **`AttestationSource`** (`EPIC-032`'s port, `FR-EVS-040`/`FR-EVS-041`):
 *   `pmi-adapter:<key>` is authorised for an **active outbound** registry entry
 *   of **that** workspace whose adapter is in the build, with the catalog's
 *   version; anything else — another workspace, a retired or inbound entry, an
 *   adapter not in this build, a URI of another shape — is `null`.
 * - **`EvidenceSink`** (the Hub's port): `bindingExists` reads
 *   `CompletionGate.evaluate` and is true only for an evaluated binding whose
 *   Contract names the item; `contribute` calls `EvidenceService.contribute`
 *   as the intake's principal with the body of `R-039-11` — the Statement
 *   inline, never a `reference` (`DEF-032-004`). A store fault propagates as a
 *   refusal, never as success.
 */
import { describe, expect, it } from 'vitest';
import { hubAttestationSource } from '../../src/modules/integrations/evidence/attestation-source.adapter.js';
import { evidenceServiceSink, type EvidenceGateReader, type EvidenceContributor } from '../../src/modules/integrations/evidence/evidence-sink.adapter.js';
import type { RegistryEntryRecord } from '../../src/modules/integrations/integrations.store.js';

const NOW = new Date('2026-10-11T09:00:00.000Z');

function entry(over: Partial<RegistryEntryRecord>): RegistryEntryRecord {
  return { id: 'e1', workspaceId: 'ws_1', key: 'fixture-ci', direction: 'outbound', status: 'active', listedOrder: 10, registeredBy: 'u', registeredAt: NOW, retiredBy: null, retiredAt: null, ...over };
}

function source(rows: RegistryEntryRecord[], inBuild: Record<string, string> = { 'fixture-ci': '0.1.0', 'github-rest': '1.2.0' }) {
  return hubAttestationSource({
    store: { findEntryByKey: async (ws, key) => rows.find((r) => r.workspaceId === ws && r.key === key) ?? null },
    catalog: { descriptor: (key) => (key in inBuild ? { version: inBuild[key]! } : null) },
  });
}

describe('T2214 · AttestationSource — pmi-adapter:<key> for an active outbound entry of the workspace', () => {
  it('authorises it with the catalog version (FR-EVS-041)', async () => {
    expect(await source([entry({})]).authorise('pmi-adapter:fixture-ci', 'ws_1')).toEqual({ uri: 'pmi-adapter:fixture-ci', version: '0.1.0' });
  });

  it.each([
    ['another workspace', [entry({ workspaceId: 'ws_2' })], 'pmi-adapter:fixture-ci'],
    ['a retired entry', [entry({ status: 'retired' })], 'pmi-adapter:fixture-ci'],
    ['an inbound entry', [entry({ key: 'pmi-studio', direction: 'inbound' })], 'pmi-adapter:pmi-studio'],
    ['an adapter not in this build', [entry({ key: 'gone' })], 'pmi-adapter:gone'],
    ['an unregistered key', [], 'pmi-adapter:github-rest'],
    ['a URI of another shape', [entry({})], 'https://ci.example.test/fixture-ci'],
    ['an empty key', [entry({})], 'pmi-adapter:'],
  ] as const)('refuses %s with null', async (_label, rows, uri) => {
    expect(await source([...rows]).authorise(uri, 'ws_1')).toBeNull();
  });
});

const WORK = { type: 'task', id: 'task_1' } as const;
const STATEMENT = { _type: 'https://in-toto.io/Statement/v1', subject: [{ name: 'o/r@abc', digest: { gitCommit: 'a'.repeat(40) } }], predicateType: 'https://in-toto.io/attestation/test-result/v0.1', predicate: { result: 'PASSED', passedTests: ['t'], failedTests: [], warnedTests: [] } };
const BINDING = { id: 'b1', workspaceId: 'ws_1', projectId: 'prj_1', workRef: WORK, workClass: 'task', contractVersion: 1, subjectArtifactType: 'task', subjectArtifactId: 'task_1', subjectVersion: 3, createdAt: NOW };

function gate(result: Awaited<ReturnType<EvidenceGateReader['evaluate']>> | Error): EvidenceGateReader & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    evaluate: async (...args) => {
      calls.push(args);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

const evaluated = (items: string[]) =>
  ({ evaluated: true, binding: BINDING, attached: [], status: { workClass: 'task', contractVersion: 1, items: items.map((itemId) => ({ itemId, description: itemId, state: 'unmet' })), unmet: items, satisfied: false } }) as never;

function contributor(fault?: Error): EvidenceContributor & { bodies: unknown[]; principals: unknown[] } {
  const bodies: unknown[] = [];
  const principals: unknown[] = [];
  return {
    bodies,
    principals,
    contribute: async (principal, body) => {
      principals.push(principal);
      bodies.push(body);
      if (fault) throw fault;
      return { id: 'att_1' };
    },
  };
}

const CONTRIBUTION = {
  workspaceId: 'ws_1',
  projectId: 'prj_1',
  principalId: 'u_intake',
  workRef: WORK,
  contractItemId: 'unit-tests',
  attestedArtifact: { id: 'task_1', version: 3 },
  attestation: STATEMENT,
  source: { uri: 'pmi-adapter:fixture-ci', version: '0.1.0' },
};

describe('T2214 · EvidenceSink.bindingExists reads CompletionGate.evaluate', () => {
  it('is true for an evaluated binding whose Contract names the item', async () => {
    const g = gate(evaluated(['unit-tests', 'review']));
    expect(await evidenceServiceSink(contributor(), g, () => NOW).bindingExists('ws_1', WORK, 'unit-tests')).toBe(true);
    expect(g.calls).toEqual([['ws_1', WORK]]);
  });

  it('is false with no binding, or a Contract without the item', async () => {
    expect(await evidenceServiceSink(contributor(), gate({ evaluated: false, binding: null, reason: 'no Evidence Contract is bound' }), () => NOW).bindingExists('ws_1', WORK, 'unit-tests')).toBe(false);
    expect(await evidenceServiceSink(contributor(), gate(evaluated(['review'])), () => NOW).bindingExists('ws_1', WORK, 'unit-tests')).toBe(false);
  });

  it('a binding that cannot be evaluated is a refusal, never a false "no binding" (FR-EVS-035)', async () => {
    const g = gate({ evaluated: false, binding: BINDING as never, reason: 'the evidence store could not be reached' });
    await expect(evidenceServiceSink(contributor(), g, () => NOW).bindingExists('ws_1', WORK, 'unit-tests')).rejects.toThrow(/could not be reached/);
    await expect(evidenceServiceSink(contributor(), gate(new Error('db down')), () => NOW).bindingExists('ws_1', WORK, 'unit-tests')).rejects.toThrow(/db down/);
  });
});

describe('T2214 · EvidenceSink.contribute calls EvidenceService.contribute with the body of R-039-11', () => {
  it('as the intake principal, the Statement inline, attached to the work item, with the adapter source', async () => {
    const c = contributor();
    const out = await evidenceServiceSink(c, gate(evaluated(['unit-tests'])), () => NOW).contribute(CONTRIBUTION);
    expect(out).toEqual({ attestationId: 'att_1' });
    expect(c.principals).toEqual([{ workspaceId: 'ws_1', userId: 'u_intake' }]);
    expect(c.bodies).toEqual([
      {
        projectId: 'prj_1',
        attestation: STATEMENT,
        attestedArtifact: { id: 'task_1', version: 3 },
        attachedTo: WORK,
        source: { uri: 'pmi-adapter:fixture-ci', version: '0.1.0' },
        producedAt: NOW.toISOString(),
      },
    ]);
    expect(c.bodies[0]).not.toHaveProperty('reference');
  });

  it("names the binding's subject when the intake named no attested artifact", async () => {
    const c = contributor();
    await evidenceServiceSink(c, gate(evaluated(['unit-tests'])), () => NOW).contribute({ ...CONTRIBUTION, attestedArtifact: null });
    expect((c.bodies[0] as { attestedArtifact: unknown }).attestedArtifact).toEqual({ id: 'task_1', version: 3 });
  });

  it('a store fault propagates as a refusal, never as success', async () => {
    const sink = evidenceServiceSink(contributor(new Error('The evidence store could not be reached (FR-EVS-035).')), gate(evaluated(['unit-tests'])), () => NOW);
    await expect(sink.contribute(CONTRIBUTION)).rejects.toThrow(/could not be reached/);
  });

  it('with no attested artifact and no binding to name one, it refuses rather than invent a subject', async () => {
    const sink = evidenceServiceSink(contributor(), gate({ evaluated: false, binding: null, reason: 'no Evidence Contract is bound' }), () => NOW);
    await expect(sink.contribute({ ...CONTRIBUTION, attestedArtifact: null })).rejects.toThrow(/attested artifact/);
  });
});
