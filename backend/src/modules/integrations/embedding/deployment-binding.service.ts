/**
 * `T2201` (EPIC-039, `FR-HUB-084`, `US7` AS4, analysis I1) — the deployment's
 * `Embed` binding: **deployment configuration read at boot**.
 *
 * `PMI_EMBED_ADAPTER` names the catalog key, `PMI_EMBED_BINDING` holds its
 * non-secret binding (JSON). The boot reads both, validates them, probes the
 * adapter once for the model version it serves, and holds the result as an
 * in-memory **snapshot** — which is what `HubEmbeddingPort` reads
 * synchronously for `modelId` and `dimension`.
 *
 * | Read | Snapshot |
 * |---|---|
 * | nothing set | unbound — `not-bound` |
 * | unknown key, not an `Embed` adapter, bad JSON, secret-looking value | bound, ineligible — `binding-invalid` |
 * | a model outside the adapter's declared table | bound, ineligible — `model-not-listed`; the dimension is never guessed |
 * | otherwise | bound; eligible unless the probe says unhealthy |
 *
 * Every observation that differs from the latest recorded one (adapter,
 * binding, `modelId` or health) appends a `deployment_capability_bindings`
 * row; `reindexRequired` is true when `modelId` changed. A reboot with the same
 * configuration appends nothing.
 *
 * **There is no write method.** Switching is an operator action that takes
 * effect on restart; no route and no workspace grant can reach this binding.
 */
import { findSecret, validate, type CapabilityAdapter, type HealthObservation } from '@pmi/capability-contract';
import { NotFoundError } from '../../../core/errors.js';
import { adapterContext, TIMEOUTS_MS, withTimeout } from '../adapter-context.js';
import type { AdapterCatalog } from '../catalog.service.js';
import type { Clock } from '../integrations.tokens.js';
import type { DeploymentObservationRecord, IntegrationsStore } from '../integrations.store.js';

export interface DeploymentBindingSnapshot {
  readonly capability: 'Embed';
  readonly bound: boolean;
  readonly eligible: boolean;
  readonly adapterKey: string | null;
  readonly providerBinding: Readonly<Record<string, unknown>>;
  readonly observedModel: { readonly model: string; readonly version: string; readonly dimension: number } | null;
  readonly modelId: string | null;
  readonly dimension: number | null;
  readonly health: 'healthy' | 'degraded' | 'unhealthy';
  readonly reason: string | null;
  /** Why not eligible, in a sentence — appended to `EmbeddingPort`'s 503 (`FR-HUB-085`). */
  readonly explanation: string | null;
  readonly observedAt: Date;
}

export interface DeploymentBindingDeps {
  readonly store: IntegrationsStore;
  readonly catalog: AdapterCatalog;
  readonly clock: Clock;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** `EPIC-024` read on the caller's `integration-registry` — for the one read route. */
  readonly access?: { requireReadable(workspaceId: string, userId: string): Promise<void> };
  /** The registry's first-read seeding (it grants the workspace creator), shared so this read behaves like §1's. */
  readonly ensureSeeded?: (workspaceId: string) => Promise<void>;
}

export interface DeploymentCapabilitiesView {
  readonly capabilities: readonly {
    readonly capability: 'Embed';
    readonly scope: 'deployment';
    readonly setBy: 'deployment configuration (PMI_EMBED_ADAPTER, PMI_EMBED_BINDING); read at boot';
    readonly adapterKey: string | null;
    readonly notApplicable?: string;
    readonly eligible: boolean;
    readonly observedModel: DeploymentBindingSnapshot['observedModel'];
    readonly modelId: string | null;
    readonly dimension: number | null;
    readonly health: string;
    readonly reason: string | null;
    readonly explanation: string | null;
    readonly observations: readonly Omit<DeploymentObservationRecord, 'providerBinding'>[];
  }[];
}

/** Key order is not meaning: PostgreSQL's jsonb reorders keys, so compare a sorted rendering. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

interface Read {
  readonly adapterKey: string | null;
  readonly binding: Readonly<Record<string, unknown>>;
  readonly refusal: { reason: 'binding-invalid' | 'model-not-listed'; explanation: string } | null;
  readonly adapter: CapabilityAdapter | null;
  readonly model: { model: string; dimension: number } | null;
}

export class DeploymentBindingService {
  private current: DeploymentBindingSnapshot;

  constructor(private readonly deps: DeploymentBindingDeps) {
    this.current = this.unboundSnapshot();
  }

  /** The binding as of the latest observation — synchronous, for `HubEmbeddingPort`. */
  snapshot(): DeploymentBindingSnapshot {
    return this.current;
  }

  /** Called once from `IntegrationsModule.onModuleInit`. */
  async observeAtBoot(): Promise<DeploymentBindingSnapshot> {
    return this.observe('system:deployment-config');
  }

  /** The health ticker: re-probe; a changed observation is appended (`observedBy: system:health`). */
  async recheck(): Promise<DeploymentBindingSnapshot> {
    return this.observe('system:health');
  }

  /** `GET /integrations/deployment/capabilities` — read only. */
  async view(workspaceId: string, userId: string): Promise<DeploymentCapabilitiesView> {
    if (this.deps.access === undefined) throw new NotFoundError('Not found.');
    await this.deps.ensureSeeded?.(workspaceId);
    await this.deps.access.requireReadable(workspaceId, userId);
    const s = this.current;
    const rows = await this.deps.store.listObservations('Embed', 10);
    return {
      capabilities: [
        {
          capability: 'Embed',
          scope: 'deployment',
          setBy: 'deployment configuration (PMI_EMBED_ADAPTER, PMI_EMBED_BINDING); read at boot',
          adapterKey: s.adapterKey,
          ...(s.adapterKey === null ? { notApplicable: 'not bound' } : {}),
          eligible: s.eligible,
          observedModel: s.observedModel,
          modelId: s.modelId,
          dimension: s.dimension,
          health: s.health,
          reason: s.reason,
          explanation: s.explanation,
          observations: rows.map(({ providerBinding: _b, ...rest }) => rest),
        },
      ],
    };
  }

  private unboundSnapshot(): DeploymentBindingSnapshot {
    return {
      capability: 'Embed',
      bound: false,
      eligible: false,
      adapterKey: null,
      providerBinding: {},
      observedModel: null,
      modelId: null,
      dimension: null,
      health: 'unhealthy',
      reason: 'not-bound',
      explanation: 'no Embed adapter is bound for this deployment (PMI_EMBED_ADAPTER is not set; FR-HUB-084)',
      observedAt: this.deps.clock(),
    };
  }

  private read(): Read {
    const key = (this.deps.env['PMI_EMBED_ADAPTER'] ?? '').trim();
    if (key === '') return { adapterKey: null, binding: {}, refusal: null, adapter: null, model: null };
    const raw = this.deps.env['PMI_EMBED_BINDING'];
    let binding: Record<string, unknown> = {};
    if (raw !== undefined && raw.trim() !== '') {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
        binding = parsed as Record<string, unknown>;
      } catch {
        return { adapterKey: key, binding: {}, refusal: { reason: 'binding-invalid', explanation: 'PMI_EMBED_BINDING is not a JSON object' }, adapter: null, model: null };
      }
    }
    const secret = findSecret(binding);
    if (secret !== null) return { adapterKey: key, binding: {}, refusal: { reason: 'binding-invalid', explanation: `PMI_EMBED_BINDING holds a secret-looking value at ${secret}; the binding is non-secret by rule (FR-HUB-045), so it is refused and not recorded` }, adapter: null, model: null };
    const adapter = this.deps.catalog.adapter(key);
    if (adapter === null) return { adapterKey: key, binding, refusal: { reason: 'binding-invalid', explanation: `${key} is not in this build's adapter catalog` }, adapter: null, model: null };
    if (!adapter.descriptor.implements.some((i) => i.capability === 'Embed' && i.majors.includes(1))) {
      return { adapterKey: key, binding, refusal: { reason: 'binding-invalid', explanation: `${key} does not implement Embed 1.x` }, adapter: null, model: null };
    }
    const models = adapter.descriptor.embedding?.models ?? [];
    const named = binding['model'];
    const chosen = typeof named === 'string' ? models.find((m) => m.model === named) : models.length === 1 ? models[0] : undefined;
    if (chosen === undefined) {
      return { adapterKey: key, binding, refusal: { reason: 'model-not-listed', explanation: `the model ${typeof named === 'string' ? `"${named}"` : '(none named)'} is not in ${key}'s declared model table (${models.map((m) => m.model).join(', ')}); its dimension is never guessed (FR-HUB-081)` }, adapter: null, model: null };
    }
    const v = validate(adapter.descriptor.bindingSchema, binding);
    if (!v.ok) return { adapterKey: key, binding, refusal: { reason: 'binding-invalid', explanation: `PMI_EMBED_BINDING does not satisfy ${key}'s binding schema: ${v.errors.map((e) => `${e.path} ${e.message}`).join('; ')}` }, adapter: null, model: null };
    return { adapterKey: key, binding, refusal: null, adapter, model: { model: chosen.model, dimension: chosen.dimension } };
  }

  private async probe(adapter: CapabilityAdapter, binding: Readonly<Record<string, unknown>>): Promise<HealthObservation> {
    const timed = adapterContext({ workspaceId: null, projectId: null, binding, credential: null, scope: { requested: { access: 'read', resources: ['model.embed'] }, granted: [...(adapter.descriptor.scopeMapping['model.embed'] ?? [])], narrowing: 'exact' }, timeoutMs: TIMEOUTS_MS.health });
    try {
      return await withTimeout(timed.context.signal, adapter.checkHealth(timed.context).catch((): HealthObservation => ({ state: 'unhealthy', reason: 'provider-error' })), (): HealthObservation => ({ state: 'unhealthy', reason: 'timed-out' }));
    } finally {
      timed.done();
    }
  }

  private async observe(observedBy: string): Promise<DeploymentBindingSnapshot> {
    const now = this.deps.clock();
    const r = this.read();
    let next: DeploymentBindingSnapshot;
    if (r.adapterKey === null) next = { ...this.unboundSnapshot(), observedAt: now };
    else if (r.refusal !== null || r.adapter === null || r.model === null) {
      next = { capability: 'Embed', bound: true, eligible: false, adapterKey: r.adapterKey, providerBinding: r.binding, observedModel: null, modelId: null, dimension: null, health: 'unhealthy', reason: r.refusal?.reason ?? 'binding-invalid', explanation: `the Embed binding ${r.adapterKey} is ineligible: ${r.refusal?.explanation ?? 'unreadable'}`, observedAt: now };
    } else {
      const h = await this.probe(r.adapter, r.binding);
      // The version the adapter reports; a previous one is kept while it cannot be read.
      const version = h.modelVersion ?? (this.current.adapterKey === r.adapterKey ? this.current.observedModel?.version : undefined) ?? 'unknown';
      const observedModel = { model: r.model.model, version, dimension: r.model.dimension };
      const eligible = h.state !== 'unhealthy';
      next = {
        capability: 'Embed',
        bound: true,
        eligible,
        adapterKey: r.adapterKey,
        providerBinding: r.binding,
        observedModel,
        modelId: `${r.adapterKey}:${r.model.model}@${version}`,
        dimension: r.model.dimension,
        health: h.state,
        reason: h.state === 'healthy' ? null : (h.reason ?? 'provider-error'),
        explanation: eligible ? null : `the Embed binding ${r.adapterKey} is ${h.state}: ${h.reason ?? 'provider-error'}${h.detail ? ` (${h.detail})` : ''}`,
        observedAt: now,
      };
    }
    this.current = next;
    await this.record(next, observedBy);
    return next;
  }

  private async record(s: DeploymentBindingSnapshot, observedBy: string): Promise<void> {
    const latest = await this.deps.store.latestObservation('Embed');
    const same =
      latest !== null &&
      latest.adapterKey === s.adapterKey &&
      canonical(latest.providerBinding) === canonical(s.providerBinding) &&
      latest.modelId === s.modelId &&
      latest.health === s.health &&
      (latest.reason ?? null) === s.reason;
    if (same) return;
    const previousModelId = latest?.modelId ?? null;
    await this.deps.store.appendObservation({
      capability: 'Embed',
      adapterKey: s.adapterKey,
      providerBinding: s.providerBinding,
      observedModel: s.observedModel,
      modelId: s.modelId,
      previousModelId,
      reindexRequired: s.modelId !== null && s.modelId !== previousModelId,
      health: s.health,
      reason: s.reason,
      observedBy,
      observedAt: s.observedAt,
    });
  }
}
