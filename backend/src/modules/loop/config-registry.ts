/**
 * T944b — per-type configuration resolution. `FR-GEL-004`, `ADR-0018`.
 *
 * PC-1: framework-free.
 *
 * One method and one rule: **a workflow type resolves its own configuration, or
 * nothing.** No default, no first-registered fallback, no merge.
 *
 * `ADR-0018`: *"A shared engine must not collapse three governed surfaces into
 * one."* This class is where that is either true or not. The failure it prevents
 * is quiet — a `?? this.#first` would let an object of an unregistered type run
 * under whichever configuration happened to load first, and every per-type test
 * would still pass, because each type works fine on its own.
 */

import type { ResolvedLoopConfig } from './loop-config.loader.js';

export class UnknownWorkflowTypeError extends Error {
  constructor(readonly workflowType: string, known: readonly string[]) {
    super(
      `no loop configuration is registered for workflow type "${workflowType}" ` +
        `(FR-GEL-004) — registered: ${known.length > 0 ? known.join(', ') : 'none'}`,
    );
    this.name = 'UnknownWorkflowTypeError';
  }
}

export class LoopConfigRegistry {
  readonly #byType = new Map<string, ResolvedLoopConfig>();

  constructor(configs: readonly ResolvedLoopConfig[]) {
    for (const config of configs) {
      if (this.#byType.has(config.workflowType)) {
        // Two configurations for one type is the collapse ADR-0018 forbids,
        // arriving by accident rather than by design.
        throw new Error(`two loop configurations registered for "${config.workflowType}"`);
      }
      this.#byType.set(config.workflowType, config);
    }
  }

  get workflowTypes(): readonly string[] {
    return [...this.#byType.keys()];
  }

  /**
   * The only way to reach a configuration.
   *
   * Named `require` rather than `get` because there is no nullable variant to
   * reach for: a caller holding an object of type X either governs it under
   * type X's rules or does not govern it.
   */
  require(workflowType: string): ResolvedLoopConfig {
    const config = this.#byType.get(workflowType);
    if (!config) throw new UnknownWorkflowTypeError(workflowType, this.workflowTypes);
    return config;
  }
}
