/**
 * `T2144`, `T2180` (EPIC-039, `FR-HUB-030`–`FR-HUB-039`, `R-039-7`) — the
 * Capability Resolver.
 *
 * Assembles every candidate's facts — catalog, registry, configuration,
 * credential presence, derived health, `PMI_ENVIRONMENT`, and the policy
 * decision read for the configuration — hands them to the pure
 * `evaluateCandidates`, applies the scope rule, and **records the decision
 * before any provider is called**. A refusal is final at once.
 *
 * It names no provider and imports no adapter: candidates are whatever the
 * workspace lists and the catalog contains (`FR-HUB-061`).
 */
import {
  CAPABILITY_SCOPES,
  contractFor,
  evaluateCandidates,
  isCapabilityName,
  type CandidateFacts,
  type CapabilityAdapter,
  type CapabilityContractDocument,
  type CapabilityName,
  type EligibilityOutcome,
  type PolicyStatus,
  type ScopeGrant,
} from '@pmi/capability-contract';
import type { AdapterCatalog } from '../catalog.service.js';
import type { HealthService } from '../health/health.service.js';
import type { CapabilityPolicySeam, Clock, PolicyStatusView } from '../integrations.tokens.js';
import type { ConfigurationRecord, IntegrationsStore, RegistryEntryRecord, ResolutionInput, ResolutionRecord } from '../integrations.store.js';
import { candidateViews, refusalMessage, storedReasons, type RefusalView } from './explanation.js';
import { grantScope } from './scope.js';

export interface ResolveRequest {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly capability: string;
  readonly major: number;
  readonly caller: string;
  readonly actorPrincipalId: string;
  readonly executionId: string | null;
}

export interface ResolvedBinding {
  readonly adapter: CapabilityAdapter;
  readonly entry: RegistryEntryRecord;
  readonly configuration: ConfigurationRecord;
  readonly contract: CapabilityContractDocument;
  readonly scope: ScopeGrant;
}

export interface ResolutionOutcome {
  readonly record: ResolutionRecord;
  readonly resolved?: ResolvedBinding;
  readonly refusal?: RefusalView;
}

export interface ResolverDeps {
  readonly store: IntegrationsStore;
  readonly catalog: AdapterCatalog;
  readonly health: HealthService;
  readonly policy: CapabilityPolicySeam;
  readonly clock: Clock;
  readonly environment: string;
  /**
   * `T2623` (`FR-HUB-031`) — a credential is *present* only when the vault can
   * open it: a row sealed under a key that has left the keyring is missing.
   */
  readonly vault?: { canOpen(scope: { workspaceId: string; projectId: string; registryEntryId: string }): Promise<boolean> };
}

export class ResolverService {
  constructor(private readonly deps: ResolverDeps) {}

  /** Record a refusal decided before candidates are evaluated (unknown capability, a pinned provider…). */
  async refuse(req: ResolveRequest, code: string, message: string, extra: Record<string, unknown> = {}): Promise<ResolutionOutcome> {
    const record = await this.deps.store.appendResolution(this.base(req, { outcome: 'refused', refusalCode: code, reasons: { rule: code, message, candidates: [], ...extra } }));
    return { record, refusal: { code, message, candidates: [] } };
  }

  async resolve(req: ResolveRequest): Promise<ResolutionOutcome> {
    if (!isCapabilityName(req.capability)) {
      return this.refuse(req, 'unknown-capability', `${req.capability} is not a capability in the vocabulary (FR-HUB-003).`);
    }
    const capability: CapabilityName = req.capability;
    // `T2622` — the package ships the documents; the store says which are
    // approved. A major retired in the store is not resolved (data-model §1).
    const packaged = contractFor(capability, req.major);
    const approved = (await this.deps.store.listContracts()).some((c) => c.name === capability && c.major === req.major && c.status === 'approved');
    const contract = packaged !== null && approved ? packaged : null;
    const configuration = await this.deps.store.getConfiguration(req.workspaceId, req.projectId, capability);
    const entries = (await this.deps.store.listEntries(req.workspaceId)).filter(
      (e) => this.deps.catalog.descriptor(e.key)?.implements.some((i) => i.capability === capability) === true || (configuration?.adapters.some((a) => a.registryEntryId === e.id) ?? false),
    );

    const policyCache = new Map<string, PolicyStatusView>();
    const policyFor = async (): Promise<{ status: PolicyStatus; explanation?: unknown; reason?: string }> => {
      if (configuration === null || configuration.decisionId === null) return { status: 'pending', reason: 'no policy decision has been requested for this configuration' };
      const key = configuration.decisionId;
      if (!policyCache.has(key)) policyCache.set(key, await this.deps.policy.port().statusOf(req.workspaceId, key)); // throws 503 while unbound
      const view = policyCache.get(key)!;
      return { status: view.status, ...(view.explanation !== undefined ? { explanation: view.explanation } : {}) };
    };

    const facts: CandidateFacts[] = [];
    for (const entry of entries) {
      const descriptor = this.deps.catalog.descriptor(entry.key);
      const preference = configuration?.adapters.find((a) => a.registryEntryId === entry.id)?.preference ?? null;
      const configured = preference !== null;
      const stored = descriptor?.credentialRequired ? await this.deps.store.credentialStatus(req.workspaceId, req.projectId, entry.id) : null;
      const credentialStatus = stored !== null && this.deps.vault !== undefined && !(await this.deps.vault.canOpen({ workspaceId: req.workspaceId, projectId: req.projectId, registryEntryId: entry.id })) ? null : stored;
      const health = configured ? await this.deps.health.derive(req.workspaceId, req.projectId, entry.id) : { state: 'unknown' as const, reason: 'not configured — not checked' };
      facts.push({
        entryKey: entry.key,
        registryEntryId: entry.id,
        direction: entry.direction,
        inBuild: descriptor !== null,
        active: entry.status === 'active',
        majors: descriptor?.implements.find((i) => i.capability === capability)?.majors ?? [],
        configured,
        preference,
        credential: descriptor === null || !descriptor.credentialRequired ? 'not-required' : credentialStatus !== null ? 'present' : 'missing',
        health: { state: health.state, ...(health.reason ? { reason: health.reason } : {}) },
        permitDegraded: configuration?.permitDegraded ?? false,
        environmentPermitted: configuration?.permittedEnvironments.includes(this.deps.environment) ?? true,
        policy: configured && entry.direction === 'outbound' ? await policyFor() : { status: 'pending', reason: 'not configured — no decision requested' },
      });
    }

    const outcome: EligibilityOutcome = contract === null && facts.length > 0
      ? { outcome: 'refused', code: 'no-compatible-adapter', candidates: evaluateCandidates({ capability, major: req.major }, facts).candidates, excluded: [] }
      : evaluateCandidates({ capability, major: req.major }, facts);

    if (outcome.outcome === 'refused') {
      const message = contract === null ? `No approved ${capability} contract exists at major ${req.major} (FR-HUB-033).` : refusalMessage(outcome, capability, req.major);
      const record = await this.deps.store.appendResolution(this.base(req, { outcome: 'refused', refusalCode: outcome.code, reasons: storedReasons(outcome, { message }) }));
      return { record, refusal: { code: outcome.code, message, candidates: candidateViews(outcome.candidates) } };
    }

    const entry = entries.find((e) => e.key === outcome.chosen)!;
    const adapter = this.deps.catalog.adapter(entry.key)!;
    const credential = await this.deps.store.credentialStatus(req.workspaceId, req.projectId, entry.id);
    const health = await this.deps.health.derive(req.workspaceId, req.projectId, entry.id);
    const scope = grantScope(contract!, adapter.descriptor, credential?.kind ?? null, (health.narrowing as ScopeGrant['narrowing'] | null) ?? null, configuration!.onNotNarrowable);
    if (!scope.proceed) {
      const message = `${capability} would resolve to ${entry.key}, but ${scope.reason}.`;
      const record = await this.deps.store.appendResolution(this.base(req, { outcome: 'refused', refusalCode: 'scope-not-narrowable', scopeGranted: scope.grant as unknown as Record<string, unknown>, reasons: storedReasons(outcome, { message, wouldHaveChosen: entry.key }) }));
      return { record, refusal: { code: 'scope-not-narrowable', message, candidates: candidateViews(outcome.candidates) } };
    }
    const record = await this.deps.store.appendResolution(
      this.base(req, {
        outcome: 'resolved',
        contractVersion: `${contract!.major}.${contract!.minor}`,
        registryEntryId: entry.id,
        adapterKey: entry.key,
        adapterVersion: adapter.descriptor.version,
        provider: adapter.descriptor.provider,
        scopeGranted: { ...scope.grant, ...(scope.reason ? { note: scope.reason } : {}) } as unknown as Record<string, unknown>,
        reasons: storedReasons(outcome),
      }),
    );
    return { record, resolved: { adapter, entry, configuration: configuration!, contract: contract!, scope: scope.grant } };
  }

  private base(req: ResolveRequest, over: Partial<ResolutionInput> & Pick<ResolutionInput, 'outcome' | 'reasons'>): ResolutionInput {
    return {
      workspaceId: req.workspaceId,
      scope: isCapabilityName(req.capability) ? CAPABILITY_SCOPES[req.capability] : 'project',
      projectId: req.projectId,
      caller: req.caller,
      actorPrincipalId: req.actorPrincipalId,
      executionId: req.executionId,
      capability: req.capability,
      requestedMajor: Number.isInteger(req.major) ? req.major : 0,
      contractVersion: null,
      refusalCode: null,
      registryEntryId: null,
      adapterKey: null,
      adapterVersion: null,
      provider: null,
      modelIdentity: null,
      scopeGranted: null,
      decidedAt: this.deps.clock(),
      ...over,
    };
  }
}
