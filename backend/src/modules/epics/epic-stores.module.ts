/**
 * EPIC-044 `T1557` — the Epic store, bound to Prisma under `DATABASE_URL` and
 * in-memory otherwise (`durable-stores.spec.ts`).
 *
 * A module of its own so that `ConnectorModule` (whose `pmi.project.context`
 * and `pmi.requirements.list` read the entity, `R-044-8`) and `EpicsModule`
 * (the screens and the board) can both reach the store without importing each
 * other — the `GovernanceStoresModule` pattern (`R-044-7`).
 */
import { Module } from '@nestjs/common';
import { prismaClient } from '../../persistence/prisma.js';
import { InMemoryEpicStore, PrismaEpicStore, type EpicDelegate, type EpicStore } from './epic.store.js';
import { EPIC_STORE } from './epics.tokens.js';

@Module({
  providers: [
    {
      provide: EPIC_STORE,
      useFactory: (): EpicStore => (process.env['DATABASE_URL'] ? new PrismaEpicStore(prismaClient().epic as unknown as EpicDelegate) : new InMemoryEpicStore()),
    },
  ],
  exports: [EPIC_STORE],
})
export class EpicStoresModule {}
