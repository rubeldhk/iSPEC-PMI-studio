/**
 * T574 — execution composition root.
 *
 * THE ONLY place a concrete execution provider is named — the exact role
 * `engine-composition.ts` plays for engines and `agent-composition.ts` for
 * agents. `backend/` never imports a provider (FR-AGT-009, Native §4);
 * providers are supplied here, in the worker.
 *
 * This file existing at all is what decision `D-21` looks like in the tree.
 * Conflict `C-20` caught `T646` about to hard-code Docker as *the* execution
 * substrate inside the engine adapter; Native §4 forbids business logic
 * depending directly on Docker. Docker is now a provider behind a port, and
 * `D-31` makes the second provider near-certainly Kubernetes — a sibling
 * registration rather than a rewrite.
 *
 * Capability validation is NOT reimplemented here. `T648` found `FR-021`'s
 * engine check written twice and both copies agreeing, which is why no
 * behavioural test caught it.
 */
import type {
  ExecutionEnvironmentDescriptor,
  ProjectExecutionEnvironment,
} from '@pmi/execution-contract';
import { DockerExecutionEnvironment, unixSocketDockerApi } from '@pmi/execution-provider-docker';

export class DuplicateExecutionProviderError extends Error {
  constructor(readonly provider: string) {
    super(
      `An execution provider is already registered as "${provider}". Two providers claiming one ` +
        `identifier makes resolution non-deterministic, and the loser is silent.`,
    );
    this.name = 'DuplicateExecutionProviderError';
  }
}

export class NoDefaultExecutionProviderError extends Error {
  constructor() {
    super('No default execution provider has been registered.');
    this.name = 'NoDefaultExecutionProviderError';
  }
}

export class ExecutionProviderRegistry {
  private readonly providers = new Map<string, ProjectExecutionEnvironment>();
  private defaultProvider?: string;

  register(
    environment: ProjectExecutionEnvironment,
    options: { isDefault?: boolean } = {},
  ): void {
    const key = environment.descriptor.provider;
    if (this.providers.has(key)) throw new DuplicateExecutionProviderError(key);
    this.providers.set(key, environment);
    if (options.isDefault) this.defaultProvider = key;
  }

  /**
   * A provider *preference* is never load-bearing.
   *
   * An orchestrator that fails when a preferred provider is absent has made the
   * preference a requirement — the same rule the agent registry follows.
   */
  resolve(preference?: string): ProjectExecutionEnvironment {
    if (preference) {
      const preferred = this.providers.get(preference);
      if (preferred) return preferred;
    }
    if (!this.defaultProvider) throw new NoDefaultExecutionProviderError();
    const fallback = this.providers.get(this.defaultProvider);
    if (!fallback) throw new NoDefaultExecutionProviderError();
    return fallback;
  }

  list(): ExecutionEnvironmentDescriptor[] {
    return [...this.providers.values()].map((p) => p.descriptor);
  }
}

/**
 * Build the registry.
 *
 * Docker is the Phase 1 default, which is what Native §4 asks for — and it is a
 * *default*, not an assumption. The daemon client is injectable so a test can
 * compose the whole chain without one; only `T646b` needs a real daemon.
 */
export function composeExecutionRegistry(
  environment: ProjectExecutionEnvironment = new DockerExecutionEnvironment(unixSocketDockerApi()),
): ExecutionProviderRegistry {
  const registry = new ExecutionProviderRegistry();
  registry.register(environment, { isDefault: true });
  return registry;
}
