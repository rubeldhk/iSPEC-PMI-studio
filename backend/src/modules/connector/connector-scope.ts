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

// The one scope of EPIC-041.
registerConnectorScope('connector.whoami');

// EPIC-043 T1417 — the ten scopes the integration contract binds
// (data-model.md §8; contracts/mcp-tool-surface.md). Exactly these: the
// architecture test refuses an eleventh, and a route without one of them cannot
// be mounted behind the guard.
// Registered one literal at a time, so the architecture test can read the list
// from this file without executing it.
registerConnectorScope('execution.register');
registerConnectorScope('execution.append');
registerConnectorScope('execution.complete');
registerConnectorScope('execution.comment');
registerConnectorScope('execution.propose');
registerConnectorScope('execution.read');
registerConnectorScope('execution.sync');
registerConnectorScope('project.read');
registerConnectorScope('requirements.read');
registerConnectorScope('health.write');
// EPIC-042 T1476 (R-042-11): the two reads this Epic makes live (contracts/governance-api.md §2).
registerConnectorScope('constitution.read');
registerConnectorScope('decomposition.read');
// EPIC-045 T1626 (contracts/artifacts-api.md §3): the one write this Epic makes
// live — the finish hook's artifact sync. It is a WRITE scope with no read
// beside it: a connector credential never reads artifacts back (FR-ART-043).
registerConnectorScope('artifacts.sync');
