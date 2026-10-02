/**
 * `T1254` (EPIC-038) — an authorised reusable source crosses, and says it did.
 *
 * `FR-CTX-051`, `FR-CTX-052`, `FR-CTX-053`.
 *
 * ## The one exception, and the two things it must carry
 *
 * `BR-0095` allows exactly one crossing: a source **explicitly authorised** as
 * reusable knowledge. A shared engineering handbook is the case it exists for,
 * and without it every tenant re-writes the same document.
 *
 * The exception is only safe if it is **visible** and **attributable**. So a
 * crossing item is marked (`crossBoundary`), and the marking names the
 * authorisation that permitted it — a boolean alone would say *somebody decided
 * this was fine* without saying who, which is the same as not knowing.
 *
 * ## And the absence of a prohibition is not a permission
 *
 * `FR-CTX-053`. This is the direction the failure runs in practice: a reusable
 * source that nobody got round to authorising looks identical to one that was
 * authorised, if the check is *"is this marked reusable?"* rather than *"who
 * permitted this crossing?"*
 */
import { describe, expect, it } from 'vitest';
import { judgeBoundary } from '../../src/modules/context/isolation.js';
import type { AuthorisationReader } from '../../src/modules/context/isolation.js';

const handbook = { sourceType: 'handbook', sourceId: 'hb_1', workspaceId: 'ws_b' };

/** A reader holding one authorisation: `ws_b`'s handbook may be read by `ws_a`. */
const authorised: AuthorisationReader = {
  async find(input) {
    return input.sourceId === 'hb_1' &&
      input.fromWorkspaceId === 'ws_b' &&
      input.toWorkspaceId === 'ws_a'
      ? {
          id: 'rka_1',
          sourceType: 'handbook',
          sourceId: 'hb_1',
          workspaceId: 'ws_b',
          toWorkspaceId: 'ws_a',
          authorisedBy: 'u_owner',
          rationale: 'the shared engineering handbook is deliberately common',
        }
      : null;
  },
};

const none: AuthorisationReader = {
  async find() {
    return null;
  },
};

describe('T1254 · an authorised reusable source crosses', () => {
  it('is allowed', async () => {
    const verdict = await judgeBoundary(handbook, 'ws_a', authorised);
    expect(verdict.allowed).toBe(true);
  });

  it('and is marked as a crossing', async () => {
    // `FR-CTX-052`. Included silently, it would be indistinguishable from
    // material the requesting workspace owns — and the one item a reviewer most
    // needs to notice would be the one nothing points at.
    const verdict = await judgeBoundary(handbook, 'ws_a', authorised);
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.crossBoundary).toBe(true);
  });

  it('and names the authorisation that permitted it', async () => {
    // A boolean says *somebody decided this was fine*. The reference says who,
    // and lets a reviewer go and read the rationale.
    const verdict = await judgeBoundary(handbook, 'ws_a', authorised);
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed && verdict.crossBoundary) {
      expect(verdict.authorisationRef).toBe('rka_1');
    }
  });
});

describe('T1254 · FR-CTX-053 — an unauthorised reusable source does not', () => {
  it('is refused when no authorisation exists', async () => {
    // The absence of a prohibition is not a permission. This is the direction
    // the failure runs: a source nobody got round to authorising looks exactly
    // like an authorised one, to a check that asks "is this reusable?" instead
    // of "who permitted this?"
    const verdict = await judgeBoundary(handbook, 'ws_a', none);
    expect(verdict.allowed).toBe(false);
  });

  it('and the refusal says an authorisation is what is missing', async () => {
    const verdict = await judgeBoundary(handbook, 'ws_a', none);
    if (!verdict.allowed) expect(verdict.reason).toMatch(/no authorisation|not authorised/i);
  });

  it('and nothing about the source type grants the crossing by itself', async () => {
    // A `handbook` is not privileged because of what it is called. The same
    // source, the same type, refused — the only difference being the
    // authorisation.
    const withAuth = await judgeBoundary(handbook, 'ws_a', authorised);
    const without = await judgeBoundary(handbook, 'ws_a', none);
    expect([withAuth.allowed, without.allowed]).toEqual([true, false]);
  });
});
