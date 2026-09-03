/**
 * `T1255` (EPIC-038) — an authorisation runs one way.
 *
 * `FR-CTX-051`, `FR-CTX-052`.
 *
 * ## Why direction is asserted separately
 *
 * *"A may read B's handbook"* does not imply *"B may read A's handbook"*, and
 * nothing about the first statement suggests the second. But a symmetric
 * implementation is the easy one to write — a row with two workspace columns
 * and a lookup that matches either — and it grants a permission **nobody
 * stated**.
 *
 * The failure is silent and asymmetric in consequence: the workspace that
 * shared something generously discovers it has also taken something it never
 * asked for, and no record anywhere says a decision was made.
 *
 * `T1254` proves an authorised crossing works. This proves it works in exactly
 * one direction, which is a different claim and the one a symmetric lookup
 * would pass while breaking.
 */
import { describe, expect, it } from 'vitest';
import { judgeBoundary } from '../../src/modules/context/isolation.js';
import type { AuthorisationReader } from '../../src/modules/context/isolation.js';

/**
 * One authorisation, stated in one direction: `ws_b` grants `ws_a`.
 *
 * The reader matches on both endpoints deliberately — a fixture that matched
 * loosely would make the assertions below pass for the wrong reason.
 */
const oneWay: AuthorisationReader = {
  async find(input) {
    return input.fromWorkspaceId === 'ws_b' && input.toWorkspaceId === 'ws_a'
      ? {
          id: 'rka_1',
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          workspaceId: 'ws_b',
          toWorkspaceId: 'ws_a',
          authorisedBy: 'u_owner',
          rationale: 'the shared engineering handbook',
        }
      : null;
  },
};

const bsHandbook = { sourceType: 'handbook', sourceId: 'hb_b', workspaceId: 'ws_b' };
const asHandbook = { sourceType: 'handbook', sourceId: 'hb_a', workspaceId: 'ws_a' };

describe('T1255 · the granted direction works', () => {
  it('ws_a may read ws_b’s handbook', async () => {
    const verdict = await judgeBoundary(bsHandbook, 'ws_a', oneWay);
    expect(verdict.allowed).toBe(true);
  });
});

describe('T1255 · and the reverse does not', () => {
  it('ws_b may NOT read ws_a’s handbook on the strength of it', async () => {
    // The assertion a symmetric lookup fails. Everything else about this case
    // looks identical to the one above: same source type, same shape of
    // authorisation, same two workspaces.
    const verdict = await judgeBoundary(asHandbook, 'ws_b', oneWay);
    expect(verdict.allowed).toBe(false);
  });

  it('and the refusal does not cite the authorisation that points the other way', async () => {
    // Citing it would be worse than refusing plainly: a reader would see an
    // authorisation named in a refusal and conclude the system was confused,
    // rather than that they need a second grant.
    const verdict = await judgeBoundary(asHandbook, 'ws_b', oneWay);
    if (!verdict.allowed) expect(verdict.reason).not.toMatch(/rka_1/);
  });

  it('and the two verdicts differ, which is the whole point', async () => {
    const forward = await judgeBoundary(bsHandbook, 'ws_a', oneWay);
    const backward = await judgeBoundary(asHandbook, 'ws_b', oneWay);
    expect([forward.allowed, backward.allowed]).toEqual([true, false]);
  });
});

describe('T1255 · a third workspace is not carried along', () => {
  it('ws_c may not read ws_b’s handbook because ws_a was granted it', async () => {
    // An authorisation is between two named workspaces. A lookup keyed only on
    // the source would let every workspace in once any workspace was let in.
    const verdict = await judgeBoundary(bsHandbook, 'ws_c', oneWay);
    expect(verdict.allowed).toBe(false);
  });
});
