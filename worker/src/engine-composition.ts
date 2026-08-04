/**
 * T035a — engine composition root.
 *
 * THE ONLY place concrete engines are named. `backend/` never imports an
 * adapter (FR-017, ADR-0001); adapters are supplied here, in the worker, so the
 * API holds no reference to a concrete engine.
 *
 * Registration refuses an adapter missing a Phase 1 capability, naming it
 * (FR-021).
 */
import {
  assertPhase1Capabilities,
  type EngineDescriptor,
  type SpecificationEngine,
} from '@pmi/engine-contract';
import { FixtureEngine } from '@pmi/engine-adapter-fixture';

export class EngineRegistry {
  private readonly engines = new Map<string, SpecificationEngine>();
  private defaultName?: string;

  register(engine: SpecificationEngine, options: { isDefault?: boolean } = {}): void {
    assertPhase1Capabilities(engine.descriptor); // FR-021
    this.engines.set(engine.descriptor.name, engine);
    if (options.isDefault) this.defaultName = engine.descriptor.name;
  }

  resolve(name?: string): SpecificationEngine {
    const key = name ?? this.defaultName;
    if (!key) throw new Error('No default engine has been registered.');
    const engine = this.engines.get(key);
    if (!engine) throw new Error(`No engine registered under "${key}".`);
    return engine;
  }

  list(): EngineDescriptor[] {
    return [...this.engines.values()].map((e) => e.descriptor);
  }
}

/**
 * Build the registry.
 *
 * The Spec Kit adapter is the intended default (FR-018) and is registered here
 * by **EPIC-003**, which builds it. Until then the fixture is the only
 * conformant engine — which is exactly the sequencing F-08.4 calls for: prove
 * the contract before building the sandbox.
 */
export function composeEngineRegistry(): EngineRegistry {
  const registry = new EngineRegistry();
  registry.register(new FixtureEngine(), { isDefault: true });
  return registry;
}
