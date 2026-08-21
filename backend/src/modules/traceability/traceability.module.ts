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
import { REQUIREMENT_STORE, RequirementsModule } from '../requirements/requirements.module.js';
import type { RequirementStore } from '../requirements/requirements.service.js';
import { LookupArtifactIdSource } from './coverage.service.js';
import { LookupRequirementStatusSource } from './retired-flag.js';
import { CoverageService, type ArtifactIdSource } from './coverage.service.js';
import {
  InMemoryTraceabilityLinkStore,
  LinkWriterService,
  type TraceabilityLinkStore,
} from './link-writer.service.js';
import type { RequirementStatusSource } from './retired-flag.js';
import {
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
/**
 * T862 — retained for the SPECIFICATION half only.
 *
 * `specificationsWithoutTasks` counts specifications no task traces back to,
 * and tasks arrive with EPIC-012. Until they do, every specification is
 * trivially without tasks, so listing them would report the whole project as a
 * coverage gap. Empty is the truthful answer to a question that cannot yet be
 * asked; the REQUIREMENT half is wired below, because that half is answerable
 * today and SC-010 is about it.
 */
export class EmptyArtifactIdSource implements ArtifactIdSource {
  async listRequirementIds(): Promise<string[]> {
    return [];
  }

  async listSpecificationIds(): Promise<string[]> {
    return [];
  }
}

@Module({
  imports: [RequirementsModule],
  controllers: [TraceabilityController],
  providers: [
    {
      provide: TRACEABILITY_LINK_STORE,
      useFactory: (): TraceabilityLinkStore => new InMemoryTraceabilityLinkStore(),
    },
    {
      // T862 — the requirement half reads the live register, so SC-010's
      // "single view" lists real uncovered requirements instead of nothing.
      // The specification half stays empty until EPIC-012 (see above).
      provide: ARTIFACT_ID_SOURCE,
      inject: [REQUIREMENT_STORE],
      useFactory: (requirements: RequirementStore): ArtifactIdSource =>
        new LookupArtifactIdSource(
          {
            listIdsForProject: async (workspaceId, projectId) =>
              (
                await requirements.list(workspaceId, projectId, {
                  sortBy: 'createdAt',
                  sortDir: 'asc',
                })
              ).map((r) => r.id),
          },
          { listIdsForProject: async (): Promise<string[]> => [] },
        ),
    },
    {
      // T860 — reads the live register. It previously answered `active` for
      // every id, which made US7 scenario 4 unreachable in the composed
      // application however well T127 passed in isolation.
      provide: REQUIREMENT_STATUS_SOURCE,
      inject: [REQUIREMENT_STORE],
      useFactory: (requirements: RequirementStore): RequirementStatusSource =>
        new LookupRequirementStatusSource(requirements),
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
