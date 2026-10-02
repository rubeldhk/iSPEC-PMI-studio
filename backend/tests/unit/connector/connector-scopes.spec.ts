/**
 * `T1416` (EPIC-043, data-model.md §8) — the scope registry holds exactly the
 * scopes the contract binds, so a route cannot invent a scope and a
 * scope cannot exist without a route. Written to FAIL before `T1417`.
 */
import { describe, expect, it } from 'vitest';
import { registeredConnectorScopes, isRegisteredConnectorScope } from '../../../src/modules/connector/connector-scope.js';

export const CONNECTOR_SCOPES_OF_RECORD = [
  // EPIC-045 T1626: the fourteenth — the finish hook's artifact sync. A WRITE
  // scope with no read beside it: a connector credential never reads artifacts
  // back (FR-ART-043).
  'artifacts.sync',
  'connector.whoami',
  'constitution.read',
  'decomposition.read',
  'execution.append',
  'execution.comment',
  'execution.complete',
  'execution.propose',
  'execution.read',
  'execution.register',
  'execution.sync',
  'health.write',
  'project.read',
  'requirements.read',
  // EPIC-046 T1692: the fifteenth — the finish hook's task sync after `tasks`
  // and `implement`. Also a WRITE scope with no read beside it: the board is a
  // human surface and a connector never reads it back (FR-KAN-071).
  'tasks.sync',
] as const;

describe('T1416 + T1475 + T1626 + T1691 · the fifteen connector scopes', () => {
  it('are exactly the registered ones, sorted', () => {
    expect(registeredConnectorScopes()).toEqual([...CONNECTOR_SCOPES_OF_RECORD]);
  });

  it('nothing a Room, an approval or an administrator needs is among them', () => {
    for (const forbidden of ['room.read', 'transition.apply', 'transition.approve', 'workspace.admin', 'grant.write']) {
      expect(isRegisteredConnectorScope(forbidden)).toBe(false);
    }
  });
});
