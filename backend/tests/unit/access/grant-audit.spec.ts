/**
 * T826 — EVERY grant and EVERY revocation is written to the audit record
 * with the actor, the change and the time, in the same transaction as the
 * change itself (FR-ACC-026, SC-013). T373 covers the refusal half of the
 * trail; this is the grant half.
 */
import { describe, expect, it } from 'vitest';
import { WS, ADMIN, ALICE, SPEC, accessHarness } from './helpers.js';

describe('T826 · the grant half of the audit trail', () => {
  it('a grant writes an audit record with actor, change and time', async () => {
    const h = accessHarness();
    const when = new Date('2026-08-21T13:00:00Z');
    const grant = await h.grantService.grant(
      WS,
      SPEC,
      { userId: ALICE, level: 'read', grantedById: ADMIN },
      when,
    );

    const trail = await h.grantService.auditTrail(WS, SPEC);
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({
      actorId: ADMIN,
      change: 'grant',
      grantId: grant.id,
      subjectUserId: ALICE,
      level: 'read',
    });
    expect(trail[0]!.occurredAt).toEqual(when);
  });

  it('a revocation writes its own audit record — the trail shows both changes', async () => {
    const h = accessHarness();
    await h.grantService.grant(WS, SPEC, { userId: ADMIN, level: 'edit', grantedById: ADMIN });
    const alices = await h.grantService.grant(WS, SPEC, {
      userId: ALICE,
      level: 'read',
      grantedById: ADMIN,
    });
    const when = new Date('2026-08-21T14:00:00Z');
    await h.grantService.revoke(WS, alices.id, ADMIN, when);

    const trail = await h.grantService.auditTrail(WS, SPEC);
    expect(trail).toHaveLength(3);
    const revocation = trail.find((t) => t.change === 'revoke')!;
    expect(revocation).toMatchObject({
      actorId: ADMIN,
      grantId: alices.id,
      subjectUserId: ALICE,
    });
    expect(revocation.occurredAt).toEqual(when);
  });

  it('the store cannot apply a change without its audit record — one operation', async () => {
    const h = accessHarness();
    // Structural: create() REQUIRES the audit record as a parameter. There is
    // no store path that writes a grant alone; the signature is the guarantee
    // the Prisma store implements as a transaction.
    const grant = await h.grants.create(
      {
        workspaceId: WS,
        artifactType: SPEC.artifactType,
        artifactId: SPEC.artifactId,
        userId: ALICE,
        level: 'read',
        grantedById: ADMIN,
        grantedAt: new Date(),
        revokedAt: null,
        revokedById: null,
      },
      {
        workspaceId: WS,
        artifactType: SPEC.artifactType,
        artifactId: SPEC.artifactId,
        actorId: ADMIN,
        change: 'grant',
        subjectUserId: ALICE,
        level: 'read',
        occurredAt: new Date(),
      },
    );
    const trail = await h.grants.auditTrailFor(WS, SPEC);
    expect(trail.some((t) => t.grantId === grant.id)).toBe(true);
  });

  it('a refused revocation (last editor) writes NO audit record — nothing changed', async () => {
    const h = accessHarness();
    const admins = await h.grantService.grant(WS, SPEC, {
      userId: ADMIN,
      level: 'edit',
      grantedById: ADMIN,
    });
    await h.grantService.revoke(WS, admins.id, ADMIN).catch(() => undefined);
    const trail = await h.grantService.auditTrail(WS, SPEC);
    expect(trail.filter((t) => t.change === 'revoke')).toHaveLength(0);
  });
});
