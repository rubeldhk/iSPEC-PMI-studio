/**
 * `T1253` (EPIC-038) — nothing crosses a tenant boundary.
 *
 * `FR-CTX-050`, `SC-CTX-003`.
 *
 * ## Why this one is P1 when provenance and budgets are not
 *
 * Every other failure in this Epic is correctable. A wrong classification is
 * reclassified; a superseded item is re-marked; a package assembled under the
 * wrong budget is assembled again. **A leaked package has already been read.**
 * There is no version of "fix it" that unreads material.
 *
 * ## The control matters more here than anywhere else in the Epic
 *
 * An isolation test over a corpus containing nothing to leak proves the
 * fixture, not the boundary — and it passes identically whether the check
 * exists or not. So every assertion below runs against a corpus that
 * **provably contains another workspace's material**, and one test asserts that
 * containment directly.
 */
import { describe, expect, it } from 'vitest';
import { judgeBoundary } from '../../src/modules/context/isolation.js';
import type { AuthorisationReader } from '../../src/modules/context/isolation.js';

/** A reader with no authorisations at all — the ordinary case. */
const none: AuthorisationReader = {
  async find() {
    return null;
  },
};

const foreign = { sourceType: 'requirement', sourceId: 'rq_other', workspaceId: 'ws_b' };
const own = { sourceType: 'requirement', sourceId: 'rq_1', workspaceId: 'ws_a' };

describe('T1253 · material from another workspace does not cross', () => {
  it('is refused', async () => {
    const verdict = await judgeBoundary(foreign, 'ws_a', none);
    expect(verdict.allowed).toBe(false);
  });

  it('and the refusal names the boundary rather than a vague denial', async () => {
    const verdict = await judgeBoundary(foreign, 'ws_a', none);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.reason).toMatch(/ws_b/);
      expect(verdict.reason).toMatch(/authoris/i);
    }
  });

  it('the fixture really does contain another workspace’s material', async () => {
    // The control the whole file rests on. Without it, every assertion here
    // would pass against a corpus with nothing to leak — proving the fixture
    // and not the boundary.
    expect(foreign.workspaceId).not.toBe('ws_a');
  });
});

describe('T1253 · and material from the requesting workspace does', () => {
  it('is allowed', async () => {
    // The other control. A `judgeBoundary` that refused everything would
    // satisfy every assertion above while making the Room useless.
    const verdict = await judgeBoundary(own, 'ws_a', none);
    expect(verdict.allowed).toBe(true);
  });

  it('and is not marked as a crossing, because it did not cross', async () => {
    // `FR-CTX-052`'s marking must mean something. If own-workspace material
    // were marked too, the flag would stop distinguishing anything and a
    // reviewer scanning for crossings would find every item.
    const verdict = await judgeBoundary(own, 'ws_a', none);
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.crossBoundary).toBe(false);
  });

  it('and carries no authorisation reference, since none was needed', async () => {
    const verdict = await judgeBoundary(own, 'ws_a', none);
    expect(verdict).not.toHaveProperty('authorisationRef');
  });
});
