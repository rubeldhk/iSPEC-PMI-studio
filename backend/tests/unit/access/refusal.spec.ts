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
    const listing = await h.enforcement.filterReadable(WS, BOB, [SPEC, REQ_OPEN]);
    // The restricted one is simply not there; the open one is.
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

  it('an open artifact refuses no one and hides from no one', async () => {
    const h = accessHarness();
    await h.enforcement.requireReadable(WS, BOB, REQ_OPEN);
    expect(await h.enforcement.filterReadable(WS, ALICE, [REQ_OPEN])).toEqual([REQ_OPEN]);
  });
});
