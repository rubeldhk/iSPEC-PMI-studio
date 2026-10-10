/**
 * `T2169`, `T2245` (EPIC-039, `FR-HUB-026`, `FR-HUB-027`, `FR-HUB-047`,
 * `R-039-6`) — adapter health: derived at read, checked on an interval, and
 * observed from requests.
 *
 * - **Derived**: the latest check within the project's interval, else
 *   `unknown` (`never-checked` or `stale`). Nothing stores *healthy*.
 * - **Observed**: a request's `credential-rejected` writes `unhealthy` at once;
 *   a throttle writes `degraded` with the hint. A success writes nothing — one
 *   success is not a health check.
 * - **Scheduled**: `runDueHealthChecks` — at most 50 due pairs per tick,
 *   concurrency 4, 5 s each. The row is inserted **after** the check with
 *   `ON CONFLICT DO NOTHING` (analysis U2), so concurrent instances record one
 *   check per pair per interval.
 */
import { deriveHealth, sanitiseText, type AdapterResult, type DerivedHealth, type HealthObservation, type ScopeGrant } from '@pmi/capability-contract';
import { adapterContext, bindingFor, TIMEOUTS_MS, withTimeout } from '../adapter-context.js';
import type { AdapterCatalog } from '../catalog.service.js';
import type { CredentialVault } from '../credentials/credential.vault.js';
import type { Clock } from '../integrations.tokens.js';
import type { ConfigurationRecord, HealthCheckRecord, IntegrationsStore, RegistryEntryRecord } from '../integrations.store.js';

export const DEFAULT_INTERVAL_SECONDS = 300;
export const MAX_CHECKS_PER_TICK = 50;
export const CHECK_CONCURRENCY = 4;

export interface HealthDeps {
  readonly store: IntegrationsStore;
  readonly catalog: AdapterCatalog;
  readonly vault: CredentialVault;
  readonly clock: Clock;
}

export interface DueRunReport {
  readonly considered: number;
  readonly checked: number;
  readonly recorded: number;
}

export class HealthService {
  constructor(private readonly deps: HealthDeps) {}

  /** The effective interval for a pair: the minimum over the project's configurations naming the adapter. */
  async intervalFor(workspaceId: string, projectId: string, registryEntryId: string): Promise<number> {
    const configs = await this.deps.store.listConfigurations(workspaceId, projectId);
    const naming = configs.filter((c) => c.adapters.some((a) => a.registryEntryId === registryEntryId));
    return naming.length === 0 ? DEFAULT_INTERVAL_SECONDS : Math.min(...naming.map((c) => c.healthIntervalSeconds));
  }

  async derive(workspaceId: string, projectId: string, registryEntryId: string, intervalSeconds?: number): Promise<DerivedHealth & { narrowing?: string | null }> {
    const latest = await this.deps.store.latestCheck(workspaceId, projectId, registryEntryId);
    const interval = intervalSeconds ?? (await this.intervalFor(workspaceId, projectId, registryEntryId));
    const derived = deriveHealth(latest === null ? null : { state: latest.state, ...(latest.reason ? { reason: latest.reason } : {}), checkedAt: latest.checkedAt }, this.deps.clock(), interval);
    return { ...derived, narrowing: latest?.narrowing ?? null };
  }

  /** `FR-HUB-047` — a request outcome is also an observation. */
  async observeOutcome(workspaceId: string, projectId: string, entry: RegistryEntryRecord, adapterVersion: string, result: AdapterResult): Promise<void> {
    if (result.ok) return;
    if (result.errorCategory === 'credential-rejected') {
      await this.deps.store.appendCheck({ workspaceId, projectId, registryEntryId: entry.id, state: 'unhealthy', reason: 'credential-rejected', detail: sanitiseText(result.message), adapterVersion, source: 'request', checkedAt: this.deps.clock(), durationMs: 0 });
    } else if (result.errorCategory === 'provider-throttled') {
      await this.deps.store.appendCheck({ workspaceId, projectId, registryEntryId: entry.id, state: 'degraded', reason: 'provider-throttled', detail: sanitiseText(result.message), retryAfterSeconds: result.retryAfterSeconds ?? null, adapterVersion, source: 'request', checkedAt: this.deps.clock(), durationMs: 0 });
    }
  }

  /** Probe one pair now. Used when a credential is set (`SC-HUB-008`) and by the scheduler. */
  async probe(workspaceId: string, projectId: string, entry: RegistryEntryRecord): Promise<{ observation: HealthObservation; durationMs: number; adapterVersion: string }> {
    const adapter = this.deps.catalog.adapter(entry.key);
    if (adapter === null) return { observation: { state: 'unhealthy', reason: 'provider-unreachable', detail: 'adapter not present in this build' }, durationMs: 0, adapterVersion: 'not-in-build' };
    const configs = await this.deps.store.listConfigurations(workspaceId, projectId);
    const config: ConfigurationRecord | null = configs.find((c) => c.adapters.some((a) => a.registryEntryId === entry.id)) ?? null;
    const capabilities = new Set(configs.filter((c) => c.adapters.some((a) => a.registryEntryId === entry.id)).map((c) => c.capability));
    const granted = adapter.descriptor.implements.filter((i) => capabilities.size === 0 || capabilities.has(i.capability)).flatMap((i) => Object.values(adapter.descriptor.scopeMapping).flat());
    const scope: ScopeGrant = { requested: { access: 'read', resources: [] }, granted: [...new Set(granted)], narrowing: 'exact' };
    const started = Date.now();
    const observation = await this.deps.vault.withCredential({ workspaceId, projectId, registryEntryId: entry.id }, async (credential) => {
      if (credential === null && adapter.descriptor.credentialRequired) return { state: 'unhealthy', reason: 'credential-missing' } as HealthObservation;
      const timed = adapterContext({ workspaceId, projectId, binding: bindingFor(config, entry.id), credential, scope, timeoutMs: TIMEOUTS_MS.health });
      try {
        return await withTimeout(timed.context.signal, adapter.checkHealth(timed.context).catch((): HealthObservation => ({ state: 'unhealthy', reason: 'provider-error' })), (): HealthObservation => ({ state: 'unhealthy', reason: 'timed-out' }));
      } finally {
        timed.done();
      }
    });
    return { observation, durationMs: Date.now() - started, adapterVersion: adapter.descriptor.version };
  }

  async checkNow(workspaceId: string, projectId: string, entry: RegistryEntryRecord): Promise<HealthCheckRecord> {
    const { observation, durationMs, adapterVersion } = await this.probe(workspaceId, projectId, entry);
    return this.deps.store.appendCheck({
      workspaceId,
      projectId,
      registryEntryId: entry.id,
      state: observation.state,
      reason: observation.state === 'healthy' ? null : (observation.reason ?? 'provider-error'),
      detail: observation.detail === undefined ? null : sanitiseText(observation.detail),
      retryAfterSeconds: observation.retryAfterSeconds ?? null,
      adapterVersion,
      narrowing: observation.narrowing ?? null,
      source: 'credential-set',
      checkedAt: this.deps.clock(),
      durationMs,
    });
  }

  /** The job handler the ticker drives. */
  async runDueHealthChecks(): Promise<DueRunReport> {
    const now = this.deps.clock();
    const configs = await this.deps.store.listActiveConfigurations(1000);
    const pairs = new Map<string, { workspaceId: string; projectId: string; entryId: string; interval: number }>();
    for (const c of configs) {
      for (const a of c.adapters) {
        const key = `${c.projectId}|${a.registryEntryId}`;
        const prior = pairs.get(key);
        pairs.set(key, { workspaceId: c.workspaceId, projectId: c.projectId, entryId: a.registryEntryId, interval: Math.min(prior?.interval ?? Number.POSITIVE_INFINITY, c.healthIntervalSeconds) });
      }
    }
    const due: { workspaceId: string; projectId: string; entry: RegistryEntryRecord; interval: number }[] = [];
    for (const p of pairs.values()) {
      if (due.length >= MAX_CHECKS_PER_TICK) break;
      const entry = await this.deps.store.findEntry(p.workspaceId, p.entryId);
      if (entry === null || entry.status !== 'active' || entry.direction !== 'outbound') continue;
      const latest = await this.deps.store.latestCheck(p.workspaceId, p.projectId, p.entryId);
      if (latest !== null && now.getTime() - latest.checkedAt.getTime() < p.interval * 1000) continue;
      due.push({ ...p, entry });
    }
    let recorded = 0;
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < due.length) {
        const pair = due[next++]!;
        const { observation, durationMs, adapterVersion } = await this.probe(pair.workspaceId, pair.projectId, pair.entry);
        const checkedAt = this.deps.clock();
        const wrote = await this.deps.store.recordScheduledCheck({
          workspaceId: pair.workspaceId,
          projectId: pair.projectId,
          registryEntryId: pair.entry.id,
          state: observation.state,
          reason: observation.state === 'healthy' ? null : (observation.reason ?? 'provider-error'),
          detail: observation.detail === undefined ? null : sanitiseText(observation.detail),
          retryAfterSeconds: observation.retryAfterSeconds ?? null,
          adapterVersion,
          narrowing: observation.narrowing ?? null,
          checkedAt,
          durationMs,
          intervalBucket: Math.floor(checkedAt.getTime() / 1000 / pair.interval),
        });
        if (wrote) recorded += 1;
      }
    };
    await Promise.all(Array.from({ length: Math.min(CHECK_CONCURRENCY, due.length) }, worker));
    return { considered: pairs.size, checked: due.length, recorded };
  }
}
