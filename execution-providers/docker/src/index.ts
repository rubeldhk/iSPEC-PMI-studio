/**
 * The Docker execution provider — descriptor only.
 *
 * `T646a` implements `start()`/`stop()` against the Docker Engine HTTP API.
 * The descriptor is declared here because registration and policy validation
 * negotiate against it, and both are testable without a daemon.
 *
 * Native §4 names Docker the Phase 1 provider; `D-21` demoted it from
 * *abstraction* to *provider*, which is what this package existing at all
 * represents.
 */
import {
  executionFail,
  type ExecutionEnvironmentDescriptor,
  type ExecutionRequest,
  type ExecutionSession,
  type ProjectExecutionEnvironment,
} from '@pmi/execution-contract';

export const DOCKER_DESCRIPTOR: ExecutionEnvironmentDescriptor = {
  provider: 'docker',
  /** Persistent bindings are EPIC-029's; this provider refuses them. */
  supportedLifecycles: ['ephemeral'],
  supportsPersistentState: false,
  supportsNetworkPolicy: true,
  maxWallClockMs: 15 * 60 * 1000,
};

export class DockerExecutionEnvironment implements ProjectExecutionEnvironment {
  readonly descriptor: ExecutionEnvironmentDescriptor = DOCKER_DESCRIPTOR;

  async start(_request: ExecutionRequest): Promise<ExecutionSession> {
    const failure = executionFail<ExecutionSession>(
      'provider_unavailable',
      'The Docker provider is not implemented (EPIC-028 T646a).',
    );
    throw new Error(failure.ok ? '' : failure.failure.message);
  }

  async stop(_session: ExecutionSession): Promise<void> {
    // Idempotent by construction: nothing was started.
  }
}
