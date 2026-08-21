/**
 * T419 — contract tests for grant, revoke and access-attempt endpoints
 * against `specs/002-team-review-access-storage/contracts/platform-api-epic-002.md`
 * (Access grants · FR-ACC-021 to FR-ACC-028).
 *
 * The contract's claims:
 *   - GET/POST grants and GET access-attempts require `edit` on the artifact;
 *   - `userId` and `level` are required on POST;
 *   - revoking the last `edit` grant → 409 (FR-ACC-027);
 *   - granting on an artifact the caller cannot edit → 404, absence.
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  NotFoundError,
  ValidationFailedError,
  toHttpStatus,
} from '../../src/core/errors.js';
import { AccessController } from '../../src/modules/access/access.controller.js';
import {
  WS,
  ADMIN,
  ALICE,
  BOB,
  SPEC,
  accessHarness,
  restrict,
  type AccessHarness,
} from '../unit/access/helpers.js';

const CTX_ADMIN = { workspaceId: WS, userId: ADMIN };

function controller(h: AccessHarness): AccessController {
  return new AccessController(h.grantService, h.enforcement);
}

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = AccessController.prototype[handler as keyof AccessController] as object;
  return {
    path: Reflect.getMetadata('path', fn) as string,
    method: Reflect.getMetadata('method', fn) as RequestMethod,
  };
}

describe('contract · access route surface', () => {
  it.each([
    ['list', 'artifacts/:type/:id/grants', RequestMethod.GET],
    ['grant', 'artifacts/:type/:id/grants', RequestMethod.POST],
    ['revoke', 'artifacts/:type/:id/grants/:grantId', RequestMethod.DELETE],
    ['attempts', 'artifacts/:type/:id/access-attempts', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });
});

describe('contract · required fields (FR-ACC-021)', () => {
  it('userId and level are required', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const c = controller(h);
    await expect(
      c.grant(CTX_ADMIN, SPEC.artifactType, SPEC.artifactId, { userId: ALICE }),
    ).rejects.toThrow(ValidationFailedError);
    await expect(
      c.grant(CTX_ADMIN, SPEC.artifactType, SPEC.artifactId, { level: 'read' }),
    ).rejects.toThrow(ValidationFailedError);
  });
});

describe('contract · the refusal table', () => {
  it('revoking the last edit grant → 409, enforced in the revoke operation', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const only = (await h.grantService.activeGrants(WS, SPEC))[0]!;
    const attempt = controller(h).revoke(CTX_ADMIN, SPEC.artifactType, SPEC.artifactId, only.id);
    const err = await attempt.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(toHttpStatus(err)).toBe(409);
  });

  it('granting on an artifact the caller cannot edit → 404, per the artifact rule', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const attempt = controller(h).grant(
      { workspaceId: WS, userId: BOB },
      SPEC.artifactType,
      SPEC.artifactId,
      { userId: BOB, level: 'edit' },
    );
    const err = await attempt.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(toHttpStatus(err)).toBe(404);
  });

  it('every refusal is recorded (FR-ACC-023) — the attempts endpoint returns it', async () => {
    const h = accessHarness();
    await restrict(h, SPEC, [{ userId: ADMIN, level: 'edit' }]);
    const c = controller(h);
    await c
      .grant({ workspaceId: WS, userId: BOB }, SPEC.artifactType, SPEC.artifactId, {
        userId: BOB,
        level: 'edit',
      })
      .catch(() => undefined);
    const attempts = await c.attempts(CTX_ADMIN, SPEC.artifactType, SPEC.artifactId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ userId: BOB, action: 'grant' });
  });
});
