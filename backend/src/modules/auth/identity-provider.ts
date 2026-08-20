/**
 * T024 — the identity-provider boundary and its local implementation (R-008).
 *
 * The interface is the whole point: Phase 3 SSO must be a SECOND implementation
 * of `IdentityProvider`, never a change to the request pipeline — the same
 * adapter argument ADR-0001 makes for engines. Nothing outside this module may
 * assume passwords exist at all.
 *
 * Framework-free (PC-1). Wired in `auth.module.ts`.
 */
import type { PasswordVerifier } from './password.service.js';

/** What a successful authentication establishes. Never carries a credential. */
export interface Identity {
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
}

export interface IdentityProvider {
  /** Resolve credentials to an identity, or null — never an error — on a mismatch. */
  authenticate(email: string, password: string): Promise<Identity | null>;
}

/** The one read path that legitimately sees `passwordHash`. */
export interface DirectoryUser {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

export interface UserDirectory {
  findByEmail(email: string): Promise<DirectoryUser | null>;
}

/** The subset of a Prisma delegate the directory needs (T463/T651 precedent). */
export interface UserDelegate {
  findUnique(args: {
    where: { email: string };
  }): Promise<DirectoryUser | null>;
}

export class PrismaUserDirectory implements UserDirectory {
  constructor(private readonly user: UserDelegate) {}

  async findByEmail(email: string): Promise<DirectoryUser | null> {
    return this.user.findUnique({ where: { email } });
  }
}

/**
 * Raised when the directory has not been configured. Refuses rather than
 * pretends — the same posture as `UnconfiguredAuditWriter` (T674): a directory
 * that answered "no such user" to everyone would look like a credentials
 * problem, and nothing would say the adapter was missing.
 */
export class UserDirectoryUnavailableError extends Error {
  constructor() {
    super(
      'The user directory is not configured. Provide USER_DIRECTORY at the composition root; ' +
        'refusing to answer a sign-in it cannot actually check.',
    );
    this.name = 'UserDirectoryUnavailableError';
  }
}

export class UnconfiguredUserDirectory implements UserDirectory {
  async findByEmail(): Promise<DirectoryUser | null> {
    throw new UserDirectoryUnavailableError();
  }
}

export class LocalIdentityProvider implements IdentityProvider {
  constructor(
    private readonly directory: UserDirectory,
    private readonly passwords: PasswordVerifier,
  ) {}

  async authenticate(email: string, password: string): Promise<Identity | null> {
    const user = await this.directory.findByEmail(email.trim().toLowerCase());
    // No user → no verification. There is no stored digest to compare against,
    // and inventing one would turn "unknown user" into an internal error path.
    if (user === null) return null;

    const matches = await this.passwords.verify(user.passwordHash, password);
    if (!matches) return null;

    // The hash stops here (data-model.md: never returned by any read path).
    return {
      userId: user.id,
      workspaceId: user.workspaceId,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
