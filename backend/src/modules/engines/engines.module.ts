/**
 * T462 — engine module.
 *
 * Convergence found the registry and resolver fully built, fully tested, and
 * **unreachable**: nothing outside their own directory constructed them, so the
 * running API had no engine layer at all. This is the wiring.
 *
 * The services stay framework-free (PC-1) — no `@Injectable()`, no decorators,
 * no Nest import in a `.service.ts` file. They are plain classes wired here
 * with factory providers, which is why the architecture test can assert that
 * services never import an HTTP type while this file legitimately does.
 *
 * Note what is absent: any import of `engine-adapters/*`. Concrete engines are
 * supplied at the WORKER's composition root (FR-017, ADR-0001). The registry
 * this module provides starts EMPTY on the API side, which is correct — the API
 * resolves and records engines, it never runs them.
 */
import { Logger, Module } from '@nestjs/common';
import { EngineRegistryService } from './engine-registry.service.js';
import { loadRegisteredEngines } from './registered-engines.js';
import { prismaClient } from '../../persistence/prisma.js';
import { EnginesController } from './engines.controller.js';
import {
  EngineResolverService,
  type ProjectEngineSelectionPort,
} from './engine-resolver.service.js';

/** Injection token for the per-project selection lookup. */
export const PROJECT_ENGINE_SELECTION = Symbol('PROJECT_ENGINE_SELECTION');

/**
 * Every project inherits the default engine.
 *
 * This is FR-019's *default* behaviour, not a placeholder that fakes a feature:
 * a project with no selection is supposed to inherit. Storing a selection is
 * EPIC-006's, because the Project stub must not grow before it owns it — so
 * this implementation is replaced there rather than extended here.
 */
export class InheritDefaultEngineSelection implements ProjectEngineSelectionPort {
  async findEngineNameForProject(): Promise<string | null> {
    return null;
  }
}

@Module({
  // T140 (EPIC-013) — the one runtime surface: read-only listing. Registration
  // stays composition-time; selection stays on PATCH /projects/{id} (EPIC-006).
  controllers: [EnginesController],
  providers: [
    {
      provide: EngineRegistryService,
      // EPIC-041 T1321 (FR-LPW-042) — descriptor-only engines from what the
      // worker recorded, when a database is configured. The API resolves and
      // records engines and never runs one; a DescriptorOnlyEngine refuses to.
      useFactory: async (): Promise<EngineRegistryService> => {
        const registry = new EngineRegistryService();
        if (process.env['DATABASE_URL']) {
          // 2026-09-19 — the load must not decide whether the application
          // composes. With the database unreachable at boot this `await`
          // threw inside composition, Nest's `abortOnError` default exited the
          // process, and `composition.spec.ts` (T832) — whose premise is that
          // composing the graph opens no connection — died as a Vitest worker
          // exit that failed CI's unit step. A registry that could not load is
          // the pre-EPIC-041 state: empty, and every submission refuses
          // `engine_unavailable` by name. The warning says why, once.
          try {
            await loadRegisteredEngines(registry, prismaClient().engineRegistration);
          } catch (err) {
            new Logger('EnginesModule').warn(
              `Registered engines could not be loaded at boot; the registry starts empty and submissions will refuse engine_unavailable until the database is reachable and the API restarts. ${err instanceof Error ? err.name : 'error'}`,
            );
          }
        }
        return registry;
      },
    },
    {
      provide: PROJECT_ENGINE_SELECTION,
      useFactory: (): ProjectEngineSelectionPort => new InheritDefaultEngineSelection(),
    },
    {
      provide: EngineResolverService,
      inject: [EngineRegistryService, PROJECT_ENGINE_SELECTION],
      useFactory: (
        registry: EngineRegistryService,
        selections: ProjectEngineSelectionPort,
      ): EngineResolverService => new EngineResolverService(registry, selections),
    },
  ],
  exports: [EngineRegistryService, EngineResolverService, PROJECT_ENGINE_SELECTION],
})
export class EnginesModule {}
