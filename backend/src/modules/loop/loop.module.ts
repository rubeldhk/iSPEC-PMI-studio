/**
 * T935, T945 — loop module wiring.
 *
 * Services stay framework-free (PC-1). The four **governance** seams — policy,
 * evidence, gates, audit — are **not registered here**: `EPIC-031`, `EPIC-032`,
 * `EPIC-021` and `EPIC-004` supply them by overriding the tokens at the
 * composition root, which is the platform-wide pattern `DecisionsModule` uses.
 *
 * **The store defaults to in-memory and the governance seams default to
 * nothing, and the asymmetry is the point.** Every other module here defaults
 * its store, and that is right: an in-memory store loses data, which is visible
 * and testable. A default `PolicyProvider` that permits is invisible — it looks
 * exactly like a policy that said yes — so `FR-GEL-062` requires its absence to
 * cause a refusal, and there is nothing bound for a caller to pick up by
 * accident.
 *
 * **`StageRegistry` is bound empty and that is deliberate.** `EPIC-031`–`035`
 * register the handlers for the stages their Rooms use. An empty registry means
 * the configuration loader refuses every file naming a stage nothing can run —
 * at composition, loudly, rather than at the first transition.
 */
import { Module } from '@nestjs/common';
import { LoopController } from './loop.controller.js';
import { LoopService } from './loop.service.js';
import { LoopConfigRegistry } from './config-registry.js';
import { StageRegistry } from './stage-registry.js';
import { InMemoryLoopStore, type LoopStore } from './loop.store.js';
import { buildConfigRegistry } from './workflow-files.js';
import { LOOP_CONFIG_SOURCE, LOOP_STAGE_HANDLERS, LOOP_STORE } from './loop.tokens.js';

@Module({
  controllers: [LoopController],
  providers: [
    {
      provide: LOOP_STAGE_HANDLERS,
      useFactory: (): StageRegistry => new StageRegistry([]),
    },
    {
      provide: LOOP_STORE,
      useFactory: (): LoopStore => new InMemoryLoopStore(),
    },
    {
      provide: LOOP_CONFIG_SOURCE,
      inject: [LOOP_STAGE_HANDLERS],
      useFactory: (stages: StageRegistry): LoopConfigRegistry =>
        // With no handlers registered, every workflow file naming a stage is
        // refused — so the registry is empty and `declareObject` refuses each
        // type by name. That is the honest state until a Room registers its
        // handlers, and it is why this is a try/catch rather than a crash: one
        // unfilled seam must not take the whole API down (FR-GEL-062).
        safeRegistry(stages),
    },
    {
      provide: LoopService,
      inject: [LOOP_STORE, LOOP_CONFIG_SOURCE],
      useFactory: (store: LoopStore, configs: LoopConfigRegistry): LoopService =>
        new LoopService(store, configs),
    },
  ],
  exports: [LoopService, LOOP_STORE, LOOP_CONFIG_SOURCE, LOOP_STAGE_HANDLERS],
})
export class LoopModule {}

/**
 * A registry of what loads, and nothing where nothing does.
 *
 * The alternative — letting a `LoopConfigError` escape composition — would make
 * an unregistered stage handler a boot failure for the entire application. The
 * refusal still happens; it happens at `declareObject`, where a caller can read
 * it, which is the shape `FR-GEL-062` asks for.
 */
function safeRegistry(stages: StageRegistry): LoopConfigRegistry {
  try {
    return buildConfigRegistry(stages.registeredStages);
  } catch {
    return new LoopConfigRegistry([]);
  }
}
