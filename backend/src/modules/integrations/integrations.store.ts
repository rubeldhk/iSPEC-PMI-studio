/**
 * `T2128` (EPIC-039) — the Integration Hub's persistence port, and the in-memory
 * binding unit tests use.
 *
 * Three guarantees are in the shape (`integrations-store.spec.ts`):
 *
 * - every read takes a workspace and refuses an empty one (`FR-HUB-005`);
 * - resolutions, invocations and health checks have **append** methods and no
 *   update or delete (data-model §5, §6, §6a) — the database refuses the same by
 *   trigger;
 * - the credential **view** has no `ciphertext`. Ciphertext crosses only
 *   `CredentialVaultPort`, which `credential.vault.ts` alone receives
 *   (`R-039-10`; `integrations-credentials-boundary.spec.ts`).
 */
import { randomUUID } from 'node:crypto';
import { MissingWorkspaceScopeError } from '../../core/workspace-scope.js';

export type Direction = 'outbound' | 'inbound';
export type EntryStatus = 'active' | 'retired';

export interface RegistryEntryRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly key: string;
  readonly direction: Direction;
  readonly status: EntryStatus;
  readonly listedOrder: number;
  readonly registeredBy: string;
  readonly registeredAt: Date;
  readonly retiredBy: string | null;
  readonly retiredAt: Date | null;
}

export interface AdapterPreference {
  readonly registryEntryId: string;
  readonly preference: number;
}

export interface ConfigurationRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly capability: string;
  readonly adapters: readonly AdapterPreference[];
  readonly permitDegraded: boolean;
  readonly permittedEnvironments: readonly string[];
  readonly onNotNarrowable: 'refuse' | 'proceed-and-record';
  readonly healthIntervalSeconds: number;
  readonly providerBinding: Readonly<Record<string, unknown>>;
  readonly configVersion: number;
  readonly decisionId: string | null;
  readonly updatedBy: string;
  readonly updatedAt: Date;
}

export type ConfigurationInput = Omit<ConfigurationRecord, 'id' | 'configVersion' | 'updatedAt'>;

/** What every service may know about a credential. No value; no ciphertext. */
export interface CredentialStatusRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly registryEntryId: string;
  readonly kind: string;
  readonly setBy: string;
  readonly setAt: Date;
}

/** The encrypted row — crosses only `CredentialVaultPort`. */
export interface CredentialCipherRow extends Omit<CredentialStatusRecord, 'id'> {
  readonly ciphertext: Buffer;
  readonly iv: Buffer;
  readonly authTag: Buffer;
  readonly keyId: string;
}

export interface CredentialVaultPort {
  putCredentialRow(row: CredentialCipherRow): Promise<CredentialStatusRecord>;
  readCredentialRow(workspaceId: string, projectId: string, registryEntryId: string): Promise<(CredentialCipherRow & { id: string }) | null>;
  deleteCredentialRow(workspaceId: string, projectId: string, registryEntryId: string): Promise<boolean>;
}

export type WrittenHealth = 'healthy' | 'degraded' | 'unhealthy';
export type HealthSource = 'scheduled' | 'request' | 'credential-set';

export interface HealthCheckRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly registryEntryId: string;
  readonly state: WrittenHealth;
  readonly reason: string | null;
  readonly detail: string | null;
  readonly retryAfterSeconds: number | null;
  readonly adapterVersion: string;
  readonly narrowing: 'exact' | 'narrowed-at-issue' | 'not-narrowable' | null;
  readonly source: HealthSource;
  readonly intervalBucket: number | null;
  readonly checkedAt: Date;
  readonly durationMs: number;
}

export interface HealthCheckInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly registryEntryId: string;
  readonly state: WrittenHealth;
  readonly reason?: string | null;
  readonly detail?: string | null;
  readonly retryAfterSeconds?: number | null;
  readonly adapterVersion: string;
  readonly narrowing?: HealthCheckRecord['narrowing'];
  readonly source: Exclude<HealthSource, 'scheduled'>;
  readonly checkedAt: Date;
  readonly durationMs: number;
}

export type ScheduledCheckInput = Omit<HealthCheckInput, 'source'> & { readonly intervalBucket: number };

export interface ResolutionRecord {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly scope: 'project' | 'deployment';
  readonly projectId: string | null;
  readonly caller: string;
  readonly actorPrincipalId: string;
  readonly executionId: string | null;
  readonly capability: string;
  readonly requestedMajor: number;
  readonly contractVersion: string | null;
  readonly outcome: 'resolved' | 'refused';
  readonly refusalCode: string | null;
  readonly registryEntryId: string | null;
  readonly adapterKey: string | null;
  readonly adapterVersion: string | null;
  readonly provider: string | null;
  readonly modelIdentity: Readonly<Record<string, unknown>> | null;
  readonly scopeGranted: Readonly<Record<string, unknown>> | null;
  readonly reasons: Readonly<Record<string, unknown>>;
  readonly decidedAt: Date;
}

export type ResolutionInput = Omit<ResolutionRecord, 'id'> & { readonly id?: string };

export interface InvocationRecord {
  readonly resolutionId: string;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
  readonly outcome: 'succeeded' | 'failed' | 'adapter-fault';
  readonly errorCategory: string | null;
  readonly providerRequestId: string | null;
  readonly retryAfterSeconds: number | null;
  readonly durationMs: number;
  readonly endedAt: Date;
}

export type IntakeState = 'pending' | 'contributed' | 'not-contributed' | 'gave-up' | 'refused';

export interface IntakeRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly workRef: Readonly<Record<string, unknown>>;
  readonly contractItemId: string;
  readonly capability: 'ReadTestResults' | 'ReadBuildStatus';
  readonly revision: string | null;
  readonly attestedArtifact: Readonly<Record<string, unknown>> | null;
  readonly state: IntakeState;
  readonly reason: string | null;
  readonly resolutionIds: readonly string[];
  readonly attestationId: string | null;
  readonly attempts: number;
  readonly nextAttemptAt: Date | null;
  readonly giveUpAt: Date;
  readonly requestedBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type IntakeInput = Omit<IntakeRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type IntakeChange = Partial<Pick<IntakeRecord, 'state' | 'reason' | 'resolutionIds' | 'attestationId' | 'attempts' | 'nextAttemptAt'>>;

export interface NotificationDeliveryRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly cause: Readonly<Record<string, unknown>>;
  readonly recipients: readonly string[];
  readonly resolutionId: string | null;
  readonly outcome: 'delivered' | 'failed' | 'refused';
  readonly providerMessageId: string | null;
  readonly failureReason: string | null;
  readonly createdAt: Date;
}

export interface DeploymentObservationRecord {
  readonly id: string;
  readonly capability: string;
  readonly adapterKey: string | null;
  readonly providerBinding: Readonly<Record<string, unknown>>;
  readonly observedModel: { readonly model: string; readonly version: string; readonly dimension: number } | null;
  readonly modelId: string | null;
  readonly previousModelId: string | null;
  readonly reindexRequired: boolean;
  readonly health: WrittenHealth;
  readonly reason: string | null;
  readonly observedBy: string;
  readonly observedAt: Date;
}

export interface ContractVersionRecord {
  readonly id: string;
  readonly name: string;
  readonly scope: 'project' | 'deployment';
  readonly major: number;
  readonly minor: number;
  readonly status: 'draft' | 'approved' | 'retired';
  readonly document: Readonly<Record<string, unknown>>;
  readonly changesState: boolean;
}

export interface ResolutionFilter {
  readonly projectId?: string;
  readonly registryEntryId?: string;
  readonly limit?: number;
}

export interface IntegrationsStore {
  // vocabulary
  listContracts(): Promise<ContractVersionRecord[]>;
  // registry
  listEntries(workspaceId: string): Promise<RegistryEntryRecord[]>;
  findEntry(workspaceId: string, id: string): Promise<RegistryEntryRecord | null>;
  findEntryByKey(workspaceId: string, key: string): Promise<RegistryEntryRecord | null>;
  createEntry(input: Omit<RegistryEntryRecord, 'id' | 'status' | 'retiredBy' | 'retiredAt'>): Promise<RegistryEntryRecord>;
  retireEntry(workspaceId: string, id: string, by: string, at: Date): Promise<RegistryEntryRecord>;
  // configuration
  getConfiguration(workspaceId: string, projectId: string, capability: string): Promise<ConfigurationRecord | null>;
  listConfigurations(workspaceId: string, projectId: string): Promise<ConfigurationRecord[]>;
  /** Every configuration naming at least one adapter — the health scheduler's due-pair source. */
  listActiveConfigurations(limit: number): Promise<ConfigurationRecord[]>;
  putConfiguration(input: ConfigurationInput): Promise<ConfigurationRecord>;
  // credentials — status only
  credentialStatus(workspaceId: string, projectId: string, registryEntryId: string): Promise<CredentialStatusRecord | null>;
  listCredentialStatus(workspaceId: string, projectId: string): Promise<CredentialStatusRecord[]>;
  // health — append only
  latestCheck(workspaceId: string, projectId: string, registryEntryId: string): Promise<HealthCheckRecord | null>;
  listChecks(workspaceId: string, registryEntryId: string, filter: { projectId?: string; limit: number }): Promise<HealthCheckRecord[]>;
  appendCheck(input: HealthCheckInput): Promise<HealthCheckRecord>;
  /** Analysis U2: insert-after with ON CONFLICT DO NOTHING; true when THIS row was recorded. */
  recordScheduledCheck(input: ScheduledCheckInput): Promise<boolean>;
  // decisions — append only
  appendResolution(input: ResolutionInput): Promise<ResolutionRecord>;
  appendInvocation(input: InvocationRecord): Promise<InvocationRecord>;
  listResolutions(workspaceId: string, filter: ResolutionFilter): Promise<ResolutionRecord[]>;
  findResolution(workspaceId: string | null, id: string): Promise<ResolutionRecord | null>;
  findInvocation(resolutionId: string): Promise<InvocationRecord | null>;
  /** Deployment-scope resolutions (no workspace) of one capability, newest first. */
  listDeploymentResolutions(capability: string, limit: number): Promise<ResolutionRecord[]>;
  // evidence intake
  createIntake(input: IntakeInput): Promise<IntakeRecord>;
  updateIntake(workspaceId: string, id: string, change: IntakeChange): Promise<IntakeRecord>;
  findIntake(workspaceId: string, id: string): Promise<IntakeRecord | null>;
  listDueIntakes(now: Date, limit: number): Promise<IntakeRecord[]>;
  // notifications — append only
  appendDelivery(input: Omit<NotificationDeliveryRecord, 'id' | 'createdAt'> & { readonly id?: string }): Promise<NotificationDeliveryRecord>;
  listDeliveries(workspaceId: string, projectId: string): Promise<NotificationDeliveryRecord[]>;
  // deployment binding record (I1) — append only, not tenant-scoped
  latestObservation(capability: string): Promise<DeploymentObservationRecord | null>;
  listObservations(capability: string, limit: number): Promise<DeploymentObservationRecord[]>;
  appendObservation(input: Omit<DeploymentObservationRecord, 'id'>): Promise<DeploymentObservationRecord>;
  /** The ciphertext port. Handed to the vault and nothing else. */
  vaultPort(): CredentialVaultPort;
}

export function requireScope(workspaceId: string): void {
  if (typeof workspaceId !== 'string' || workspaceId.trim() === '') throw new MissingWorkspaceScopeError();
}

const byDesc = <T>(key: (t: T) => Date) => (a: T, b: T): number => key(b).getTime() - key(a).getTime();

export class InMemoryIntegrationsStore implements IntegrationsStore {
  private readonly contracts: ContractVersionRecord[] = [];
  private readonly entries = new Map<string, RegistryEntryRecord>();
  private readonly configurations = new Map<string, ConfigurationRecord>();
  private readonly credentials = new Map<string, CredentialCipherRow & { id: string }>();
  private readonly checks: HealthCheckRecord[] = [];
  private readonly resolutions = new Map<string, ResolutionRecord>();
  private readonly invocations = new Map<string, InvocationRecord>();
  private readonly intakes = new Map<string, IntakeRecord>();
  private readonly deliveries: NotificationDeliveryRecord[] = [];
  private readonly observations: DeploymentObservationRecord[] = [];

  constructor(seedContracts: readonly ContractVersionRecord[] = []) {
    this.contracts.push(...seedContracts);
  }

  async listContracts(): Promise<ContractVersionRecord[]> {
    return [...this.contracts];
  }

  async listEntries(workspaceId: string): Promise<RegistryEntryRecord[]> {
    requireScope(workspaceId);
    return [...this.entries.values()].filter((e) => e.workspaceId === workspaceId).sort((a, b) => a.listedOrder - b.listedOrder);
  }

  async findEntry(workspaceId: string, id: string): Promise<RegistryEntryRecord | null> {
    requireScope(workspaceId);
    const e = this.entries.get(id);
    return e !== undefined && e.workspaceId === workspaceId ? e : null;
  }

  async findEntryByKey(workspaceId: string, key: string): Promise<RegistryEntryRecord | null> {
    requireScope(workspaceId);
    return [...this.entries.values()].find((e) => e.workspaceId === workspaceId && e.key === key) ?? null;
  }

  async createEntry(input: Omit<RegistryEntryRecord, 'id' | 'status' | 'retiredBy' | 'retiredAt'>): Promise<RegistryEntryRecord> {
    requireScope(input.workspaceId);
    if (await this.findEntryByKey(input.workspaceId, input.key)) throw new Error(`registry entry ${input.key} already exists in this workspace`);
    const row: RegistryEntryRecord = { ...input, id: randomUUID(), status: 'active', retiredBy: null, retiredAt: null };
    this.entries.set(row.id, row);
    return row;
  }

  async retireEntry(workspaceId: string, id: string, by: string, at: Date): Promise<RegistryEntryRecord> {
    const e = await this.findEntry(workspaceId, id);
    if (e === null) throw new Error('no such entry');
    if (e.status === 'retired') return e;
    const row: RegistryEntryRecord = { ...e, status: 'retired', retiredBy: by, retiredAt: at };
    this.entries.set(id, row);
    return row;
  }

  private configKey(projectId: string, capability: string): string {
    return `${projectId}|${capability}`;
  }

  async getConfiguration(workspaceId: string, projectId: string, capability: string): Promise<ConfigurationRecord | null> {
    requireScope(workspaceId);
    const c = this.configurations.get(this.configKey(projectId, capability));
    return c !== undefined && c.workspaceId === workspaceId ? c : null;
  }

  async listConfigurations(workspaceId: string, projectId: string): Promise<ConfigurationRecord[]> {
    requireScope(workspaceId);
    return [...this.configurations.values()].filter((c) => c.workspaceId === workspaceId && c.projectId === projectId);
  }

  async listActiveConfigurations(limit: number): Promise<ConfigurationRecord[]> {
    return [...this.configurations.values()].filter((c) => c.adapters.length > 0).slice(0, limit);
  }

  async putConfiguration(input: ConfigurationInput): Promise<ConfigurationRecord> {
    requireScope(input.workspaceId);
    const existing = this.configurations.get(this.configKey(input.projectId, input.capability));
    const row: ConfigurationRecord = { ...input, id: existing?.id ?? randomUUID(), configVersion: (existing?.configVersion ?? 0) + 1, updatedAt: new Date() };
    this.configurations.set(this.configKey(input.projectId, input.capability), row);
    return row;
  }

  private credKey(workspaceId: string, projectId: string, entryId: string): string {
    return `${workspaceId}|${projectId}|${entryId}`;
  }

  private status(row: CredentialCipherRow & { id: string }): CredentialStatusRecord {
    return { id: row.id, workspaceId: row.workspaceId, projectId: row.projectId, registryEntryId: row.registryEntryId, kind: row.kind, setBy: row.setBy, setAt: row.setAt };
  }

  async credentialStatus(workspaceId: string, projectId: string, registryEntryId: string): Promise<CredentialStatusRecord | null> {
    requireScope(workspaceId);
    const row = this.credentials.get(this.credKey(workspaceId, projectId, registryEntryId));
    return row === undefined ? null : this.status(row);
  }

  async listCredentialStatus(workspaceId: string, projectId: string): Promise<CredentialStatusRecord[]> {
    requireScope(workspaceId);
    return [...this.credentials.values()].filter((r) => r.workspaceId === workspaceId && r.projectId === projectId).map((r) => this.status(r));
  }

  async latestCheck(workspaceId: string, projectId: string, registryEntryId: string): Promise<HealthCheckRecord | null> {
    requireScope(workspaceId);
    // Latest wins; at an equal instant the later-recorded row wins (reverse, then a stable sort).
    return [...this.checks].reverse().filter((c) => c.workspaceId === workspaceId && c.projectId === projectId && c.registryEntryId === registryEntryId).sort(byDesc((c) => c.checkedAt))[0] ?? null;
  }

  async listChecks(workspaceId: string, registryEntryId: string, filter: { projectId?: string; limit: number }): Promise<HealthCheckRecord[]> {
    requireScope(workspaceId);
    return [...this.checks]
      .reverse()
      .filter((c) => c.workspaceId === workspaceId && c.registryEntryId === registryEntryId && (filter.projectId === undefined || c.projectId === filter.projectId))
      .sort(byDesc((c) => c.checkedAt))
      .slice(0, filter.limit);
  }

  private toCheck(input: HealthCheckInput | ScheduledCheckInput, source: HealthSource, bucket: number | null): HealthCheckRecord {
    return {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      registryEntryId: input.registryEntryId,
      state: input.state,
      reason: input.reason ?? null,
      detail: input.detail ?? null,
      retryAfterSeconds: input.retryAfterSeconds ?? null,
      adapterVersion: input.adapterVersion,
      narrowing: input.narrowing ?? null,
      source,
      intervalBucket: bucket,
      checkedAt: input.checkedAt,
      durationMs: input.durationMs,
    };
  }

  async appendCheck(input: HealthCheckInput): Promise<HealthCheckRecord> {
    requireScope(input.workspaceId);
    if (input.state !== 'healthy' && !input.reason) throw new Error('a non-healthy check requires a reason');
    const row = this.toCheck(input, input.source, null);
    this.checks.push(row);
    return row;
  }

  async recordScheduledCheck(input: ScheduledCheckInput): Promise<boolean> {
    requireScope(input.workspaceId);
    const taken = this.checks.some((c) => c.source === 'scheduled' && c.projectId === input.projectId && c.registryEntryId === input.registryEntryId && c.intervalBucket === input.intervalBucket);
    if (taken) return false;
    this.checks.push(this.toCheck(input, 'scheduled', input.intervalBucket));
    return true;
  }

  async appendResolution(input: ResolutionInput): Promise<ResolutionRecord> {
    if (input.scope === 'project') requireScope(input.workspaceId ?? '');
    const row: ResolutionRecord = { ...input, id: input.id ?? randomUUID() };
    if (this.resolutions.has(row.id)) throw new Error('resolution already recorded');
    this.resolutions.set(row.id, row);
    return row;
  }

  async appendInvocation(input: InvocationRecord): Promise<InvocationRecord> {
    if (this.invocations.has(input.resolutionId)) throw new Error('an invocation is already recorded for this resolution');
    this.invocations.set(input.resolutionId, input);
    return input;
  }

  async listResolutions(workspaceId: string, filter: ResolutionFilter): Promise<ResolutionRecord[]> {
    requireScope(workspaceId);
    return [...this.resolutions.values()]
      .filter((r) => r.workspaceId === workspaceId && (filter.projectId === undefined || r.projectId === filter.projectId) && (filter.registryEntryId === undefined || r.registryEntryId === filter.registryEntryId || JSON.stringify(r.reasons).includes(`"${filter.registryEntryId}"`)))
      .sort(byDesc((r) => r.decidedAt))
      .slice(0, filter.limit ?? 50);
  }

  async listDeploymentResolutions(capability: string, limit: number): Promise<ResolutionRecord[]> {
    return [...this.resolutions.values()].filter((r) => r.scope === 'deployment' && r.capability === capability).reverse().sort(byDesc((r) => r.decidedAt)).slice(0, limit);
  }

  async findResolution(workspaceId: string | null, id: string): Promise<ResolutionRecord | null> {
    const r = this.resolutions.get(id);
    return r !== undefined && r.workspaceId === workspaceId ? r : null;
  }

  async findInvocation(resolutionId: string): Promise<InvocationRecord | null> {
    return this.invocations.get(resolutionId) ?? null;
  }

  async createIntake(input: IntakeInput): Promise<IntakeRecord> {
    requireScope(input.workspaceId);
    const now = new Date();
    const row: IntakeRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.intakes.set(row.id, row);
    return row;
  }

  async updateIntake(workspaceId: string, id: string, change: IntakeChange): Promise<IntakeRecord> {
    const row = await this.findIntake(workspaceId, id);
    if (row === null) throw new Error('no such intake');
    const next: IntakeRecord = { ...row, ...change, updatedAt: new Date() };
    this.intakes.set(id, next);
    return next;
  }

  async findIntake(workspaceId: string, id: string): Promise<IntakeRecord | null> {
    requireScope(workspaceId);
    const row = this.intakes.get(id);
    return row !== undefined && row.workspaceId === workspaceId ? row : null;
  }

  async listDueIntakes(now: Date, limit: number): Promise<IntakeRecord[]> {
    return [...this.intakes.values()].filter((i) => i.state === 'pending' && (i.nextAttemptAt === null || i.nextAttemptAt <= now)).slice(0, limit);
  }

  async appendDelivery(input: Omit<NotificationDeliveryRecord, 'id' | 'createdAt'> & { readonly id?: string }): Promise<NotificationDeliveryRecord> {
    requireScope(input.workspaceId);
    const row: NotificationDeliveryRecord = { ...input, id: input.id ?? randomUUID(), createdAt: new Date() };
    this.deliveries.push(row);
    return row;
  }

  async listDeliveries(workspaceId: string, projectId: string): Promise<NotificationDeliveryRecord[]> {
    requireScope(workspaceId);
    return this.deliveries.filter((d) => d.workspaceId === workspaceId && d.projectId === projectId);
  }

  async latestObservation(capability: string): Promise<DeploymentObservationRecord | null> {
    // Newest first; at an equal instant the later append wins, as `createdAt` breaks the tie in PostgreSQL.
    return this.observations.filter((o) => o.capability === capability).reverse().sort(byDesc((o) => o.observedAt))[0] ?? null;
  }

  async listObservations(capability: string, limit: number): Promise<DeploymentObservationRecord[]> {
    return this.observations.filter((o) => o.capability === capability).reverse().sort(byDesc((o) => o.observedAt)).slice(0, limit);
  }

  async appendObservation(input: Omit<DeploymentObservationRecord, 'id'>): Promise<DeploymentObservationRecord> {
    const row: DeploymentObservationRecord = { ...input, id: randomUUID() };
    this.observations.push(row);
    return row;
  }

  vaultPort(): CredentialVaultPort {
    return {
      putCredentialRow: async (row) => {
        requireScope(row.workspaceId);
        const key = this.credKey(row.workspaceId, row.projectId, row.registryEntryId);
        const stored = { ...row, id: this.credentials.get(key)?.id ?? randomUUID() };
        this.credentials.set(key, stored);
        return this.status(stored);
      },
      readCredentialRow: async (workspaceId, projectId, registryEntryId) => {
        requireScope(workspaceId);
        return this.credentials.get(this.credKey(workspaceId, projectId, registryEntryId)) ?? null;
      },
      deleteCredentialRow: async (workspaceId, projectId, registryEntryId) => {
        requireScope(workspaceId);
        return this.credentials.delete(this.credKey(workspaceId, projectId, registryEntryId));
      },
    };
  }
}
