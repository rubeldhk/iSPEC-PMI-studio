/**
 * T023 — the identity-provider boundary.
 * Written to FAIL before T024 exists (Constitution V).
 *
 * R-008: all authentication sits behind this interface so Phase 3 SSO replaces
 * an adapter, not the request pipeline — the same argument ADR-0001 makes for
 * engines. The local implementation is one adapter; nothing outside the auth
 * module may assume passwords exist at all.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  LocalIdentityProvider,
  type DirectoryUser,
  type UserDirectory,
} from '../../../src/modules/auth/identity-provider.js';
import type { PasswordVerifier } from '../../../src/modules/auth/password.service.js';

const USER: DirectoryUser = {
  id: 'u1',
  workspaceId: 'ws_a',
  email: 'owner@example.test',
  displayName: 'Owner',
  passwordHash: '$argon2id$stored',
};

function directory(user: DirectoryUser | null = USER): UserDirectory {
  return { findByEmail: vi.fn(async () => user) };
}

function verifier(matches: boolean): PasswordVerifier {
  return {
    verify: vi.fn(async (digest: string, plain: string) => {
      // The provider must hand the STORED digest and the SUPPLIED password on.
      expect(digest).toBe(USER.passwordHash);
      expect(plain).toBe('pw');
      return matches;
    }),
  };
}

describe('LocalIdentityProvider', () => {
  it('returns the identity on correct credentials — without the password hash', async () => {
    const provider = new LocalIdentityProvider(directory(), verifier(true));
    const identity = await provider.authenticate('owner@example.test', 'pw');
    expect(identity).toEqual({
      userId: 'u1',
      workspaceId: 'ws_a',
      email: 'owner@example.test',
      displayName: 'Owner',
    });
    // The hash never crosses the boundary (data-model.md: never returned by
    // any read path).
    expect(identity).not.toHaveProperty('passwordHash');
  });

  it('returns null on a wrong password', async () => {
    const provider = new LocalIdentityProvider(directory(), verifier(false));
    await expect(provider.authenticate('owner@example.test', 'pw')).resolves.toBeNull();
  });

  it('returns null for an unknown email', async () => {
    const provider = new LocalIdentityProvider(directory(null), {
      verify: vi.fn(async () => true),
    });
    await expect(provider.authenticate('nobody@example.test', 'pw')).resolves.toBeNull();
  });

  it('normalises the email before lookup — trimmed, lowercased', async () => {
    const dir = directory();
    const provider = new LocalIdentityProvider(dir, verifier(true));
    await provider.authenticate('  Owner@Example.TEST ', 'pw');
    expect(dir.findByEmail).toHaveBeenCalledWith('owner@example.test');
  });

  it('never calls the verifier when the user does not exist', async () => {
    // Nothing to compare against; calling verify with an invented digest would
    // turn "unknown user" into an internal error path.
    const verify = vi.fn(async () => true);
    const provider = new LocalIdentityProvider(directory(null), { verify });
    await provider.authenticate('nobody@example.test', 'pw');
    expect(verify).not.toHaveBeenCalled();
  });
});
