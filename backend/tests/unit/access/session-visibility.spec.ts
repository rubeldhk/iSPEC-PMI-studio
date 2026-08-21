/**
 * T812 — review session content is evaluated against the grants held AT OPEN
 * TIME, so a revocation takes effect on the reviewer's next open of an
 * already-open session (FR-ACC-028a, SC-018) — and a restricted question is
 * marked restricted, never silently omitted (T816).
 */
import { describe, expect, it } from 'vitest';
import { WS, ADMIN, ALICE, SPEC, REQ_OPEN, accessHarness, restrict } from './helpers.js';

const QUESTIONS = [
  { questionId: 'q1', concerns: SPEC },
  { questionId: 'q2', concerns: REQ_OPEN },
];

describe('T812 · open-time grant evaluation', () => {
  it('grants held at open time govern what the reviewer sees', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);
    const visibility = await h.evaluation.visibilityAtOpen(WS, ALICE, QUESTIONS);
    expect(visibility).toEqual([
      { questionId: 'q1', restricted: false },
      { questionId: 'q2', restricted: false },
    ]);
  });

  it('a revocation takes effect on the NEXT open of an already-open session (SC-018)', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);
    // First open: readable.
    const before = await h.evaluation.visibilityAtOpen(WS, ALICE, QUESTIONS);
    expect(before[0]!.restricted).toBe(false);

    // The grant is revoked while the session sits open…
    const alices = (await h.grantService.activeGrants(WS, SPEC)).find((g) => g.userId === ALICE)!;
    await h.grantService.revoke(WS, alices.id, ADMIN);

    // …the NEXT open re-evaluates: no stale capability survives the revoke.
    const after = await h.evaluation.visibilityAtOpen(WS, ALICE, QUESTIONS);
    expect(after[0]!.restricted).toBe(true);
  });

  it('the restricted question is MARKED, never dropped — the session shows its true size', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const visibility = await h.evaluation.visibilityAtOpen(WS, ALICE, QUESTIONS);
    // Both questions are present; one is restricted.
    expect(visibility).toHaveLength(2);
    expect(visibility).toEqual([
      { questionId: 'q1', restricted: true },
      { questionId: 'q2', restricted: false },
    ]);
  });

  it('a regrant restores visibility on the next open — evaluation is live, both ways', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    expect((await h.evaluation.visibilityAtOpen(WS, ALICE, QUESTIONS))[0]!.restricted).toBe(true);
    await restrict(h, SPEC, [{ userId: ALICE, level: 'read' }]);
    expect((await h.evaluation.visibilityAtOpen(WS, ALICE, QUESTIONS))[0]!.restricted).toBe(false);
  });
});
