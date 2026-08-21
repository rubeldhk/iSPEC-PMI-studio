/**
 * T375 — no artifact can reach a state with no user holding edit access
 * (FR-ACC-027, SC-008).
 */
import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../../src/core/errors.js';
import { WS, ADMIN, ALICE, SPEC, accessHarness, restrict } from './helpers.js';

describe('T375 · the last-editor guarantee', () => {
  it('refuses to revoke the last edit grant', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);
    const admins = (await h.grantService.activeGrants(WS, SPEC)).find((g) => g.userId === ADMIN)!;
    await expect(h.grantService.revoke(WS, admins.id, ADMIN)).rejects.toThrow(ConflictError);
    // The grant is still active — the artifact never lost its editor.
    expect(
      (await h.grantService.activeGrants(WS, SPEC)).filter((g) => g.level === 'edit'),
    ).toHaveLength(1);
  });

  it('revokes an edit grant freely while another editor remains', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'edit' },
    ]);
    const alices = (await h.grantService.activeGrants(WS, SPEC)).find((g) => g.userId === ALICE)!;
    const revoked = await h.grantService.revoke(WS, alices.id, ADMIN);
    expect(revoked.revokedAt).not.toBeNull();
    expect(
      (await h.grantService.activeGrants(WS, SPEC)).filter((g) => g.level === 'edit'),
    ).toHaveLength(1);
  });

  it('read grants revoke freely — they never carry the invariant', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);
    const alices = (await h.grantService.activeGrants(WS, SPEC)).find((g) => g.userId === ALICE)!;
    const revoked = await h.grantService.revoke(WS, alices.id, ADMIN);
    expect(revoked.revokedAt).not.toBeNull();
  });
});
