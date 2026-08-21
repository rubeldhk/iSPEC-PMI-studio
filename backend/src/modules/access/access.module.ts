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
import { AccessEnforcementService, InMemoryAttemptStore, type AttemptStore } from './access-enforcement.service.js';
import { AccessEvaluationService } from './access-evaluation.service.js';
import { AccessGrantService, InMemoryGrantStore } from './access-grant.service.js';
import { AccessInheritanceService, InMemoryDerivationGraph, type DerivationGraph } from './access-inheritance.service.js';
import { AccessSnapshotService } from './access-snapshot.service.js';

export const ACCESS_GRANT_STORE = Symbol('ACCESS_GRANT_STORE');
export const ACCESS_ATTEMPT_STORE = Symbol('ACCESS_ATTEMPT_STORE');
export const DERIVATION_GRAPH = Symbol('DERIVATION_GRAPH');

@Module({
  controllers: [AccessController],
  providers: [
    { provide: ACCESS_GRANT_STORE, useFactory: (): InMemoryGrantStore => new InMemoryGrantStore() },
    { provide: ACCESS_ATTEMPT_STORE, useFactory: (): AttemptStore => new InMemoryAttemptStore() },
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
      provide: AccessEnforcementService,
      inject: [AccessInheritanceService, ACCESS_ATTEMPT_STORE],
      useFactory: (
        inheritance: AccessInheritanceService,
        attempts: AttemptStore,
      ): AccessEnforcementService => new AccessEnforcementService(inheritance, attempts),
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
    ACCESS_GRANT_STORE,
    ACCESS_ATTEMPT_STORE,
    DERIVATION_GRAPH,
  ],
})
export class AccessModule {}
