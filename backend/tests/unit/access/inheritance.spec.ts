/**
 * T374 — a derived artifact is at least as restricted as EVERY source —
 * most-restrictive-wins (FR-ACC-025, clarified 2026-08-08). Derivation
 * cannot be used to read a restricted source indirectly.
 */
import { describe, expect, it } from 'vitest';
import {
  WS, ADMIN, ALICE, BOB, SPEC, REQ_OPEN, REQ_RESTRICTED, accessHarness, restrict,
} from './helpers.js';

describe('T374 · derived-artifact restriction inheritance', () => {
  // **Rewritten in C2E.** Every case here used to lean on an artifact with no
  // grants being readable by everyone. `X19` inverted that, so each artifact in
  // play is now granted explicitly. What the suite is *about* is unchanged:
  // most-restrictive-wins across the ancestry.

  it('a widely granted + a narrowly granted source: hidden without a grant on the narrow one', async () => {
    const h = accessHarness();
    h.derivations.derive(SPEC, [REQ_OPEN, REQ_RESTRICTED]);
    await restrict(h, REQ_OPEN, [
      { userId: ALICE, level: 'read' },
      { userId: BOB, level: 'read' },
    ]);
    await restrict(h, SPEC, [
      { userId: ALICE, level: 'read' },
      { userId: BOB, level: 'read' },
    ]);
    await restrict(h, REQ_RESTRICTED, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);

    expect(await h.inheritance.effectivelyReadable(WS, ALICE, SPEC)).toBe(true);
    expect(await h.inheritance.effectivelyReadable(WS, BOB, REQ_OPEN)).toBe(true);
    // BOB may read the derived artifact directly AND the wide source, and is
    // still refused. The narrow source in its ancestry is what decides.
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(false);
  });

  it('derivation cannot read a restricted source indirectly — no laundering', async () => {
    const h = accessHarness();
    h.derivations.derive(SPEC, [REQ_RESTRICTED]);
    await restrict(h, REQ_RESTRICTED, [{ userId: ADMIN, level: 'edit' }]);
    // BOB is granted on the derived artifact ITSELF, deliberately. Without
    // this the assertion would hold under deny-by-default for a reason that
    // has nothing to do with laundering, and prove nothing.
    await restrict(h, SPEC, [{ userId: BOB, level: 'read' }]);
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(false);
  });

  it('a later restriction on a source propagates — evaluated on read, not copied on write', async () => {
    const h = accessHarness();
    h.derivations.derive(SPEC, [REQ_OPEN]);
    await restrict(h, SPEC, [{ userId: BOB, level: 'read' }]);
    // ADMIN keeps an edit grant so revoking BOB's cannot trip FR-ACC-027.
    await restrict(h, REQ_OPEN, [{ userId: ADMIN, level: 'edit' }]);
    const bobOnSource = await h.grantService.grant(WS, REQ_OPEN, {
      userId: BOB,
      level: 'read',
      grantedById: ADMIN,
    });
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(true);

    // The source access is withdrawn LATER; the derived artifact follows at
    // once, because inheritance is evaluated on read rather than copied.
    await h.grantService.revoke(WS, bobOnSource.id, ADMIN);
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(false);
  });

  it('restriction is transitive through a derivation chain', async () => {
    const h = accessHarness();
    const task = { artifactType: 'task', artifactId: 'task_1' };
    h.derivations.derive(task, [SPEC]);
    h.derivations.derive(SPEC, [REQ_RESTRICTED]);
    await restrict(h, REQ_RESTRICTED, [{ userId: ALICE, level: 'edit' }]);
    // Both links in the chain are granted to both actors, so the only thing
    // separating them is the far end of the ancestry.
    for (const artifact of [SPEC, task]) {
      await restrict(h, artifact, [
        { userId: ALICE, level: 'read' },
        { userId: BOB, level: 'read' },
      ]);
    }

    expect(await h.inheritance.effectivelyReadable(WS, ALICE, task)).toBe(true);
    expect(await h.inheritance.effectivelyReadable(WS, BOB, task)).toBe(false);
  });

  it('editing a derived artifact still requires reading every source', async () => {
    const h = accessHarness();
    h.derivations.derive(SPEC, [REQ_RESTRICTED]);
    await restrict(h, REQ_RESTRICTED, [{ userId: ALICE, level: 'edit' }]);
    await restrict(h, SPEC, [{ userId: BOB, level: 'edit' }]);
    // BOB edits the spec directly but cannot read its restricted source.
    expect(await h.inheritance.effectivelyEditable(WS, BOB, SPEC)).toBe(false);
    expect(await h.inheritance.effectivelyEditable(WS, ALICE, SPEC)).toBe(false); // no edit grant on SPEC
  });

  it('an artifact with NO grants is refused, not opened (X19)', async () => {
    // The inverted rule, asserted directly so it cannot drift back.
    const h = accessHarness();
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(false);
    expect(await h.inheritance.effectivelyEditable(WS, BOB, SPEC)).toBe(false);
  });
});
