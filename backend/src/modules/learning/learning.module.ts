/**
 * `T2302`, `T2335` (EPIC-048) — the Learning module.
 *
 * Registered in `app.module.ts` in the commit that created it; `T2301` proves the
 * wiring. `DEF-005-001` is what a module built, tested and registered nowhere
 * looks like.
 *
 * ## No workflow type, no area
 *
 * `FR-LRN-070`: candidates are reviewed in `EPIC-031`'s Decision Inbox and
 * knowledge is browsed inside `EPIC-038`'s Context area. This module declares
 * neither an area nor a workflow type; `T2301` and `T2382` assert the absence.
 *
 * ## Ports: real where the owner is on `main`, refusing where it is not
 *
 * `LEARNING_PORTS_TOKEN` is one object holding all twelve ports (`learning.tokens.ts`).
 * The `main` owners are bound to their services here; the four unmerged owners
 * stay **refusing** until Phase 9. Route tests rebind a member of that object to
 * an in-test recorder, visibly, in the test that needs it — the default never
 * changes (`R-048-20`).
 *
 * ## The writer goes to the materialiser and nowhere else
 *
 * `KNOWLEDGE_WRITER` is injected into one provider. `T2332` reads this file and
 * fails if a second provider asks for it (`R-048-4` fence 1, `MP-1a`).
 */
import { Module } from '@nestjs/common';
import { prismaClient } from '../../persistence/prisma.js';
import { AgentsModule } from '../agents/agents.module.js';
import { PrincipalRegistryService } from '../agents/principal-registry.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ConnectorModule } from '../connector/connector.module.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { ExecutionEventService } from '../executions/execution-event.service.js';
import { ExecutionRegistrationService } from '../executions/execution-registration.service.js';
import { ExecutionRegistryFacade } from '../executions/execution-registry.facade.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { SteeringModule } from '../steering/steering.module.js';
import { SteeringService } from '../steering/steering.service.js';
import { LearningConnectorController } from './learning-connector.controller.js';
import { LearningPolicyReader, steeringPolicySource } from './learning-policy.js';
import { LearningController } from './learning.controller.js';
import { InMemoryLearningStore, type LearningStore } from './learning.store.js';
import { PrismaKnowledgeWriter, PrismaLearningStore, type LearningPrismaClient } from './learning.store.prisma.js';
import { KNOWLEDGE_WRITER, LEARNING_PORTS, LEARNING_PORTS_TOKEN, LEARNING_STORE, refusingPorts, type AuditPort, type LearningPorts } from './learning.tokens.js';
import { auditPort, executionsPort, principalsPort, projectsPort } from './main-ports.js';
import { secretScreenPort } from './secret.screen.js';
import { SubmissionService } from './submission.service.js';
import { CandidateViewService } from './candidate.view.js';
import { DecisionRequester } from './decision.requester.js';
import { ApproverGuard } from './approver.guard.js';
import { InMemoryKnowledgeWriter, type KnowledgeWriter } from './knowledge.writer.js';
import { Materialiser } from './materialiser.js';

/** Resolvable proof the module is in the graph — `T2301` asks for it by name. */
export class LearningService {
  /** Hosted views, not an owned area (`FR-LRN-070`). */
  readonly hostedIn = Object.freeze(['decision-inbox', 'context'] as const);
  /** The eleven contract ports and what each absence does. */
  readonly ports = LEARNING_PORTS;
}

const hasDatabase = (): boolean => Boolean(process.env['DATABASE_URL']);

@Module({
  imports: [AgentsModule, AuditModule, ConnectorModule, ExecutionsModule, ProjectsModule, SteeringModule],
  controllers: [LearningController, LearningConnectorController],
  providers: [
    { provide: LearningService, useFactory: (): LearningService => new LearningService() },
    {
      provide: LEARNING_STORE,
      // DATABASE_URL decides, as it does for every durable store (T1178).
      useFactory: (): LearningStore =>
        hasDatabase() ? new PrismaLearningStore(prismaClient() as unknown as LearningPrismaClient) : new InMemoryLearningStore(),
    },
    {
      provide: LEARNING_PORTS_TOKEN,
      inject: [ExecutionRegistryFacade, ExecutionRegistrationService, ExecutionEventService, PrincipalRegistryService, AuditService, SteeringService, ProjectsService],
      useFactory: (
        facade: ExecutionRegistryFacade,
        registration: ExecutionRegistrationService,
        events: ExecutionEventService,
        registry: PrincipalRegistryService,
        audit: AuditService,
        steering: SteeringService,
        projects: ProjectsService,
      ): LearningPorts => {
        const ports: LearningPorts = refusingPorts();
        // The SecretScreen is pure code — EPIC-037's patterns — and needs no database.
        Object.assign(ports, {
          secrets: secretScreenPort(),
          policy: steeringPolicySource(steering),
          projects: projectsPort(projects),
          audit: auditPort(audit),
        });
        if (hasDatabase()) {
          const users = prismaClient().user as unknown as { findFirst(args: unknown): Promise<unknown> };
          Object.assign(ports, {
            executions: executionsPort({ facade, registration, events }),
            principals: principalsPort(registry, {
              isUser: async (workspaceId: string, userId: string) => (await users.findFirst({ where: { id: userId, workspaceId }, select: { id: true } })) !== null,
            }),
          });
        }
        // Unmerged — stay refusing until Phase 9 (R-048-20): decisions (EPIC-031),
        // evidence + attestations + reader access (EPIC-032), index (EPIC-038),
        // experts (EPIC-047).
        return ports;
      },
    },
    {
      provide: LearningPolicyReader,
      inject: [LEARNING_PORTS_TOKEN],
      // Reads `ports.policy` at call time, so a rebinding is seen.
      useFactory: (ports: LearningPorts): LearningPolicyReader => new LearningPolicyReader({ current: (ws) => ports.policy.current(ws) }),
    },
    {
      provide: KNOWLEDGE_WRITER,
      inject: [LEARNING_STORE, LEARNING_PORTS_TOKEN],
      useFactory: (store: LearningStore, ports: LearningPorts): KnowledgeWriter => {
        // Reads `ports.audit` at call time, so the audit binding is the live one.
        const audit: AuditPort = { record: (entry, tx) => ports.audit.record(entry, tx) };
        return hasDatabase()
          ? new PrismaKnowledgeWriter(prismaClient() as unknown as LearningPrismaClient, audit)
          : new InMemoryKnowledgeWriter(store as InMemoryLearningStore, audit);
      },
    },
    {
      // R-048-4 fence 1: the writer is injected here and nowhere else (T2332).
      provide: Materialiser,
      inject: [LEARNING_STORE, KNOWLEDGE_WRITER, LEARNING_PORTS_TOKEN, LearningPolicyReader],
      useFactory: (store: LearningStore, writer: KnowledgeWriter, ports: LearningPorts, policy: LearningPolicyReader): Materialiser =>
        new Materialiser({
          store,
          writer,
          ports,
          policy,
          guard: new ApproverGuard({ kindOf: (ws, id) => ports.principals.kindOf(ws, id) }),
        }),
    },
    {
      provide: DecisionRequester,
      inject: [LEARNING_STORE, LEARNING_PORTS_TOKEN, LearningPolicyReader, Materialiser],
      useFactory: (store: LearningStore, ports: LearningPorts, policy: LearningPolicyReader, materialiser: Materialiser): DecisionRequester =>
        new DecisionRequester({ store, ports, policy, applyResolution: (candidate, resolution) => materialiser.applyResolution(candidate.workspaceId, candidate.id, resolution) }),
    },
    {
      provide: SubmissionService,
      inject: [LEARNING_STORE, LEARNING_PORTS_TOKEN, LearningPolicyReader, DecisionRequester],
      useFactory: (store: LearningStore, ports: LearningPorts, policy: LearningPolicyReader, requester: DecisionRequester): SubmissionService =>
        // T2349: every recorded, non-provisional candidate asks EPIC-031 for a decision.
        new SubmissionService({ store, ports, policy, requestDecision: (candidate) => requester.request(candidate) }),
    },
    {
      provide: CandidateViewService,
      inject: [LEARNING_STORE, LEARNING_PORTS_TOKEN, DecisionRequester],
      useFactory: (store: LearningStore, ports: LearningPorts, requester: DecisionRequester): CandidateViewService =>
        new CandidateViewService({ reads: store, ports, eligibilityOf: (candidate) => requester.eligibility(candidate) }),
    },
  ],
  exports: [LearningService, LEARNING_STORE, LEARNING_PORTS_TOKEN, SubmissionService, CandidateViewService, Materialiser],
})
export class LearningModule {}
