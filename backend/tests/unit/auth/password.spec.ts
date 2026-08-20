/**
 * T021 — Argon2id hashing and verification.
 * Written to FAIL before T022 exists (Constitution V).
 *
 * R-008 / tech-stack.md: Argon2id, not bcrypt. The digest format is asserted
 * because it is the one observable guarantee that the right algorithm ran —
 * a bcrypt digest here would verify happily and satisfy every other test.
 */
import { describe, expect, it } from 'vitest';
import { Argon2PasswordService } from '../../../src/modules/auth/password.service.js';

const service = new Argon2PasswordService();

describe('Argon2PasswordService', () => {
  it('produces an Argon2id digest, never the plaintext', async () => {
    const digest = await service.hash('correct horse battery staple');
    expect(digest.startsWith('$argon2id$')).toBe(true);
    expect(digest).not.toContain('correct horse battery staple');
  });

  it('verifies the password that was hashed', async () => {
    const digest = await service.hash('s3cret-Phrase');
    await expect(service.verify(digest, 's3cret-Phrase')).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const digest = await service.hash('s3cret-Phrase');
    await expect(service.verify(digest, 's3cret-phrase')).resolves.toBe(false);
  });

  it('salts: hashing the same password twice yields different digests', async () => {
    const [a, b] = await Promise.all([service.hash('same input'), service.hash('same input')]);
    expect(a).not.toBe(b);
    // ...and both still verify.
    await expect(service.verify(a, 'same input')).resolves.toBe(true);
    await expect(service.verify(b, 'same input')).resolves.toBe(true);
  });

  it('refuses to hash an empty password, naming the field', async () => {
    await expect(service.hash('')).rejects.toThrow(/password/i);
    await expect(service.hash('   ')).rejects.toThrow(/password/i);
  });

  it('treats a malformed digest as a non-match, not a crash', async () => {
    // A corrupted row must read as "wrong password", never as a 500: the
    // sign-in path calls this with whatever the database returned.
    await expect(service.verify('not-a-phc-digest', 'anything')).resolves.toBe(false);
  });
});
