/**
 * `T1354` (EPIC-041) — the connector credential's wire form (`R-041-3`).
 *
 * 32 bytes from the platform CSPRNG, presented as `pmi_ct_<base64url>`. The
 * platform keeps `sha256(value)` and an eight-character lookup prefix, never
 * the value (`FR-LPW-021`). Verification is a digest comparison in constant
 * time. No stretching: a high-entropy random token needs none, and it is
 * verified on every MCP call (`research.md` R-041-3 — Argon2 is the password
 * hash, `D-09`, and is deliberately slow).
 *
 * Nothing here is stored: `MintedToken` is what the minting service takes
 * apart into a record (prefix, digest) and a once-only response (value).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const CREDENTIAL_PREFIX = 'pmi_ct_';
/** Characters after the prefix that index the lookup (`data-model.md` §3). */
export const LOOKUP_PREFIX_LENGTH = 8;
/** 32 bytes as base64url. Anything shorter never came from `mintToken`. */
const BODY_LENGTH = 43;

export interface MintedToken {
  /** Shown once. Never stored, never logged. */
  readonly value: string;
  readonly tokenPrefix: string;
  /** `sha256(value)`, hex. */
  readonly tokenHash: string;
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** The lookup key, or null when the value is not shaped like a credential. */
export function lookupPrefix(value: string): string | null {
  if (!value.startsWith(CREDENTIAL_PREFIX)) return null;
  const body = value.slice(CREDENTIAL_PREFIX.length);
  if (body.length < BODY_LENGTH) return null;
  return body.slice(0, LOOKUP_PREFIX_LENGTH);
}

export function mintToken(random: () => Buffer = (): Buffer => randomBytes(32)): MintedToken {
  const value = `${CREDENTIAL_PREFIX}${random().toString('base64url')}`;
  const tokenPrefix = lookupPrefix(value);
  if (tokenPrefix === null) throw new Error('mintToken: the randomness supplied fewer than 32 bytes.');
  return { value, tokenPrefix, tokenHash: hashToken(value) };
}

/** Constant-time comparison of the presented value's digest with the stored one. */
export function verifyToken(value: string, tokenHash: string): boolean {
  const presented = Buffer.from(hashToken(value), 'hex');
  const stored = Buffer.from(tokenHash, 'hex');
  if (stored.length === 0 || stored.length !== presented.length) return false;
  return timingSafeEqual(presented, stored);
}

/** `Authorization: Bearer <token>` → the token; anything else → null. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}
