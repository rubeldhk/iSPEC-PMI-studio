/**
 * T811 — the run access snapshot governs only what a RUN may read and
 * produce, and is NOT consulted when deciding what a reviewer may see
 * (FR-ACC-028, FR-ACC-028a).
 */
import { describe, expect, it } from 'vitest';
import { WS, ADMIN, ALICE, BOB, SPEC, REQ_OPEN, accessHarness, restrict } from './helpers.js';

describe('T811 · the snapshot governs the run', () => {
  it('resolves grants ONCE at capture; a later revoke does not half-apply', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);
    const snapshot = await h.snapshot.capture(WS, ALICE);
    expect(h.snapshot.runMayRead(snapshot, SPEC)).toBe(true);

    // Mid-run, ALICE's grant is revoked…
    const alices = (await h.grantService.activeGrants(WS, SPEC)).find((g) => g.userId === ALICE)!;
    await h.grantService.revoke(WS, alices.id, ADMIN);

    // …the RUN still reads from its snapshot — consistency for the run's
    // duration, never a half-applied permission change (FR-ACC-028).
    expect(h.snapshot.runMayRead(snapshot, SPEC)).toBe(true);
    // A snapshot captured NOW would refuse.
    const fresh = await h.snapshot.capture(WS, ALICE);
    expect(h.snapshot.runMayRead(fresh, SPEC)).toBe(false);
  });

  it('open artifacts are readable through the snapshot without any grant', async () => {
    const h = accessHarness();
    const snapshot = await h.snapshot.capture(WS, BOB);
    expect(h.snapshot.runMayRead(snapshot, REQ_OPEN)).toBe(true);
  });

  it('restricted artifacts with no snapshot grant are not readable by the run', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const snapshot = await h.snapshot.capture(WS, BOB);
    expect(h.snapshot.runMayRead(snapshot, SPEC)).toBe(false);
  });

  it('reviewer visibility is NOT snapshot-scoped — the seam refuses by name', () => {
    const h = accessHarness();
    expect(() => h.snapshot.reviewerVisibilityIsNotSnapshotScoped()).toThrow(
      /CURRENT grants at session open/,
    );
  });

  it('reviewer visibility ignores the snapshot: a revoked reviewer is restricted NOW', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);
    // The run carries ALICE's generous snapshot…
    const snapshot = await h.snapshot.capture(WS, ALICE);
    expect(h.snapshot.runMayRead(snapshot, SPEC)).toBe(true);

    const alices = (await h.grantService.activeGrants(WS, SPEC)).find((g) => g.userId === ALICE)!;
    await h.grantService.revoke(WS, alices.id, ADMIN);

    // …but what ALICE the REVIEWER sees is evaluated against current grants:
    const visibility = await h.evaluation.visibilityAtOpen(WS, ALICE, [
      { questionId: 'q1', concerns: SPEC },
    ]);
    expect(visibility).toEqual([{ questionId: 'q1', restricted: true }]);
  });
});
