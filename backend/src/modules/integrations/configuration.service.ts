/**
 * `T2142` (EPIC-039, `FR-HUB-031`, `FR-HUB-032`, `FR-HUB-062`, `R-039-7`) — a
 * project configures which adapters serve a capability.
 *
 * - **Preference is not ambiguity**: several adapters must carry distinct
 *   preferences, so the API cannot create an ambiguous configuration; the
 *   resolver keeps the refusal for rows a migration might leave behind.
 * - **Policy is decided here, read at resolution**: every change requests one
 *   `CapabilityPolicy` decision for the new `configVersion` and stores its id.
 *   While the seam is unbound the change is refused `503` and nothing is stored.
 * - **Bindings are non-secret**: each adapter's binding is validated against its
 *   declared schema, and secret-looking material is refused (`FR-HUB-045`).
 * - **Every change is an audited `update`** with before and after — switching a
 *   provider is a recorded configuration change and touches no business rule
 *   (`FR-HUB-062`).
 *
 * Bindings are held **per adapter** (`providerBinding[registryEntryId]`), since
 * two adapters of one capability need different bindings (a fixture script, a
 * GitHub repository) — a refinement of data-model §3's single object.
 */
import { CAPABILITY_SCOPES, contractFor, findSecret, isCapabilityName, isPlatformEnvironment, validate } from '@pmi/capability-contract';
import { GovernanceSeamUnboundError, ValidationFailedError } from '../../core/errors.js';
import type { AdapterCatalog } from './catalog.service.js';
import type { AuditPort, CapabilityPolicySeam, Clock } from './integrations.tokens.js';
import type { ConfigurationRecord, IntegrationsStore } from './integrations.store.js';
import { defaultOnNotNarrowable } from './resolver/scope.js';

export interface OwnerGatePort {
  requireOwner(ctx: { workspaceId: string; userId: string }, projectId: string, operation: string): Promise<void>;
}

export interface ConfigurationDeps {
  readonly store: IntegrationsStore;
  readonly catalog: AdapterCatalog;
  readonly policy: CapabilityPolicySeam;
  readonly audit: AuditPort;
  readonly ownerGate: OwnerGatePort;
  readonly clock: Clock;
}

export type PolicyStatusRead = 'permitted' | 'pending' | 'not-permitted' | 'policy-seam-unbound' | 'no-decision';

export interface ConfigurationView {
  readonly capability: string;
  readonly adapters: { registryEntryId: string; key: string | null; preference: number }[];
  readonly permitDegraded: boolean;
  readonly permittedEnvironments: readonly string[];
  readonly onNotNarrowable: string;
  readonly healthIntervalSeconds: number;
  readonly configVersion: number;
  readonly decisionId: string | null;
  readonly policyStatus: PolicyStatusRead;
  readonly policyExplanation?: unknown;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface PutResult {
  readonly configVersion: number;
  readonly decisionId: string;
  readonly policyStatus: PolicyStatusRead;
}

function bad(message: string, fields: { field: string; reason: string }[]): ValidationFailedError {
  return new ValidationFailedError(message, { fields });
}

export class ConfigurationService {
  constructor(private readonly deps: ConfigurationDeps) {}

  private async policyStatus(workspaceId: string, decisionId: string | null): Promise<{ status: PolicyStatusRead; explanation?: unknown }> {
    if (decisionId === null) return { status: 'no-decision' };
    try {
      const v = await this.deps.policy.port().statusOf(workspaceId, decisionId);
      return { status: v.status, ...(v.explanation !== undefined ? { explanation: v.explanation } : {}) };
    } catch (err) {
      if (err instanceof GovernanceSeamUnboundError) return { status: 'policy-seam-unbound' };
      throw err;
    }
  }

  private async view(workspaceId: string, c: ConfigurationRecord): Promise<ConfigurationView> {
    const keys = await Promise.all(c.adapters.map(async (a) => (await this.deps.store.findEntry(workspaceId, a.registryEntryId))?.key ?? null));
    const policy = await this.policyStatus(workspaceId, c.decisionId);
    return {
      capability: c.capability,
      adapters: c.adapters.map((a, i) => ({ registryEntryId: a.registryEntryId, key: keys[i] ?? null, preference: a.preference })),
      permitDegraded: c.permitDegraded,
      permittedEnvironments: c.permittedEnvironments,
      onNotNarrowable: c.onNotNarrowable,
      healthIntervalSeconds: c.healthIntervalSeconds,
      configVersion: c.configVersion,
      decisionId: c.decisionId,
      policyStatus: policy.status,
      ...(policy.explanation !== undefined ? { policyExplanation: policy.explanation } : {}),
      updatedBy: c.updatedBy,
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  /** Every capability's configuration, policy status derived per read (never cached). */
  async list(workspaceId: string, projectId: string): Promise<ConfigurationView[]> {
    const rows = await this.deps.store.listConfigurations(workspaceId, projectId);
    return Promise.all(rows.sort((a, b) => a.capability.localeCompare(b.capability)).map((c) => this.view(workspaceId, c)));
  }

  async put(ctx: { workspaceId: string; userId: string }, projectId: string, capability: string, body: Record<string, unknown>): Promise<PutResult> {
    await this.deps.ownerGate.requireOwner(ctx, projectId, 'configure an integration');
    if (!isCapabilityName(capability)) throw bad(`${capability} is not a capability in the vocabulary.`, [{ field: 'capability', reason: 'unknown capability' }]);
    if (CAPABILITY_SCOPES[capability] === 'deployment') {
      throw bad(`${capability} is resolved at deployment scope: its binding is deployment configuration recorded at boot, not a project setting (FR-HUB-084).`, [{ field: 'capability', reason: 'deployment scope' }]);
    }
    const contract = contractFor(capability, 1)!;
    const rawAdapters = body['adapters'];
    if (!Array.isArray(rawAdapters)) throw bad('adapters must be a list of { registryEntryId, preference, binding? }.', [{ field: 'adapters', reason: 'required' }]);
    const legacyBinding = body['providerBinding'];

    const adapters: { registryEntryId: string; preference: number }[] = [];
    const bindings: Record<string, Record<string, unknown>> = {};
    const summaries: { registryEntryId: string; key: string; preference: number }[] = [];
    for (const [i, raw] of rawAdapters.entries()) {
      const a = (raw ?? {}) as Record<string, unknown>;
      const id = a['registryEntryId'];
      const preference = rawAdapters.length === 1 && a['preference'] === undefined ? 1 : a['preference'];
      if (typeof id !== 'string') throw bad('every adapter needs a registryEntryId.', [{ field: `adapters.${i}.registryEntryId`, reason: 'required' }]);
      if (!Number.isInteger(preference) || (preference as number) < 1) throw bad('every adapter needs a preference ≥ 1 (1 = most preferred).', [{ field: `adapters.${i}.preference`, reason: 'integer ≥ 1' }]);
      const entry = await this.deps.store.findEntry(ctx.workspaceId, id);
      if (entry === null) throw bad(`registry entry ${id} is not listed in this workspace.`, [{ field: `adapters.${i}.registryEntryId`, reason: 'not listed' }]);
      if (entry.direction === 'inbound') throw bad(`${entry.key} is an inbound connector; connectors are never resolution candidates (FR-HUB-022).`, [{ field: `adapters.${i}.registryEntryId`, reason: 'inbound' }]);
      if (entry.status === 'retired') throw bad(`${entry.key} is retired and cannot be configured (FR-HUB-028).`, [{ field: `adapters.${i}.registryEntryId`, reason: 'retired' }]);
      const descriptor = this.deps.catalog.descriptor(entry.key);
      if (descriptor === null) throw bad(`${entry.key} is not present in this build.`, [{ field: `adapters.${i}.registryEntryId`, reason: 'not in build' }]);
      if (!descriptor.implements.some((x) => x.capability === capability)) throw bad(`${entry.key} does not implement ${capability}.`, [{ field: `adapters.${i}.registryEntryId`, reason: 'does not implement the capability' }]);
      const binding = (a['binding'] ?? (rawAdapters.length === 1 ? legacyBinding : undefined) ?? {}) as Record<string, unknown>;
      const secret = findSecret(binding);
      if (secret !== null) throw bad(`The binding for ${entry.key} holds secret-looking material at ${secret}; a binding is non-secret configuration — credentials go through the credentials route (FR-HUB-045).`, [{ field: `adapters.${i}.binding.${secret}`, reason: 'secret-looking material' }]);
      const v = validate(descriptor.bindingSchema, binding);
      if (!v.ok) throw bad(`The binding for ${entry.key} does not fit its schema: ${v.errors.map((e) => `${e.path} ${e.message}`).join('; ')}.`, v.errors.map((e) => ({ field: `adapters.${i}.binding.${e.path}`, reason: e.message })));
      adapters.push({ registryEntryId: id, preference: preference as number });
      bindings[id] = binding;
      summaries.push({ registryEntryId: id, key: entry.key, preference: preference as number });
    }
    if (new Set(adapters.map((a) => a.preference)).size !== adapters.length) {
      throw bad('Several adapters need distinct preferences — otherwise the project has expressed no order and every request would be ambiguous (FR-HUB-032).', [{ field: 'adapters', reason: 'distinct preferences required' }]);
    }
    if (new Set(adapters.map((a) => a.registryEntryId)).size !== adapters.length) throw bad('An adapter is listed twice.', [{ field: 'adapters', reason: 'duplicate' }]);

    const environments = body['permittedEnvironments'] ?? ['local', 'dev', 'stage', 'prod'];
    if (!Array.isArray(environments) || environments.some((e) => !isPlatformEnvironment(e))) {
      throw bad(`permittedEnvironments must be drawn from local, dev, stage, prod (got ${JSON.stringify(environments)}).`, [{ field: 'permittedEnvironments', reason: 'local | dev | stage | prod' }]);
    }
    const interval = body['healthIntervalSeconds'] ?? 300;
    if (!Number.isInteger(interval) || (interval as number) < 60 || (interval as number) > 3600) throw bad('healthIntervalSeconds must be an integer between 60 and 3600.', [{ field: 'healthIntervalSeconds', reason: '60–3600' }]);
    const onNotNarrowable = body['onNotNarrowable'] ?? defaultOnNotNarrowable(contract);
    if (onNotNarrowable !== 'refuse' && onNotNarrowable !== 'proceed-and-record') throw bad('onNotNarrowable must be refuse or proceed-and-record.', [{ field: 'onNotNarrowable', reason: 'refuse | proceed-and-record' }]);
    const permitDegraded = body['permitDegraded'] ?? false;
    if (typeof permitDegraded !== 'boolean') throw bad('permitDegraded must be a boolean.', [{ field: 'permitDegraded', reason: 'boolean' }]);

    const before = await this.deps.store.getConfiguration(ctx.workspaceId, projectId, capability);
    const nextVersion = (before?.configVersion ?? 0) + 1;
    // Decided BEFORE anything is stored: an unbound seam refuses the change (503).
    const { decisionId } = await this.deps.policy.port().requestDecision({ workspaceId: ctx.workspaceId, projectId, actorId: ctx.userId, capability, configurationId: before?.id ?? `${projectId}:${capability}`, configVersion: nextVersion });
    const saved = await this.deps.store.putConfiguration({
      workspaceId: ctx.workspaceId,
      projectId,
      capability,
      adapters,
      permitDegraded,
      permittedEnvironments: environments as string[],
      onNotNarrowable,
      healthIntervalSeconds: interval as number,
      providerBinding: bindings,
      decisionId,
      updatedBy: ctx.userId,
    });
    const beforeSummary = before === null ? null : { configVersion: before.configVersion, adapters: await Promise.all(before.adapters.map(async (a) => ({ registryEntryId: a.registryEntryId, key: (await this.deps.store.findEntry(ctx.workspaceId, a.registryEntryId))?.key ?? null, preference: a.preference }))), permitDegraded: before.permitDegraded, permittedEnvironments: before.permittedEnvironments, onNotNarrowable: before.onNotNarrowable, healthIntervalSeconds: before.healthIntervalSeconds, bindings: before.providerBinding };
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: 'update',
      targetType: 'capability-configuration',
      targetId: saved.id,
      outcome: 'success',
      detail: {
        projectId,
        capability,
        before: beforeSummary,
        after: { configVersion: saved.configVersion, adapters: summaries, permitDegraded, permittedEnvironments: environments, onNotNarrowable, healthIntervalSeconds: interval, bindings, decisionId },
      },
    });
    const policy = await this.policyStatus(ctx.workspaceId, decisionId);
    return { configVersion: saved.configVersion, decisionId, policyStatus: policy.status };
  }
}
