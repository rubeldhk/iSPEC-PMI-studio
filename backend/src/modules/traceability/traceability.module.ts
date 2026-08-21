/**
 * T130–T133 — traceability module wiring.
 *
 * Services stay framework-free (PC-1); plain classes wired with factory
 * providers. The link store defaults to in-memory (the `JOB_STORE` posture);
 * the Prisma-backed store is supplied by overriding `TRACEABILITY_LINK_STORE`
 * at the composition root. The artifact-id source defaults to EMPTY — a
 * coverage report over artifacts nobody wired reads as zero requirements,
 * which is visible, not silently wrong.
 */
import { Module } from '@nestjs/common';
import { CoverageService, type ArtifactIdSource } from './coverage.service.js';
import {
  InMemoryTraceabilityLinkStore,
  LinkWriterService,
  type TraceabilityLinkStore,
} from './link-writer.service.js';
import type { RequirementStatusSource } from './retired-flag.js';
import {
  AllActiveRequirementStatusSource,
  REQUIREMENT_STATUS_SOURCE,
  TraceabilityController,
} from './traceability.controller.js';
import { TraceabilityService } from './traceability.service.js';
import { ChainTraversalService } from './chain-traversal.service.js';
import { ChainGapService } from './chain-gap.service.js';

export { REQUIREMENT_STATUS_SOURCE } from './traceability.controller.js';

export const TRACEABILITY_LINK_STORE = Symbol('TRACEABILITY_LINK_STORE');
export const ARTIFACT_ID_SOURCE = Symbol('ARTIFACT_ID_SOURCE');

/** Replaced at the composition root with project/requirement-backed lookups. */
export class EmptyArtifactIdSource implements ArtifactIdSource {
  async listRequirementIds(): Promise<string[]> {
    return [];
  }

  async listSpecificationIds(): Promise<string[]> {
    return [];
  }
}

@Module({
  controllers: [TraceabilityController],
  providers: [
    {
      provide: TRACEABILITY_LINK_STORE,
      useFactory: (): TraceabilityLinkStore => new InMemoryTraceabilityLinkStore(),
    },
    { provide: ARTIFACT_ID_SOURCE, useFactory: (): ArtifactIdSource => new EmptyArtifactIdSource() },
    {
      // Replaced at the composition root with the requirements store. Until
      // then everything reads active — visible, and named here on purpose.
      provide: REQUIREMENT_STATUS_SOURCE,
      useFactory: (): RequirementStatusSource => new AllActiveRequirementStatusSource(),
    },
    {
      provide: LinkWriterService,
      inject: [TRACEABILITY_LINK_STORE],
      useFactory: (store: TraceabilityLinkStore): LinkWriterService => new LinkWriterService(store),
    },
    {
      provide: TraceabilityService,
      inject: [TRACEABILITY_LINK_STORE],
      useFactory: (store: TraceabilityLinkStore): TraceabilityService =>
        new TraceabilityService(store),
    },
    {
      provide: CoverageService,
      inject: [TRACEABILITY_LINK_STORE, ARTIFACT_ID_SOURCE],
      useFactory: (store: TraceabilityLinkStore, artifacts: ArtifactIdSource): CoverageService =>
        new CoverageService(store, artifacts),
    },
    {
      // EPIC-022 T304/T306 — the chain reads the same graph the writer writes.
      provide: ChainTraversalService,
      inject: [TRACEABILITY_LINK_STORE],
      useFactory: (store: TraceabilityLinkStore): ChainTraversalService =>
        new ChainTraversalService(store),
    },
    {
      provide: ChainGapService,
      inject: [TRACEABILITY_LINK_STORE],
      useFactory: (store: TraceabilityLinkStore): ChainGapService => new ChainGapService(store),
    },
  ],
  exports: [
    LinkWriterService,
    TraceabilityService,
    CoverageService,
    ChainTraversalService,
    ChainGapService,
    TRACEABILITY_LINK_STORE,
    ARTIFACT_ID_SOURCE,
  ],
})
export class TraceabilityModule {}
