/**
 * T026 — contract tests for `/auth/*` against `contracts/platform-api.md`.
 *
 * Two layers of assertion, matching what the contract actually promises:
 *
 * 1. **Route surface** — the paths and methods the document tables declare,
 *    read from the controller's routing metadata. The `/v1` prefix is applied
 *    globally in `main.ts` (D-8) and asserted there, not per controller.
 * 2. **Response and error shapes** — the universal rules: errors carry a
 *    machine-readable `code`, validation failures name the field (FR-007),
 *    passwords never appear in any response, and 401 is the status for a
 *    missing or invalid session.
 */
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { AuthController, SESSION_COOKIE } from '../../src/modules/auth/auth.controller.js';
import type { IdentityProvider } from '../../src/modules/auth/identity-provider.js';
import { SessionService } from '../../src/modules/auth/sessions.js';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';

/** Nest routing metadata keys (PATH_METADATA / METHOD_METADATA). */
const PATH = 'path';
const METHOD = 'method';

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = AuthController.prototype[handler as keyof AuthController] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

const provider = (identity: Awaited<ReturnType<IdentityProvider['authenticate']>>): IdentityProvider => ({
  authenticate: vi.fn(async () => identity),
});

const res = (): { setHeader: ReturnType<typeof vi.fn> } => ({ setHeader: vi.fn() });

describe('contract · Authentication route surface', () => {
  it('is served under /auth', () => {
    expect(Reflect.getMetadata(PATH, AuthController)).toBe('auth');
  });

  it('POST /auth/sign-in establishes a session', () => {
    expect(route('signIn')).toEqual({ path: 'sign-in', method: RequestMethod.POST });
  });

  it('POST /auth/sign-out ends the session', () => {
    expect(route('signOut')).toEqual({ path: 'sign-out', method: RequestMethod.POST });
  });

  it('GET /auth/me returns the current user and workspace', () => {
    expect(route('me')).toEqual({ path: 'me', method: RequestMethod.GET });
  });

  it('sign-in and sign-out return 200, not Nest\'s default 201', () => {
    for (const handler of ['signIn', 'signOut'] as const) {
      const fn = AuthController.prototype[handler] as object;
      expect(Reflect.getMetadata('__httpCode__', fn), `${handler} status`).toBe(200);
    }
  });
});

describe('contract · response shapes and universal rules', () => {
  const IDENTITY = {
    userId: 'u1',
    workspaceId: 'ws_a',
    email: 'owner@example.test',
    displayName: 'Owner',
  };

  it('sign-in returns user and workspace identity, and an HTTP-only cookie', async () => {
    const controller = new AuthController(provider(IDENTITY), new SessionService());
    const response = res();
    const body = await controller.signIn(
      { email: 'owner@example.test', password: 'pw' },
      response as never,
    );
    expect(body).toEqual({
      user: { id: 'u1', email: 'owner@example.test', displayName: 'Owner' },
      workspace: { id: 'ws_a' },
    });
    const cookie = response.setHeader.mock.calls[0]?.[1] as string;
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('passwords are never returned by any read path', async () => {
    const sessions = new SessionService();
    const controller = new AuthController(provider(IDENTITY), sessions);
    const signIn = await controller.signIn(
      { email: 'owner@example.test', password: 'pw' },
      res() as never,
    );
    const token = sessions.create(IDENTITY).token;
    const me = await controller.me({ headers: { cookie: `${SESSION_COOKIE}=${token}` } } as never);
    for (const body of [signIn, me]) {
      expect(JSON.stringify(body)).not.toMatch(/password/i);
    }
  });

  it('a missing session is 401 with code "unauthenticated"', async () => {
    const controller = new AuthController(provider(null), new SessionService());
    const err = await controller.me({ headers: {} } as never).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(401);
    expect(toErrorBody(err).error.code).toBe('unauthenticated');
  });

  it('rejected credentials are 401 and do not say which half failed', async () => {
    const controller = new AuthController(provider(null), new SessionService());
    const err = await controller
      .signIn({ email: 'owner@example.test', password: 'wrong' }, res() as never)
      .catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(401);
    const body = toErrorBody(err);
    expect(body.error.code).toBe('unauthenticated');
    // "Invalid email or password" is fine; "unknown email" / "wrong password" /
    // "no such user" would each confirm account existence.
    expect(body.error.message).not.toMatch(/unknown email|no such (user|account)|wrong password|password (is )?incorrect/i);
  });

  it('validation failures are 400 and name the missing fields (FR-007)', async () => {
    const controller = new AuthController(provider(IDENTITY), new SessionService());
    const err = await controller.signIn({}, res() as never).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(400);
    const body = toErrorBody(err);
    expect(body.error.code).toBe('validation_failed');
    const details = body.error.details as { fields: { field: string; reason: string }[] };
    expect(details.fields.map((f) => f.field).sort()).toEqual(['email', 'password']);
  });
});
