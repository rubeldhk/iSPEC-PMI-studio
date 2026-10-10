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
 * `ActorAccess` is `EPIC-024`'s, on `main`, and bound for real. The four ports
 * whose owners are open pull requests — or, for gateways, nobody yet — are
 * bound **refusing** (`R-047-13`), each naming itself in its `503`. Phase 9
 * replaces them when `EPIC-031`, `EPIC-032` and `EPIC-038` merge.
 */
import { Module } from '@nestjs/common';
import { prismaClient } from '../../persistence/prisma.js';
import { AccessInheritanceService } from '../access/access-inheritance.service.js';
import { AccessModule } from '../access/access.module.js';
import { AssignmentService } from './assignment.service.js';
import { Authoring } from './authoring.js';
import { DispatchService } from './dispatch.service.js';
import { ExpertsController } from './experts.controller.js';
import { InMemoryExpertsStore, type ExpertsStore } from './experts.store.js';
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
  imports: [AccessModule],
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
    // R-047-13 — bound refusing; Phase 9 binds EPIC-031/032/038's adapters.
    { provide: EXPERT_PORTS, useFactory: (): ExpertPorts => refusingPorts() },
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
  exports: [ExpertsService, EXPERT_PORTS],
})
export class ExpertsModule {}
