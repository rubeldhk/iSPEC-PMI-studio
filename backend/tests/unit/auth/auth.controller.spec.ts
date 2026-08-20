/**
 * T024a — the auth controller, with a mocked identity provider.
 * Written to FAIL before T025 exists (Constitution V).
 *
 * Covers sign-in success, rejection, and session teardown. The controller is a
 * transport (PC-1): everything it does is delegate to the identity provider and
 * the session service, translate the outcome, and manage the cookie.
 */
import { describe, expect, it, vi } from 'vitest';
import { AuthController, SESSION_COOKIE } from '../../../src/modules/auth/auth.controller.js';
import type { Identity, IdentityProvider } from '../../../src/modules/auth/identity-provider.js';
import { SessionService } from '../../../src/modules/auth/sessions.js';
import {
  UnauthenticatedError,
  ValidationFailedError,
} from '../../../src/core/errors.js';

const IDENTITY: Identity = {
  userId: 'u1',
  workspaceId: 'ws_a',
  email: 'owner@example.test',
  displayName: 'Owner',
};

function provider(identity: Identity | null): IdentityProvider {
  return { authenticate: vi.fn(async () => identity) };
}

interface FakeResponse {
  setHeader: ReturnType<typeof vi.fn>;
  headers: Record<string, string>;
}

function response(): FakeResponse {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
  };
}

function requestWithCookie(token: string): { headers: { cookie: string } } {
  return { headers: { cookie: `${SESSION_COOKIE}=${token}` } };
}

function build(identity: Identity | null = IDENTITY): {
  controller: AuthController;
  sessions: SessionService;
} {
  const sessions = new SessionService();
  return { controller: new AuthController(provider(identity), sessions), sessions };
}

describe('AuthController · sign-in', () => {
  it('establishes a session and returns user and workspace identity', async () => {
    const { controller } = build();
    const res = response();
    const out = await controller.signIn(
      { email: 'owner@example.test', password: 'pw' },
      res as never,
    );
    expect(out).toEqual({
      user: { id: 'u1', email: 'owner@example.test', displayName: 'Owner' },
      workspace: { id: 'ws_a' },
    });
    // Session cookie: HTTP-only, per contracts/platform-api.md.
    const cookie = res.headers['set-cookie'];
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('never returns a password hash from any auth response', async () => {
    const { controller } = build();
    const out = await controller.signIn(
      { email: 'owner@example.test', password: 'pw' },
      response() as never,
    );
    expect(JSON.stringify(out)).not.toMatch(/passwordHash|password/);
  });

  it('rejects bad credentials with unauthenticated — and sets no cookie', async () => {
    const { controller } = build(null);
    const res = response();
    await expect(
      controller.signIn({ email: 'owner@example.test', password: 'wrong' }, res as never),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('refuses a request missing email or password, naming the fields (FR-007 shape)', async () => {
    const { controller } = build();
    const err = await controller
      .signIn({ email: '', password: '' }, response() as never)
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    const details = (err as ValidationFailedError).details as {
      fields: { field: string }[];
    };
    expect(details.fields.map((f) => f.field).sort()).toEqual(['email', 'password']);
  });
});

describe('AuthController · me', () => {
  it('returns the current user and workspace for a live session', async () => {
    const { controller, sessions } = build();
    const record = sessions.create(IDENTITY);
    const out = await controller.me(requestWithCookie(record.token) as never);
    expect(out).toEqual({
      user: { id: 'u1', email: 'owner@example.test', displayName: 'Owner' },
      workspace: { id: 'ws_a' },
    });
  });

  it('rejects with unauthenticated when there is no session cookie', async () => {
    const { controller } = build();
    await expect(controller.me({ headers: {} } as never)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('rejects with unauthenticated when the token resolves to nothing', async () => {
    const { controller } = build();
    await expect(
      controller.me(requestWithCookie('stale-token') as never),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('AuthController · sign-out (session teardown)', () => {
  it('destroys the session and expires the cookie', async () => {
    const { controller, sessions } = build();
    const record = sessions.create(IDENTITY);
    const res = response();
    await controller.signOut(requestWithCookie(record.token) as never, res as never);

    // The server-side session is gone…
    expect(sessions.resolve(record.token)).toBeNull();
    // …and the browser is told to drop the cookie.
    expect(res.headers['set-cookie']).toMatch(/Max-Age=0/i);

    // A subsequent `me` with the old token is refused.
    await expect(
      controller.me(requestWithCookie(record.token) as never),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('is idempotent — signing out with no session still succeeds', async () => {
    const { controller } = build();
    const res = response();
    await expect(
      controller.signOut({ headers: {} } as never, res as never),
    ).resolves.toEqual({ signedOut: true });
  });
});

describe('SessionService', () => {
  it('expires sessions after their time-to-live', () => {
    let now = Date.parse('2026-08-20T10:00:00Z');
    const sessions = new SessionService({ ttlMs: 1000, now: () => new Date(now) });
    const record = sessions.create(IDENTITY);
    expect(sessions.resolve(record.token)).not.toBeNull();
    now += 1001;
    expect(sessions.resolve(record.token)).toBeNull();
  });

  it('issues opaque, unique tokens', () => {
    const sessions = new SessionService();
    const a = sessions.create(IDENTITY).token;
    const b = sessions.create(IDENTITY).token;
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    // Opaque: nothing about the identity is recoverable from the token.
    expect(a).not.toContain('u1');
    expect(a).not.toContain('ws_a');
  });
});
