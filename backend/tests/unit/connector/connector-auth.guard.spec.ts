/**
 * `T1359` (EPIC-041) — the connector guard (`R-041-3`).
 *
 * Unknown, wrong-digest and revoked tokens produce ONE identical `401`; a
 * valid token yields a `TrustedPrincipalContext` scoped to its project; a
 * resource of another project is `404`; a route not registered in the
 * `ConnectorScope` registry is `403`. In this Epic the registry holds exactly
 * `connector.whoami`, and this test registers a second scope to prove
 * `EPIC-043` can extend it without touching the guard (`FR-LPW-025`,
 * `FR-LPW-026`; analysis `U1`).
 *
 * Written to FAIL before `T1360` exists.
 */
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, InvalidConnectorCredentialError, NotFoundError } from '../../../src/core/errors.js';
import { ConnectorAuthGuard, type ConnectorRequest } from '../../../src/modules/connector/connector-auth.guard.js';
import {
  CONNECTOR_SCOPE_KEY,
  ConnectorScope,
  registerConnectorScope,
  registeredConnectorScopes,
} from '../../../src/modules/connector/connector-scope.js';
import { InMemoryConnectorCredentialStore } from '../../../src/modules/connector/connector-credential.store.js';
import { mintToken } from '../../../src/modules/connector/credential-token.js';

const NOW = new Date('2026-09-04T12:00:00Z');

async function harness() {
  const store = new InMemoryConnectorCredentialStore();
  const minted = mintToken();
  await store.create({
    id: 'cred_a',
    workspaceId: 'ws_a',
    projectId: 'p_a',
    principalId: 'pr_a',
    tokenPrefix: minted.tokenPrefix,
    tokenHash: minted.tokenHash,
    label: 'laptop',
    createdById: 'u_owner',
    createdAt: NOW,
    lastUsedAt: null,
    revokedAt: null,
    revokedById: null,
  });
  const forPrincipal = vi.fn(async (workspaceId: string, principalId: string) => ({ workspaceId, principalId, kind: 'connector' }));
  const guard = new ConnectorAuthGuard(store, { forPrincipal } as never, { now: () => NOW });
  return { guard, store, minted, forPrincipal };
}

const request = (authorization: string | undefined, params: Record<string, string> = {}) =>
  ({ headers: authorization === undefined ? {} : { authorization }, params }) as ConnectorRequest;

describe('T1359 · one identical 401 for every credential failure', () => {
  const failures: [string, (h: Awaited<ReturnType<typeof harness>>) => Promise<string | undefined>][] = [
    ['no header', async () => undefined],
    ['not a bearer', async () => 'Basic abc'],
    ['unknown prefix', async () => 'Bearer pmi_ct_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'],
    ['wrong digest, right prefix', async (h) => `Bearer ${h.minted.value.slice(0, -1)}${h.minted.value.endsWith('A') ? 'B' : 'A'}`],
    ['revoked', async (h) => {
      await h.store.revoke('ws_a', 'cred_a', 'u_owner', NOW);
      return `Bearer ${h.minted.value}`;
    }],
  ];

  it.each(failures)('%s', async (_label, header) => {
    const h = await harness();
    const req = request(await header(h));
    const error = await h.guard.authenticate(req, 'connector.whoami').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidConnectorCredentialError);
    expect((error as Error).message).toBe(ConnectorAuthGuard.REFUSAL_MESSAGE);
    expect(h.forPrincipal).not.toHaveBeenCalled();
  });
});

describe('T1359 · a valid credential', () => {
  it('yields a trusted principal context from the factory, scoped to its project, and touches lastUsedAt', async () => {
    const h = await harness();
    const req = request(`Bearer ${h.minted.value}`);
    const ctx = await h.guard.authenticate(req, 'connector.whoami');
    expect(h.forPrincipal).toHaveBeenCalledWith('ws_a', 'pr_a');
    expect(ctx).toMatchObject({ workspaceId: 'ws_a', projectId: 'p_a', credentialId: 'cred_a' });
    expect(ctx.principal).toMatchObject({ principalId: 'pr_a' });
    expect(req.workspaceId).toBe('ws_a');
    expect(req.connector).toBe(ctx);
    expect((await h.store.find('ws_a', 'cred_a'))?.lastUsedAt).toEqual(NOW);
  });

  it('is 404, never 403, for a resource of another project (FR-LPW-025)', async () => {
    const h = await harness();
    const req = request(`Bearer ${h.minted.value}`, { projectId: 'p_b' });
    await expect(h.guard.authenticate(req, 'connector.whoami')).rejects.toBeInstanceOf(NotFoundError);
    const own = request(`Bearer ${h.minted.value}`, { projectId: 'p_a' });
    await expect(h.guard.authenticate(own, 'connector.whoami')).resolves.toMatchObject({ projectId: 'p_a' });
  });
});

describe('T1359 · the scope registry', () => {
  it('holds exactly the eleven scopes of record', () => {
    // EPIC-043 T1417 widened the registry to the eleven scopes of record (data-model.md §8).
    expect(registeredConnectorScopes()).toEqual(['connector.whoami', 'execution.append', 'execution.comment', 'execution.complete', 'execution.propose', 'execution.read', 'execution.register', 'execution.sync', 'health.write', 'project.read', 'requirements.read']);
  });

  it('refuses a route that declares no scope, and one whose scope is not registered — 403, after the credential is verified', async () => {
    const h = await harness();
    await expect(h.guard.authenticate(request(`Bearer ${h.minted.value}`), undefined)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(h.guard.authenticate(request(`Bearer ${h.minted.value}`), 'artifacts.sync')).rejects.toBeInstanceOf(ForbiddenError);
    // An invalid credential on an unscoped route is still the 401 — identity before scope.
    await expect(h.guard.authenticate(request('Bearer pmi_ct_nope'), undefined)).rejects.toBeInstanceOf(InvalidConnectorCredentialError);
  });

  it('can be extended by a later Epic without touching the guard (U1)', async () => {
    const h = await harness();
    registerConnectorScope('artifacts.sync');
    try {
      await expect(h.guard.authenticate(request(`Bearer ${h.minted.value}`), 'artifacts.sync')).resolves.toMatchObject({ projectId: 'p_a' });
    } finally {
      registerConnectorScope('artifacts.sync', { remove: true });
    }
    expect(registeredConnectorScopes()).toEqual(['connector.whoami', 'execution.append', 'execution.comment', 'execution.complete', 'execution.propose', 'execution.read', 'execution.register', 'execution.sync', 'health.write', 'project.read', 'requirements.read']);
  });

  it('the decorator writes the scope as route metadata the guard reads', () => {
    class Probe {
      @ConnectorScope('connector.whoami')
      whoami(): void {}
    }
    expect(Reflect.getMetadata(CONNECTOR_SCOPE_KEY, Probe.prototype.whoami)).toBe('connector.whoami');
  });
});
