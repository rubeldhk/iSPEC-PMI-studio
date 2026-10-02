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
 * ## Two seams are bound to refusals, and that is the honest state
 *
 * `EmbeddingPort` has **no owner anywhere in the programme** (`FR-CTX-013`), and
 * `AccessPolicy` is `EPIC-024`'s, bound in `T1258`. Both refuse rather than
 * degrade, because a package ranked by a zero vector or filtered by nothing
 * would be **wrong** rather than smaller — and a wrong package is one nobody
 * can tell is wrong.
 *
 * `GovernanceSeamUnboundError` carries a `503` and **names the seam**: a 503
 * saying nothing is the same defect with a better number.
 */
import { Module } from '@nestjs/common';
import { GovernanceSeamUnboundError } from '../../core/errors.js';
import { prismaClient } from '../../persistence/prisma.js';
import { AssemblyService, type AssemblyPorts } from './assembly.service.js';
import { ContextController } from './context.controller.js';
import { InMemoryContextStore, type ContextStore } from './context.store.js';
import { PrismaContextStore, type ContextPrismaClient } from './context.store.prisma.js';
import { CONTEXT_PORTS, CONTEXT_STORE } from './context.tokens.js';

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
      provide: AssemblyService,
      /**
       * Bound with **two seams refusing**, which is the honest state rather
       * than an oversight.
       *
       * `sourceClasses` is real and reads the store — it is this Epic's own
       * configuration and nobody else's to supply. The other two name the Epic
       * that owes them, so a `503` sends somebody to the right place instead of
       * to the logs.
       */
      useFactory: (store: ContextStore): AssemblyService => {
        const ports: AssemblyPorts = {
          retrieval: {
            async search(): Promise<never> {
              throw new GovernanceSeamUnboundError(
                'no embedding provider is bound (EmbeddingPort, FR-CTX-013), so the index ' +
                  'cannot be built or queried. This capability has no owner anywhere in the ' +
                  'programme — see EPIC-038 R-038-1 and the closing report. Assembly refuses ' +
                  'rather than returning an unranked package, which would be a different ' +
                  'thing rather than a degraded one (FR-CTX-012)',
              );
            },
          },
          access: {
            async mayRead(): Promise<never> {
              throw new GovernanceSeamUnboundError(
                'no access adjudicator is bound (AccessPolicy, FR-CTX-054); EPIC-024 supplies ' +
                  'it and T1258 binds it. Assembly refuses rather than including every ' +
                  'candidate, which is the leak FR-CTX-050 exists to prevent',
              );
            },
          },
          sourceClasses: {
            classify: (workspaceId, sourceType) => store.classifySource(workspaceId, sourceType),
          },
          /**
           * `FR-CTX-053` — no authorisations are readable yet, and the honest
           * default is **none**.
           *
           * `T1260` binds this to `context_reusable_authorisations`. Until
           * then, own-workspace material is unaffected and every crossing is
           * refused — which is the direction to be wrong in, and the direction
           * `FR-CTX-053` names: the absence of a prohibition is not a
           * permission, and neither is the absence of a reader.
           */
          authorisations: {
            async find(): Promise<null> {
              return null;
            },
          },
        };
        return new AssemblyService(store, ports);
      },
      inject: [CONTEXT_STORE],
    },
  ],
  exports: [ContextService, AssemblyService, CONTEXT_STORE],
})
export class ContextModule {}
