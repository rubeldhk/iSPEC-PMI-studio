/**
 * T935 — loop module wiring.
 *
 * Services stay framework-free (PC-1). The four provider seams — policy,
 * evidence, gates, audit — are **not registered here**: `EPIC-031`, `EPIC-032`,
 * `EPIC-021` and `EPIC-004` supply them by overriding the tokens at the
 * composition root, which is the platform-wide pattern `DecisionsModule` uses
 * for its stores.
 *
 * **Nothing is defaulted.** No no-op `StageHandler`, no permissive
 * `PolicyProvider`, no in-memory `AuditSink`. Every other module in this
 * repository defaults its store to an in-memory implementation and that is right
 * for a store; it is wrong here. `FR-GEL-062` requires an absent policy provider
 * to cause a refusal, and a default that permits would be indistinguishable, at
 * every call site, from a policy that said yes.
 *
 * So the tokens are declared in `loop.tokens.ts` and left unbound. Resolution
 * failure surfaces where a transition needs the seam — as a named refusal
 * (`FR-GEL-014`), not as a silent pass.
 */
import { Module } from '@nestjs/common';
import { LoopController } from './loop.controller.js';
import { LoopService } from './loop.service.js';

@Module({
  controllers: [LoopController],
  providers: [{ provide: LoopService, useFactory: (): LoopService => new LoopService() }],
  exports: [LoopService],
})
export class LoopModule {}
