/**
 * EPIC-024 — access module wiring (F-02.5, F-024.6).
 *
 * In-memory defaults, per the platform posture; a deployment overrides
 * ACCESS_GRANT_STORE / ACCESS_ATTEMPT_STORE with `PrismaAccessStore` at the
 * composition root (EPIC-014 F-11.2). The derivation graph defaults to the
 * in-memory implementation until the traceability graph supplies a live one
 * on the same token.
 */
import { Module } from '@nestjs/common';
import { AccessController } from './access.controller.js';
import { AccessEnforcementService, type AttemptStore } from './access-enforcement.service.js';
import { AccessEvaluationService } from './access-evaluation.service.js';
import {
  AccessGrantService,
  InMemoryGrantStore,
  type GrantStore,
} from './access-grant.service.js';
import { AccessInheritanceService, InMemoryDerivationGraph, type DerivationGraph } from './access-inheritance.service.js';
import { AccessSnapshotService } from './access-snapshot.service.js';
import { PrismaAccessStore, type AccessDb } from './access.store.js';
import {
  CompositePrincipalDirectory,
  PrismaActorDirectory,
  WorkspaceBoundaryService,
  type ActorDirectory,
  type NonHumanPrincipalLookup,
} from './workspace-boundary.service.js';
import {
  PrincipalDelegationService,
  type DelegationStore,
} from './principal-delegation.service.js';
import { PrismaDelegationStore } from './delegation.store.js';
import { AgentsModule } from '../agents/agents.module.js';
import { PrincipalRegistryService } from '../agents/principal-registry.service.js';
import { prismaClient } from '../../persistence/prisma.js';

export const ACCESS_GRANT_STORE = Symbol('ACCESS_GRANT_STORE');
export const ACCESS_ATTEMPT_STORE = Symbol('ACCESS_ATTEMPT_STORE');
export const DERIVATION_GRAPH = Symbol('DERIVATION_GRAPH');
/** `X19` — the authoritative actor source the boundary reads. */
export const ACTOR_DIRECTORY = Symbol('ACTOR_DIRECTORY');
/** `T1139` — where scoped non-human delegations are read and written. */
export const DELEGATION_STORE = Symbol('DELEGATION_STORE');
/**
 * `T1140` — EPIC-028's public registry, injected. EPIC-024 never reads
 * EPIC-028's tables: a second reader of another epic's schema is how two
 * epics end up disagreeing about who exists.
 */
export const NON_HUMAN_PRINCIPALS = Symbol('NON_HUMAN_PRINCIPALS');

/**
 * One store instance, reached lazily.
 *
 * `prismaClient()` reads `DATABASE_URL` when constructed, so it must not run
 * while modules are merely being assembled.
 */
let store: PrismaAccessStore | undefined;
function prismaAccessStore(): PrismaAccessStore {
  return (store ??= new PrismaAccessStore(prismaClient() as unknown as AccessDb));
}

@Module({
  imports: [AgentsModule],
  controllers: [AccessController],
  providers: [
    // X13 (C2D) — grants and refusal records are DURABLE. Bound to the
    // PrismaAccessStore this Epic already shipped and never composed: with the
    // in-memory store, a restart turned a governed artifact back into an
    // ungoverned one, because "no grants" means "unrestricted".
    { provide: ACCESS_GRANT_STORE, useFactory: (): GrantStore => prismaAccessStore() },
    { provide: ACCESS_ATTEMPT_STORE, useFactory: (): AttemptStore => prismaAccessStore() },
    { provide: DERIVATION_GRAPH, useFactory: (): DerivationGraph => new InMemoryDerivationGraph() },
    {
      provide: AccessGrantService,
      inject: [ACCESS_GRANT_STORE],
      useFactory: (grants: InMemoryGrantStore): AccessGrantService => new AccessGrantService(grants),
    },
    {
      provide: AccessInheritanceService,
      inject: [ACCESS_GRANT_STORE, DERIVATION_GRAPH],
      useFactory: (grants: InMemoryGrantStore, derivations: DerivationGraph): AccessInheritanceService =>
        new AccessInheritanceService(grants, derivations),
    },
    {
      provide: ACTOR_DIRECTORY,
      inject: [NON_HUMAN_PRINCIPALS],
      useFactory: (principals: NonHumanPrincipalLookup): ActorDirectory =>
        // Reached lazily, like the grant store: `prismaClient()` reads
        // DATABASE_URL when constructed, so it must not run while modules are
        // merely being assembled.
        // Humans from `users`, agents and services from EPIC-028's registry —
        // one boundary over both, not a second authorisation system.
        new CompositePrincipalDirectory(
          new PrismaActorDirectory({
            findUnique: (args) => prismaClient().user.findUnique(args as never) as never,
          }),
          principals,
        ),
    },
    {
      provide: WorkspaceBoundaryService,
      inject: [ACTOR_DIRECTORY],
      useFactory: (directory: ActorDirectory): WorkspaceBoundaryService =>
        new WorkspaceBoundaryService(directory),
    },
    {
      provide: NON_HUMAN_PRINCIPALS,
      inject: [PrincipalRegistryService],
      // EPIC-028's PUBLIC service, narrowed to the one question the boundary
      // asks. EPIC-024 never touches EPIC-028's tables — a second reader of
      // another epic's schema is how two epics end up disagreeing about who
      // exists, and the C3B authorisation forbids it by name.
      useFactory: (registry: PrincipalRegistryService): NonHumanPrincipalLookup => ({
        find: async (workspaceId, principalId) => {
          const p = await registry.find(workspaceId, principalId);
          return p === null
            ? null
            : {
                principalId: p.principalId,
                kind: p.kind,
                workspaceId: p.workspaceId,
                state: p.state,
                identityVersion: p.identityVersion,
              };
        },
      }),
    },
    {
      provide: DELEGATION_STORE,
      useFactory: (): DelegationStore => new PrismaDelegationStore(() => prismaClient() as never),
    },
    {
      provide: PrincipalDelegationService,
      inject: [DELEGATION_STORE, NON_HUMAN_PRINCIPALS],
      useFactory: (
        store: DelegationStore,
        principals: NonHumanPrincipalLookup,
      ): PrincipalDelegationService =>
        new PrincipalDelegationService(store, {
          find: async (workspaceId, principalId) => {
            const p = await principals.find(workspaceId, principalId);
            return p === null ? null : { identityVersion: p.identityVersion, state: p.state };
          },
        }),
    },
    {
      provide: AccessEnforcementService,
      inject: [AccessInheritanceService, ACCESS_ATTEMPT_STORE, WorkspaceBoundaryService],
      useFactory: (
        inheritance: AccessInheritanceService,
        attempts: AttemptStore,
        boundary: WorkspaceBoundaryService,
      ): AccessEnforcementService =>
        new AccessEnforcementService(inheritance, attempts, boundary),
    },
    {
      provide: AccessSnapshotService,
      inject: [ACCESS_GRANT_STORE],
      useFactory: (grants: InMemoryGrantStore): AccessSnapshotService =>
        new AccessSnapshotService(grants),
    },
    {
      provide: AccessEvaluationService,
      inject: [AccessEnforcementService],
      useFactory: (enforcement: AccessEnforcementService): AccessEvaluationService =>
        new AccessEvaluationService(enforcement),
    },
  ],
  exports: [
    AccessGrantService,
    AccessEnforcementService,
    AccessInheritanceService,
    AccessSnapshotService,
    AccessEvaluationService,
    WorkspaceBoundaryService,
    PrincipalDelegationService,
    ACCESS_GRANT_STORE,
    ACCESS_ATTEMPT_STORE,
    DERIVATION_GRAPH,
  ],
})
export class AccessModule {}
