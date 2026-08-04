/**
 * T162 — correlation across the sandbox boundary.
 *
 * The asymmetry is deliberate (PC-3, ADR-0002):
 *
 *   IN   the correlation id, as an environment variable. Costs nothing and
 *        requires no change to the sandbox security contract.
 *
 *   OUT  nothing. The container emits no telemetry, because doing so would
 *        require widening the egress allow-list — which currently permits the
 *        AI provider endpoint and nothing else. The WORKER records the job's
 *        spans and metrics on the container's behalf, from outside.
 *
 * This file is the whole boundary. Keep it that way.
 */

export const SANDBOX_CORRELATION_ENV = 'PMI_CORRELATION_ID';

const VALID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SandboxEnvironmentInput {
  correlationId: string;
  /** The ONLY credential the agent receives, for the one endpoint it may reach. */
  aiProviderToken: string;
}

/**
 * Build the complete environment for a sandbox container.
 *
 * Exhaustive by design: whatever is not returned here does not exist inside the
 * container. No database URL, no queue URL, no session secret, no telemetry
 * collector.
 */
export function buildSandboxEnvironment(input: SandboxEnvironmentInput): Record<string, string> {
  if (!VALID.test(input.correlationId)) {
    throw new Error(
      'Refusing to start a sandbox without a valid correlation id — the run would be untraceable (PC-3).',
    );
  }
  if (!input.aiProviderToken) {
    throw new Error('Refusing to start a sandbox without an AI provider credential.');
  }

  return {
    [SANDBOX_CORRELATION_ENV]: input.correlationId,
    AI_PROVIDER_TOKEN: input.aiProviderToken,
  };
}
