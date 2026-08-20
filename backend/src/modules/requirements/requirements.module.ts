/**
 * T066–T070 — requirements module wiring.
 *
 * Services stay framework-free (PC-1); plain classes wired with factory
 * providers. Stores default to in-memory (the `JOB_STORE` posture): the API
 * boots without a database, and a deployment that wants persistence overrides
 * `REQUIREMENT_STORE` / `REQUIREMENT_VERSION_STORE` with the Prisma-backed
 * stores at the composition root.
 */
import { Module } from '@nestjs/common';
import { RequirementRetireService } from './requirement-retire.service.js';
import {
  InMemoryRequirementVersionStore,
  RequirementVersionService,
  type RequirementVersionStore,
} from './requirement-version.service.js';
import { RequirementsController } from './requirements.controller.js';
import {
  InMemoryRequirementStore,
  RequirementsService,
  type RequirementStore,
} from './requirements.service.js';

export const REQUIREMENT_STORE = Symbol('REQUIREMENT_STORE');
export const REQUIREMENT_VERSION_STORE = Symbol('REQUIREMENT_VERSION_STORE');

@Module({
  controllers: [RequirementsController],
  providers: [
    {
      provide: REQUIREMENT_STORE,
      useFactory: (): RequirementStore => new InMemoryRequirementStore(),
    },
    {
      provide: REQUIREMENT_VERSION_STORE,
      useFactory: (): RequirementVersionStore => new InMemoryRequirementVersionStore(),
    },
    {
      provide: RequirementVersionService,
      inject: [REQUIREMENT_VERSION_STORE],
      useFactory: (store: RequirementVersionStore): RequirementVersionService =>
        new RequirementVersionService(store),
    },
    {
      provide: RequirementsService,
      inject: [REQUIREMENT_STORE, RequirementVersionService],
      useFactory: (store: RequirementStore, history: RequirementVersionService): RequirementsService =>
        new RequirementsService(store, history),
    },
    {
      provide: RequirementRetireService,
      inject: [REQUIREMENT_STORE],
      useFactory: (store: RequirementStore): RequirementRetireService =>
        new RequirementRetireService(store),
    },
  ],
  exports: [
    RequirementsService,
    RequirementVersionService,
    RequirementRetireService,
    REQUIREMENT_STORE,
    REQUIREMENT_VERSION_STORE,
  ],
})
export class RequirementsModule {}
