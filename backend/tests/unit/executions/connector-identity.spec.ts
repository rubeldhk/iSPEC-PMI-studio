/**
 * `T1412` (EPIC-043, `R-043-3`, data-model.md §5) — `ExecutionIdentityRefs` from
 * the guard's context and server-side facts only. Never from a body.
 *
 * Written to FAIL before `T1413`.
 */
import { describe, expect, it, vi } from 'vitest';
import { RegistryRefusedError } from '@pmi/execution-registry-contract';
import { identityFromConnector, type ConnectorIdentityLookups } from '../../../src/modules/executions/connector-identity.js';
import type { ConnectorRequestContext } from '../../../src/modules/connector/connector-auth.guard.js';

function ctx(over: Partial<ConnectorRequestContext['principal']> = {}): ConnectorRequestContext {
  return {
    credentialId: 'cred_1',
    workspaceId: 'ws_a',
    projectId: 'proj_1',
    principal: {
      principalId: 'pr_1',
      kind: 'connector',
      workspaceId: 'ws_a',
      sponsorUserId: 'u_owner',
      identityVersion: 1,
      connectorRegistrationId: 'reg_mcp',
      ...over,
    } as ConnectorRequestContext['principal'],
  };
}

function lookups(over: Partial<ConnectorIdentityLookups> = {}): ConnectorIdentityLookups {
  return {
    snapshotOf: vi.fn(async () => 'snap_1'),
    completeIdentity: vi.fn(async () => ({ snapshotId: 'snap_lazy' })),
    delegationFor: vi.fn(async () => ({ id: 'del_1', identityVersion: 1 })),
    ...over,
  };
}

describe('T1412 · identityFromConnector', () => {
  it('builds every reference from the credential, the principal and the delegation', async () => {
    const l = lookups();
    const refs = await identityFromConnector(ctx(), l);
    expect(refs).toEqual({
      authenticatedPrincipalId: 'pr_1',
      agentSnapshotId: 'snap_1',
      connectorRegistrationId: 'reg_mcp',
      sponsorUserId: 'u_owner',
      delegationId: 'del_1',
      delegationIdentityVersion: 1,
    });
    expect(l.delegationFor).toHaveBeenCalledWith('ws_a', 'pr_1', 'proj_1');
  });

  it('completes the identity lazily when the credential has no snapshot yet', async () => {
    const l = lookups({ snapshotOf: vi.fn(async () => null) });
    const refs = await identityFromConnector(ctx(), l);
    expect(l.completeIdentity).toHaveBeenCalledWith('ws_a', 'cred_1');
    expect(refs.agentSnapshotId).toBe('snap_lazy');
  });

  it('refuses identity_not_resolvable when completion cannot produce a snapshot', async () => {
    const l = lookups({ snapshotOf: vi.fn(async () => null), completeIdentity: vi.fn(async () => ({ snapshotId: null })) });
    await expect(identityFromConnector(ctx(), l)).rejects.toMatchObject({ refusal: 'identity_not_resolvable' });
    await expect(identityFromConnector(ctx(), l)).rejects.toBeInstanceOf(RegistryRefusedError);
  });

  it('refuses when the principal has no sponsor or no registration — a connector always has both', async () => {
    await expect(identityFromConnector(ctx({ sponsorUserId: null }), lookups())).rejects.toMatchObject({ refusal: 'identity_not_resolvable' });
    await expect(identityFromConnector(ctx({ connectorRegistrationId: null }), lookups())).rejects.toMatchObject({ refusal: 'identity_not_resolvable' });
  });

  it('never reads a request body', () => {
    // The signature admits no body; this is the property, asserted at the type level and here by arity.
    expect(identityFromConnector.length).toBe(2);
  });
});
