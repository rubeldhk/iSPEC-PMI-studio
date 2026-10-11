/**
 * `T2595` (EPIC-047) — the agent runtime an Expert run executes in, composed
 * where it may be named. `DEF-047-002`, option A; `ADR-0030` (amended).
 *
 * `backend/src` may name no agent adapter, execution provider or model. This
 * package may, and does — and only here. It hands the result to
 * `@pmi/backend/api`, which binds `ExpertGateways` to it.
 *
 * ## What is composed
 *
 * - **The fixture agent**, always, as the worker composes it. It runs only
 *   under a contract that names its model, `fixture-1`.
 * - **One agent gateway per model in `PMI_EXPERT_MODELS`**, each declaring that
 *   model under its own name. Expert dispatch selects a gateway by the model a
 *   contract names (`R-047-2`, `FR-EXP-017`), so a model nobody listed is a
 *   model no Expert can be dispatched to — a refusal naming the model, never a
 *   silent substitution.
 * - **The Docker execution environment**, the worker's provider. Where the
 *   process cannot reach a Docker daemon — the compose `app` container mounts
 *   no socket — a run fails naming the provider and why; nothing degrades.
 *
 * ## The session a run starts
 *
 * Built per run, so the sandbox carries that run's correlation id (`PC-3`):
 * the engine image (or `PMI_EXPERT_IMAGE`), the sandbox environment — the AI
 * credential and the correlation id, exhaustively, by the engine adapter's own
 * builder — the generation egress profile and the engine's resource limits. No
 * credential refuses the run, by that same builder, before a session starts.
 */
import type { AgentGateway } from '@pmi/agent-contract';
import { ClaudeAgent } from '@pmi/agent-adapter-claude';
import { FixtureAgent } from '@pmi/agent-adapter-fixture';
import type { AgentRuntime, SessionTemplate } from '@pmi/backend/api';
import { buildSandboxEnvironment, DEFAULT_ENGINE_IMAGE, DEFAULT_RESOURCE_LIMITS } from '@pmi/engine-adapter-speckit';
import { GENERATION_EGRESS_PROFILE, type ProjectExecutionEnvironment } from '@pmi/execution-contract';
import { DockerExecutionEnvironment, unixSocketDockerApi } from '@pmi/execution-provider-docker';

/** The configuration the launcher reads. Everything else stays out of the sandbox. */
export interface LauncherEnv {
  readonly PMI_EXPERT_MODELS?: string | undefined;
  readonly PMI_EXPERT_IMAGE?: string | undefined;
  readonly AI_PROVIDER_TOKEN?: string | undefined;
}

/** `PMI_EXPERT_MODELS` — comma-separated, trimmed, deduplicated, blanks ignored. */
export function expertModels(raw: string | undefined): string[] {
  const seen = new Set<string>();
  for (const part of (raw ?? '').split(',')) {
    const model = part.trim();
    if (model !== '') seen.add(model);
  }
  return [...seen];
}

export function composeExpertRuntime(
  env: LauncherEnv = process.env,
  deps: { readonly environment?: ProjectExecutionEnvironment } = {},
): AgentRuntime {
  const gateways: AgentGateway[] = [
    new FixtureAgent(),
    ...expertModels(env.PMI_EXPERT_MODELS).map(
      (model) => new ClaudeAgent({ descriptor: { name: `agent:${model}`, model } }),
    ),
  ];
  const environment = deps.environment ?? new DockerExecutionEnvironment(unixSocketDockerApi());
  const image = env.PMI_EXPERT_IMAGE?.trim() || DEFAULT_ENGINE_IMAGE;
  const token = env.AI_PROVIDER_TOKEN ?? '';

  return {
    gateways,
    environment,
    session: ({ correlationId }): SessionTemplate => ({
      lifecycle: 'ephemeral',
      image,
      env: buildSandboxEnvironment({ correlationId, aiProviderToken: token }),
      workspace: { kind: 'ephemeral', scratchPath: '/workspace' },
      egressProfile: GENERATION_EGRESS_PROFILE,
      credentials: [],
      resourceLimits: { ...DEFAULT_RESOURCE_LIMITS },
    }),
  };
}
