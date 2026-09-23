/**
 * T373 — an ungranted artifact is HIDDEN from listings, not shown as
 * inaccessible, and every refused attempt reaches the audit record
 * (FR-ACC-023, FR-ACC-024, SC-007, SC-013).
 */
import { describe, expect, it } from 'vitest';
import { NotFoundError, toHttpStatus } from '../../../src/core/errors.js';
import { WS, ADMIN, ALICE, BOB, SPEC, REQ_OPEN, accessHarness, restrict } from './helpers.js';

describe('T373 · refuse, hide, record', () => {
  it('hides an ungranted artifact from listings — no placeholder, no error', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    // BOB is granted on the second artifact. Under deny-by-default the
    // contrast is between what BOB was granted and what he was not — it used
    // to be between a restricted artifact and an ungoverned one, which no
    // longer exists.
    await restrict(h, REQ_OPEN, [{ userId: BOB, level: 'read' }]);
    const listing = await h.enforcement.filterReadable(WS, BOB, [SPEC, REQ_OPEN]);
    // The one he cannot read is simply not there — no placeholder, no error.
    expect(listing).toEqual([REQ_OPEN]);
  });

  it('direct access is refused as ABSENT — 404, never 403', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const attempt = h.enforcement.requireReadable(WS, BOB, SPEC);
    await expect(attempt).rejects.toThrow(NotFoundError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(404);
  });

  it('every refused attempt reaches the record — who, what, when, why (SC-007)', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const when = new Date('2026-08-21T12:00:00Z');
    await h.enforcement.requireReadable(WS, BOB, SPEC, 'read', when).catch(() => undefined);

    const attempts = await h.enforcement.attemptsFor(WS, SPEC);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      userId: BOB,
      artifactType: SPEC.artifactType,
      artifactId: SPEC.artifactId,
      action: 'read',
    });
    expect(attempts[0]!.reason).not.toBe('');
    expect(attempts[0]!.attemptedAt).toEqual(when);
  });

  it('a permitted access records nothing — the record is refusals, not surveillance', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    await h.enforcement.requireReadable(WS, ADMIN, SPEC);
    expect(await h.enforcement.attemptsFor(WS, SPEC)).toHaveLength(0);
  });

  it('an UNGRANTED artifact refuses everyone and hides from everyone (X19)', async () => {
    // **Inverted in C2E.** This asserted the opposite — that an artifact with
    // no grants "refuses no one and hides from no one". That was the defect:
    // a governed artifact nobody had granted was readable by anyone who could
    // name the workspace, and a newly created specification had no grants at
    // all. The assertion is kept, pointed the other way, so the old behaviour
    // cannot return quietly.
    const h = accessHarness();
    await expect(h.enforcement.requireReadable(WS, BOB, REQ_OPEN)).rejects.toThrow(NotFoundError);
    expect(await h.enforcement.filterReadable(WS, ALICE, [REQ_OPEN])).toEqual([]);
  });

  it('a granted artifact is reachable by its grantee, and by nobody else', async () => {
    // The other half: deny-by-default must not deny the person who WAS granted.
    const h = accessHarness();
    await restrict(h, REQ_OPEN, [{ userId: ALICE, level: 'read' }]);
    await h.enforcement.requireReadable(WS, ALICE, REQ_OPEN);
    expect(await h.enforcement.filterReadable(WS, ALICE, [REQ_OPEN])).toEqual([REQ_OPEN]);
    await expect(h.enforcement.requireReadable(WS, BOB, REQ_OPEN)).rejects.toThrow(NotFoundError);
  });

  it('an actor from another workspace is refused even naming the right artifact (X19)', async () => {
    // The boundary, not the grants: CAROL holds no identity in this workspace,
    // so the grant lookup is never reached.
    const h = accessHarness();
    await restrict(h, REQ_OPEN, [{ userId: 'u_carol', level: 'read' }]);
    await expect(h.enforcement.requireReadable(WS, 'u_carol', REQ_OPEN)).rejects.toThrow(
      NotFoundError,
    );
    const attempts = await h.enforcement.attemptsFor(WS, REQ_OPEN);
    expect(attempts.at(-1)?.reason).toMatch(/workspace boundary/i);
  });
});
