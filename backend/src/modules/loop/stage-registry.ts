/**
 * T942 — the stage handler registry. `R-030-5`, `FR-GEL-007`, `FR-GEL-062`.
 *
 * PC-1: framework-free.
 *
 * **There is no fallback and there will not be one.** Every other registry in
 * this repository defaults sensibly — an in-memory store, a null metric sink —
 * and that is correct for those, because a missing store still lets you read
 * nothing and a missing sink still lets you not measure. A missing `Decide`
 * handler is different in kind: the default would let an object advance past the
 * stage where a human was supposed to decide, and every test would stay green.
 *
 * The contract puts it in one line: *a no-op `Decide` handler is an
 * auto-approval wearing a placeholder's name.*
 */

import type { LoopStage, StageHandler } from '@pmi/loop-contract';

/** Raised when a stage has no handler. Never returns a substitute. */
export class UnhandledStageError extends Error {
  constructor(readonly stage: LoopStage) {
    super(
      `no StageHandler is registered for "${stage}" (FR-GEL-007, R-030-5) — ` +
        'a configuration naming this stage should not have loaded',
    );
    this.name = 'UnhandledStageError';
  }
}

export class StageRegistry {
  readonly #handlers = new Map<LoopStage, StageHandler>();

  constructor(handlers: readonly StageHandler[]) {
    for (const handler of handlers) {
      if (this.#handlers.has(handler.stage)) {
        // Two handlers for one stage makes "which one ran?" a question with no
        // answer, decided by module load order.
        throw new Error(`two StageHandlers registered for "${handler.stage}"`);
      }
      this.#handlers.set(handler.stage, handler);
    }
  }

  /**
   * Which stages can run. The loader reads this to refuse a configuration
   * naming a stage nothing handles — at load, before the workflow type exists.
   */
  get registeredStages(): readonly LoopStage[] {
    return [...this.#handlers.keys()];
  }

  handlerFor(stage: LoopStage): StageHandler {
    const handler = this.#handlers.get(stage);
    if (!handler) throw new UnhandledStageError(stage);
    return handler;
  }
}
