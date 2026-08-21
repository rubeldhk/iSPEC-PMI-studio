/**
 * T372 — read and edit grants permit exactly their level and no more
 * (FR-ACC-021, FR-ACC-022).
 */
import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationFailedError } from '../../../src/core/errors.js';
import { WS, ADMIN, ALICE, BOB, SPEC, accessHarness, restrict } from './helpers.js';

describe('T372 · grant levels', () => {
  it('a read grant permits reading and nothing more', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);
    expect(await h.inheritance.effectivelyReadable(WS, ALICE, SPEC)).toBe(true);
    expect(await h.inheritance.effectivelyEditable(WS, ALICE, SPEC)).toBe(false);
  });

  it('an edit grant permits editing, which includes reading', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    expect(await h.inheritance.effectivelyReadable(WS, ADMIN, SPEC)).toBe(true);
    expect(await h.inheritance.effectivelyEditable(WS, ADMIN, SPEC)).toBe(true);
  });

  it('no grant on a restricted artifact permits nothing', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(false);
    expect(await h.inheritance.effectivelyEditable(WS, BOB, SPEC)).toBe(false);
  });

  it('a revoked grant permits nothing — revocation is a timestamp, not a delete', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);
    const grants = await h.grantService.activeGrants(WS, SPEC);
    const alices = grants.find((g) => g.userId === ALICE)!;
    await h.grantService.revoke(WS, alices.id, ADMIN);

    expect(await h.inheritance.effectivelyReadable(WS, ALICE, SPEC)).toBe(false);
    // The row survives with its history; it is just no longer active.
    const revoked = await h.grants.find(WS, alices.id);
    expect(revoked).not.toBeNull();
    expect(revoked!.revokedAt).not.toBeNull();
    expect(revoked!.revokedById).toBe(ADMIN);
  });

  it('refuses a grant without a level or without a user, naming the field', async () => {
    const h = accessHarness();
    await expect(
      h.grantService.grant(WS, SPEC, { userId: ALICE, grantedById: ADMIN }),
    ).rejects.toThrow(ValidationFailedError);
    await expect(
      h.grantService.grant(WS, SPEC, { userId: '', level: 'read', grantedById: ADMIN }),
    ).rejects.toThrow(ValidationFailedError);
  });

  it('revoking an already-revoked grant is refused', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);
    const alices = (await h.grantService.activeGrants(WS, SPEC)).find((g) => g.userId === ALICE)!;
    await h.grantService.revoke(WS, alices.id, ADMIN);
    await expect(h.grantService.revoke(WS, alices.id, ADMIN)).rejects.toThrow(ConflictError);
  });
});
