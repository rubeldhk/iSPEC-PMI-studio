/**
 * `T1360` (EPIC-041) — the connector scope registry (`FR-LPW-026`; analysis `U1`).
 *
 * A route that accepts a connector credential declares its scope with
 * `@ConnectorScope('…')`; the guard refuses a route that declares none, and a
 * declared scope nobody registered. **The set is a registry, not a list in
 * prose**: this Epic registers exactly `connector.whoami`; `EPIC-043`
 * registers `execution.*`, `artifacts.sync` and `tasks.sync` on its own
 * routes by calling `registerConnectorScope`, without touching the guard.
 *
 * A credential authorises every registered scope for its project; per-scope
 * credentials are a later policy question (contracts/provisioning-api.md).
 */
import { SetMetadata } from '@nestjs/common';

export const CONNECTOR_SCOPE_KEY = 'pmi:connector-scope';

const REGISTRY = new Set<string>();

export function registerConnectorScope(scope: string, options: { remove?: boolean } = {}): void {
  if (options.remove) REGISTRY.delete(scope);
  else REGISTRY.add(scope);
}

export function isRegisteredConnectorScope(scope: string | undefined): scope is string {
  return scope !== undefined && REGISTRY.has(scope);
}

export function registeredConnectorScopes(): readonly string[] {
  return [...REGISTRY].sort();
}

/** Declares the scope a route needs. The guard reads it through `Reflector`. */
export function ConnectorScope(scope: string): MethodDecorator & ClassDecorator {
  return SetMetadata(CONNECTOR_SCOPE_KEY, scope);
}

// The one scope of this Epic.
registerConnectorScope('connector.whoami');
