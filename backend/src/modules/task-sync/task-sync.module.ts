/**
 * `T1707` (EPIC-046) — the task-sync module: `tasks.md` parsed into rows, the
 * manifests that say what each execution saw, and the proposals a person raises
 * about them.
 *
 * A module of its own because four things reach these rows — the connector's
 * sync, the board, the proposal path and the execution-event listener — and the
 * module must depend on Epics, executions and tasks **without any of them
 * depending back**.
 *
 * `EPIC-012`'s progress aggregate is reached through `TASK_PROGRESS_PORT` rather
 * than reimplemented, so `FR-KAN-056`'s *one derivation for every surface* is
 * structural rather than a convention somebody has to remember.
 */
import { Module } from '@nestjs/common';
import { prismaClient } from '../../persistence/prisma.js';
import { AgentsModule } from '../agents/agents.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ConnectorModule } from '../connector/connector.module.js';
import { EpicStoresModule } from '../epics/epic-stores.module.js';
import { EPIC_STORE } from '../epics/epics.tokens.js';
import type { EpicStore } from '../epics/epic.store.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { ExecutionCommentService } from '../executions/execution-comment.service.js';
import { ExecutionEventService } from '../executions/execution-event.service.js';
import { EpicsModule } from '../epics/epics.module.js';
import { TraceabilityModule } from '../traceability/traceability.module.js';
import { LinkWriterService } from '../traceability/link-writer.service.js';
import {
  EmptyArtifactDigestReader,
  EmptyEpicRunReader,
  EmptyLegacyTaskReader,
  EmptyProgressEventReader,
  EmptyProposalVerdictReader,
  EmptySingleProposalVerdictReader,
  EmptyTaskExecutionReader,
  PrismaArtifactDigestReader,
  PrismaEpicRunReader,
  PrismaLegacyTaskReader,
  PrismaProgressEventReader,
  PrismaProposalVerdictReader,
  PrismaSingleProposalVerdictReader,
  PrismaTaskExecutionReader,
  type ExecutionRawDb,
  type ProposalVerdictReader,
} from './execution-reader.js';
import { TaskEventService, type ProgressEventReader } from './task-event.service.js';
import { TaskProgressService, type EpicIdSource, type LegacyTaskSource } from './task-progress.service.js';
import {
  TaskProposalService,
  type MovePolicyPort,
  type ProposalVerdictSource,
  type ProposalAuditPort,
  type ProposalEventPort,
} from './task-proposal.service.js';
import { TaskBoardController } from './task-board.controller.js';
import { TaskBoardService, type ArtifactDigestPort, type EpicRunReader } from './task-board.service.js';
import { DEFAULT_TASK_GRAMMAR } from './task-grammar.js';
import {
  TaskSyncService,
  type EpicLister,
  type ExecutionReader,
  type SyncAuditPort,
  type SyncCommentPort,
  type TaskLinkPort,
} from './task-sync.service.js';
import { InMemoryTaskSyncStore, type TaskSyncStore } from './task-sync.store.js';
import { PrismaTaskSyncStore, type TaskSyncDb } from './task-sync.store.prisma.js';
import { TASK_SYNC_STORE } from './task-sync.tokens.js';
import { TasksSyncController } from './tasks-sync.controller.js';
import { taskSyncLimits } from './task-validation.js';

export const TASK_SYNC_EXECUTIONS = Symbol('TASK_SYNC_EXECUTIONS');
export const TASK_PROGRESS_EVENTS = Symbol('TASK_PROGRESS_EVENTS');
export const TASK_ARTIFACT_DIGESTS = Symbol('TASK_ARTIFACT_DIGESTS');
export const TASK_EPIC_RUNS = Symbol('TASK_EPIC_RUNS');
export const TASK_PROPOSAL_VERDICTS = Symbol('TASK_PROPOSAL_VERDICTS');

@Module({
  // `AgentsModule` is here for the GUARD, not for this module's own code:
  // `@UseGuards(ConnectorAuthGuard)` instantiates the guard in the CONSUMING
  // module's injector, so `TrustedPrincipalFactory` must be resolvable here.
  // `ArtifactsModule` and `ExecutionsModule` import it for the same reason.
  // Without it the graph fails to construct and Nest aborts the process rather
  // than reporting it (`abortOnError` is true by default) — which reads as a
  // crash, and cost EPIC-045 a debugging session before it was written down.
  // `TraceabilityModule` is here for `T1783`'s task→Epic edge only: this
  // module writes into the graph and the graph knows nothing of it, which is
  // the same one-way direction every other dependency here has.
  imports: [ConnectorModule, AgentsModule, EpicStoresModule, EpicsModule, ExecutionsModule, AuditModule, TraceabilityModule],
  // Two controllers, deliberately separate: the connector's write is behind
  // `ConnectorAuthGuard`, and the board's read is not behind it at all — a
  // connector credential receives `404` on it (`FR-KAN-071`).
  controllers: [TasksSyncController, TaskBoardController],
  providers: [
    {
      provide: TASK_SYNC_STORE,
      // T1330's rule: `DATABASE_URL` is read in the factory body, so a reader
      // sees the decision rather than a `configured()` helper hiding it.
      useFactory: (): TaskSyncStore =>
        process.env['DATABASE_URL'] ? new PrismaTaskSyncStore(prismaClient() as unknown as TaskSyncDb) : new InMemoryTaskSyncStore(),
    },
    {
      provide: TASK_SYNC_EXECUTIONS,
      useFactory: (): ExecutionReader =>
        process.env['DATABASE_URL'] ? new PrismaTaskExecutionReader(prismaClient() as unknown as ExecutionRawDb) : new EmptyTaskExecutionReader(),
    },
    {
      provide: TASK_PROGRESS_EVENTS,
      useFactory: (): ProgressEventReader =>
        process.env['DATABASE_URL'] ? new PrismaProgressEventReader(prismaClient() as unknown as ExecutionRawDb) : new EmptyProgressEventReader(),
    },
    {
      provide: TaskEventService,
      inject: [TASK_SYNC_STORE, TASK_PROGRESS_EVENTS, AuditService],
      useFactory: (store: TaskSyncStore, events: ProgressEventReader, audit: AuditService): TaskEventService =>
        new TaskEventService({ store, events, audit: { record: (row) => audit.record(row as never) } }),
    },
    {
      provide: TaskSyncService,
      inject: [TASK_SYNC_STORE, TASK_SYNC_EXECUTIONS, EPIC_STORE, ExecutionCommentService, AuditService, TaskEventService, LinkWriterService],
      useFactory: (
        store: TaskSyncStore,
        executions: ExecutionReader,
        epics: EpicStore,
        comments: ExecutionCommentService,
        audit: AuditService,
        progress: TaskEventService,
        links: LinkWriterService,
      ): TaskSyncService => {
        // `bindExecutions` wants the number, the parent's number and the split
        // suffix — the same three fields the board resolves an execution with,
        // so a task sync and a card cannot attach the same execution to
        // different Epics (FR-KAN-030).
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
        const commentPort: SyncCommentPort = { add: (input) => comments.add({ ...input }) };
        const auditPort: SyncAuditPort = { record: (row) => audit.record(row as never) };
        const linkPort: TaskLinkPort = { linkTasksToEpic: (input) => links.linkTasksToEpic(input) };
        return new TaskSyncService({
          store,
          executions,
          epics: lister,
          comments: commentPort,
          audit: auditPort,
          grammar: DEFAULT_TASK_GRAMMAR,
          limits: taskSyncLimits,
          progress,
          links: linkPort,
        });
      },
    },
    {
      provide: TaskProgressService,
      inject: [TASK_SYNC_STORE, EPIC_STORE],
      useFactory: (store: TaskSyncStore, epics: EpicStore): TaskProgressService => {
        // Two sources, ONE derivation (`FR-KAN-056`): the project's Epics, and
        // `EPIC-012`'s specification-scoped rows that have no Epic. `T1781`
        // wired the second after the convergence pass found it declared and
        // unconnected — a project holding generated tasks read them as absent.
        const ids: EpicIdSource = {
          idsForProject: async (workspaceId, projectId) => (await epics.list(workspaceId, projectId)).map((e) => e.id),
        };
        const legacy: LegacyTaskSource = process.env['DATABASE_URL']
          ? new PrismaLegacyTaskReader(prismaClient() as unknown as ExecutionRawDb)
          : new EmptyLegacyTaskReader();
        return new TaskProgressService({ store, epics: ids, legacy });
      },
    },
    {
      provide: TASK_ARTIFACT_DIGESTS,
      useFactory: (): ArtifactDigestPort =>
        process.env['DATABASE_URL'] ? new PrismaArtifactDigestReader(prismaClient() as unknown as ExecutionRawDb) : new EmptyArtifactDigestReader(),
    },
    {
      provide: TASK_EPIC_RUNS,
      useFactory: (): EpicRunReader =>
        process.env['DATABASE_URL'] ? new PrismaEpicRunReader(prismaClient() as unknown as ExecutionRawDb) : new EmptyEpicRunReader(),
    },
    {
      provide: TASK_PROPOSAL_VERDICTS,
      useFactory: (): ProposalVerdictReader =>
        process.env['DATABASE_URL'] ? new PrismaProposalVerdictReader(prismaClient() as unknown as ExecutionRawDb) : new EmptyProposalVerdictReader(),
    },
    {
      provide: TaskProposalService,
      inject: [TASK_SYNC_STORE, ExecutionEventService, AuditService],
      useFactory: (
        store: TaskSyncStore,
        events: ExecutionEventService,
        audit: AuditService,
      ): TaskProposalService => {
        const eventPort: ProposalEventPort = { append: (input) => events.append(input as never) as never };
        const auditPort: ProposalAuditPort = { record: (row) => audit.record(row as never) };
        const policy: MovePolicyPort = {
          // `projects.taskMoveRequiresApproval` (R-046-6), one join behind the
          // store. A task whose project cannot be resolved takes the STRICTER
          // posture — a move that cannot prove it may apply at once waits.
          requiresApproval: async (workspaceId, taskId) => {
            const task = await store.findTask(taskId);
            if (task === null) return true;
            if (task.epicId === null) return false;
            return store.moveRequiresApproval(workspaceId, task.epicId);
          },
        };
        // `T1792` — one proposal's recorded verdicts, so *is this still
        // waiting* is answered from the event stream and never from a column.
        const verdicts: ProposalVerdictSource = process.env['DATABASE_URL']
          ? new PrismaSingleProposalVerdictReader(prismaClient() as unknown as ExecutionRawDb)
          : new EmptySingleProposalVerdictReader();
        return new TaskProposalService({ store, events: eventPort, audit: auditPort, policy, verdicts });
      },
    },
    {
      provide: TaskBoardService,
      inject: [TASK_SYNC_STORE, TaskEventService, TASK_SYNC_EXECUTIONS, TASK_ARTIFACT_DIGESTS, TASK_EPIC_RUNS, TASK_PROPOSAL_VERDICTS],
      useFactory: (
        store: TaskSyncStore,
        events: TaskEventService,
        executions: ExecutionReader,
        artifacts: ArtifactDigestPort,
        runs: EpicRunReader,
        verdicts: ProposalVerdictReader,
      ): TaskBoardService => new TaskBoardService({ store, events, executions, artifacts, runs, verdicts }),
    },
  ],
  exports: [TASK_SYNC_STORE, TaskSyncService, TaskBoardService, TaskEventService, TaskProgressService, TaskProposalService],
})
export class TaskSyncModule {}
