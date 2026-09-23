/**
 * T1110 (EPIC-021 C2C reopening) — the module EPIC-021 never had.
 *
 * `X7`'s composition half. EPIC-021 closed with services, a schema and unit
 * tests, and **no module**: `backend/src/modules/reviews/` was imported by
 * nothing, so none of it ran. Its closure recorded the gap and assigned the
 * wiring to EPIC-014 F-11.2, which had no task for it.
 *
 * The providers here are **bound to real Prisma**, not defaulted to in-memory.
 * That is the difference between this and the seams in `loop.module.ts`: those
 * are unfilled by design and refuse at use; these are the production capability
 * itself, and an in-memory binding would leave `X7` open while looking closed.
 *
 * Only {@link GateProductionService} is exported. EPIC-030 consumes gate policy
 * through it and cannot reach the stores to re-derive a disposition of its own.
 */
import { Module } from '@nestjs/common';
import { GateConfigService, type GateStore } from './gate-config.service.js';
import {
  GateProductionService,
  type GateFinalOutcomeStore,
} from './gate-production.service.js';
import {
  PrismaGateFinalOutcomeStore,
  PrismaGateStore,
  type GateFinalOutcomeDelegate,
  type ReviewGateDelegate,
} from './gate.store.prisma.js';
import { prismaClient } from '../../persistence/prisma.js';

/** Where gate configuration is read and appended. */
export const GATE_STORE = Symbol('GATE_STORE');

/** Where authoritative, append-only gate decisions live. */
export const GATE_FINAL_OUTCOME_STORE = Symbol('GATE_FINAL_OUTCOME_STORE');

@Module({
  providers: [
    {
      provide: GATE_STORE,
      // Lazily reached: `prismaClient()` reads DATABASE_URL when constructed,
      // so it must not run while modules are merely being assembled.
      useFactory: (): GateStore =>
        new PrismaGateStore({
          create: (args) => prismaClient().reviewGate.create(args as never) as never,
          findMany: (args) => prismaClient().reviewGate.findMany(args as never) as never,
        } as ReviewGateDelegate),
    },
    {
      provide: GATE_FINAL_OUTCOME_STORE,
      useFactory: (): GateFinalOutcomeStore =>
        new PrismaGateFinalOutcomeStore({
          create: (args) =>
            prismaClient().gateFinalOutcome.create(args as never) as Promise<{ id: string }>,
          findMany: (args) => prismaClient().gateFinalOutcome.findMany(args as never) as never,
        } as GateFinalOutcomeDelegate),
    },
    {
      provide: GateConfigService,
      inject: [GATE_STORE],
      useFactory: (store: GateStore): GateConfigService => new GateConfigService(store),
    },
    {
      provide: GateProductionService,
      inject: [GATE_STORE, GATE_FINAL_OUTCOME_STORE],
      useFactory: (gates: GateStore, outcomes: GateFinalOutcomeStore): GateProductionService =>
        new GateProductionService(gates, outcomes),
    },
  ],
  exports: [GateConfigService, GateProductionService],
})
export class ReviewsModule {}
