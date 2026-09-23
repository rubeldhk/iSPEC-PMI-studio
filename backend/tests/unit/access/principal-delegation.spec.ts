/**
 * T1139 (EPIC-024, C3B) — scoped delegation to a non-human principal.
 *
 * The rule these protect: a sponsor's ownership does **not** flow to the agents
 * they sponsor. Registering one agent must not hand it everything that human
 * owns, for as long as it exists.
 */
import { describe, expect, it } from 'vitest';
import {
  DELEGABLE_ACTIONS,
  DelegationRefused,
  DelegationStoreUnavailable,
  NEVER_DELEGABLE,
  PrincipalDelegationService,
  isDelegableAction,
  type DelegationRow,
  type DelegationStore,
} from '../../../src/modules/access/principal-delegation.service.js';

const WS = 'ws_a';
const AGENT = 'p_agent';
const SPEC = { artifactType: 'specification', artifactId: 'spec_1' };
const OTHER = { artifactType: 'specification', artifactId: 'spec_2' };

function row(over: Partial<DelegationRow> = {}): DelegationRow {
  return {
    id: 'd1',
    workspaceId: WS,
    principalId: AGENT,
    sponsorUserId: 'u_sponsor',
    artifactType: SPEC.artifactType,
    artifactId: SPEC.artifactId,
    actions: ['execution.register', 'transition.propose'],
    identityVersion: 1,
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    expiresAt: null,
    revokedAt: null,
    ...over,
  };
}

function store(rows: DelegationRow[]): DelegationStore {
  return {
    activeFor: async (_w, _p, artifact) =>
      rows.filter(
        (r) => r.artifactType === artifact.artifactType && r.artifactId === artifact.artifactId,
      ),
    create: async () => row(),
    revoke: async () => row({ revokedAt: new Date() }),
  };
}

/** The authoritative state, at version 1 and active unless a case says otherwise. */
function principals(
  over: Partial<{ identityVersion: number; state: 'active' | 'suspended' | 'revoked' }> = {},
) {
  return {
    find: async () => ({ identityVersion: 1, state: 'active' as const, ...over }),
  };
}

const svc = (
  rows: DelegationRow[],
  state = principals(),
): PrincipalDelegationService => new PrincipalDelegationService(store(rows), state);

const NOW = new Date('2026-06-01T00:00:00Z');

describe('T1139 · a delegation permits exactly what it names', () => {
  it('permits a delegated action on the delegated artifact', async () => {
    const d = await svc([row()]).requireDelegated({
      workspaceId: WS,
      principalId: AGENT,
      artifact: SPEC,
      action: 'transition.propose',
      at: NOW,
    });
    expect(d.id).toBe('d1');
  });

  it('refuses an action the delegation does not carry', async () => {
    await expect(
      svc([row({ actions: ['execution.register'] })]).requireDelegated({
        workspaceId: WS,
        principalId: AGENT,
        artifact: SPEC,
        action: 'transition.propose',
        at: NOW,
      }),
    ).rejects.toThrow(DelegationRefused);
  });

  it('refuses on a DIFFERENT artifact — scope is per artifact, not per sponsor', async () => {
    // The defect this exists to prevent: one delegation becoming a key to
    // everything the sponsor owns.
    await expect(
      svc([row()]).requireDelegated({
        workspaceId: WS,
        principalId: AGENT,
        artifact: OTHER,
        action: 'transition.propose',
        at: NOW,
      }),
    ).rejects.toThrow(DelegationRefused);
  });
});

describe('T1139 · time and revocation fail closed', () => {
  it.each([
    ['revoked', row({ revokedAt: new Date('2026-05-01T00:00:00Z') })],
    ['expired', row({ expiresAt: new Date('2026-05-01T00:00:00Z') })],
    ['not yet effective', row({ effectiveFrom: new Date('2026-12-01T00:00:00Z') })],
  ])('refuses a %s delegation', async (_label, r) => {
    await expect(
      svc([r]).requireDelegated({
        workspaceId: WS,
        principalId: AGENT,
        artifact: SPEC,
        action: 'transition.propose',
        at: NOW,
      }),
    ).rejects.toThrow(DelegationRefused);
  });

  it('refuses when the identity version has moved on', async () => {
    // A suspension bumps the version, so yesterday's delegation stops matching
    // — and reactivating bumps it again rather than restoring the old value.
    await expect(
      svc([row({ identityVersion: 1 })], principals({ identityVersion: 2 })).requireDelegated({
        workspaceId: WS,
        principalId: AGENT,
        artifact: SPEC,
        action: 'transition.propose',
        at: NOW,
      }),
    ).rejects.toThrow(DelegationRefused);
  });
});

describe('T1139 · approval and application can never be delegated', () => {
  it.each(NEVER_DELEGABLE)('refuses to grant %s', async (action) => {
    await expect(
      svc([]).delegate({
        workspaceId: WS,
        principalId: AGENT,
        sponsorUserId: 'u_sponsor',
        artifact: SPEC,
        actions: [action],
        identityVersion: 1,
        correlationId: 'c1',
      }),
    ).rejects.toThrow(DelegationRefused);
  });

  it.each(NEVER_DELEGABLE)('refuses to CHECK %s even if a row somehow carried it', async (action) => {
    // Defence in depth: the database CHECK makes such a row unwritable, and
    // this makes it unusable if one ever existed.
    await expect(
      svc([row({ actions: [action] })]).requireDelegated({
        workspaceId: WS,
        principalId: AGENT,
        artifact: SPEC,
        action,
        at: NOW,
      }),
    ).rejects.toThrow(DelegationRefused);
  });

  it('the two vocabularies do not overlap', () => {
    for (const a of NEVER_DELEGABLE) expect(isDelegableAction(a)).toBe(false);
    for (const a of DELEGABLE_ACTIONS) expect(isDelegableAction(a)).toBe(true);
  });

  it('refuses a delegation carrying no action at all', async () => {
    await expect(
      svc([]).delegate({
        workspaceId: WS,
        principalId: AGENT,
        sponsorUserId: 'u_sponsor',
        artifact: SPEC,
        actions: [],
        identityVersion: 1,
        correlationId: 'c1',
      }),
    ).rejects.toThrow(DelegationRefused);
  });
});

describe('T1139 · an unreadable store is not a decision', () => {
  it('fails closed, and distinguishably from "no delegation"', async () => {
    const broken: DelegationStore = {
      activeFor: async () => {
        throw new Error('connection reset');
      },
      create: async () => row(),
      revoke: async () => row(),
    };
    await expect(
      new PrincipalDelegationService(broken, principals()).requireDelegated({
        workspaceId: WS,
        principalId: AGENT,
        artifact: SPEC,
        action: 'transition.propose',
        at: NOW,
      }),
    ).rejects.toThrow(DelegationStoreUnavailable);
  });
});
