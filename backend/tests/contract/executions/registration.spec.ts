/**
 * T1030 (EPIC-037 Band A) — registration refuses before it writes.
 *
 * The database stub **throws on contact**. That is the assertion, not a
 * convenience: every refusal here must happen before anything is persisted, so
 * a rejected registration cannot leave a half-written execution behind. If a
 * check were ever moved after the first write, these would fail with "the
 * database was touched" rather than passing quietly.
 */
import { describe, expect, it } from 'vitest';
import { RegistryRefusedError } from '@pmi/execution-registry-contract';
import {
  ExecutionRegistrationService,
  type DelegationPort,
  type IdentityResolverPort,
  type RegistrationDb,
} from '../../../src/modules/executions/execution-registration.service.js';
import type { ExecutionEventService } from '../../../src/modules/executions/execution-event.service.js';

const WS = 'ws_a';
const AGENT = 'p_agent';

/** Any contact is a failure of the claim these tests make. */
const refusingDb: RegistrationDb = {
  $transaction: async () => {
    throw new Error('the database was touched before the request was validated');
  },
  $queryRawUnsafe: async () => {
    throw new Error('the database was touched before the request was validated');
  },
};

const identity: IdentityResolverPort = {
  resolveSnapshot: async (snapshotId) => ({
    snapshotId,
    principalId: AGENT,
    workspaceId: WS,
    kind: 'agent',
    sponsorUserId: 'u_sponsor',
    identityVersion: 1,
    connectorRegistrationId: 'conn_1',
  }),
  findConnector: async (_w, connectorId) => ({ connectorId, state: 'active' }),
};

const delegated: DelegationPort = {
  requireDelegated: async () => ({ id: 'd_1', identityVersion: 1 }),
};

const undelegated: DelegationPort = {
  requireDelegated: async () => {
    throw new Error('no active delegation carries "execution.register"');
  },
};

const events = {
  append: async () => {
    throw new Error('an event was appended for a refused registration');
  },
} as unknown as ExecutionEventService;

function service(
  over: { identity?: IdentityResolverPort; delegations?: DelegationPort } = {},
): ExecutionRegistrationService {
  return new ExecutionRegistrationService(
    refusingDb,
    events,
    over.identity ?? identity,
    over.delegations ?? delegated,
  );
}

const REQUEST = {
  workspaceId: WS,
  command: 'specify' as const,
  argsSanitized: {},
  surface: 'fixture' as const,
  identity: {
    authenticatedPrincipalId: AGENT,
    agentSnapshotId: 'snap_1',
    connectorRegistrationId: 'conn_1',
    sponsorUserId: 'u_sponsor',
    delegationId: 'd_1',
    delegationIdentityVersion: 1,
  },
  input: { targetType: 'specification', targetId: 'spec_1' },
  correlationId: 'c1',
  idempotencyKey: 'k1',
  contractVersion: '1.0',
};

async function refusalOf(promise: Promise<unknown>): Promise<RegistryRefusedError> {
  const outcome = await promise.then(() => null).catch((e: unknown) => e);
  expect(outcome, 'the request was accepted').not.toBeNull();
  expect(outcome).toBeInstanceOf(RegistryRefusedError);
  return outcome as RegistryRefusedError;
}

describe('T1030 · the request itself is refused before any write', () => {
  it('refuses an unsupported contract version', async () => {
    const refusal = await refusalOf(
      service().register({ ...REQUEST, contractVersion: '9.9' }),
    );
    expect(refusal.refusal).toBe('unsupported_contract_version');
  });

  it('refuses registration with no input identity', async () => {
    const refusal = await refusalOf(
      service().register({ ...REQUEST, input: { targetType: 'specification', targetId: '' } }),
    );
    expect(refusal.refusal).toBe('input_binding_incomplete');
  });

  it('refuses commitAfter at registration (AC-EXR-17b)', async () => {
    // Asking for an output commit before the work has run is itself the
    // defect. Ignoring it would be almost as bad: the connector would believe
    // it had been recorded.
    const refusal = await refusalOf(
      service().register({
        ...REQUEST,
        input: { targetType: 'specification', targetId: 'spec_1', commitAfter: 'def' } as never,
      }),
    );
    expect(refusal.refusal).toBe('output_binding_not_permitted');
  });

  it('refuses a credential in the arguments', async () => {
    const refusal = await refusalOf(
      service().register({ ...REQUEST, argsSanitized: { apiKey: 'x' } }),
    );
    expect(refusal.refusal).toBe('credential_detected');
  });
});

describe('T1030 · identity is resolved, never believed', () => {
  it('refuses a snapshot that does not resolve', async () => {
    const refusal = await refusalOf(
      service({ identity: { ...identity, resolveSnapshot: async () => null } }).register(REQUEST),
    );
    expect(refusal.refusal).toBe('identity_not_resolvable');
  });

  it('refuses a snapshot belonging to another workspace', async () => {
    const refusal = await refusalOf(
      service({
        identity: {
          ...identity,
          resolveSnapshot: async (s) => ({
            snapshotId: s,
            principalId: AGENT,
            workspaceId: 'ws_other',
            kind: 'agent',
            sponsorUserId: 'u_sponsor',
            identityVersion: 1,
            connectorRegistrationId: 'conn_1',
          }),
        },
      }).register(REQUEST),
    );
    expect(refusal.refusal).toBe('identity_not_resolvable');
  });

  it('refuses a snapshot describing a DIFFERENT principal than the authenticated one', async () => {
    const refusal = await refusalOf(
      service({
        identity: {
          ...identity,
          resolveSnapshot: async (s) => ({
            snapshotId: s,
            principalId: 'p_someone_else',
            workspaceId: WS,
            kind: 'agent',
            sponsorUserId: 'u_sponsor',
            identityVersion: 1,
            connectorRegistrationId: 'conn_1',
          }),
        },
      }).register(REQUEST),
    );
    expect(refusal.refusal).toBe('identity_not_resolvable');
  });

  it('refuses a sponsor that disagrees with the frozen snapshot', async () => {
    // The submitted sponsor is a claim; the frozen one is the record. If they
    // disagree, the claim loses.
    const refusal = await refusalOf(
      service().register({
        ...REQUEST,
        identity: { ...REQUEST.identity, sponsorUserId: 'u_someone_else' },
      }),
    );
    expect(refusal.refusal).toBe('identity_not_resolvable');
  });

  it.each([
    ['unknown', null],
    ['revoked', { connectorId: 'conn_1', state: 'revoked' }],
  ])('refuses a %s connector', async (_label, connector) => {
    const refusal = await refusalOf(
      service({ identity: { ...identity, findConnector: async () => connector } }).register(
        REQUEST,
      ),
    );
    expect(refusal.refusal).toBe('identity_not_resolvable');
  });
});

describe('T1030 · a sponsor’s ownership does not reach their agent', () => {
  it('refuses when no delegation authorises registration', async () => {
    const refusal = await refusalOf(service({ delegations: undelegated }).register(REQUEST));
    expect(refusal.refusal).toBe('delegation_missing');
  });

  it('reaches the database only once everything above passes', async () => {
    // The control. Every assertion here rests on the stub throwing, so this
    // proves a fully valid request DOES get that far — otherwise the suite
    // would pass against a service that refused everything.
    const failure = await service()
      .register(REQUEST)
      .then(() => null)
      .catch((e: unknown) => e as Error);
    expect(failure?.message).toMatch(/the database was touched/);
  });
});
