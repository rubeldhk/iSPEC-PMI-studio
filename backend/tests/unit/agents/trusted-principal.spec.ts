/**
 * T1136 (EPIC-028, C3B) — a trusted principal context cannot be forged.
 *
 * The registry is only worth having if the thing carrying "who is acting"
 * cannot be constructed by whoever wants to claim it. These assert that
 * directly: a hand-built object with every field copied across is still
 * rejected, because the check reads a brand this module never exports rather
 * than the shape.
 */
import { describe, expect, it } from 'vitest';
import type { IdentitySnapshotPort, PrincipalIdentitySnapshot } from '@pmi/agent-contract';
import {
  isTrustedPrincipal,
  PrincipalNotActingError,
  TrustedPrincipalFactory,
  type AuthoritativePrincipalResolver,
} from '../../../src/modules/agents/trusted-principal.js';

const WS = 'ws_a';

function resolver(
  record: Awaited<ReturnType<AuthoritativePrincipalResolver['resolve']>>,
): AuthoritativePrincipalResolver {
  return { resolve: async () => record };
}

const snapshots: IdentitySnapshotPort = {
  capture: async (workspaceId, principalId): Promise<PrincipalIdentitySnapshot> => ({
    snapshotId: `snap-${principalId}`,
    principalId,
    kind: 'agent',
    workspaceId,
    sponsorUserId: 'u_sponsor',
    identityVersion: 1,
    connectorRegistrationId: null,
    capturedAt: '2026-08-27T00:00:00.000Z',
  }),
  resolve: async () => null,
};

const ACTIVE = {
  principalId: 'p_agent',
  kind: 'agent' as const,
  workspaceId: WS,
  sponsorUserId: 'u_sponsor',
  identityVersion: 3,
  connectorRegistrationId: 'conn_1',
  state: 'active' as const,
};

describe('T1136 · a context is only ever minted from an authoritative resolution', () => {
  it('mints one for an active principal, pinning the identity version', async () => {
    const ctx = await new TrustedPrincipalFactory(resolver(ACTIVE), snapshots).forPrincipal(
      WS,
      'p_agent',
    );
    expect(isTrustedPrincipal(ctx)).toBe(true);
    expect(ctx.identityVersion, 'the version was not pinned at resolution').toBe(3);
    expect(ctx.sponsorUserId).toBe('u_sponsor');
  });

  it.each([
    ['unknown principal', null],
    ['suspended principal', { ...ACTIVE, state: 'suspended' as const }],
    ['revoked principal', { ...ACTIVE, state: 'revoked' as const }],
    ['principal from another workspace', { ...ACTIVE, workspaceId: 'ws_b' }],
  ])('refuses: %s', async (_label, record) => {
    await expect(
      new TrustedPrincipalFactory(resolver(record), snapshots).forPrincipal(WS, 'p_agent'),
    ).rejects.toThrow(PrincipalNotActingError);
  });

  it('names WHICH refusal, so an operator is not left guessing', async () => {
    const failure = await new TrustedPrincipalFactory(
      resolver({ ...ACTIVE, state: 'revoked' }),
      snapshots,
    )
      .forPrincipal(WS, 'p_agent')
      .catch((e: unknown) => e as Error);
    expect((failure as Error).message).toMatch(/revoked/);
  });
});

describe('T1136 · forgery', () => {
  it('rejects a hand-built look-alike with every field copied', async () => {
    // The whole point. This object is structurally identical to a real context
    // and is still not one, because the brand is a Symbol this module never
    // exports. Duck typing does not get you in.
    const forged = {
      principalId: 'p_agent',
      kind: 'agent',
      workspaceId: WS,
      sponsorUserId: 'u_sponsor',
      identityVersion: 3,
      connectorRegistrationId: 'conn_1',
    };
    expect(isTrustedPrincipal(forged)).toBe(false);

    const factory = new TrustedPrincipalFactory(resolver(ACTIVE), snapshots);
    await expect(factory.freeze(forged as never)).rejects.toThrow(PrincipalNotActingError);
  });

  it.each([
    ['a plain object', {}],
    ['null', null],
    ['a string', 'p_agent'],
    ['a class instance of the wrong type', new Error('nope')],
  ])('rejects %s', (_label, value) => {
    expect(isTrustedPrincipal(value)).toBe(false);
  });

  it('a real context CAN be frozen — the check is not simply refusing everything', async () => {
    // The control. Without it, `isTrustedPrincipal` returning false always
    // would satisfy every assertion above.
    const factory = new TrustedPrincipalFactory(resolver(ACTIVE), snapshots);
    const ctx = await factory.forPrincipal(WS, 'p_agent');
    const snapshot = await factory.freeze(ctx);
    expect(snapshot.snapshotId).toBe('snap-p_agent');
    expect(snapshot.principalId).toBe('p_agent');
  });

  it('freezing goes through the service, so the caller never chooses the snapshot id', async () => {
    // A caller that could supply the id could supply somebody else's.
    let askedFor: [string, string] | null = null;
    const spy: IdentitySnapshotPort = {
      capture: async (w, p) => {
        askedFor = [w, p];
        return { ...(await snapshots.capture(w, p)) };
      },
      resolve: async () => null,
    };
    const factory = new TrustedPrincipalFactory(resolver(ACTIVE), spy);
    await factory.freeze(await factory.forPrincipal(WS, 'p_agent'));
    expect(askedFor).toEqual([WS, 'p_agent']);
  });
});
