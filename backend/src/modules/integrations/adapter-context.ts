/**
 * EPIC-039 — the context the Hub hands an adapter for one call: the project's
 * non-secret binding for that adapter, the credential handle (or none), the
 * scope the resolver granted, and an abort signal that fires at the timeout.
 *
 * Shared by requests and health checks so both reach a provider the same way.
 */
import type { AdapterContext, CapabilityName, CredentialHandle, ScopeGrant } from '@pmi/capability-contract';
import type { ConfigurationRecord } from './integrations.store.js';

/** Provider timeouts (`R-039-15`). */
export const TIMEOUTS_MS: Readonly<Record<CapabilityName | 'health', number>> = Object.freeze({
  ReadRepository: 10_000,
  ReadBuildStatus: 10_000,
  ReadTestResults: 30_000,
  SendNotification: 10_000,
  Embed: 20_000,
  health: 5_000,
});

/** The binding a configuration holds for one adapter (keyed by registry entry). */
export function bindingFor(configuration: ConfigurationRecord | null, registryEntryId: string): Readonly<Record<string, unknown>> {
  const all = (configuration?.providerBinding ?? {}) as Record<string, unknown>;
  const own = all[registryEntryId];
  return own !== null && typeof own === 'object' ? (own as Record<string, unknown>) : {};
}

export interface TimedContext {
  readonly context: AdapterContext;
  done(): void;
}

export function adapterContext(input: {
  workspaceId: string | null;
  projectId: string | null;
  binding: Readonly<Record<string, unknown>>;
  credential: CredentialHandle | null;
  scope: ScopeGrant;
  timeoutMs: number;
}): TimedContext {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timed-out')), input.timeoutMs);
  timer.unref();
  return {
    context: { workspaceId: input.workspaceId, projectId: input.projectId, binding: input.binding, credential: input.credential, scope: input.scope, signal: controller.signal, timeoutMs: input.timeoutMs },
    done: () => clearTimeout(timer),
  };
}

/** Race an adapter call against its timeout; a timeout is `timed-out`, never re-resolved (`FR-HUB-039`). */
export async function withTimeout<T>(signal: AbortSignal, work: Promise<T>, onTimeout: () => T): Promise<T> {
  if (signal.aborted) return onTimeout();
  return Promise.race([
    work,
    new Promise<T>((resolve) => {
      signal.addEventListener('abort', () => resolve(onTimeout()), { once: true });
    }),
  ]);
}
