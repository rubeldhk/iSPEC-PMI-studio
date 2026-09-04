/**
 * `T1362` (EPIC-041) — connector module wiring.
 *
 * Composes the credential store (Prisma under `DATABASE_URL`, in memory
 * otherwise — the same seam as every durable store), the credential service,
 * the guard, and the three controllers. Registered in `app.module.ts` in the
 * same commit — `DEF-005-001` is what an unregistered module looks like.
 *
 * `ProjectsModule` and this module reference each other: provisioning mints a
 * credential in the create response (`FR-LPW-020`), and minting reads the
 * project. Both sides use `forwardRef`, as Nest's circular-dependency guidance
 * prescribes.
 */
import { Module, forwardRef } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessGrantService } from '../access/access-grant.service.js';
import { AccessModule } from '../access/access.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { IdentitySnapshotService, PrincipalRegistryService } from '../agents/principal-registry.service.js';
import { PrincipalDelegationService } from '../access/principal-delegation.service.js';
import { TrustedPrincipalFactory } from '../agents/trusted-principal.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { prismaClient } from '../../persistence/prisma.js';
import { ConnectorAuthGuard } from './connector-auth.guard.js';
import { ConnectorCredentialService } from './connector-credential.service.js';
import {
  InMemoryConnectorCredentialStore,
  PrismaConnectorCredentialStore,
  type ConnectorCredentialDelegate,
  type ConnectorCredentialStore,
} from './connector-credential.store.js';
import { ConnectorController, ConnectorCredentialsController, ProjectConnectorCredentialsController } from './connector.controller.js';
import { CONNECTOR_CREDENTIAL_STORE } from './connector.tokens.js';

export { CONNECTOR_CREDENTIAL_STORE } from './connector.tokens.js';

@Module({
  imports: [forwardRef(() => ProjectsModule), AgentsModule, AuditModule, AccessModule],
  controllers: [ProjectConnectorCredentialsController, ConnectorCredentialsController, ConnectorController],
  providers: [
    {
      provide: CONNECTOR_CREDENTIAL_STORE,
      useFactory: (): ConnectorCredentialStore =>
        process.env['DATABASE_URL']
          ? new PrismaConnectorCredentialStore(prismaClient().connectorCredential as unknown as ConnectorCredentialDelegate)
          : new InMemoryConnectorCredentialStore(),
    },
    {
      provide: ConnectorCredentialService,
      inject: [CONNECTOR_CREDENTIAL_STORE, ProjectsService, PrincipalRegistryService, AuditService, AccessGrantService, IdentitySnapshotService, PrincipalDelegationService],
      useFactory: (
        credentials: ConnectorCredentialStore,
        projects: ProjectsService,
        principals: PrincipalRegistryService,
        audit: AuditService,
        grants: AccessGrantService,
        snapshots: IdentitySnapshotService,
        delegations: PrincipalDelegationService,
      ): ConnectorCredentialService =>
        new ConnectorCredentialService({
          credentials,
          projects,
          principals,
          // The read side only: the owner-grant check (FR-LPW-027). Asserted by
          // tests/architecture/connector-boundary.spec.ts.
          grants: { activeForArtifact: (workspaceId, artifact) => grants.activeGrants(workspaceId, artifact) },
          audit,
          // EPIC-043 T1411 (R-043-3): EPIC-028's services, by shape — what the
          // registry will resolve when this credential registers an execution.
          // Delegations are granted and revoked here; never approval or application.
          identity: {
            captureSnapshot: async (workspaceId, principalId) => {
              const s = await snapshots.capture(workspaceId, principalId);
              return { snapshotId: s.snapshotId, identityVersion: s.identityVersion };
            },
            ensureRegistration: async (workspaceId, kind, registeredByUserId) => {
              const c = await principals.ensureConnector({ workspaceId, kind, registeredByUserId });
              return { registrationId: c.connectorId };
            },
            attachRegistration: (input) => principals.attachConnectorRegistration(input),
            delegate: async (input) => {
              const d = await delegations.delegate(input);
              return { id: d.id };
            },
            revokeDelegations: async (input) => {
              const rows = await delegations.listActive(input.workspaceId, input.principalId, input.artifact);
              for (const row of rows) await delegations.revoke(input.workspaceId, row.id, input.revokedById);
              return rows.length;
            },
          },
        }),
    },
    {
      provide: ConnectorAuthGuard,
      inject: [CONNECTOR_CREDENTIAL_STORE, TrustedPrincipalFactory, Reflector],
      useFactory: (credentials: ConnectorCredentialStore, principals: TrustedPrincipalFactory, reflector: Reflector): ConnectorAuthGuard =>
        new ConnectorAuthGuard(credentials, principals, { reflector }),
    },
  ],
  // EPIC-043: the executions module mounts its controller behind the guard.
  exports: [ConnectorCredentialService, CONNECTOR_CREDENTIAL_STORE, ConnectorAuthGuard],
})
export class ConnectorModule {}
