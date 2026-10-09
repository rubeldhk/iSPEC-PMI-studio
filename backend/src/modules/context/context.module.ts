/**
 * `T1223`, `T1243` (EPIC-038) — the Context module.
 *
 * Registered in `app.module.ts` in the commit that created it, which is the
 * whole point. `T1224` proves the wiring, and `DEF-005-001` is what a module
 * built, tested and never registered looks like: fifteen of fifteen tasks green
 * and the feature unreachable in the running application.
 *
 * This repository has now recorded that class **eight times**. The question
 * that finds it is *which capabilities have a caller*, not *which have a test*.
 *
 * ## An area, not a Room
 *
 * `R-038-11`, `FR-CTX-070`. The three Rooms exist because requirements, changes
 * and defects each move through states a person decides on — stages, gates,
 * authorities. A Context Package is assembled, used and inspected; there is no
 * decision in its life, so a workflow type would introduce stages nobody needs.
 *
 * `ContextService` declares an `area` and deliberately **no** `workflowType`.
 * `T1224` asserts both, because the absence is a design decision and an absence
 * nobody checks is one somebody adds later by analogy.
 *
 * ## One seam is bound to a refusal, and that is the honest state
 *
 * `EmbeddingPort` has **no owner anywhere in the programme** (`FR-CTX-013`). It
 * refuses rather than degrades, because a package ranked by a zero vector
 * would be **wrong** rather than smaller — and a wrong package is one nobody
 * can tell is wrong. `AccessPolicy` is `EPIC-024`'s and is bound (`T1258`).
 *
 * `GovernanceSeamUnboundError` carries a `503` and **names the seam**: a 503
 * saying nothing is the same defect with a better number.
 */
import { Module } from '@nestjs/common';
import { prismaClient } from '../../persistence/prisma.js';
import { AccessModule } from '../access/access.module.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { ExecutionRegistryFacade } from '../executions/execution-registry.facade.js';
import { AccessInheritanceService } from '../access/access-inheritance.service.js';
import { WorkspaceBoundaryService } from '../access/workspace-boundary.service.js';
import { NotFoundError } from '../../core/errors.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { RequirementsModule } from '../requirements/requirements.module.js';
import { RequirementsService } from '../requirements/requirements.service.js';
import { SpecificationsModule } from '../specifications/specifications.module.js';
import { SpecificationsReadService } from '../specifications/specifications-read.service.js';
import { governedSources } from './sources.adapter.js';
import type { SourceVersionReader } from './inspection.service.js';
import type { ArtifactSource } from './retrieval/index.service.js';
import { accessPolicyFromEpic024 } from './access.adapter.js';
import { InspectionService, type ExecutionRegistrationReader } from './inspection.service.js';
import { IndexService } from './retrieval/index.service.js';
import { SearchService } from './retrieval/search.service.js';
import { InMemoryVectorIndex, type VectorIndex } from './retrieval/vector.index.js';
import { PgVectorIndex, type PgVectorClient } from './retrieval/vector.index.pg.js';
import { AssemblyService, type AssemblyPorts } from './assembly.service.js';
import { ContextController } from './context.controller.js';
import { InMemoryContextStore, type ContextStore } from './context.store.js';
import { PrismaContextStore, type ContextPrismaClient } from './context.store.prisma.js';
import { CONTEXT_PORTS, CONTEXT_SOURCES, CONTEXT_STORE, CONTEXT_VECTOR_INDEX } from './context.tokens.js';

/** Resolvable proof the module is in the graph — `T1224` asks for it by name. */
export class ContextService {
  /**
   * The application area this module owns, per PMI-DOC-006 §4.1.
   *
   * Not a workflow type. See the header: a context package has no lifecycle,
   * and naming one here would be the first step toward stages nobody asked for.
   */
  readonly area = 'context';

  /** The five ports this area declares, and what each absence does. */
  readonly ports = CONTEXT_PORTS;
}

@Module({
  imports: [AccessModule, ExecutionsModule, ProjectsModule, RequirementsModule, SpecificationsModule],
  controllers: [ContextController],
  providers: [
    { provide: ContextService, useFactory: (): ContextService => new ContextService() },
    {
      provide: CONTEXT_STORE,
      // `T1178`'s lesson, applied in the commit that first needs it rather than
      // in a later remediation: `DATABASE_URL` decides, as it does for the
      // three Rooms. Unset in unit tests, so the in-memory store stays their
      // default and only theirs.
      useFactory: (): ContextStore =>
        process.env['DATABASE_URL']
          ? new PrismaContextStore(prismaClient() as unknown as ContextPrismaClient)
          : new InMemoryContextStore(),
    },
    {
      provide: CONTEXT_VECTOR_INDEX,
      // `DATABASE_URL` decides, as it does for the store: pgvector in the
      // running application, the exact in-memory twin in unit tests.
      useFactory: (): VectorIndex =>
        process.env['DATABASE_URL']
          ? new PgVectorIndex(prismaClient() as unknown as PgVectorClient)
          : new InMemoryVectorIndex(),
    },
    {
      provide: CONTEXT_SOURCES,
      /**
       * `T1810`, `T1812` — requirements and specifications, read through their
       * own modules' public services (`sources.adapter.ts`). Fills both
       * `SourceVersionReader` and `ArtifactSource`; other governed types answer
       * *unknown* and do not resolve.
       */
      useFactory: (
        requirements: RequirementsService,
        specifications: SpecificationsReadService,
        executions: ExecutionRegistryFacade,
      ): SourceVersionReader & ArtifactSource =>
        // `T1828`, `R-038-8` — execution history through EPIC-037's projections.
        governedSources({ requirements, specifications, executions }),
      inject: [RequirementsService, SpecificationsReadService, ExecutionRegistryFacade],
    },
    {
      provide: IndexService,
      /**
       * `T1276`, `T1278`, `T1812`. `ArtifactSource` reads requirements and
       * specifications; `EmbeddingPort` is still unowned, so `reindex` answers
       * `400` for a source that may not be indexed and `503` naming the seam for
       * one that may.
       */
      useFactory: (
        store: ContextStore,
        vectors: VectorIndex,
        sources: SourceVersionReader & ArtifactSource,
      ): IndexService => new IndexService(store, vectors, null, sources),
      inject: [CONTEXT_STORE, CONTEXT_VECTOR_INDEX, CONTEXT_SOURCES],
    },
    {
      provide: AssemblyService,
      /**
       * Bound with **the embedding seam refusing**, which is the honest state
       * rather than an oversight.
       *
       * `sourceClasses` is real and reads the store — it is this Epic's own
       * configuration and nobody else's to supply. `retrieval` names the gap
       * it refuses over, so a `503` sends somebody to the right place instead of
       * to the logs.
       */
      useFactory: (
        store: ContextStore,
        boundary: WorkspaceBoundaryService,
        readability: AccessInheritanceService,
        vectors: VectorIndex,
        registry: ExecutionRegistryFacade,
        sources: SourceVersionReader & ArtifactSource,
        projects: ProjectsService,
      ): AssemblyService => {
        const ports: AssemblyPorts = {
          // `T1279` — real ranking, over a provider nobody owns yet. Refuses
          // with the `EmbeddingPort` 503 until one is bound (`FR-CTX-013`).
          // `T1810` marks stale candidates through the governed sources.
          // `T1826` — and the sources authorised into this workspace, ranked in
          // their owners' partitions.
          retrieval: new SearchService(vectors, null, sources, {}, store),
          // `T1808`, `FR-CTX-050` — the project is asked of its own module; a
          // project another workspace holds is indistinguishable from none.
          projects: {
            async inWorkspace(workspaceId, projectId) {
              try {
                await projects.get(workspaceId, projectId);
                return true;
              } catch (error) {
                if (error instanceof NotFoundError) return false;
                throw error;
              }
            },
          },
          // `T1804`, `FR-CTX-036` — the retrieval limit, estimate and price are
          // the workspace's configuration; with none, assembly refuses.
          budgetPolicy: store,
          // `T1288`, `R-038-8` — EPIC-037's projections, never its event
          // stream. A projection's version is how far it has projected.
          executions: {
            async projectedVersion(workspaceId, executionId) {
              const snapshot = await registry.snapshot(workspaceId, executionId);
              return snapshot === null ? null : String(snapshot.projectedThroughSequence);
            },
          },
          // `FR-CTX-022` — no system in the programme supplies live state yet.
          // Degrades: a package that asks records it as unavailable, with why.
          liveState: null,
          // `FR-CTX-042` — EPIC-033 records baselines but offers no "status of
          // this source version" read, so every item is `undetermined` with a
          // reason naming it, never `current` by default (DEF-038-003).
          provenance: null,
          // `T1258`, `FR-CTX-054` — `EPIC-024` adjudicates; see `access.adapter.ts`.
          access: accessPolicyFromEpic024(boundary, readability),
          sourceClasses: {
            classify: (workspaceId, sourceType) => store.classifySource(workspaceId, sourceType),
          },
          /**
           * `FR-CTX-051`–`FR-CTX-053` — read from
           * `context_reusable_authorisations` (`T1260`). No row, no crossing:
           * the absence of a prohibition is not a permission.
           */
          authorisations: store,
        };
        return new AssemblyService(store, ports);
      },
      inject: [
        CONTEXT_STORE,
        WorkspaceBoundaryService,
        AccessInheritanceService,
        CONTEXT_VECTOR_INDEX,
        ExecutionRegistryFacade,
        CONTEXT_SOURCES,
        ProjectsService,
      ],
    },
    {
      provide: InspectionService,
      /**
       * `T1264`, `T1265` — read-only, and built with no assembler.
       *
       * `versions` reads requirements and specifications through their own
       * modules (`T1810`); any other type's drift note says `unknown` with a
       * reason rather than claiming `unchanged`.
       *
       * Registrations come from `EPIC-037`'s public facade. Its registration
       * records no consequentiality, so a registered execution is reported as
       * registered with consequentiality `undetermined` — `DEF-038-002`. This
       * Epic must not decide it (`FR-CTX-061`).
       */
      useFactory: (
        store: ContextStore,
        registry: ExecutionRegistryFacade,
        sources: SourceVersionReader & ArtifactSource,
      ): InspectionService => {
        const registrations: ExecutionRegistrationReader = {
          async registrationOf(workspaceId, executionId) {
            const snapshot = await registry.snapshot(workspaceId, executionId);
            return snapshot === null
              ? null
              : {
                  consequential: 'undetermined',
                  reason:
                    'EPIC-037 registers this execution but records no consequentiality, and ' +
                    'this Epic may not decide it (FR-CTX-061, DEF-038-002)',
                  // `T1816` — whether it ran is EPIC-037's projected fact.
                  lifecycleState: snapshot.lifecycleState,
                };
          },
        };
        return new InspectionService(store, sources, registrations);
      },
      inject: [CONTEXT_STORE, ExecutionRegistryFacade, CONTEXT_SOURCES],
    },
  ],
  exports: [ContextService, AssemblyService, InspectionService, IndexService, CONTEXT_STORE],
})
export class ContextModule {}
