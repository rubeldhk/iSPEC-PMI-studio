/**
 * T143a/T143b — decisions module wiring.
 *
 * Services stay framework-free (PC-1). Stores default to in-memory; the
 * Prisma-backed stores are supplied by overriding the tokens at the
 * composition root — the platform-wide seam.
 */
import { Module } from '@nestjs/common';
import { DecisionsController } from './decisions.controller.js';
import {
  DecisionsService,
  InMemoryAdrSpecificationLinkStore,
  InMemoryAdrStore,
  type AdrSpecificationLinkStore,
  type AdrStore,
} from './decisions.service.js';

export const ADR_STORE = Symbol('ADR_STORE');
export const ADR_SPECIFICATION_LINK_STORE = Symbol('ADR_SPECIFICATION_LINK_STORE');

@Module({
  controllers: [DecisionsController],
  providers: [
    { provide: ADR_STORE, useFactory: (): AdrStore => new InMemoryAdrStore() },
    {
      provide: ADR_SPECIFICATION_LINK_STORE,
      useFactory: (): AdrSpecificationLinkStore => new InMemoryAdrSpecificationLinkStore(),
    },
    {
      provide: DecisionsService,
      inject: [ADR_STORE, ADR_SPECIFICATION_LINK_STORE],
      useFactory: (store: AdrStore, links: AdrSpecificationLinkStore): DecisionsService =>
        new DecisionsService(store, links),
    },
  ],
  exports: [DecisionsService, ADR_STORE, ADR_SPECIFICATION_LINK_STORE],
})
export class DecisionsModule {}
