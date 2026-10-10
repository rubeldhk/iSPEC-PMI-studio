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
 * The `main` owners are bound to their services here; an owner not yet on
 * `main` (today only `decisions`, `EPIC-031`'s A-031-1, PR #8) stays **refusing**. Route tests rebind a member of that object to
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
import { AccessModule } from '../access/access.module.js';
import { AccessInheritanceService } from '../access/access-inheritance.service.js';
import { AgentsModule } from '../agents/agents.module.js';
import { PrincipalRegistryService } from '../agents/principal-registry.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ConnectorModule } from '../connector/connector.module.js';
import { ContextModule } from '../context/context.module.js';
import { CONTEXT_KNOWLEDGE, type KnowledgeSupplyBinding } from '../context/context.tokens.js';
import { IndexService } from '../context/retrieval/index.service.js';
import { EvidenceModule } from '../evidence/evidence.module.js';
import { EvidenceService } from '../evidence/evidence.service.js';
import { AccessControlEvidencePolicy } from '../evidence/access.adapter.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { ExpertsModule } from '../experts/experts.module.js';
import { EXPERT_PROVENANCE, type ExpertProvenance } from '../experts/provenance.js';
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
import { attestationsAdapter } from './adapters/attestations.adapter.js';
import { evidenceReadsAdapter, readerAccessAdapter } from './adapters/evidence.adapter.js';
import { expertsAdapter } from './adapters/experts.adapter.js';
import { bindKnowledgeIntoContext, knowledgeIndexAdapter } from './adapters/context.adapter.js';
import { secretScreenPort } from './secret.screen.js';
import { SubmissionService } from './submission.service.js';
import { CandidateViewService } from './candidate.view.js';
import { DecisionRequester } from './decision.requester.js';
import { ApproverGuard } from './approver.guard.js';
import { InMemoryKnowledgeWriter, type KnowledgeWriter } from './knowledge.writer.js';
import { Materialiser } from './materialiser.js';
import { approvalAttestation } from './attestation.js';
import { RetrievabilityService } from './retrievability.js';
import { LearningJobs } from './learning.jobs.js';
import { LearningSweeps } from './learning.sweeps.js';
import { ReviewService } from './review.service.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeGate, KnowledgeReader } from './supply.js';

/** The provider that fills `CONTEXT_KNOWLEDGE` — instantiated with the module (T2399). */
const CONTEXT_KNOWLEDGE_BOUND = Symbol('LEARNING_CONTEXT_KNOWLEDGE_BOUND');

/** Resolvable proof the module is in the graph — `T2301` asks for it by name. */
export class LearningService {
  /** Hosted views, not an owned area (`FR-LRN-070`). */
  readonly hostedIn = Object.freeze(['decision-inbox', 'context'] as const);
  /** The eleven contract ports and what each absence does. */
  readonly ports = LEARNING_PORTS;
}

const hasDatabase = (): boolean => Boolean(process.env['DATABASE_URL']);

@Module({
  imports: [AccessModule, AgentsModule, AuditModule, ConnectorModule, ContextModule, EvidenceModule, ExecutionsModule, ExpertsModule, ProjectsModule, SteeringModule],
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
      inject: [ExecutionRegistryFacade, ExecutionRegistrationService, ExecutionEventService, PrincipalRegistryService, AuditService, SteeringService, ProjectsService, LEARNING_STORE, EvidenceService, AccessInheritanceService, EXPERT_PROVENANCE, IndexService],
      useFactory: (
        facade: ExecutionRegistryFacade,
        registration: ExecutionRegistrationService,
        events: ExecutionEventService,
        registry: PrincipalRegistryService,
        audit: AuditService,
        steering: SteeringService,
        projects: ProjectsService,
        store: LearningStore,
        evidence: EvidenceService,
        readability: AccessInheritanceService,
        provenance: ExpertProvenance,
        index: IndexService,
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
        // Phase 9 — owners now on main (R-048-20). Each owner picks its own
        // persistence by DATABASE_URL, so these bind with or without one.
        Object.assign(ports, {
          // T2395 — EPIC-032's resolve (A-032-1), and its own access rule over EPIC-024.
          evidence: evidenceReadsAdapter(evidence),
          readerAccess: readerAccessAdapter(new AccessControlEvidencePolicy(readability)),
          // T2401 — EPIC-047's provenance read (A-047-2); governed-knowledge is A-047-1.
          experts: expertsAdapter(provenance),
          // T2389 — EPIC-032's contribute, the platform-source branch.
          attestations: attestationsAdapter({
            evidence,
            projectOf: async (workspaceId: string, candidateId: string) => (await store.candidate(workspaceId, candidateId))?.projectId ?? null,
          }),
          // T2399 — EPIC-038's reindex. Its refusal (no embedding provider,
          // FR-CTX-013) is recorded not-yet-retrievable with its own reason.
          index: knowledgeIndexAdapter(index),
        });
        // Still refusing: decisions (EPIC-031 — A-031-1 and A-031-2 are in open
        // PR #8, not on main).
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
      provide: RetrievabilityService,
      inject: [LEARNING_STORE, LEARNING_PORTS_TOKEN],
      useFactory: (store: LearningStore, ports: LearningPorts): RetrievabilityService =>
        new RetrievabilityService({ store, ports: { index: { reindex: (input) => ports.index.reindex(input) } } }),
    },
    {
      // R-048-4 fence 1: the writer is injected here and nowhere else (T2332).
      provide: Materialiser,
      inject: [LEARNING_STORE, KNOWLEDGE_WRITER, LEARNING_PORTS_TOKEN, LearningPolicyReader, RetrievabilityService],
      useFactory: (store: LearningStore, writer: KnowledgeWriter, ports: LearningPorts, policy: LearningPolicyReader, retrievability: RetrievabilityService): Materialiser =>
        new Materialiser({
          store,
          writer,
          ports,
          policy,
          guard: new ApproverGuard({ kindOf: (ws, id) => ports.principals.kindOf(ws, id) }),
          // After the version commits: approval/v1 (T2357). A failure flags, never rolls back.
          // and the reindex, recorded as it is (T2377).
          after: [
            approvalAttestation({ store, ports: { attestations: { contribute: (input) => ports.attestations.contribute(input) } } }),
            retrievability.afterMaterialise(),
          ],
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
      provide: LearningJobs,
      inject: [LEARNING_STORE, LEARNING_PORTS_TOKEN, Materialiser, DecisionRequester, RetrievabilityService],
      useFactory: (store: LearningStore, ports: LearningPorts, materialiser: Materialiser, requester: DecisionRequester, retrievability: RetrievabilityService): LearningJobs =>
        new LearningJobs({ store, ports, materialiser, requester, retrievability, policy: new LearningPolicyReader({ current: (ws) => ports.policy.current(ws) }) }),
    },
    {
      provide: ReviewService,
      inject: [LEARNING_STORE, LEARNING_PORTS_TOKEN, LearningPolicyReader, Materialiser],
      useFactory: (store: LearningStore, ports: LearningPorts, policy: LearningPolicyReader, materialiser: Materialiser): ReviewService =>
        new ReviewService({ store, ports, policy, materialiser }),
    },
    {
      // Off unless PMI_LEARNING_SWEEPS=on (learning.sweeps.ts).
      provide: LearningSweeps,
      inject: [LearningJobs],
      useFactory: (jobs: LearningJobs): LearningSweeps => new LearningSweeps(jobs),
    },
    {
      // What EPIC-038 reads for source type knowledge-entry (T2333) — bound into
      // its sources adapter through CONTEXT_KNOWLEDGE (T2399, below).
      provide: KnowledgeReader,
      inject: [LEARNING_STORE],
      useFactory: (store: LearningStore): KnowledgeReader => new KnowledgeReader(store),
    },
    {
      // The admission port EPIC-038 consults (T2373; bound into AssemblyPorts through CONTEXT_KNOWLEDGE by T2399).
      provide: KnowledgeGate,
      inject: [LEARNING_STORE, LEARNING_PORTS_TOKEN],
      useFactory: (store: LearningStore, ports: LearningPorts): KnowledgeGate =>
        new KnowledgeGate({ reads: store, ports, policy: new LearningPolicyReader({ current: (ws) => ports.policy.current(ws) }) }),
    },
    {
      // T2399, A-038-2 — fill EPIC-038's knowledge slot with the reader and
      // admission above. EPIC-038 reads it at call time; unfilled, it serves
      // and admits no knowledge entry.
      provide: CONTEXT_KNOWLEDGE_BOUND,
      inject: [CONTEXT_KNOWLEDGE, KnowledgeReader, KnowledgeGate],
      useFactory: (binding: KnowledgeSupplyBinding, reader: KnowledgeReader, admission: KnowledgeGate): KnowledgeSupplyBinding =>
        bindKnowledgeIntoContext(binding, { reader, admission }),
    },
    {
      provide: KnowledgeService,
      inject: [LEARNING_STORE],
      useFactory: (store: LearningStore): KnowledgeService => new KnowledgeService({ reads: store }),
    },
    {
      provide: CandidateViewService,
      inject: [LEARNING_STORE, LEARNING_PORTS_TOKEN, DecisionRequester],
      useFactory: (store: LearningStore, ports: LearningPorts, requester: DecisionRequester): CandidateViewService =>
        new CandidateViewService({ reads: store, ports, eligibilityOf: (candidate) => requester.eligibility(candidate) }),
    },
  ],
  exports: [LearningService, LEARNING_STORE, LEARNING_PORTS_TOKEN, SubmissionService, CandidateViewService, Materialiser, LearningJobs, KnowledgeReader, KnowledgeGate],
})
export class LearningModule {}
