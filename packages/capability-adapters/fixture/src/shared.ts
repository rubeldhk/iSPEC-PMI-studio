/**
 * `T2140` (EPIC-039, `R-039-9`) — what every fixture adapter shares.
 *
 * A fixture is a **complete provider**, scripted by the project's non-secret
 * binding (`script`) or, in a conformance run, by `inject()`. It ships in
 * production builds: a project without a Git host, a CI service or a mail
 * provider exercises the Hub against these.
 */
import { createHash } from 'node:crypto';
import type { AdapterCall, AdapterContext, AdapterResult, CapabilityAdapter, AdapterDescriptor, HealthObservation, HealthReason, JsonSchema } from '@pmi/capability-contract';
import type { ConformanceScenario } from '@pmi/capability-contract/conformance';

export const FIXTURE_VERSION = '0.1.0';

export type InvokeScript = 'ok' | 'throttled' | 'credential-rejected' | 'revision-not-found' | 'non-final' | 'provider-error' | 'non-conforming' | 'model-not-present';

export interface FixtureScript {
  readonly health?: 'healthy' | 'degraded' | 'unhealthy';
  readonly healthReason?: HealthReason;
  readonly invoke?: InvokeScript;
  /** Non-final until this many reads of a revision have been made (Q17). */
  readonly finalAfterReads?: number;
  readonly result?: 'PASSED' | 'FAILED';
  /** fixture-embed: a weights digest, so a "new version" is scriptable (CC-12). */
  readonly modelDigest?: string;
}

/** The binding schema every fixture accepts — non-secret by construction. */
export const FIXTURE_BINDING_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    repository: { type: 'string', maxLength: 200 },
    from: { type: 'string', maxLength: 320 },
    model: { type: 'string', maxLength: 100 },
    script: {
      type: 'object',
      additionalProperties: false,
      properties: {
        health: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        healthReason: { type: 'string', maxLength: 64 },
        invoke: { type: 'string', enum: ['ok', 'throttled', 'credential-rejected', 'revision-not-found', 'non-final', 'provider-error', 'non-conforming', 'model-not-present'] },
        finalAfterReads: { type: 'integer' },
        result: { type: 'string', enum: ['PASSED', 'FAILED'] },
        modelDigest: { type: 'string', maxLength: 128 },
      },
    },
  },
};

export function fixtureDescriptor(over: Pick<AdapterDescriptor, 'key' | 'name' | 'implements' | 'scopeMapping'> & Partial<AdapterDescriptor>): AdapterDescriptor {
  return {
    provider: 'fixture',
    transport: 'native-api',
    version: FIXTURE_VERSION,
    credentialKinds: [{ kind: 'fixture-token', narrowing: 'per-request' }],
    credentialRequired: false,
    bindingSchema: FIXTURE_BINDING_SCHEMA,
    ...over,
  };
}

/** A full commit id for any revision name — deterministic, so tests can predict it. */
export function commitFor(revision: string): string {
  return /^[0-9a-f]{40}$/.test(revision) ? revision : createHash('sha1').update(`fixture:${revision}`).digest('hex');
}

export const FULL_SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

export abstract class FixtureAdapter implements CapabilityAdapter {
  abstract readonly descriptor: AdapterDescriptor;
  /** How many times a credential was released to this adapter (never its value). */
  credentialUses = 0;
  private injected: ConformanceScenario | null = null;

  /** Conformance runs script the adapter directly; projects script it through the binding. */
  inject(scenario: ConformanceScenario): void {
    this.injected = scenario;
  }

  protected script(ctx: AdapterContext): FixtureScript {
    const fromBinding = (ctx.binding['script'] ?? {}) as FixtureScript;
    if (this.injected === null) return fromBinding;
    switch (this.injected) {
      case 'unhealthy':
        return { ...fromBinding, health: 'unhealthy', healthReason: 'provider-unreachable', invoke: 'provider-error' };
      case 'model-version-changed':
        return { ...fromBinding, modelDigest: 'sha256:fixture-letters-2' };
      default:
        return { ...fromBinding, invoke: this.injected };
    }
  }

  protected async touchCredential(ctx: AdapterContext): Promise<void> {
    if (ctx.credential === null) return;
    await ctx.credential.use(() => {
      this.credentialUses += 1;
    });
  }

  /** The scripted failure for this call, or null to proceed. */
  protected scriptedFailure(script: FixtureScript): AdapterResult | null {
    switch (script.invoke) {
      case 'throttled':
        return { ok: false, errorCategory: 'provider-throttled', message: 'fixture: rate limited', retryAfterSeconds: 30 };
      case 'credential-rejected':
        return { ok: false, errorCategory: 'credential-rejected', message: 'fixture: the credential was rejected' };
      case 'revision-not-found':
        return { ok: false, errorCategory: 'revision-not-found', message: 'fixture: no such revision' };
      case 'provider-error':
        return { ok: false, errorCategory: 'provider-unavailable', message: 'fixture: the provider answered 500' };
      case 'model-not-present':
        return { ok: false, errorCategory: 'model-not-present', message: 'fixture: the model is not present' };
      default:
        return null;
    }
  }

  async checkHealth(ctx: AdapterContext): Promise<HealthObservation> {
    try {
      const s = this.script(ctx);
      if (s.invoke === 'credential-rejected') return { state: 'unhealthy', reason: 'credential-rejected' };
      if (s.invoke === 'throttled') return { state: 'degraded', reason: 'provider-throttled', retryAfterSeconds: 30 };
      const state = s.health ?? 'healthy';
      if (state === 'healthy') return { state, ...this.healthExtras(s) };
      return { state, reason: s.healthReason ?? 'provider-unreachable', ...this.healthExtras(s) };
    } catch {
      return { state: 'unhealthy', reason: 'provider-error' };
    }
  }

  protected healthExtras(_s: FixtureScript): Partial<HealthObservation> {
    return {};
  }

  async invoke(call: AdapterCall): Promise<AdapterResult> {
    try {
      await this.touchCredential(call);
      const s = this.script(call);
      const failure = this.scriptedFailure(s);
      if (failure !== null) return failure;
      return await this.serve(call, s);
    } catch (err) {
      return { ok: false, errorCategory: 'adapter-fault', message: err instanceof Error ? err.message : 'fixture fault' };
    }
  }

  protected abstract serve(call: AdapterCall, script: FixtureScript): Promise<AdapterResult>;
}

export function invalidInput(message: string): AdapterResult {
  return { ok: false, errorCategory: 'adapter-fault', message: `fixture: ${message}` };
}
