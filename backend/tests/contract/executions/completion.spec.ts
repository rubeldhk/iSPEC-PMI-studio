/**
 * T1037 (EPIC-037 Band A) — completion binds output, or explains why it cannot.
 *
 * The database stub throws on contact, so every refusal below is proven to
 * happen before anything is written.
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
    principalId: 'p_agent',
    workspaceId: WS,
    kind: 'agent',
    sponsorUserId: 'u_sponsor',
    identityVersion: 1,
    connectorRegistrationId: 'conn_1',
  }),
  findConnector: async (_w, connectorId) => ({ connectorId, state: 'active' }),
};

const delegations: DelegationPort = {
  requireDelegated: async () => ({ id: 'd_1', identityVersion: 1 }),
};

const events = {
  append: async () => {
    throw new Error('an event was appended for a refused completion');
  },
} as unknown as ExecutionEventService;

const service = (): ExecutionRegistrationService =>
  new ExecutionRegistrationService(refusingDb, events, identity, delegations);

const BASE = {
  executionId: 'exec_1',
  workspaceId: WS,
  identity: {
    authenticatedPrincipalId: 'p_agent',
    agentSnapshotId: 'snap_1',
    connectorRegistrationId: 'conn_1',
    sponsorUserId: 'u_sponsor',
    delegationId: 'd_1',
    delegationIdentityVersion: 1,
  },
  idempotencyKey: 'k1',
  occurredAt: '2026-08-27T00:00:00.000Z',
  completionComment: 'Generated and reviewed.',
};

async function refusalOf(promise: Promise<unknown>): Promise<RegistryRefusedError> {
  const outcome = await promise.then(() => null).catch((e: unknown) => e);
  expect(outcome, 'the completion was accepted').not.toBeNull();
  expect(outcome).toBeInstanceOf(RegistryRefusedError);
  return outcome as RegistryRefusedError;
}

describe('T1037 · a completion carries a comment', () => {
  it.each([['empty', ''], ['whitespace', '   ']])('refuses a %s comment', async (_l, comment) => {
    // `FR-EXR-013`. A completion nobody explained is a gap in the record that
    // no later reader can fill.
    const refusal = await refusalOf(
      service().complete({ ...BASE, outcome: 'completed', completionComment: comment }),
    );
    expect(refusal.refusal).toBe('completion_comment_required');
  });
});

describe('T1037 · success binds output; failure must not', () => {
  it('refuses a successful completion with no output identity', async () => {
    const refusal = await refusalOf(service().complete({ ...BASE, outcome: 'completed' }));
    expect(refusal.refusal).toBe('output_binding_required');
  });

  it.each(['failed', 'cancelled', 'timed-out'] as const)(
    'refuses an output binding on a %s completion',
    async (outcome) => {
      // `AC-EXR-17d`. Nothing resulted, so a resulting version would be a
      // claim about work that did not happen.
      const refusal = await refusalOf(
        service().complete({ ...BASE, outcome, output: { commitAfter: 'def' } }),
      );
      expect(refusal.refusal).toBe('output_binding_not_permitted');
    },
  );

  it.each(['failed', 'cancelled', 'timed-out'] as const)(
    'ACCEPTS a %s completion with no output',
    async (outcome) => {
      // The control: a failure with no output must get past validation, or the
      // rule above would be indistinguishable from refusing every failure.
      const failure = await service()
        .complete({ ...BASE, outcome })
        .then(() => null)
        .catch((e: unknown) => e as Error);
      expect(failure?.message).toMatch(/the database was touched|an event was appended/);
    },
  );

  it('ACCEPTS a successful completion carrying output', async () => {
    const failure = await service()
      .complete({ ...BASE, outcome: 'completed', output: { commitAfter: 'def', resultingVersion: 2 } })
      .then(() => null)
      .catch((e: unknown) => e as Error);
    expect(failure?.message).toMatch(/the database was touched|an event was appended/);
  });
});
