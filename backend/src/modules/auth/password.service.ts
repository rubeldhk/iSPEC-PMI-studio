/**
 * T022 — Argon2id password hashing (R-008, tech-stack.md).
 *
 * Argon2id, not bcrypt — decided in `_shared/tech-stack.md` and recorded in the
 * dependency register (D-09). The digest is a PHC string carrying its own salt
 * and parameters, so verification needs no side table.
 *
 * Framework-free (PC-1): no HTTP, no ORM. Wired in `auth.module.ts`.
 */
import argon2 from 'argon2';

/** The narrow slice sign-in needs — the identity provider depends on this, not on argon2. */
export interface PasswordVerifier {
  verify(digest: string, plain: string): Promise<boolean>;
}

export interface PasswordHasher extends PasswordVerifier {
  hash(plain: string): Promise<string>;
}

export class Argon2PasswordService implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    if (!plain || plain.trim() === '') {
      // Named so a caller can surface it as a validation failure (FR-007 shape).
      throw new Error('password is required and cannot be empty.');
    }
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(digest: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(digest, plain);
    } catch {
      // A malformed or corrupted digest is a non-match, not an internal error:
      // this runs on the sign-in path with whatever the database returned, and
      // a crash here would turn "wrong password" into a 500.
      return false;
    }
  }
}
