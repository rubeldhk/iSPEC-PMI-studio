/**
 * `T1902` (EPIC-047) — the Engineering Experts module.
 *
 * Registered in `app.module.ts` in the change that created it; `T1901` proves
 * the wiring. `DEF-005-001` is what a module built, tested and registered
 * nowhere looks like, and this repository has recorded that class eight times.
 *
 * ## An area, not a Room
 *
 * `FR-EXP-070`. Experts are presented as a view-only registry in their own
 * Delivery area. Contract approval runs through `EPIC-031`'s Decision Inbox, so
 * no workflow type is declared here — `T1901` asserts the absence.
 *
 * ## What is bound, and what refuses
 *
 * `ActorAccess` is `EPIC-024`'s, and bound for real. Phase 9 (`T1978`, `T1980`,
 * `T1982`) binds three more to their owners: `ContractApprovals` to `EPIC-031`'s
 * decision engine, `EvidenceContracts` to `EPIC-032`'s catalog and
 * `ContextAssembler` to `EPIC-038`'s assembly. Phase 15 (`DEF-047-001`) binds
 * `ExpertExecutions` to `EPIC-037`'s registry under an agent principal minted
 * per Expert and sponsor, and `ExpertGateways` to a runner over `EPIC-028`'s
 * seam — which refuses, naming `DEF-047-002`, until a composition root supplies
 * `EXPERT_AGENT_RUNTIME`.
 */
import { Module } from '@nestjs/common';
import { AssemblyService } from '../context/assembly.service.js';
import { ContextModule } from '../context/context.module.js';
import type { DecisionRepository } from '../decision/decision.repository.js';
import { DecisionModule } from '../decision/decision.module.js';
import { DECISION_REPOSITORY } from '../decision/decision.tokens.js';
import { DecisionEngine } from '../decision/evaluator.js';
import type { ContractCatalog } from '../evidence/contract.loader.js';
import { EvidenceModule } from '../evidence/evidence.module.js';
import { EVIDENCE_CATALOG } from '../evidence/evidence.tokens.js';
import { prismaClient } from '../../persistence/prisma.js';
import { AccessInheritanceService } from '../access/access-inheritance.service.js';
import { AccessModule } from '../access/access.module.js';
import { PrincipalDelegationService } from '../access/principal-delegation.service.js';
import { AgentsModule } from '../agents/agents.module.js';
import { IdentitySnapshotService, PrincipalRegistryService } from '../agents/principal-registry.service.js';
import { ExecutionRegistrationService } from '../executions/execution-registration.service.js';
import { ExecutionRegistryFacade } from '../executions/execution-registry.facade.js';
import { ExecutionTimelineService } from '../executions/execution-timeline.service.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { expertExecutions } from './adapters/executions.adapter.js';
import { InMemoryExpertIdentityStore, PrismaExpertIdentityStore, type IdentityStoreClient } from './adapters/identity.store.js';
import { EXPERT_AGENT_RUNTIME, expertGateways, type AgentRuntime } from './adapters/runners.adapter.js';
import { assemblyContext } from './adapters/context.adapter.js';
import { decisionApprovals } from './adapters/decisions.adapter.js';
import { catalogEvidence } from './adapters/evidence.adapter.js';
import { AssignmentService } from './assignment.service.js';
import { Authoring } from './authoring.js';
import { DispatchService } from './dispatch.service.js';
import { ExpertsController } from './experts.controller.js';
import { InMemoryExpertsStore, type ExpertsStore } from './experts.store.js';
import { EXPERT_PROVENANCE, expertProvenance, type ExpertProvenance } from './provenance.js';
import { PrismaExpertsStore, type ExpertsPrismaClient } from './experts.store.prisma.js';
import { RegistryService } from './registry.service.js';
import { SessionsService } from './sessions.service.js';
import {
  ACTOR_ACCESS,
  EXPERT_PORTS,
  EXPERTS_STORE,
  TASK_LOOKUP,
  refusingPorts,
  type ActorAccess,
  type ExpertPorts,
  type TaskLookup,
} from './experts.tokens.js';

/** Resolvable proof the module is in the graph — `T1901` asks for it by name. */
export class ExpertsService {
  /** PMI-DOC-006 §4, Delivery group. Not a workflow type: see the header. */
  readonly area = 'engineering-experts';
}

@Module({
  imports: [AccessModule, AgentsModule, DecisionModule, EvidenceModule, ContextModule, ExecutionsModule],
  controllers: [ExpertsController],
  providers: [
    { provide: ExpertsService, useFactory: (): ExpertsService => new ExpertsService() },
    {
      provide: EXPERTS_STORE,
      // `DATABASE_URL` decides, as it does for every sibling module. Unset in
      // unit tests, so the in-memory store stays their default and only theirs.
      useFactory: (): ExpertsStore =>
        process.env['DATABASE_URL']
          ? new PrismaExpertsStore(prismaClient() as unknown as ExpertsPrismaClient)
          : new InMemoryExpertsStore(),
    },
    {
      provide: ACTOR_ACCESS,
      inject: [AccessInheritanceService],
      useFactory: (inheritance: AccessInheritanceService): ActorAccess => ({
        mayRead: (ws, userId, artifact) => inheritance.effectivelyReadable(ws, userId, artifact),
        mayEdit: (ws, userId, artifact) => inheritance.effectivelyEditable(ws, userId, artifact),
      }),
    },
    {
      provide: Authoring,
      inject: [ACTOR_ACCESS],
      useFactory: (access: ActorAccess): Authoring => new Authoring(access),
    },
    // R-047-13, Phase 9 — EPIC-031/032/038 bound to their adapters; gateways and
    // executions still refuse (R-047-2, DEF-047-001).
    // T2566 — no agent runtime is composed into the API process (DEF-047-002):
    // `backend/` may name no adapter or provider. A composition root that can
    // overrides this token; until one does, ExpertGateways refuses naming why.
    { provide: EXPERT_AGENT_RUNTIME, useValue: null },
    {
      provide: EXPERT_PORTS,
      inject: [
        DecisionEngine,
        DECISION_REPOSITORY,
        EVIDENCE_CATALOG,
        AssemblyService,
        ACTOR_ACCESS,
        PrincipalRegistryService,
        IdentitySnapshotService,
        PrincipalDelegationService,
        ExecutionRegistryFacade,
        ExecutionRegistrationService,
        ExecutionTimelineService,
        EXPERT_AGENT_RUNTIME,
      ],
      useFactory: (
        engine: DecisionEngine,
        decisions: DecisionRepository,
        catalog: ContractCatalog,
        assembly: AssemblyService,
        access: ActorAccess,
        principals: PrincipalRegistryService,
        snapshots: IdentitySnapshotService,
        delegations: PrincipalDelegationService,
        registry: ExecutionRegistryFacade,
        registration: ExecutionRegistrationService,
        timeline: ExecutionTimelineService,
        runtime: AgentRuntime | null,
      ): ExpertPorts => ({
        ...refusingPorts(),
        approvals: decisionApprovals(engine, decisions),
        evidence: catalogEvidence(catalog),
        context: assemblyContext(assembly),
        // T2564, DEF-047-001 — registered under the Expert's own agent principal.
        executions: expertExecutions(
          {
            access,
            principals,
            snapshots,
            delegations,
            registry,
            timeline: {
              projectIdOf: (ws, id) => registration.projectIdOf(ws, id),
              events: (ws, projectId, id) => timeline.events(ws, projectId, id),
            },
          },
          process.env['DATABASE_URL']
            ? new PrismaExpertIdentityStore(prismaClient() as unknown as IdentityStoreClient)
            : new InMemoryExpertIdentityStore(),
        ),
        gateways: expertGateways(runtime),
      }),
    },
    {
      provide: RegistryService,
      inject: [EXPERTS_STORE, Authoring, EXPERT_PORTS],
      useFactory: (store: ExpertsStore, authoring: Authoring, ports: ExpertPorts): RegistryService =>
        // Getters, so a port rebound in the holder is the one the next call reads.
        new RegistryService(store, {
          authoring,
          get approvals() {
            return ports.approvals;
          },
          get evidence() {
            return ports.evidence;
          },
        }),
    },
    {
      provide: DispatchService,
      inject: [EXPERTS_STORE, ACTOR_ACCESS, EXPERT_PORTS],
      useFactory: (store: ExpertsStore, access: ActorAccess, ports: ExpertPorts): DispatchService =>
        // The holder itself: DispatchService reads `ports.<name>` on every call.
        new DispatchService(store, { access, ports }),
    },
    {
      provide: SessionsService,
      inject: [EXPERTS_STORE, EXPERT_PORTS],
      useFactory: (store: ExpertsStore, ports: ExpertPorts): SessionsService => new SessionsService(store, ports),
    },
    {
      provide: TASK_LOOKUP,
      // `FR-EXP-056` — EPIC-046's table, asked only whether a task exists. With
      // no database (unit composition) there are no tasks to find.
      useFactory: (): TaskLookup => ({
        async exists(workspaceId, taskId) {
          if (!process.env['DATABASE_URL']) return false;
          const client = prismaClient() as unknown as { task: { findFirst(args: unknown): Promise<unknown> } };
          return (await client.task.findFirst({ where: { id: taskId, workspaceId }, select: { id: true } })) !== null;
        },
      }),
    },
    // `A-047-2`, `FR-EXP-064` — for EPIC-048's `ExpertProvenance` port.
    {
      provide: EXPERT_PROVENANCE,
      inject: [EXPERTS_STORE],
      useFactory: (store: ExpertsStore): ExpertProvenance => expertProvenance(store),
    },
    {
      provide: AssignmentService,
      inject: [EXPERTS_STORE, Authoring, EXPERT_PORTS, TASK_LOOKUP],
      useFactory: (store: ExpertsStore, authoring: Authoring, ports: ExpertPorts, tasks: TaskLookup): AssignmentService =>
        new AssignmentService(store, {
          authoring,
          tasks,
          get approvals() {
            return ports.approvals;
          },
        }),
    },
  ],
  exports: [ExpertsService, EXPERT_PORTS, EXPERT_PROVENANCE],
})
export class ExpertsModule {}
