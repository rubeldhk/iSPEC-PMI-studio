/**
 * `registryOverClient(client)` — `ExecutionRegistry` over an MCP `Client`
 * (`T1429`, `R-037-10`, `SC-PIC-001`).
 *
 * What the fixture connector conformance suite runs against: the contract's
 * own interface, implemented by calling the server's tools. A refusal comes
 * back as the contract's typed rejection (`RegistryRefusedError`). The adapter
 * is the contract and no wider — no apply, approve, set or patch.
 */
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  RegistryRefusedError,
  type AppendEventRequest,
  type AppendedEvent,
  type CompleteExecutionRequest,
  type ExecutionRegistry,
  type ExecutionSnapshot,
  type ProposeTransitionRequest,
  type RegisterExecutionRequest,
  type RegistryRefusal,
} from '@pmi/execution-registry-contract';

type Result = { isError?: boolean; structuredContent?: unknown; content?: unknown };

/** What the platform derives; a connector over MCP never sends these. */
const DERIVED = ['workspaceId', 'projectId', 'identity', 'surface', 'assurance'] as const;

function strip<T extends object>(request: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(request as Record<string, unknown>) };
  for (const key of DERIVED) delete out[key];
  return out;
}

async function call<T>(client: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const result = (await client.callTool({ name, arguments: args })) as Result;
  if (result.isError) {
    const refusal = (result.structuredContent ?? {}) as { code?: string; message?: string };
    throw new RegistryRefusedError((refusal.code ?? 'platform_error') as RegistryRefusal, refusal.message ?? 'The platform refused the call.');
  }
  return result.structuredContent as T;
}

export function registryOverClient(client: Client): ExecutionRegistry {
  return {
    register: (request: RegisterExecutionRequest) => call<ExecutionSnapshot>(client, 'pmi.execution.register', strip(request)),
    appendEvent: (request: AppendEventRequest) => call<AppendedEvent>(client, 'pmi.execution.appendEvent', strip(request)),
    complete: (request: CompleteExecutionRequest) => call<AppendedEvent>(client, 'pmi.execution.complete', strip(request)),
    proposeTransition: (request: ProposeTransitionRequest) => call<AppendedEvent>(client, 'pmi.execution.proposeStatus', strip(request)),
    history: async (_workspaceId: string, executionId: string) => {
      const r = await call<{ events: AppendedEvent[] }>(client, 'pmi.execution.history', { executionId });
      return r.events;
    },
    snapshot: async (_workspaceId: string, executionId: string) => {
      const r = await call<{ snapshot: ExecutionSnapshot | null }>(client, 'pmi.execution.history', { executionId });
      return r.snapshot;
    },
  };
}
