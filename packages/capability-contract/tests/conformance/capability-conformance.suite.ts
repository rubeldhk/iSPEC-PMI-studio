/**
 * `T2123` (EPIC-039, `FR-HUB-060`) — the shared adapter conformance suite:
 * CC-01 to CC-13 of `contracts/capability-contract.md` §3.
 *
 * One suite per capability, run against **every** adapter that implements it.
 * A fixture adapter injects each case itself; a real adapter is run over
 * **recorded** provider responses served through an injected `fetch` — never
 * the network (`R-039-9`). An adapter is not conformant until every case its
 * capability applies passes.
 *
 * This is the **adapter-level** suite. The caller-level suite `SC-HUB-001`
 * requires runs in the backend through the real HTTP route.
 */
import { describe, expect, it } from 'vitest';
import { contractFor } from '../../src/capabilities.js';
import type { AdapterCall, AdapterContext, CapabilityAdapter } from '../../src/adapter.js';
import { HEALTH_STATES } from '../../src/health.js';
import { validate } from '../../src/schema.js';
import { REQUIRED_RESOURCES } from '../../src/adapter.js';
import type { CapabilityName } from '../../src/vocabulary.js';

export type ConformanceScenario = 'throttled' | 'credential-rejected' | 'revision-not-found' | 'non-final' | 'unhealthy' | 'provider-error' | 'model-version-changed';

export interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface CapabilityConformanceHarness {
  readonly capability: CapabilityName;
  /** A FRESH adapter per call, configured as a project would configure it. */
  adapter(): CapabilityAdapter;
  /** The context the Hub would pass: binding, credential, granted scope. */
  context(adapter: CapabilityAdapter): AdapterContext;
  /** A valid input for the capability. */
  validInput(): unknown;
  /** Make subsequent calls on this adapter behave as `scenario`. */
  inject(adapter: CapabilityAdapter, scenario: ConformanceScenario): void;
  /** The scenarios this provider can express; a case whose scenario is absent is reported as not applicable. */
  readonly supports: readonly ConformanceScenario[];
  /** The plaintext the context's credential holds — CC-04 asserts no message contains it. */
  readonly credentialSecret?: string;
  /** Recorded provider requests (real adapters) — CC-09 and CC-10. */
  requests?(adapter: CapabilityAdapter): readonly RecordedRequest[];
  /** The provider permission a recorded request needs (CC-09). */
  permissionFor?(request: RecordedRequest): string | null;
  /** The idempotency keys the provider received (CC-10). */
  idempotencyKeysSeen?(adapter: CapabilityAdapter): readonly string[];
  /** CC-13, the `Embed` fixture only. */
  readonly letterBag?: {
    readonly expected: Readonly<Record<string, readonly number[]>>;
    /** query, a synonym sharing meaning but no letters, a lexical neighbour sharing letters but no meaning. */
    readonly meaning: { readonly query: string; readonly synonym: string; readonly lexical: string };
  };
}

function call(harness: CapabilityConformanceHarness, adapter: CapabilityAdapter, input: unknown = harness.validInput()): AdapterCall {
  return { ...harness.context(adapter), capability: harness.capability, contractVersion: '1.0', input };
}

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / Math.sqrt(na * nb);
}

const READS: readonly CapabilityName[] = ['ReadRepository', 'ReadBuildStatus', 'ReadTestResults'];

export function capabilityConformanceSuite(name: string, harness: CapabilityConformanceHarness): void {
  const contract = contractFor(harness.capability, 1);
  const supports = (s: ConformanceScenario): boolean => harness.supports.includes(s);

  describe(`capability conformance · ${harness.capability} · ${name}`, () => {
    it('has a 1.x contract to conform to', () => {
      expect(contract, `no ${harness.capability} 1.x contract ships`).not.toBeNull();
    });

    it('CC-01 — implements the capability at major 1 and declares provider, transport and version', () => {
      const d = harness.adapter().descriptor;
      expect(d.implements.find((i) => i.capability === harness.capability)?.majors).toContain(1);
      expect(d.provider.length).toBeGreaterThan(0);
      expect(d.transport.length).toBeGreaterThan(0);
      expect(d.version.length).toBeGreaterThan(0);
    });

    it('CC-02 — a valid input produces output that validates against the 1.0 output schema', async () => {
      const adapter = harness.adapter();
      const result = await adapter.invoke(call(harness, adapter));
      expect(result.ok, result.ok ? '' : `${result.errorCategory}: ${result.message}`).toBe(true);
      if (!result.ok) return;
      expect(validate(contract!.outputSchema, result.output)).toEqual({ ok: true });
    });

    it.runIf(supports('throttled'))('CC-03 — a throttled provider yields provider-throttled with retryAfterSeconds', async () => {
      const adapter = harness.adapter();
      harness.inject(adapter, 'throttled');
      const result = await adapter.invoke(call(harness, adapter));
      expect(result).toMatchObject({ ok: false, errorCategory: 'provider-throttled' });
      expect(result.ok ? undefined : result.retryAfterSeconds).toBeGreaterThan(0);
    });

    it.runIf(supports('credential-rejected'))('CC-04 — a rejected credential yields credential-rejected, and the message holds no credential', async () => {
      const adapter = harness.adapter();
      harness.inject(adapter, 'credential-rejected');
      const result = await adapter.invoke(call(harness, adapter));
      expect(result).toMatchObject({ ok: false, errorCategory: 'credential-rejected' });
      if (harness.credentialSecret !== undefined && !result.ok) expect(result.message).not.toContain(harness.credentialSecret);
    });

    it.runIf(READS.includes(harness.capability) && supports('revision-not-found'))('CC-05 — an unknown revision yields revision-not-found', async () => {
      const adapter = harness.adapter();
      harness.inject(adapter, 'revision-not-found');
      expect(await adapter.invoke(call(harness, adapter))).toMatchObject({ ok: false, errorCategory: 'revision-not-found' });
    });

    it.runIf((harness.capability === 'ReadBuildStatus' || harness.capability === 'ReadTestResults') && supports('non-final'))('CC-06 — a non-final run yields final: false', async () => {
      const adapter = harness.adapter();
      harness.inject(adapter, 'non-final');
      const result = await adapter.invoke(call(harness, adapter));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.output as { final: boolean }).final).toBe(false);
        expect(validate(contract!.outputSchema, result.output)).toEqual({ ok: true });
      }
    });

    it('CC-07 — checkHealth returns one of the three written states, with a reason when not healthy', async () => {
      const adapter = harness.adapter();
      const healthy = await adapter.checkHealth(harness.context(adapter));
      expect(HEALTH_STATES).toContain(healthy.state);
      if (healthy.state !== 'healthy') expect(healthy.reason).toBeDefined();
      if (supports('unhealthy')) {
        const sick = harness.adapter();
        harness.inject(sick, 'unhealthy');
        const h = await sick.checkHealth(harness.context(sick));
        expect(h.state).not.toBe('healthy');
        expect(HEALTH_STATES).toContain(h.state);
        expect(h.reason).toBeDefined();
      }
    });

    it('CC-08 — never throws: every injected failure, and a malformed input, is a returned result', async () => {
      for (const scenario of harness.supports) {
        const adapter = harness.adapter();
        harness.inject(adapter, scenario);
        await expect(adapter.invoke(call(harness, adapter))).resolves.toBeDefined();
        await expect(adapter.checkHealth(harness.context(adapter))).resolves.toBeDefined();
      }
      const adapter = harness.adapter();
      await expect(adapter.invoke(call(harness, adapter, { nonsense: true }))).resolves.toBeDefined();
      await expect(adapter.invoke(call(harness, adapter, null))).resolves.toBeDefined();
    });

    it.runIf(harness.requests !== undefined && harness.permissionFor !== undefined)('CC-09 — calls only provider endpoints its scopeMapping covers for the capability', async () => {
      const adapter = harness.adapter();
      await adapter.invoke(call(harness, adapter));
      const requests = harness.requests!(adapter);
      expect(requests.length, 'no provider request was recorded').toBeGreaterThan(0);
      const allowed = new Set(REQUIRED_RESOURCES[harness.capability].flatMap((r) => adapter.descriptor.scopeMapping[r] ?? []));
      for (const r of requests) {
        const permission = harness.permissionFor!(r);
        if (permission === null) continue; // token minting and similar calls carry no resource permission
        expect(allowed.has(permission), `${r.method} ${r.url} needs ${permission}`).toBe(true);
      }
    });

    it.runIf(harness.capability === 'SendNotification')('CC-10 — passes idempotencyKey to the provider (R-039-13)', async () => {
      const adapter = harness.adapter();
      const input = harness.validInput() as { idempotencyKey: string };
      await adapter.invoke(call(harness, adapter, input));
      expect(harness.idempotencyKeysSeen?.(adapter) ?? []).toContain(input.idempotencyKey);
    });

    it.runIf(harness.capability === 'Embed')('CC-11 — one finite, non-zero vector per text, in order, of the declared dimension; same text, same vector', async () => {
      const adapter = harness.adapter();
      const texts = ['alpha bravo', 'charlie delta', 'alpha bravo'];
      const result = await adapter.invoke(call(harness, adapter, { texts }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const output = result.output as { model: { id: string; version: string; dimension: number }; vectors: number[][] };
      const declared = adapter.descriptor.embedding!.models.find((m) => m.model === output.model.id)!;
      expect(declared, `model ${output.model.id} is not declared`).toBeDefined();
      expect(output.model.dimension).toBe(declared.dimension);
      expect(output.vectors).toHaveLength(texts.length);
      for (const v of output.vectors) {
        expect(v).toHaveLength(declared.dimension);
        expect(v.every((x) => Number.isFinite(x))).toBe(true);
        expect(v.some((x) => x !== 0)).toBe(true);
      }
      expect(output.vectors[2]).toEqual(output.vectors[0]);
      expect(output.vectors[1]).not.toEqual(output.vectors[0]);
    });

    it.runIf(harness.capability === 'Embed')('CC-12 — reports the model version, and it changes when the weights digest changes', async () => {
      const adapter = harness.adapter();
      const before = await adapter.invoke(call(harness, adapter, { texts: ['x'] }));
      const health = await adapter.checkHealth(harness.context(adapter));
      expect(before.ok).toBe(true);
      const v1 = before.ok ? (before.output as { model: { version: string } }).model.version : '';
      expect(v1.length).toBeGreaterThan(0);
      expect(health.modelVersion).toBe(v1);
      if (supports('model-version-changed')) {
        harness.inject(adapter, 'model-version-changed');
        const after = await adapter.invoke(call(harness, adapter, { texts: ['x'] }));
        const v2 = after.ok ? (after.output as { model: { version: string } }).model.version : '';
        expect(v2.length).toBeGreaterThan(0);
        expect(v2).not.toBe(v1);
      }
    });

    it.runIf(harness.letterBag !== undefined)('CC-13 — the fixture equals EPIC-038\'s letterVector, and is NOT semantic (FR-HUB-086)', async () => {
      const adapter = harness.adapter();
      const corpus = Object.keys(harness.letterBag!.expected);
      const result = await adapter.invoke(call(harness, adapter, { texts: corpus }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const vectors = (result.output as { vectors: number[][] }).vectors;
      corpus.forEach((t, i) => expect(vectors[i]).toEqual(harness.letterBag!.expected[t]));
      const { query, synonym, lexical } = harness.letterBag!.meaning;
      const r = await adapter.invoke(call(harness, adapter, { texts: [query, synonym, lexical] }));
      if (!r.ok) throw new Error('embed failed');
      const [q, s, l] = (r.output as { vectors: number[][] }).vectors as [number[], number[], number[]];
      expect(cosine(q, l), 'a letter-bag must rank the lexical neighbour above the synonym').toBeGreaterThan(cosine(q, s));
    });
  });
}
