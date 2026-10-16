/**
 * `T2121` (EPIC-039, `FR-HUB-045`, `R-039-10`) — one list of credential shapes.
 *
 * `EPIC-037`'s execution sanitiser and the Hub must agree about what a secret
 * looks like, so the list lives once — here — and the sanitiser imports it.
 * Asserted **by identity**, not by copy — from the backend side, in
 * `backend/tests/unit/integrations-redaction.spec.ts`, because this package
 * imports nothing from the repository.
 *
 * Written to FAIL before `T2122`.
 */
import { describe, expect, it } from 'vitest';
import { SECRET_PATTERNS, findSecret, looksLikeSecret } from '../src/redaction.js';
import { CAPABILITY_PORTS } from '../src/ports.js';

describe('T2121 · the secret patterns are one list', () => {
  it('is frozen — the one list cannot be edited at runtime by an importer', () => {
    // The identity with `EPIC-037`'s sanitiser is asserted from the backend side
    // (`backend/tests/unit/integrations-redaction.spec.ts`): this package depends
    // on nothing in the repository, its tests included.
    expect(Object.isFrozen(SECRET_PATTERNS)).toBe(true);
  });

  it('recognises the canary the SC-HUB-004 suite plants', () => {
    expect(looksLikeSecret('pmi-canary-0b3f2c1e-4d5a-4e6f-9a7b-8c9d0e1f2a3b')).toBe(true);
    expect(looksLikeSecret('build pmi-canary-0b3f2c1e-4d5a-4e6f-9a7b-8c9d0e1f2a3b failed')).toBe(true);
  });

  it('still recognises the shapes it always did, and not ordinary text', () => {
    expect(looksLikeSecret('ghp_abcdefghijklmnopqrstuvwxyz0123')).toBe(true);
    expect(looksLikeSecret('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
    expect(looksLikeSecret('the build passed on main')).toBe(false);
  });

  it('finds a secret anywhere in a value and names its path', () => {
    expect(findSecret({ body: { text: ['ok', 'token ghp_abcdefghijklmnopqrstuvwxyz0123'] } })).toBe('body.text.1');
    expect(findSecret({ subject: 'hello' })).toBeNull();
  });
});

describe('T2122 · CAPABILITY_PORTS — what each absent port does', () => {
  it('declares the six ports and the two it fills, each with an owner and an absent behaviour', () => {
    expect(CAPABILITY_PORTS.map((p) => p.name)).toEqual(['CapabilityPolicy', 'EvidenceSink', 'CredentialKeyring', 'ExecutionEvents', 'RegistryAccess', 'ProjectOwnerGrant', 'EmbeddingPort', 'AttestationSource']);
    for (const p of CAPABILITY_PORTS) {
      expect(p.filledBy.length).toBeGreaterThan(0);
      expect(p.absent.length).toBeGreaterThan(0);
    }
    expect(CAPABILITY_PORTS.find((p) => p.name === 'CapabilityPolicy')!.absent).toMatch(/^refuse/);
  });
});
