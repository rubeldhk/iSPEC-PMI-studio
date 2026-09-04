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
import { PrincipalRegistryService } from '../agents/principal-registry.service.js';
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
      inject: [CONNECTOR_CREDENTIAL_STORE, ProjectsService, PrincipalRegistryService, AuditService, AccessGrantService],
      useFactory: (
        credentials: ConnectorCredentialStore,
        projects: ProjectsService,
        principals: PrincipalRegistryService,
        audit: AuditService,
        grants: AccessGrantService,
      ): ConnectorCredentialService =>
        new ConnectorCredentialService({
          credentials,
          projects,
          principals,
          // The read side only: the owner-grant check (FR-LPW-027). Asserted by
          // tests/architecture/connector-boundary.spec.ts.
          grants: { activeForArtifact: (workspaceId, artifact) => grants.activeGrants(workspaceId, artifact) },
          audit,
        }),
    },
    {
      provide: ConnectorAuthGuard,
      inject: [CONNECTOR_CREDENTIAL_STORE, TrustedPrincipalFactory, Reflector],
      useFactory: (credentials: ConnectorCredentialStore, principals: TrustedPrincipalFactory, reflector: Reflector): ConnectorAuthGuard =>
        new ConnectorAuthGuard(credentials, principals, { reflector }),
    },
  ],
  exports: [ConnectorCredentialService, CONNECTOR_CREDENTIAL_STORE],
})
export class ConnectorModule {}
