/**
 * `T1624` / `T1638` (EPIC-045, `R-045-6`) — the artifacts module: synced
 * markdown, the versions it becomes and the manifests that say which execution
 * delivered what.
 *
 * A module of its own because three things reach the content — the connector's
 * sync, the Epic detail's Files section and the specification detail — and the
 * module must depend on Epics, executions and specifications **without any of
 * them depending back**. The specification entity is reached through
 * `SPECIFICATION_SYNC_PORT`, implemented by the specifications module, so
 * nothing here touches a specification table (`R-045-4`).
 *
 * Two controllers, deliberately separate: the connector's write is behind
 * `ConnectorAuthGuard`, and the three session reads are not behind it at all —
 * a connector credential receives `404` on every read (`FR-ART-043`).
 */
import { Module } from '@nestjs/common';
import { prismaClient } from '../../persistence/prisma.js';
import { AgentsModule } from '../agents/agents.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ConnectorModule } from '../connector/connector.module.js';
import { EpicStoresModule } from '../epics/epic-stores.module.js';
import { EpicsModule } from '../epics/epics.module.js';
import { EPIC_STORE } from '../epics/epics.tokens.js';
import type { EpicStore } from '../epics/epic.store.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { ExecutionCommentService } from '../executions/execution-comment.service.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { SpecificationsModule } from '../specifications/specifications.module.js';
import { PrismaSpecificationSyncService, type SpecificationSyncDb } from '../specifications/specification-sync.service.js';
import { InMemoryArtifactStore, PrismaArtifactStore, type ArtifactDb, type ArtifactStore } from './artifact.store.js';
import { ArtifactReadService } from './artifact-read.service.js';
import {
  ArtifactSyncService,
  EmptyExecutionReader,
  PrismaExecutionReader,
  type EpicLister,
  type ExecutionRawDb,
  type ExecutionReader,
  type ProjectOwnerPort,
  type SyncAuditPort,
  type SyncCommentPort,
} from './artifact-sync.service.js';
import { ArtifactsController } from './artifacts.controller.js';
import { ArtifactsSyncController } from './artifacts-sync.controller.js';
import { ARTIFACT_STORE, SPECIFICATION_SYNC_PORT } from './artifacts.tokens.js';
import { InMemorySpecificationSyncPort, type SpecificationSyncPort } from './specification-sync.port.js';

export const ARTIFACT_EXECUTIONS = Symbol('ARTIFACT_EXECUTIONS');

@Module({
  // `AgentsModule` is here for the GUARD, not for this module's own code:
  // `@UseGuards(ConnectorAuthGuard)` instantiates the guard in the consuming
  // module's injector, so `TrustedPrincipalFactory` must be resolvable here.
  // `ExecutionsModule` imports it for the same reason. Without it the graph
  // fails to construct, and Nest aborts the process rather than reporting it
  // (`abortOnError` is true by default), which reads as a crash and not as a
  // wiring mistake.
  imports: [ConnectorModule, AgentsModule, EpicStoresModule, EpicsModule, ExecutionsModule, SpecificationsModule, AuditModule, ProjectsModule],
  controllers: [ArtifactsSyncController, ArtifactsController],
  providers: [
    {
      provide: ARTIFACT_STORE,
      useFactory: (): ArtifactStore => (process.env['DATABASE_URL'] ? new PrismaArtifactStore(prismaClient() as unknown as ArtifactDb) : new InMemoryArtifactStore()),
    },
    {
      provide: ARTIFACT_EXECUTIONS,
      useFactory: (): ExecutionReader => (process.env['DATABASE_URL'] ? new PrismaExecutionReader(prismaClient() as unknown as ExecutionRawDb) : new EmptyExecutionReader()),
    },
    {
      provide: SPECIFICATION_SYNC_PORT,
      useFactory: (): SpecificationSyncPort => (process.env['DATABASE_URL'] ? new PrismaSpecificationSyncService(prismaClient() as unknown as SpecificationSyncDb) : new InMemorySpecificationSyncPort()),
    },
    {
      provide: ArtifactSyncService,
      inject: [ARTIFACT_STORE, ARTIFACT_EXECUTIONS, EPIC_STORE, SPECIFICATION_SYNC_PORT, ExecutionCommentService, AuditService, ProjectsService],
      useFactory: (
        store: ArtifactStore,
        executions: ExecutionReader,
        epics: EpicStore,
        specifications: SpecificationSyncPort,
        comments: ExecutionCommentService,
        audit: AuditService,
        projects: ProjectsService,
      ): ArtifactSyncService => {
        // `bindExecutions` wants the number, the parent's number and the split
        // suffix — the same three fields the board resolves an execution with,
        // so a sync and a card cannot attach the same execution to different
        // Epics (R-045-2).
        const lister: EpicLister = {
          list: async (workspaceId, projectId) => {
            const rows = await epics.list(workspaceId, projectId);
            const byId = new Map(rows.map((r) => [r.id, r]));
            return rows.map((r) => ({
              id: r.id,
              number: r.number,
              parentNumber: r.parentEpicId ? (byId.get(r.parentEpicId)?.number ?? null) : null,
              splitSuffix: r.splitSuffix,
              slug: r.slug,
            }));
          },
        };
        const commentPort: SyncCommentPort = { add: (input) => comments.add({ ...input, idempotencyKey: input.idempotencyKey }) };
        const auditPort: SyncAuditPort = { record: (row) => audit.record(row as never) };
        const owners: ProjectOwnerPort = {
          ownerOf: async (workspaceId, projectId) => {
            try {
              return (await projects.get(workspaceId, projectId)).ownerUserId;
            } catch {
              // A project the caller cannot read is not an owner lookup failure
              // worth failing a sync over; the initiator stands in.
              return null;
            }
          },
        };
        return new ArtifactSyncService({ store, executions, epics: lister, specifications, comments: commentPort, audit: auditPort, owners });
      },
    },
    {
      provide: ArtifactReadService,
      inject: [ARTIFACT_STORE, ARTIFACT_EXECUTIONS],
      useFactory: (store: ArtifactStore, executions: ExecutionReader): ArtifactReadService => new ArtifactReadService({ store, executions }),
    },
  ],
  exports: [ARTIFACT_STORE, ArtifactSyncService, ArtifactReadService],
})
export class ArtifactsModule {}
