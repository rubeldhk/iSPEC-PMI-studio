/**
 * `T2302` (EPIC-048) — the Learning module.
 *
 * Registered in `app.module.ts` in the commit that created it. `T2301` proves the
 * wiring: `DEF-005-001` is what a module built, tested and registered nowhere
 * looks like.
 *
 * ## No workflow type, no area
 *
 * `FR-LRN-070`: candidates are reviewed in `EPIC-031`'s Decision Inbox and
 * knowledge is browsed inside `EPIC-038`'s Context area. This module declares
 * neither an area nor a workflow type; `T2301` and `T2382` assert the absence.
 */
import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller.js';

/** Resolvable proof the module is in the graph — `T2301` asks for it by name. */
export class LearningService {
  /** Hosted views, not an owned area (`FR-LRN-070`). */
  readonly hostedIn = Object.freeze(['decision-inbox', 'context'] as const);
}

@Module({
  controllers: [LearningController],
  providers: [{ provide: LearningService, useFactory: (): LearningService => new LearningService() }],
  exports: [LearningService],
})
export class LearningModule {}
