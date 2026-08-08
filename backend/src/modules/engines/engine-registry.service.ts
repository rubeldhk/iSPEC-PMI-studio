/**
 * T034 + T139 — engine registry and capability validation.
 *
 * `backend/` never names a concrete engine (FR-017, ADR-0001). Adapters are
 * supplied at the composition root and arrive here as `SpecificationEngine`
 * instances behind the contract. The architecture test fails the build if that
 * stops being true.
 *
 * Framework-free (PC-1): the persistence port is narrow, so the whole registry
 * is testable without a database or an HTTP layer.
 */
import {
  MissingCapabilityError,
  PHASE_1_CAPABILITIES,
  assertPhase1Capabilities,
  type EngineDescriptor,
  type SpecificationEngine,
} from '@pmi/engine-contract';

/** What gets recorded so an operator can see which engines a deployment accepted. */
export interface EngineRegistrationRecord {
  name: string;
  version: string;
  capabilities: string[];
  isDefault: boolean;
}

export interface EngineRegistrationStore {
  record(registration: EngineRegistrationRecord): Promise<void>;
}

export class UnknownEngineError extends Error {
  readonly code = 'unknown_engine' as const;
  constructor(
    readonly requested: string,
    readonly registered: string[],
  ) {
    super(
      `No engine is registered under "${requested}". Registered: ` +
        `${registered.length > 0 ? registered.join(', ') : 'none'}.`,
    );
    this.name = 'UnknownEngineError';
  }
}

export class NoDefaultEngineError extends Error {
  readonly code = 'no_default_engine' as const;
  constructor() {
    super('No default engine has been registered.');
    this.name = 'NoDefaultEngineError';
  }
}

export interface RegisterOptions {
  isDefault?: boolean;
}

export class EngineRegistryService {
  private readonly engines = new Map<string, SpecificationEngine>();
  private defaultName: string | undefined;

  constructor(private readonly store?: EngineRegistrationStore) {}

  /**
   * FR-021 — refuse an adapter missing a Phase 1 capability, naming it.
   *
   * The refusal is a throw rather than a returned result: this is a wiring
   * defect at composition time, not an operational failure a user can act on.
   * Engine *operations* return failures; engine *registration* does not.
   */
  register(engine: SpecificationEngine, options: RegisterOptions = {}): void {
    assertPhase1Capabilities(engine.descriptor);

    const { name } = engine.descriptor;
    this.engines.set(name, engine);
    if (options.isDefault) this.defaultName = name;
  }

  /**
   * T139 — startup validation, all-or-nothing.
   *
   * If ANY adapter is incomplete the registry stays empty and startup fails.
   * Registering the valid subset would boot the platform into a configuration
   * nobody designed: the intended default might be the one that was refused,
   * and the first anyone would know is a generation running on the wrong
   * engine with FR-022 provenance recording it as intended.
   */
  registerAll(
    entries: readonly { engine: SpecificationEngine; isDefault?: boolean }[],
  ): void {
    const refusals: MissingCapabilityError[] = [];
    for (const entry of entries) {
      const missing = PHASE_1_CAPABILITIES.filter(
        (capability) => !entry.engine.descriptor.capabilities.includes(capability),
      );
      if (missing.length > 0) {
        refusals.push(new MissingCapabilityError(entry.engine.descriptor.name, [...missing]));
      }
    }

    if (refusals.length > 0) {
      throw new MissingCapabilityError(
        refusals.map((refusal) => refusal.engineName).join(', '),
        refusals.flatMap((refusal) => refusal.missing),
      );
    }

    for (const entry of entries) {
      this.register(entry.engine, entry.isDefault === true ? { isDefault: true } : {});
    }
  }

  /** Persist what was accepted, so a deployment's engine set is inspectable. */
  async recordRegistrations(): Promise<void> {
    if (!this.store) return;
    for (const [name, engine] of this.engines) {
      await this.store.record({
        name,
        version: engine.descriptor.version,
        capabilities: [...engine.descriptor.capabilities],
        isDefault: name === this.defaultName,
      });
    }
  }

  has(name: string): boolean {
    return this.engines.has(name);
  }

  get(name: string): SpecificationEngine {
    const engine = this.engines.get(name);
    if (!engine) throw new UnknownEngineError(name, [...this.engines.keys()]);
    return engine;
  }

  getDefault(): SpecificationEngine {
    if (!this.defaultName) throw new NoDefaultEngineError();
    return this.get(this.defaultName);
  }

  get defaultEngineName(): string | undefined {
    return this.defaultName;
  }

  listRegistered(): EngineDescriptor[] {
    return [...this.engines.values()].map((engine) => engine.descriptor);
  }
}
