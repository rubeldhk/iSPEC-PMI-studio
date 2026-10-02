/**
 * T1042 (EPIC-037 Band A) — arguments are sanitised, credentials refuse.
 *
 * `FR-EXR-022`. The asymmetry these assert is the point: a value that *looks
 * like* a secret is redacted, so the shape of the command survives; a *named
 * credential field* is refused outright, because storing a placeholder would
 * tell the connector its behaviour was acceptable.
 *
 * Arguments land in an append-only table. A secret written there cannot be
 * taken back out, which is why this leans towards over-redacting.
 */
import { describe, expect, it } from 'vitest';
import {
  CredentialDetectedError,
  REDACTED,
  looksLikeSecret,
  sanitiseArgs,
} from '../../../src/modules/executions/sanitisation.js';

describe('T1042 · a named credential field is refused, not redacted', () => {
  it.each([
    'password',
    'apiKey',
    'api_key',
    'accessKey',
    'client_secret',
    'authorization',
    'privateKey',
    'token',
  ])('refuses "%s"', (field) => {
    expect(() => sanitiseArgs({ [field]: 'anything' })).toThrow(CredentialDetectedError);
  });

  it('refuses it however it is cased or punctuated', () => {
    expect(() => sanitiseArgs({ 'API-KEY': 'x' })).toThrow(CredentialDetectedError);
    expect(() => sanitiseArgs({ ClientSecret: 'x' })).toThrow(CredentialDetectedError);
  });

  it('refuses one nested two levels down', () => {
    // A shallow pass would be a guard that looks like protection.
    expect(() => sanitiseArgs({ config: { auth: { token: 'x' } } })).toThrow(
      CredentialDetectedError,
    );
  });

  it('names the field, so the connector author can fix it', () => {
    const failure = (() => {
      try {
        sanitiseArgs({ apiKey: 'x' });
        return null;
      } catch (e) {
        return e as CredentialDetectedError;
      }
    })();
    expect(failure?.field).toBe('apiKey');
  });
});

describe('T1042 · a value that looks like a secret is redacted', () => {
  it.each([
    ['GitHub token', 'ghp_abcdefghijklmnop0123456789'],
    ['OpenAI-style', 'sk-abcdefghijklmnopqrstuvwx'],
    ['Anthropic-style', 'sk-ant-abcdefghijklmnopqrstuvwx'],
    ['AWS access key id', 'AKIAIOSFODNN7EXAMPLE'],
    ['Slack token', 'xoxb-1234567890-abcdefghij'],
    ['JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NX0.dBjftJeZ4CVPmB92K27uhbUJU1p1r'],
    ['private key block', '-----BEGIN RSA PRIVATE KEY-----\nMIIE...'],
    ['connection string', 'postgresql://user:hunter2@host:5432/db'],
  ])('redacts a %s', (_label, value) => {
    expect(sanitiseArgs({ note: value }).note).toBe(REDACTED);
    expect(looksLikeSecret(value)).toBe(true);
  });

  it('leaves ordinary arguments alone — it is not redacting everything', () => {
    // The control. Without it, a sanitiser that redacted every string would
    // satisfy every assertion above.
    const args = { spec: 'specs/037/spec.md', count: 3, dryRun: true, tags: ['a', 'b'] };
    expect(sanitiseArgs(args)).toEqual(args);
    expect(looksLikeSecret('specs/037/spec.md')).toBe(false);
  });

  it('redacts inside arrays and nested objects', () => {
    const out = sanitiseArgs({
      env: ['SAFE=1', 'GH=ghp_abcdefghijklmnop0123456789'],
      nested: { deeper: { note: 'AKIAIOSFODNN7EXAMPLE' } },
    });
    expect((out.env as string[])[1]).toBe(REDACTED);
    expect(((out.nested as Record<string, Record<string, unknown>>).deeper as Record<string, unknown>).note).toBe(
      REDACTED,
    );
  });

  it('preserves the shape of the command even when a value is removed', () => {
    // Why redaction and refusal are different responses: the history should
    // still show that an argument was passed and what it was called.
    const out = sanitiseArgs({ branch: 'main', note: 'ghp_abcdefghijklmnop0123456789' });
    expect(Object.keys(out).sort()).toEqual(['branch', 'note']);
    expect(out.branch).toBe('main');
  });
});
