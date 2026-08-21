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
  it('one open + one restricted source: hidden without a grant on the restricted one', async () => {
    const h = accessHarness();
    // The specification derives from an open requirement and a restricted one.
    h.derivations.derive(SPEC, [REQ_OPEN, REQ_RESTRICTED]);
    await restrict(h, REQ_RESTRICTED, [
      { userId: ADMIN, level: 'edit' },
      { userId: ALICE, level: 'read' },
    ]);

    // ALICE holds a grant on the restricted source → the derived spec reads.
    expect(await h.inheritance.effectivelyReadable(WS, ALICE, SPEC)).toBe(true);
    // BOB reads the open source but NOT the restricted one → the spec is hidden.
    expect(await h.inheritance.effectivelyReadable(WS, BOB, REQ_OPEN)).toBe(true);
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(false);
  });

  it('derivation cannot read a restricted source indirectly — no laundering', async () => {
    const h = accessHarness();
    h.derivations.derive(SPEC, [REQ_RESTRICTED]);
    await restrict(h, REQ_RESTRICTED, [{ userId: ADMIN, level: 'edit' }]);
    // Even though the spec itself carries no grant rows (would be "open"),
    // its ancestry restricts it: most restrictive wins.
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(false);
  });

  it('a later restriction on a source propagates — evaluated on read, not copied on write', async () => {
    const h = accessHarness();
    h.derivations.derive(SPEC, [REQ_OPEN]);
    // At first everything is open.
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(true);
    // The source is restricted LATER; the derived artifact follows at once.
    await restrict(h, REQ_OPEN, [{ userId: ADMIN, level: 'edit' }]);
    expect(await h.inheritance.effectivelyReadable(WS, BOB, SPEC)).toBe(false);
  });

  it('restriction is transitive through a derivation chain', async () => {
    const h = accessHarness();
    const task = { artifactType: 'task', artifactId: 'task_1' };
    h.derivations.derive(task, [SPEC]);
    h.derivations.derive(SPEC, [REQ_RESTRICTED]);
    await restrict(h, REQ_RESTRICTED, [{ userId: ALICE, level: 'edit' }]);

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
});
