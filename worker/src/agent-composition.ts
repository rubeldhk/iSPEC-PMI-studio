/**
 * T562, T569 — agent composition root.
 *
 * THE ONLY place concrete agents are named — the exact role
 * `engine-composition.ts` plays for engines. `backend/` never imports an agent
 * adapter (FR-AGT-004, Native §3); adapters are supplied here, in the worker, so
 * the API holds no reference to a concrete provider.
 *
 * Capability validation is NOT reimplemented here. `T648` found `FR-021`'s
 * engine check written twice — once in the contract, once open-coded in a
 * registry — and both agreed, which is why no behavioural test caught it. This
 * registry delegates to `assertAgentCapabilities` for the same reason.
 */
import {
  assertAgentCapabilities,
  type AgentCapability,
  type AgentDescriptor,
  type AgentGateway,
} from '@pmi/agent-contract';
import { FixtureAgent } from '@pmi/agent-adapter-fixture';
import { ClaudeAgent } from '@pmi/agent-adapter-claude';

export class DuplicateAgentError extends Error {
  constructor(readonly agentName: string) {
    super(
      `An agent is already registered as "${agentName}". Two adapters claiming one identifier ` +
        `makes resolution non-deterministic, and the loser is silent.`,
    );
    this.name = 'DuplicateAgentError';
  }
}

export class NoDefaultAgentError extends Error {
  constructor() {
    super('No default agent has been registered.');
    this.name = 'NoDefaultAgentError';
  }
}

export class AgentRegistry {
  private readonly agents = new Map<string, AgentGateway>();
  private defaultName?: string;

  /**
   * Registration refuses an adapter missing a required capability, naming it —
   * the behaviour quickstart `V11` step 5 already proves for engines.
   */
  register(
    agent: AgentGateway,
    options: { isDefault?: boolean; requires?: readonly AgentCapability[] } = {},
  ): void {
    const name = agent.descriptor.name;
    if (this.agents.has(name)) throw new DuplicateAgentError(name);
    if (options.requires) assertAgentCapabilities(agent.descriptor, options.requires);

    this.agents.set(name, agent);
    if (options.isDefault) this.defaultName = name;
  }

  /**
   * A provider *preference* is never load-bearing.
   *
   * Native §2 forbids workflows containing provider-specific logic, and an
   * orchestrator that fails when a preferred provider is absent has made the
   * preference a requirement. An unavailable preference falls back.
   */
  resolve(preference?: string): AgentGateway {
    if (preference) {
      const preferred = this.agents.get(preference);
      if (preferred) return preferred;
    }
    if (!this.defaultName) throw new NoDefaultAgentError();
    const fallback = this.agents.get(this.defaultName);
    if (!fallback) throw new NoDefaultAgentError();
    return fallback;
  }

  list(): AgentDescriptor[] {
    return [...this.agents.values()].map((a) => a.descriptor);
  }
}

/**
 * Build the registry.
 *
 * The fixture is the default until `T564` implements the Claude adapter:
 * `R-028-5` is uninvestigated, so `ClaudeAgent.execute()` returns a named
 * failure rather than pretending to work. Registering it anyway is deliberate —
 * it is what makes the provider-swap acceptance test meaningful, and what
 * `T646b` will exercise once a container runtime exists.
 */
export function composeAgentRegistry(): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(new FixtureAgent(), { isDefault: true });
  registry.register(new ClaudeAgent());
  return registry;
}
