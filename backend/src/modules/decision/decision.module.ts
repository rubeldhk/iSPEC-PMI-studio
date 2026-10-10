/**
 * `T737`, `T728b` — the decision module. Registered in `app.module.ts`
 * (`T738`), the wiring `decision-reachability.spec.ts` proves.
 *
 * `decision/` is singular on purpose: `decisions/` is `EPIC-016`'s ADR store.
 *
 * ## The four ports, bound
 *
 * - `SteeringSource` → `EPIC-019`'s `SteeringService`, through
 *   `steering.adapter.ts` (`R-031-1`).
 * - `AuditSink` → `EPIC-004`'s `AuditService` (`adapters.ts`).
 * - `GateProvider` → **unbound**. `EPIC-021`'s gates are evaluated per review
 *   session and expose no "evaluate this gate for this action" call; a binding
 *   would be a guess at semantics nobody declared. Unbound, every required gate
 *   resolves to `violation` — the declared, fail-closed behaviour. `DEF-031-004`.
 * - `EvidenceContractSource` → **unbound** here: evidence gates arrive through
 *   the `GateProvider` once it exists, and `EPIC-032` is a separate branch.
 */
import { Module } from '@nestjs/common';
import type { AuditSink, GateProvider, SteeringSource } from '@pmi/decision-contract';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { SteeringModule } from '../steering/steering.module.js';
import { SteeringService } from '../steering/steering.service.js';
import { prismaClient } from '../../persistence/prisma.js';
import { AuditServiceSink, RepositoryPolicySource } from './adapters.js';
import { DecisionController } from './decision.controller.js';
import {
  InMemoryDecisionRepository,
  PrismaDecisionRepository,
  type DecisionRepository,
} from './decision.repository.js';
import { DecisionService } from './decision.service.js';
import {
  DECISION_AUDIT_SINK,
  DECISION_GATE_PROVIDER,
  DECISION_POLICY_SOURCE,
  DECISION_REPOSITORY,
  DECISION_STEERING_SOURCE,
} from './decision.tokens.js';
import { DecisionEngine } from './evaluator.js';
import type { PolicySource } from './policy.loader.js';
import { SteeringRulesetSource } from './steering.adapter.js';

@Module({
  imports: [AuditModule, SteeringModule],
  controllers: [DecisionController],
  providers: [
    {
      provide: DECISION_REPOSITORY,
      useFactory: (): DecisionRepository =>
        process.env['DATABASE_URL'] ? new PrismaDecisionRepository(prismaClient()) : new InMemoryDecisionRepository(),
    },
    {
      provide: DECISION_STEERING_SOURCE,
      inject: [SteeringService],
      useFactory: (steering: SteeringService): SteeringSource => new SteeringRulesetSource(steering),
    },
    {
      provide: DECISION_AUDIT_SINK,
      inject: [AuditService],
      useFactory: (audit: AuditService): AuditSink => new AuditServiceSink(audit),
    },
    { provide: DECISION_GATE_PROVIDER, useFactory: (): GateProvider | null => null },
    {
      provide: DECISION_POLICY_SOURCE,
      inject: [DECISION_REPOSITORY],
      useFactory: (repository: DecisionRepository): PolicySource => new RepositoryPolicySource(repository),
    },
    {
      provide: DecisionEngine,
      inject: [DECISION_STEERING_SOURCE, DECISION_POLICY_SOURCE, DECISION_GATE_PROVIDER, DECISION_AUDIT_SINK, DECISION_REPOSITORY],
      useFactory: (
        steering: SteeringSource,
        policies: PolicySource,
        gates: GateProvider | null,
        audit: AuditSink,
        repository: DecisionRepository,
      ) => new DecisionEngine({ steering, policies, gates, audit, repository }),
    },
    {
      provide: DecisionService,
      inject: [DecisionEngine, DECISION_REPOSITORY, DECISION_POLICY_SOURCE],
      useFactory: (engine: DecisionEngine, repository: DecisionRepository, policies: PolicySource) =>
        new DecisionService(engine, repository, policies),
    },
  ],
  // EPIC-047 T1978 — DECISION_REPOSITORY is exported so a consumer that holds a
  // decision id can read its resolution (`resolutionOf`); EPIC-031 offers no callback.
  exports: [DecisionEngine, DecisionService, DECISION_REPOSITORY],
})
export class DecisionModule {}
