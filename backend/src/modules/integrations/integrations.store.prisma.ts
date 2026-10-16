/**
 * `T2130` (EPIC-039) — the Integration Hub's store over PostgreSQL.
 *
 * The behaviour of `integrations.store.ts`'s in-memory binding, against the
 * ten tables of `20261009130000_epic039_integration_hub`. Two rules carried
 * across from the port:
 *
 * - **Append-only stays append-only**: there is no `update` or `delete` call on
 *   a decision table here, and the database's triggers refuse one anyway.
 * - **`ciphertext` is selected in one place** — `vaultPort().readCredentialRow`,
 *   which only `credential.vault.ts` receives. Every status read uses an explicit
 *   `select` without it (`R-039-10`, architecture-tested).
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ConfigurationInput,
  ConfigurationRecord,
  ContractVersionRecord,
  CredentialStatusRecord,
  CredentialVaultPort,
  DeploymentObservationRecord,
  HealthCheckInput,
  HealthCheckRecord,
  IntakeChange,
  IntakeInput,
  IntakeRecord,
  IntegrationsStore,
  InvocationRecord,
  NotificationDeliveryRecord,
  RegistryEntryRecord,
  ResolutionFilter,
  ResolutionInput,
  ResolutionRecord,
  ScheduledCheckInput,
} from './integrations.store.js';
import { requireScope } from './integrations.store.js';

type Json = Prisma.InputJsonValue;
const json = (v: unknown): Json => v as Json;

const STATUS_SELECT = { id: true, workspaceId: true, projectId: true, registryEntryId: true, kind: true, setBy: true, setAt: true } as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
function entry(r: any): RegistryEntryRecord {
  return { id: r.id, workspaceId: r.workspaceId, key: r.key, direction: r.direction, status: r.status, listedOrder: r.listedOrder, registeredBy: r.registeredBy, registeredAt: r.registeredAt, retiredBy: r.retiredBy, retiredAt: r.retiredAt };
}
function configuration(r: any): ConfigurationRecord {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    projectId: r.projectId,
    capability: r.capability,
    adapters: r.adapters,
    permitDegraded: r.permitDegraded,
    permittedEnvironments: r.permittedEnvironments,
    onNotNarrowable: r.onNotNarrowable,
    healthIntervalSeconds: r.healthIntervalSeconds,
    providerBinding: r.providerBinding,
    configVersion: r.configVersion,
    decisionId: r.decisionId,
    updatedBy: r.updatedBy,
    updatedAt: r.updatedAt,
  };
}
function check(r: any): HealthCheckRecord {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    projectId: r.projectId,
    registryEntryId: r.registryEntryId,
    state: r.state,
    reason: r.reason,
    detail: r.detail,
    retryAfterSeconds: r.retryAfterSeconds,
    adapterVersion: r.adapterVersion,
    narrowing: r.narrowing,
    source: r.source,
    intervalBucket: r.intervalBucket === null ? null : Number(r.intervalBucket),
    checkedAt: r.checkedAt,
    durationMs: r.durationMs,
  };
}
function resolution(r: any): ResolutionRecord {
  const { createdAt: _c, ...rest } = r;
  return rest as ResolutionRecord;
}
function invocation(r: any): InvocationRecord {
  const { createdAt: _c, ...rest } = r;
  return rest as InvocationRecord;
}
function intake(r: any): IntakeRecord {
  return r as IntakeRecord;
}
function observation(r: any): DeploymentObservationRecord {
  const { createdAt: _c, ...rest } = r;
  return rest as DeploymentObservationRecord;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export class PrismaIntegrationsStore implements IntegrationsStore {
  constructor(private readonly db: PrismaClient) {}

  async listContracts(): Promise<ContractVersionRecord[]> {
    const rows = await this.db.capabilityContractVersion.findMany({ orderBy: [{ name: 'asc' }, { major: 'asc' }, { minor: 'asc' }] });
    return rows.map((r) => ({ id: r.id, name: r.name, scope: r.scope as 'project' | 'deployment', major: r.major, minor: r.minor, status: r.status as ContractVersionRecord['status'], document: r.document as Record<string, unknown>, changesState: r.changesState }));
  }

  async listEntries(workspaceId: string): Promise<RegistryEntryRecord[]> {
    requireScope(workspaceId);
    return (await this.db.integrationRegistryEntry.findMany({ where: { workspaceId }, orderBy: { listedOrder: 'asc' } })).map(entry);
  }

  async findEntry(workspaceId: string, id: string): Promise<RegistryEntryRecord | null> {
    requireScope(workspaceId);
    const r = await this.db.integrationRegistryEntry.findFirst({ where: { workspaceId, id } });
    return r === null ? null : entry(r);
  }

  async findEntryByKey(workspaceId: string, key: string): Promise<RegistryEntryRecord | null> {
    requireScope(workspaceId);
    const r = await this.db.integrationRegistryEntry.findFirst({ where: { workspaceId, key } });
    return r === null ? null : entry(r);
  }

  async createEntry(input: Omit<RegistryEntryRecord, 'id' | 'status' | 'retiredBy' | 'retiredAt'>): Promise<RegistryEntryRecord> {
    requireScope(input.workspaceId);
    return entry(await this.db.integrationRegistryEntry.create({ data: { ...input } }));
  }

  async retireEntry(workspaceId: string, id: string, by: string, at: Date): Promise<RegistryEntryRecord> {
    const e = await this.findEntry(workspaceId, id);
    if (e === null) throw new Error('no such entry');
    if (e.status === 'retired') return e;
    return entry(await this.db.integrationRegistryEntry.update({ where: { id }, data: { status: 'retired', retiredBy: by, retiredAt: at } }));
  }

  async getConfiguration(workspaceId: string, projectId: string, capability: string): Promise<ConfigurationRecord | null> {
    requireScope(workspaceId);
    const r = await this.db.projectCapabilityConfiguration.findFirst({ where: { workspaceId, projectId, capability } });
    return r === null ? null : configuration(r);
  }

  async listConfigurations(workspaceId: string, projectId: string): Promise<ConfigurationRecord[]> {
    requireScope(workspaceId);
    return (await this.db.projectCapabilityConfiguration.findMany({ where: { workspaceId, projectId } })).map(configuration);
  }

  async listActiveConfigurations(limit: number): Promise<ConfigurationRecord[]> {
    return (await this.db.projectCapabilityConfiguration.findMany({ where: { NOT: { adapters: { equals: [] } } }, orderBy: { updatedAt: 'asc' }, take: limit })).map(configuration);
  }

  async putConfiguration(input: ConfigurationInput): Promise<ConfigurationRecord> {
    requireScope(input.workspaceId);
    const data = {
      adapters: json(input.adapters),
      permitDegraded: input.permitDegraded,
      permittedEnvironments: [...input.permittedEnvironments],
      onNotNarrowable: input.onNotNarrowable,
      healthIntervalSeconds: input.healthIntervalSeconds,
      providerBinding: json(input.providerBinding),
      decisionId: input.decisionId,
      updatedBy: input.updatedBy,
    };
    const r = await this.db.projectCapabilityConfiguration.upsert({
      where: { projectId_capability: { projectId: input.projectId, capability: input.capability } },
      create: { workspaceId: input.workspaceId, projectId: input.projectId, capability: input.capability, configVersion: 1, ...data },
      update: { ...data, configVersion: { increment: 1 } },
    });
    return configuration(r);
  }

  async credentialStatus(workspaceId: string, projectId: string, registryEntryId: string): Promise<CredentialStatusRecord | null> {
    requireScope(workspaceId);
    return this.db.integrationCredential.findFirst({ where: { workspaceId, projectId, registryEntryId }, select: STATUS_SELECT });
  }

  async listCredentialStatus(workspaceId: string, projectId: string): Promise<CredentialStatusRecord[]> {
    requireScope(workspaceId);
    return this.db.integrationCredential.findMany({ where: { workspaceId, projectId }, select: STATUS_SELECT });
  }

  async latestCheck(workspaceId: string, projectId: string, registryEntryId: string): Promise<HealthCheckRecord | null> {
    requireScope(workspaceId);
    const r = await this.db.integrationHealthCheck.findFirst({ where: { workspaceId, projectId, registryEntryId }, orderBy: [{ checkedAt: 'desc' }, { createdAt: 'desc' }] });
    return r === null ? null : check(r);
  }

  async listChecks(workspaceId: string, registryEntryId: string, filter: { projectId?: string; limit: number }): Promise<HealthCheckRecord[]> {
    requireScope(workspaceId);
    return (
      await this.db.integrationHealthCheck.findMany({
        where: { workspaceId, registryEntryId, ...(filter.projectId !== undefined ? { projectId: filter.projectId } : {}) },
        orderBy: [{ checkedAt: 'desc' }, { createdAt: 'desc' }],
        take: filter.limit,
      })
    ).map(check);
  }

  private checkData(input: HealthCheckInput | ScheduledCheckInput): Omit<Prisma.IntegrationHealthCheckUncheckedCreateInput, 'source'> {
    return {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      registryEntryId: input.registryEntryId,
      state: input.state,
      reason: input.reason ?? null,
      detail: input.detail ?? null,
      retryAfterSeconds: input.retryAfterSeconds ?? null,
      adapterVersion: input.adapterVersion,
      narrowing: input.narrowing ?? null,
      checkedAt: input.checkedAt,
      durationMs: input.durationMs,
    };
  }

  async appendCheck(input: HealthCheckInput): Promise<HealthCheckRecord> {
    requireScope(input.workspaceId);
    return check(await this.db.integrationHealthCheck.create({ data: { ...this.checkData(input), source: input.source } }));
  }

  /** Analysis U2: the row goes in after the check; a concurrent winner makes this a no-op. */
  async recordScheduledCheck(input: ScheduledCheckInput): Promise<boolean> {
    requireScope(input.workspaceId);
    const d = this.checkData(input);
    const n = await this.db.$executeRaw`
      INSERT INTO "integration_health_checks"
        ("id","workspaceId","projectId","registryEntryId","state","reason","detail","retryAfterSeconds","adapterVersion","narrowing","source","intervalBucket","checkedAt","durationMs")
      VALUES (gen_random_uuid()::text, ${d.workspaceId}, ${d.projectId}, ${d.registryEntryId}, ${d.state}, ${d.reason}, ${d.detail}, ${d.retryAfterSeconds}, ${d.adapterVersion}, ${d.narrowing}, 'scheduled', ${BigInt(input.intervalBucket)}, ${d.checkedAt}, ${d.durationMs})
      ON CONFLICT DO NOTHING`;
    return n === 1;
  }

  async appendResolution(input: ResolutionInput): Promise<ResolutionRecord> {
    if (input.scope === 'project') requireScope(input.workspaceId ?? '');
    const r = await this.db.capabilityResolution.create({
      data: {
        ...(input.id !== undefined ? { id: input.id } : {}),
        workspaceId: input.workspaceId,
        scope: input.scope,
        projectId: input.projectId,
        caller: input.caller,
        actorPrincipalId: input.actorPrincipalId,
        executionId: input.executionId,
        capability: input.capability,
        requestedMajor: input.requestedMajor,
        contractVersion: input.contractVersion,
        outcome: input.outcome,
        refusalCode: input.refusalCode,
        registryEntryId: input.registryEntryId,
        adapterKey: input.adapterKey,
        adapterVersion: input.adapterVersion,
        provider: input.provider,
        ...(input.modelIdentity !== null ? { modelIdentity: json(input.modelIdentity) } : {}),
        ...(input.scopeGranted !== null ? { scopeGranted: json(input.scopeGranted) } : {}),
        reasons: json(input.reasons),
        decidedAt: input.decidedAt,
      },
    });
    return resolution(r);
  }

  async appendInvocation(input: InvocationRecord): Promise<InvocationRecord> {
    return invocation(await this.db.capabilityInvocation.create({ data: { ...input } }));
  }

  async listDeploymentResolutions(capability: string, limit: number): Promise<ResolutionRecord[]> {
    return (await this.db.capabilityResolution.findMany({ where: { scope: 'deployment', capability }, orderBy: { decidedAt: 'desc' }, take: limit })).map(resolution);
  }

  async listResolutions(workspaceId: string, filter: ResolutionFilter): Promise<ResolutionRecord[]> {
    requireScope(workspaceId);
    const where: Prisma.CapabilityResolutionWhereInput = { workspaceId, ...(filter.projectId !== undefined ? { projectId: filter.projectId } : {}) };
    if (filter.registryEntryId !== undefined) {
      // A refusal names no adapter column, so an entry's refusals are found by
      // its key among the evaluated candidates (`reasons.candidates`).
      const e = await this.db.integrationRegistryEntry.findFirst({ where: { workspaceId, id: filter.registryEntryId }, select: { key: true } });
      where.OR = [{ registryEntryId: filter.registryEntryId }, ...(e ? [{ reasons: { path: ['candidates'], array_contains: [{ entryKey: e.key }] } }] : [])];
    }
    return (await this.db.capabilityResolution.findMany({ where, orderBy: { decidedAt: 'desc' }, take: filter.limit ?? 50 })).map(resolution);
  }

  async findResolution(workspaceId: string | null, id: string): Promise<ResolutionRecord | null> {
    const r = await this.db.capabilityResolution.findFirst({ where: { id, workspaceId } });
    return r === null ? null : resolution(r);
  }

  async findInvocation(resolutionId: string): Promise<InvocationRecord | null> {
    const r = await this.db.capabilityInvocation.findUnique({ where: { resolutionId } });
    return r === null ? null : invocation(r);
  }

  async createIntake(input: IntakeInput): Promise<IntakeRecord> {
    requireScope(input.workspaceId);
    return intake(
      await this.db.evidenceIntakeAttempt.create({
        data: { ...input, workRef: json(input.workRef), attestedArtifact: input.attestedArtifact === null ? undefined : json(input.attestedArtifact), resolutionIds: [...input.resolutionIds] },
      }),
    );
  }

  async updateIntake(workspaceId: string, id: string, change: IntakeChange): Promise<IntakeRecord> {
    requireScope(workspaceId);
    const found = await this.findIntake(workspaceId, id);
    if (found === null) throw new Error('no such intake');
    const { resolutionIds, ...rest } = change;
    return intake(await this.db.evidenceIntakeAttempt.update({ where: { id }, data: { ...rest, ...(resolutionIds ? { resolutionIds: [...resolutionIds] } : {}) } }));
  }

  async findIntake(workspaceId: string, id: string): Promise<IntakeRecord | null> {
    requireScope(workspaceId);
    const r = await this.db.evidenceIntakeAttempt.findFirst({ where: { workspaceId, id } });
    return r === null ? null : intake(r);
  }

  async listDueIntakes(now: Date, limit: number): Promise<IntakeRecord[]> {
    return (await this.db.evidenceIntakeAttempt.findMany({ where: { state: 'pending', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, orderBy: { createdAt: 'asc' }, take: limit })).map(intake);
  }

  async appendDelivery(input: Omit<NotificationDeliveryRecord, 'id' | 'createdAt'> & { readonly id?: string }): Promise<NotificationDeliveryRecord> {
    requireScope(input.workspaceId);
    return (await this.db.notificationDelivery.create({ data: { ...input, cause: json(input.cause), recipients: [...input.recipients] } })) as unknown as NotificationDeliveryRecord;
  }

  async listDeliveries(workspaceId: string, projectId: string): Promise<NotificationDeliveryRecord[]> {
    requireScope(workspaceId);
    return (await this.db.notificationDelivery.findMany({ where: { workspaceId, projectId }, orderBy: { createdAt: 'asc' } })) as unknown as NotificationDeliveryRecord[];
  }

  async latestObservation(capability: string): Promise<DeploymentObservationRecord | null> {
    const r = await this.db.deploymentCapabilityBinding.findFirst({ where: { capability }, orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }] });
    return r === null ? null : observation(r);
  }

  async listObservations(capability: string, limit: number): Promise<DeploymentObservationRecord[]> {
    return (await this.db.deploymentCapabilityBinding.findMany({ where: { capability }, orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }], take: limit })).map(observation);
  }

  async appendObservation(input: Omit<DeploymentObservationRecord, 'id'>): Promise<DeploymentObservationRecord> {
    return observation(
      await this.db.deploymentCapabilityBinding.create({
        data: { ...input, providerBinding: json(input.providerBinding), ...(input.observedModel !== null ? { observedModel: json(input.observedModel) } : { observedModel: undefined }) },
      }),
    );
  }

  vaultPort(): CredentialVaultPort {
    return {
      putCredentialRow: async (row) => {
        requireScope(row.workspaceId);
        const data = { kind: row.kind, ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyId: row.keyId, setBy: row.setBy, setAt: row.setAt };
        return this.db.integrationCredential.upsert({
          where: { workspaceId_projectId_registryEntryId: { workspaceId: row.workspaceId, projectId: row.projectId, registryEntryId: row.registryEntryId } },
          create: { workspaceId: row.workspaceId, projectId: row.projectId, registryEntryId: row.registryEntryId, ...data },
          update: data,
          select: STATUS_SELECT,
        });
      },
      readCredentialRow: async (workspaceId, projectId, registryEntryId) => {
        requireScope(workspaceId);
        const r = await this.db.integrationCredential.findFirst({ where: { workspaceId, projectId, registryEntryId } });
        return r === null ? null : { id: r.id, workspaceId: r.workspaceId, projectId: r.projectId, registryEntryId: r.registryEntryId, kind: r.kind, ciphertext: Buffer.from(r.ciphertext), iv: Buffer.from(r.iv), authTag: Buffer.from(r.authTag), keyId: r.keyId, setBy: r.setBy, setAt: r.setAt };
      },
      deleteCredentialRow: async (workspaceId, projectId, registryEntryId) => {
        requireScope(workspaceId);
        const r = await this.db.integrationCredential.deleteMany({ where: { workspaceId, projectId, registryEntryId } });
        return r.count > 0;
      },
    };
  }
}
