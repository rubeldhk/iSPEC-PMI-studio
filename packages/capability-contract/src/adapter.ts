/**
 * `T2118` (EPIC-039) — the adapter interface (`contracts/capability-contract.md` §2).
 *
 * Three guarantees live in these types rather than in discipline:
 *
 * - **A descriptor says who it talks to** (`FR-HUB-024`): `assertDescriptor`
 *   refuses one without provider, transport, version or `implements`, naming
 *   the field, and an `Embed` descriptor without a declared dimension per model
 *   (`FR-HUB-081`).
 * - **A credential has no value** (`FR-HUB-043`, `R-039-10`): a
 *   `CredentialHandle` releases the plaintext only inside `use(fn)`, prints as
 *   `[credential]` and throws on `toJSON`.
 * - **An adapter never throws** (the storage-contract rule): `invoke` returns a
 *   result; the output is `unknown` because the **Hub** validates it against the
 *   contract (`FR-HUB-016`).
 */
import type { HealthObservation } from './health.js';
import type { JsonSchema } from './schema.js';
import { isCapabilityName, isScopeResource, type CapabilityName, type ScopeResource } from './vocabulary.js';

export type AdapterTransport = 'native-api' | 'cli' | 'mcp' | 'customer-connector';
export const ADAPTER_TRANSPORTS: readonly AdapterTransport[] = Object.freeze(['native-api', 'cli', 'mcp', 'customer-connector']);

/** How a credential of this kind can be narrowed to a capability's scope (`FR-HUB-034`). */
export type CredentialNarrowing = 'per-request' | 'at-issue' | 'none';

export interface CredentialKind {
  readonly kind: string;
  readonly narrowing: CredentialNarrowing;
}

export interface EmbeddingModel {
  readonly model: string;
  /** Declared, never probed (`FR-HUB-081`). */
  readonly dimension: number;
}

export interface AdapterDescriptor {
  /** Unique in the catalog: `github-rest`, `fixture-ci`, … */
  readonly key: string;
  readonly name: string;
  /** The only place a provider is named (`FR-HUB-024`, `FR-HUB-061`). */
  readonly provider: string;
  readonly transport: AdapterTransport;
  /** The adapter's own version (semver of its package). */
  readonly version: string;
  readonly implements: readonly { readonly capability: CapabilityName; readonly majors: readonly number[] }[];
  readonly credentialKinds: readonly CredentialKind[];
  /** False when the adapter can serve with no credential at all (Ollama on loopback). */
  readonly credentialRequired: boolean;
  /** The project's non-secret `providerBinding`. */
  readonly bindingSchema: JsonSchema;
  /** Provider-neutral resource → the provider's permission names. */
  readonly scopeMapping: Partial<Record<ScopeResource, readonly string[]>>;
  /** `Embed` adapters only. */
  readonly embedding?: { readonly models: readonly EmbeddingModel[] };
}

/** Which provider-neutral resources each capability needs — mirrors the contract files. */
export const REQUIRED_RESOURCES: Readonly<Record<CapabilityName, readonly ScopeResource[]>> = Object.freeze({
  ReadRepository: ['repository.contents'],
  ReadBuildStatus: ['ci.checks'],
  ReadTestResults: ['ci.artifacts'],
  SendNotification: ['notification.send'],
  Embed: ['model.embed'],
});

export class DescriptorError extends Error {
  constructor(
    readonly key: string,
    readonly field: string,
    message: string,
  ) {
    super(`Adapter descriptor ${key || '(no key)'}: ${field} — ${message}`);
    this.name = 'DescriptorError';
  }
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** Refuse a descriptor that leaves out who it talks to, naming the field. */
export function assertDescriptor(d: AdapterDescriptor): void {
  const key = (d as { key?: unknown }).key;
  const k = typeof key === 'string' ? key : '';
  const fail = (field: string, message: string): never => {
    throw new DescriptorError(k, field, message);
  };
  if (!nonEmpty(key)) fail('key', 'is required');
  if (!nonEmpty(d.name)) fail('name', 'is required');
  if (!nonEmpty(d.provider)) fail('provider', 'is required — an adapter must say which provider it talks to (FR-HUB-024)');
  if (!ADAPTER_TRANSPORTS.includes(d.transport)) fail('transport', `must be one of ${ADAPTER_TRANSPORTS.join(', ')}`);
  if (!nonEmpty(d.version)) fail('version', 'is required');
  if (!Array.isArray(d.implements) || d.implements.length === 0) fail('implements', 'must name at least one capability (FR-HUB-024)');
  for (const impl of d.implements) {
    if (!isCapabilityName(impl.capability)) fail('implements', `${String(impl.capability)} is not a capability in the vocabulary`);
    if (!Array.isArray(impl.majors) || impl.majors.length === 0 || impl.majors.some((m) => !Number.isInteger(m) || m < 1)) fail('implements', `${impl.capability} must name the majors it implements`);
    for (const resource of REQUIRED_RESOURCES[impl.capability]) {
      const mapped = d.scopeMapping?.[resource];
      if (!Array.isArray(mapped) || mapped.length === 0) fail('scopeMapping', `${impl.capability} needs ${resource} mapped to the provider's permissions`);
    }
  }
  for (const resource of Object.keys(d.scopeMapping ?? {})) if (!isScopeResource(resource)) fail('scopeMapping', `${resource} is not a provider-neutral scope resource`);
  if (!Array.isArray(d.credentialKinds)) fail('credentialKinds', 'must be a list (empty when no credential exists)');
  if (typeof d.credentialRequired !== 'boolean') fail('credentialRequired', 'must be declared');
  if (d.credentialRequired && d.credentialKinds.length === 0) fail('credentialKinds', 'a credential is required but no kind is declared');
  if (d.bindingSchema === null || typeof d.bindingSchema !== 'object') fail('bindingSchema', 'is required (an empty object schema when nothing is bound)');
  if (d.implements.some((i) => i.capability === 'Embed')) {
    const models = d.embedding?.models;
    if (!Array.isArray(models) || models.length === 0) fail('embedding.models', 'an Embed adapter must declare its models and their dimensions before any request (FR-HUB-081)');
    for (const m of models!) {
      if (!nonEmpty(m.model)) fail('embedding.models', 'a model needs a name');
      if (!Number.isInteger(m.dimension) || m.dimension < 1) fail('embedding.models.dimension', `${m.model} must declare a positive integer dimension`);
    }
  }
}

// ---------------------------------------------------------------- credentials

const SECRETS = new WeakMap<CredentialHandle, string>();
const INSPECT = Symbol.for('nodejs.util.inspect.custom');

/**
 * A credential reference that can be used and never read (`ADR-0012`).
 *
 * The plaintext is held outside the object, in a module-private `WeakMap`, so
 * no enumeration, inspection or serialisation of the handle can reach it.
 */
export class CredentialHandle {
  constructor(
    readonly kind: string,
    secret: string,
  ) {
    SECRETS.set(this, secret);
    Object.freeze(this);
  }

  /** The only way to the secret: for the duration of one provider call. */
  async use<T>(fn: (plaintext: string) => T | Promise<T>): Promise<T> {
    const secret = SECRETS.get(this);
    if (secret === undefined) throw new Error('This credential handle has no secret.');
    return fn(secret);
  }

  toString(): string {
    return '[credential]';
  }

  toJSON(): never {
    throw new Error('A credential handle cannot be serialised (FR-HUB-043).');
  }

  [INSPECT](): string {
    return '[credential]';
  }
}

export function createCredentialHandle(secret: string, kind: string): CredentialHandle {
  return new CredentialHandle(kind, secret);
}

// ---------------------------------------------------------------- invocation

/** What the resolver granted the adapter (`FR-HUB-034`). Never a credential. */
export interface ScopeGrant {
  readonly requested: { readonly access: 'read' | 'write'; readonly resources: readonly ScopeResource[] };
  /** The provider permission names the adapter may use. */
  readonly granted: readonly string[];
  readonly narrowing: 'exact' | 'narrowed-at-issue' | 'not-narrowable';
}

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array; signal?: AbortSignal }) => Promise<Response>;

export interface AdapterContext {
  readonly workspaceId: string | null;
  readonly projectId: string | null;
  readonly binding: Readonly<Record<string, unknown>>;
  readonly credential: CredentialHandle | null;
  readonly scope: ScopeGrant;
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
}

export interface AdapterCall extends AdapterContext {
  readonly capability: CapabilityName;
  readonly contractVersion: string;
  readonly input: unknown;
}

export type AdapterResult =
  | { readonly ok: true; readonly output: unknown; readonly providerRequestId?: string }
  | { readonly ok: false; readonly errorCategory: string; readonly message: string; readonly retryAfterSeconds?: number; readonly providerRequestId?: string };

export interface CapabilityAdapter {
  readonly descriptor: AdapterDescriptor;
  /** Never throws: every failure is a returned result. */
  invoke(call: AdapterCall): Promise<AdapterResult>;
  checkHealth(ctx: AdapterContext): Promise<HealthObservation>;
}

/** Turn anything an adapter might throw into a result — the never-throws rule, enforced at the edge. */
export function faultResult(err: unknown): AdapterResult {
  const message = err instanceof Error ? err.message : 'unknown adapter failure';
  return { ok: false, errorCategory: 'adapter-fault', message };
}
