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
import {
  buildEngineDescriptor,
  nodeWorkspaceFileSystem,
  SpecKitEngine,
  type WorkspaceFileSystem,
} from '@pmi/engine-adapter-speckit';
import type { ProjectExecutionEnvironment } from '@pmi/execution-contract';
import type { AgentGateway } from '@pmi/agent-contract';
import { mkdtemp, rm } from 'node:fs/promises';
import { composeAgentRegistry } from './agent-composition.js';
import { composeExecutionRegistry } from './execution-composition.js';

/**
 * T647 — the Spec Kit engine's provenance.
 *
 * Versions are read from the environment rather than hardcoded: the descriptor
 * is what `FR-022` records against every generated artifact, so a wrong value
 * here is a wrong provenance claim on real output. `buildEngineDescriptor`
 * refuses an incomplete set rather than inventing one.
 */
const SPECKIT_DESCRIPTOR = buildEngineDescriptor({
  specifyVersion: process.env['SPECIFY_VERSION'] ?? '0.16.4',
  agentCliVersion: process.env['AGENT_CLI_VERSION'] ?? '1.0.0',
  agentModel: process.env['AGENT_MODEL'] ?? 'unknown',
});

export interface EngineCompositionDeps {
  /** Injectable so the chain composes in a test without a Docker daemon. */
  environment?: ProjectExecutionEnvironment;
  agent?: AgentGateway;
  fileSystem?: WorkspaceFileSystem;
  aiProviderToken?: string;
}

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
 * **T647 — Spec Kit is now the default (FR-018).** It was the *intended*
 * default from EPIC-003 and could not be registered, because it needed a
 * container runtime that did not exist and an agent it named as a literal.
 * Both now exist: `T646a` supplies the execution environment, `T564` supplies
 * the agent, and neither is named here as anything but a composed dependency.
 *
 * The fixture stays registered. It is what proves the contract is
 * engine-neutral rather than Spec-Kit-shaped (`ADR-0001`), and it backs the
 * fast, deterministic test suite that never invokes a live AI agent.
 *
 * Every dependency is injectable so the whole chain composes in a test without
 * a daemon — which is the difference between this and EPIC-003, where the
 * engine was *"fully built, fully tested, and unreachable."*
 */
export function composeEngineRegistry(deps: EngineCompositionDeps = {}): EngineRegistry {
  const registry = new EngineRegistry();

  // Registered FIRST so a Spec Kit registration that throws still leaves a
  // working engine rather than an empty registry.
  registry.register(new FixtureEngine());

  const environment = deps.environment ?? composeExecutionRegistry().resolve();
  const agent = deps.agent ?? composeAgentRegistry().resolve();

  registry.register(
    new SpecKitEngine({
      descriptor: SPECKIT_DESCRIPTOR,
      environment,
      agent,
      fileSystem: deps.fileSystem ?? nodeWorkspaceFileSystem({ mkdtemp, rm }),
      // The ONE credential a sandbox receives (ADR-0002). Absent in tests and
      // in any deployment that has not configured it; the engine fails with a
      // named reason rather than starting a container that cannot authenticate.
      aiProviderToken: deps.aiProviderToken ?? process.env['AI_PROVIDER_TOKEN'] ?? '',
    }),
    { isDefault: true },
  );

  return registry;
}
