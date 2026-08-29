/**
 * T1037, T1038 (EPIC-037 Band A) — composing the execution registry.
 *
 * ## What this module reaches, and what it deliberately cannot
 *
 * It imports `LoopModule` for **one** token: `PROPOSAL_ADJUDICATOR`. EPIC-030's
 * individual ports — gates, authority policy, lifecycle validation and
 * application, adjudication records — are not exported, so this Epic cannot
 * assemble its own adjudicator over its own gate provider. That bypass is what
 * `FR-GEL-073` forbids, and unexported tokens are how it is prevented rather
 * than merely prohibited.
 *
 * It imports `AgentsModule` and `AccessModule` for identity and delegation, and
 * uses their **public services**. It reads neither epic's tables.
 *
 * There is no path to EPIC-009 from here at all. A connector cannot apply a
 * lifecycle transition because nothing in this module can.
 *
 * ## Why no controller is mounted (C3C closure)
 *
 * `ExecutionsController` was written under `T1038` and briefly mounted here.
 * Booting the composed application and issuing real HTTP proved the mistake:
 * `GET /v1/executions/:workspaceId/:id/history` answered **200 with a real
 * workspace's event stream to a caller holding no session**, and `POST
 * /v1/executions` accepted `identity.authenticatedPrincipalId` from the request
 * body — the caller asserting who it was.
 *
 * The application's only authentication boundary is `SessionContextMiddleware`,
 * which resolves a **human** session cookie. These routes are for connectors,
 * and nothing in this repository authenticates a connector yet — that is
 * EPIC-039 transport work, explicitly outside this band. There is no safe way
 * to mint a trusted principal context for them today, and a mounted route that
 * cannot authenticate its caller is worse than an absent one: it looks
 * delivered.
 *
 * So the module composes the registry and exports the **facade**, which the
 * fixture connector and the round-trip test drive in-process. External REST
 * activation belongs with the transport work that can authenticate it.
 */
import { Module } from '@nestjs/common';
import { ExecutionEventService, type EventDb } from './execution-event.service.js';
import {
  ExecutionRegistrationService,
  type DelegationPort,
  type IdentityResolverPort,
  type RegistrationDb,
} from './execution-registration.service.js';
import {
  ExecutionProjectionService,
  type ProjectionDb,
} from './execution-projection.service.js';
import { ExecutionCommentService, type CommentDb } from './execution-comment.service.js';
import { StatusProposalService, type ProposalDb } from './status-proposal.service.js';
import { ExecutionRegistryFacade } from './execution-registry.facade.js';
import { AgentsModule } from '../agents/agents.module.js';
import {
  IdentitySnapshotService,
  PrincipalRegistryService,
} from '../agents/principal-registry.service.js';
import { AccessModule } from '../access/access.module.js';
import { PrincipalDelegationService } from '../access/principal-delegation.service.js';
import { GOVERNED_LOOP } from '../../composition/governed-loop.js';
import { PROPOSAL_ADJUDICATOR } from '../loop/loop.tokens.js';
import type { ProposalAdjudicator } from '@pmi/loop-contract';
import { prismaClient } from '../../persistence/prisma.js';

export const EXECUTION_DB = Symbol('EXECUTION_DB');
export const EXECUTION_IDENTITY = Symbol('EXECUTION_IDENTITY');
export const EXECUTION_DELEGATIONS = Symbol('EXECUTION_DELEGATIONS');

@Module({
  imports: [AgentsModule, AccessModule, GOVERNED_LOOP],
  // `controllers` is deliberately EMPTY. See the header: `ExecutionsController`
  // exists but is NOT mounted, because nothing can authenticate its callers.
  // `tests/architecture/executions-unmounted.spec.ts` fails if it returns.
  controllers: [],
  providers: [
    {
      provide: EXECUTION_DB,
      // Lazily reached: `prismaClient()` reads DATABASE_URL at construction.
      useFactory: (): EventDb & RegistrationDb & ProjectionDb & CommentDb & ProposalDb =>
        prismaClient() as unknown as EventDb & RegistrationDb & ProjectionDb & CommentDb & ProposalDb,
    },
    {
      provide: ExecutionEventService,
      inject: [EXECUTION_DB],
      useFactory: (db: EventDb): ExecutionEventService => new ExecutionEventService(db),
    },
    {
      provide: ExecutionProjectionService,
      inject: [EXECUTION_DB],
      useFactory: (db: ProjectionDb): ExecutionProjectionService =>
        new ExecutionProjectionService(db),
    },
    {
      provide: EXECUTION_IDENTITY,
      inject: [IdentitySnapshotService, PrincipalRegistryService],
      // EPIC-028's public services, narrowed to what the registry asks. This
      // Epic never reads `principals` or `principal_identity_snapshots`.
      useFactory: (
        snapshots: IdentitySnapshotService,
        registry: PrincipalRegistryService,
      ): IdentityResolverPort => ({
        resolveSnapshot: async (snapshotId) => {
          const s = await snapshots.resolve(snapshotId);
          return s === null
            ? null
            : {
                snapshotId: s.snapshotId,
                principalId: s.principalId,
                workspaceId: s.workspaceId,
                kind: s.kind,
                sponsorUserId: s.sponsorUserId,
                identityVersion: s.identityVersion,
                connectorRegistrationId: s.connectorRegistrationId,
              };
        },
        findConnector: async (workspaceId, connectorId) => {
          const c = await registry.findConnector(workspaceId, connectorId);
          return c === null ? null : { connectorId: c.connectorId, state: c.state };
        },
      }),
    },
    {
      provide: EXECUTION_DELEGATIONS,
      inject: [PrincipalDelegationService],
      useFactory: (delegations: PrincipalDelegationService): DelegationPort => ({
        requireDelegated: async (input) => {
          const d = await delegations.requireDelegated(input);
          return { id: d.id, identityVersion: d.identityVersion };
        },
      }),
    },
    {
      provide: ExecutionRegistrationService,
      inject: [EXECUTION_DB, ExecutionEventService, EXECUTION_IDENTITY, EXECUTION_DELEGATIONS],
      useFactory: (
        db: RegistrationDb,
        events: ExecutionEventService,
        identity: IdentityResolverPort,
        delegations: DelegationPort,
      ): ExecutionRegistrationService =>
        new ExecutionRegistrationService(db, events, identity, delegations),
    },
    {
      provide: ExecutionCommentService,
      inject: [EXECUTION_DB, ExecutionEventService],
      useFactory: (db: CommentDb, events: ExecutionEventService): ExecutionCommentService =>
        new ExecutionCommentService(db, events),
    },
    {
      provide: StatusProposalService,
      inject: [
        EXECUTION_DB,
        ExecutionEventService,
        ExecutionProjectionService,
        PROPOSAL_ADJUDICATOR,
        EXECUTION_IDENTITY,
        EXECUTION_DELEGATIONS,
      ],
      useFactory: (
        db: ProposalDb,
        events: ExecutionEventService,
        projections: ExecutionProjectionService,
        adjudicator: ProposalAdjudicator,
        identity: IdentityResolverPort,
        delegations: DelegationPort,
      ): StatusProposalService =>
        new StatusProposalService(db, events, projections, adjudicator, identity, delegations),
    },
    {
      provide: ExecutionRegistryFacade,
      inject: [ExecutionRegistrationService, ExecutionEventService, StatusProposalService],
      useFactory: (
        registration: ExecutionRegistrationService,
        events: ExecutionEventService,
        proposals: StatusProposalService,
      ): ExecutionRegistryFacade => new ExecutionRegistryFacade(registration, events, proposals),
    },
  ],
  exports: [
    ExecutionRegistryFacade,
    ExecutionRegistrationService,
    ExecutionEventService,
    ExecutionProjectionService,
    ExecutionCommentService,
    StatusProposalService,
  ],
})
export class ExecutionsModule {}
