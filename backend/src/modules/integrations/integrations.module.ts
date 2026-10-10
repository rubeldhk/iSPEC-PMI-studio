/**
 * `T2105`, `T2225` (EPIC-039) — the Integration Hub module.
 *
 * Registered in `app.module.ts` before `ServeStaticModule`, in the same change
 * that created it: `DEF-005-001` is what an unregistered module looks like.
 *
 * What is composed here, and nowhere else:
 *
 * - the store — PostgreSQL under `DATABASE_URL`, in-memory otherwise (the
 *   `T1330` durable-store rule);
 * - the adapter catalog, from `composition/integration-adapters.ts`, the one
 *   backend file that imports adapter packages (`R-039-1`);
 * - the declared ports as **seams bound refusing** — `CapabilityPolicy`,
 *   `EvidenceSink` — and `CredentialKeyring` bound from `PMI_INTEGRATION_KEYS`
 *   when present (`R-039-13`, `R-039-10`);
 * - `PMI_ENVIRONMENT`, read once; the module refuses to start without it
 *   (`R-039-8`);
 * - the ticker that drives `runDueHealthChecks`, off under
 *   `PMI_INTEGRATION_SCHEDULER=off` (`R-039-6`).
 */
import { Inject, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { CAPABILITY_CONTRACTS, PLATFORM_ENVIRONMENTS, isPlatformEnvironment } from '@pmi/capability-contract';
import { prismaClient } from '../../persistence/prisma.js';
import { createAdapterCatalog } from '../../composition/integration-adapters.js';
import { AccessEnforcementService } from '../access/access-enforcement.service.js';
import { AccessGrantService } from '../access/access-grant.service.js';
import { AccessModule } from '../access/access.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ConnectorModule } from '../connector/connector.module.js';
import { CONNECTOR_CREDENTIAL_STORE } from '../connector/connector.tokens.js';
import type { ConnectorCredentialStore } from '../connector/connector-credential.store.js';
import { WorkstationConnectionService } from '../connector/workstation-connection.service.js';
import { ExecutionEventService } from '../executions/execution-event.service.js';
import { ExecutionRegistryFacade } from '../executions/execution-registry.facade.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { OwnerGate } from '../governance/owner-gate.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { AdapterCatalog } from './catalog.service.js';
import { ConfigurationController } from './configuration.controller.js';
import { CredentialsController } from './credentials/credentials.controller.js';
import { createHub, type Hub } from './hub.js';
import { HUB } from './hub.token.js';
import { RegistryController } from './registry.controller.js';
import { CapabilityRequestsController } from './requests/capability-requests.controller.js';
import { InMemoryIntegrationsStore, type IntegrationsStore } from './integrations.store.js';
import { PrismaIntegrationsStore } from './integrations.store.prisma.js';
import {
  ADAPTER_CATALOG,
  CapabilityPolicySeam,
  CredentialKeyringSeam,
  EvidenceSinkSeam,
  INTEGRATIONS_STORE,
  INTEGRATIONS_TICKER,
  PLATFORM_ENVIRONMENT,
  envKeyring,
} from './integrations.tokens.js';
import { tickerFromEnvironment, type Ticker } from './health/ticker.js';

/** `T2225` (`R-039-8`) — the deployment environment, or a refusal to start naming the variable. */
export function resolvePlatformEnvironment(env: Readonly<Record<string, string | undefined>>): string {
  const value = env['PMI_ENVIRONMENT'];
  if (value === undefined || value.trim() === '') {
    throw new Error('PMI_ENVIRONMENT is not set. The integrations module refuses to start rather than guess: set it to one of local, dev, stage, prod (R-039-8, .env.example).');
  }
  if (!isPlatformEnvironment(value)) throw new Error(`PMI_ENVIRONMENT "${value}" is not one of ${PLATFORM_ENVIRONMENTS.join(', ')} (R-039-8).`);
  return value;
}

/** Health ticks every 30 s (`R-039-6`). */
export const HEALTH_TICK_MS = 30_000;

@Module({
  imports: [AuditModule, AccessModule, ProjectsModule, ConnectorModule, ExecutionsModule],
  controllers: [RegistryController, ConfigurationController, CredentialsController, CapabilityRequestsController],
  providers: [
    { provide: PLATFORM_ENVIRONMENT, useFactory: (): string => resolvePlatformEnvironment(process.env) },
    {
      provide: INTEGRATIONS_STORE,
      useFactory: (): IntegrationsStore =>
        process.env['DATABASE_URL']
          ? new PrismaIntegrationsStore(prismaClient())
          : new InMemoryIntegrationsStore(CAPABILITY_CONTRACTS.map((d, i) => ({ id: `contract_${i}`, name: d.name, scope: d.scope, major: d.major, minor: d.minor, status: 'approved' as const, document: d as unknown as Record<string, unknown>, changesState: d.changesState }))),
    },
    { provide: ADAPTER_CATALOG, useFactory: (): AdapterCatalog => createAdapterCatalog() },
    { provide: CapabilityPolicySeam, useValue: new CapabilityPolicySeam() },
    { provide: EvidenceSinkSeam, useValue: new EvidenceSinkSeam() },
    {
      provide: CredentialKeyringSeam,
      useFactory: (): CredentialKeyringSeam => {
        const seam = new CredentialKeyringSeam();
        const configured = envKeyring(process.env);
        if (configured !== null) seam.bind(configured);
        return seam;
      },
    },
    { provide: INTEGRATIONS_TICKER, useFactory: (): Ticker => tickerFromEnvironment(process.env) },
    {
      provide: HUB,
      inject: [
        INTEGRATIONS_STORE,
        ADAPTER_CATALOG,
        CapabilityPolicySeam,
        EvidenceSinkSeam,
        CredentialKeyringSeam,
        PLATFORM_ENVIRONMENT,
        AuditService,
        ExecutionEventService,
        ExecutionRegistryFacade,
        ProjectsService,
        AccessGrantService,
        AccessEnforcementService,
        CONNECTOR_CREDENTIAL_STORE,
        WorkstationConnectionService,
      ],
      useFactory: (
        store: IntegrationsStore,
        catalog: AdapterCatalog,
        policy: CapabilityPolicySeam,
        evidence: EvidenceSinkSeam,
        keyring: CredentialKeyringSeam,
        environment: string,
        audit: AuditService,
        events: ExecutionEventService,
        registry: ExecutionRegistryFacade,
        projects: ProjectsService,
        grants: AccessGrantService,
        enforcement: AccessEnforcementService,
        connectorCredentials: ConnectorCredentialStore,
        workstations: WorkstationConnectionService,
      ): Hub => {
        const artifact = (workspaceId: string): { artifactType: string; artifactId: string } => ({ artifactType: 'integration-registry', artifactId: workspaceId });
        const ownerGate = new OwnerGate({
          projects: { get: (workspaceId, id) => projects.get(workspaceId, id) },
          grants: { activeGrants: (workspaceId, a) => grants.activeGrants(workspaceId, a as never) },
          audit: { record: (row) => audit.record(row as never) },
        });
        return createHub({
          store,
          catalog,
          policy,
          evidence,
          keyring,
          clock: () => new Date(),
          environment,
          audit: { record: (row) => audit.record(row) },
          events: {
            appendCapabilityResolved: async ({ workspaceId, executionId, emittedBy, resolutionId, payload }) => {
              await events.append({ workspaceId, executionId, type: 'capability-resolved', payload, occurredAt: new Date().toISOString(), emittedBy, idempotencyKey: `capability-resolved:${resolutionId}` });
            },
          },
          executions: { exists: async (workspaceId, executionId) => (await registry.snapshot(workspaceId, executionId).catch(() => null)) !== null },
          projects: { exists: async (workspaceId, projectId) => (await projects.get(workspaceId, projectId).catch(() => null)) !== null },
          ownerGate,
          access: {
            requireReadable: (workspaceId, userId) => enforcement.requireReadable(workspaceId, userId, artifact(workspaceId)),
            requireEditable: (workspaceId, userId) => enforcement.requireEditable(workspaceId, userId, artifact(workspaceId)),
            grantEdit: async (workspaceId, userId, grantedBy) => {
              const active = await grants.activeGrants(workspaceId, artifact(workspaceId));
              if (active.some((g) => g.userId === userId && g.level === 'edit')) return;
              await grants.grant(workspaceId, artifact(workspaceId), { userId, level: 'edit', grantedById: grantedBy });
            },
          },
          workspaces: {
            creatorOf: async (workspaceId) => {
              if (!process.env['DATABASE_URL']) return null;
              const first = await prismaClient().user.findFirst({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
              return first?.id ?? null;
            },
          },
          projectConnectors: {
            activeCredential: async (workspaceId, projectId) => {
              const active = (await connectorCredentials.listForProject(workspaceId, projectId, { revoked: false })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
              return active === undefined ? null : { createdById: active.createdById, createdAt: active.createdAt };
            },
            lastConnection: async (workspaceId, projectId) => {
              const rows = await workstations.listForProject(workspaceId, projectId);
              return rows.map((r) => r.lastSeenAt).sort().pop() ?? null;
            },
          },
        });
      },
    },
  ],
  exports: [HUB, CapabilityPolicySeam, EvidenceSinkSeam, CredentialKeyringSeam, INTEGRATIONS_TICKER],
})
export class IntegrationsModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(HUB) private readonly hub: Hub,
    @Inject(INTEGRATIONS_TICKER) private readonly ticker: Ticker,
  ) {}

  onModuleInit(): void {
    this.ticker.start(HEALTH_TICK_MS, async () => {
      await this.hub.health.runDueHealthChecks();
    });
  }

  onModuleDestroy(): void {
    this.ticker.stop();
  }
}
