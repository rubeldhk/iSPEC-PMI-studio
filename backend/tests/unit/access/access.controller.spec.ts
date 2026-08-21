/**
 * T418 — the access controller: a grant request on an artifact the caller
 * cannot edit returns ABSENCE, not forbidden.
 *
 * Written to FAIL before T420 exists (Constitution V).
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, toHttpStatus } from '../../../src/core/errors.js';
import { AccessController } from '../../../src/modules/access/access.controller.js';
import { WS, ADMIN, ALICE, BOB, SPEC, accessHarness, restrict, type AccessHarness } from './helpers.js';

const CTX_ADMIN = { workspaceId: WS, userId: ADMIN };
const CTX_BOB = { workspaceId: WS, userId: BOB };

function controller(h: AccessHarness): AccessController {
  return new AccessController(h.grantService, h.enforcement);
}

describe('T418 · access controller', () => {
  it('grants and lists on an artifact the caller can edit', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const c = controller(h);
    const created = await c.grant(CTX_ADMIN, SPEC.artifactType, SPEC.artifactId, {
      userId: ALICE,
      level: 'read',
    });
    expect(created.userId).toBe(ALICE);
    const listed = await c.list(CTX_ADMIN, SPEC.artifactType, SPEC.artifactId);
    expect(listed).toHaveLength(2);
  });

  it('a grant request on an artifact the caller cannot edit is ABSENT — 404, never 403', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const attempt = controller(h).grant(CTX_BOB, SPEC.artifactType, SPEC.artifactId, {
      userId: BOB,
      level: 'edit',
    });
    await expect(attempt).rejects.toThrow(NotFoundError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(404);
    // …and the refusal reached the record.
    expect((await h.enforcement.attemptsFor(WS, SPEC)).length).toBeGreaterThan(0);
  });

  it('listing grants requires edit too — absence otherwise', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }, { userId: ALICE, level: 'read' }]);
    // ALICE holds read, not edit: the grant register is absent to her.
    await expect(
      controller(h).list({ workspaceId: WS, userId: ALICE }, SPEC.artifactType, SPEC.artifactId),
    ).rejects.toThrow(NotFoundError);
  });

  it('revoking the last edit grant is 409 — the last-editor invariant', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const admins = (await h.grantService.activeGrants(WS, SPEC))[0]!;
    const attempt = controller(h).revoke(CTX_ADMIN, SPEC.artifactType, SPEC.artifactId, admins.id);
    await expect(attempt).rejects.toThrow(ConflictError);
    expect(toHttpStatus(await attempt.catch((e: unknown) => e))).toBe(409);
  });

  it('access-attempts lists the refusals for an editor', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    await h.enforcement.requireReadable(WS, BOB, SPEC).catch(() => undefined);
    const attempts = await controller(h).attempts(CTX_ADMIN, SPEC.artifactType, SPEC.artifactId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.userId).toBe(BOB);
  });
});
