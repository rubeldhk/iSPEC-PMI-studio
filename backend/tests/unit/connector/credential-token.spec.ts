/**
 * `T1353` (EPIC-041) — token generation and verification (`R-041-3`).
 *
 * 32 random bytes, `pmi_ct_` prefix, base64url; the stored digest is
 * `sha256`; verification is constant-time and rejects a one-character change;
 * the value is not part of anything that is stored (`FR-LPW-021`).
 *
 * Written to FAIL before `T1354` exists.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CREDENTIAL_PREFIX,
  LOOKUP_PREFIX_LENGTH,
  bearerToken,
  hashToken,
  lookupPrefix,
  mintToken,
  verifyToken,
} from '../../../src/modules/connector/credential-token.js';

describe('T1353 · mintToken', () => {
  it('draws 32 bytes from the supplied randomness and presents them as pmi_ct_<base64url>', () => {
    const bytes = Buffer.alloc(32, 7);
    const minted = mintToken(() => bytes);
    expect(minted.value).toBe(`${CREDENTIAL_PREFIX}${bytes.toString('base64url')}`);
    expect(minted.value).toMatch(/^pmi_ct_[A-Za-z0-9_-]{43}$/);
  });

  it('uses the platform CSPRNG by default and never repeats', () => {
    const values = new Set(Array.from({ length: 50 }, () => mintToken().value));
    expect(values.size).toBe(50);
  });

  it('records the sha256 hex digest and the first eight characters after the prefix — never the value', () => {
    const minted = mintToken();
    expect(minted.tokenHash).toBe(createHash('sha256').update(minted.value).digest('hex'));
    expect(minted.tokenPrefix).toBe(minted.value.slice(CREDENTIAL_PREFIX.length, CREDENTIAL_PREFIX.length + LOOKUP_PREFIX_LENGTH));
    expect(minted.tokenPrefix).toHaveLength(LOOKUP_PREFIX_LENGTH);
    const stored = { tokenPrefix: minted.tokenPrefix, tokenHash: minted.tokenHash };
    expect(JSON.stringify(stored)).not.toContain(minted.value);
  });
});

describe('T1353 · verifyToken', () => {
  it('accepts the value whose digest was stored', () => {
    const minted = mintToken();
    expect(verifyToken(minted.value, minted.tokenHash)).toBe(true);
  });

  it('rejects a one-character change anywhere in the value', () => {
    const minted = mintToken();
    const last = minted.value.length - 1;
    const flipped = minted.value.slice(0, last) + (minted.value[last] === 'A' ? 'B' : 'A');
    expect(verifyToken(flipped, minted.tokenHash)).toBe(false);
    const early = `${minted.value.slice(0, 10)}${minted.value[10] === 'x' ? 'y' : 'x'}${minted.value.slice(11)}`;
    expect(verifyToken(early, minted.tokenHash)).toBe(false);
  });

  it('compares digests of equal length, so a malformed stored hash cannot throw', () => {
    expect(verifyToken('pmi_ct_whatever', 'not-a-digest')).toBe(false);
    expect(hashToken('a')).toHaveLength(64);
  });
});

describe('T1353 · parsing the wire form', () => {
  it('lookupPrefix reads the eight characters after pmi_ct_, and refuses anything else', () => {
    const minted = mintToken();
    expect(lookupPrefix(minted.value)).toBe(minted.tokenPrefix);
    expect(lookupPrefix('sk-ant-abcdefghijk')).toBeNull();
    expect(lookupPrefix('pmi_ct_short')).toBeNull();
  });

  it('bearerToken reads Authorization: Bearer <token> and nothing else', () => {
    expect(bearerToken('Bearer pmi_ct_abc')).toBe('pmi_ct_abc');
    expect(bearerToken('bearer pmi_ct_abc')).toBe('pmi_ct_abc');
    expect(bearerToken('Basic dXNlcjpwdw==')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken('')).toBeNull();
  });
});
