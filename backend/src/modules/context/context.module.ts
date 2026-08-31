/**
 * `T1223` (EPIC-038) — the Context module.
 *
 * Registered in `app.module.ts` in the commit that creates it, which is the
 * whole point. `T1224` proves the wiring, and `DEF-005-001` is what a module
 * built, tested and never registered looks like: fifteen of fifteen tasks
 * green and the feature unreachable in the running application.
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
 * `ContextService` therefore declares an `area` and deliberately **no**
 * `workflowType`. `T1224` asserts both, because the absence is a design
 * decision and an absence nobody checks is one somebody adds later by analogy.
 *
 * ## What is bound, and what is not
 *
 * Nothing yet. The five ports (`context.tokens.ts`) arrive in `T1234`, and
 * three of them refuse when absent — `EmbeddingPort` has no owner anywhere in
 * the programme, so assembly will refuse in every deployment until one exists.
 * That is the honest state and it is recorded rather than papered over with a
 * default that would silently produce meaningless rankings.
 */
import { Module } from '@nestjs/common';

/** Resolvable proof the module is in the graph — `T1224` asks for it by name. */
export class ContextService {
  /**
   * The application area this module owns, per PMI-DOC-006 §4.1.
   *
   * Not a workflow type. See the header: a context package has no lifecycle,
   * and naming one here would be the first step toward stages nobody asked for.
   */
  readonly area = 'context';
}

@Module({
  providers: [{ provide: ContextService, useFactory: (): ContextService => new ContextService() }],
  exports: [ContextService],
})
export class ContextModule {}
