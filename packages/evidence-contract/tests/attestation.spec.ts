/**
 * T856a — the in-toto Statement types, written to fail first.
 *
 * `FR-EVS-042` refuses a contribution naming no artifact version. The type
 * makes that refusal a compile error before it is a runtime check: `subject` is
 * a non-empty tuple, and a subject's `digest` names at least one algorithm. The
 * `@ts-expect-error` blocks are the real assertions — if the type ever accepts
 * the bad value, `tsc` reports the directive unused and `pnpm typecheck` fails.
 *
 * `parseAttestation` is the runtime half, for bodies arriving over HTTP where no
 * compiler stands guard.
 *
 * **A correction to `contracts/evidence-contract.md` §1.** It typed `digest` as
 * `Record<'sha256' | 'gitCommit' | 'gitBlob', string>` — all three required. The
 * in-toto Statement spec requires a digest *set*, any algorithm: its own
 * `test-result` example carries `gitCommit` alone. Requiring all three would
 * have refused every real test-result attestation.
 */
import { describe, expect, it } from 'vitest';
import {
  IN_TOTO_STATEMENT_TYPE,
  parseAttestation,
  type Attestation,
  type AttestationSubject,
} from '../src/attestation.js';

const subject: AttestationSubject = {
  name: 'spec.md',
  digest: { gitCommit: 'd20ace7968ba43c0219f62d71334c1095bab1602' },
};

const valid = {
  _type: IN_TOTO_STATEMENT_TYPE,
  subject: [subject],
  predicateType: 'https://in-toto.io/attestation/test-result/v0.1',
  predicate: { result: 'PASSED' },
};

describe('T856a · FR-EVS-042 — an attestation with no subject digest is not representable', () => {
  it('uses the in-toto Statement v1 type URI', () => {
    expect(IN_TOTO_STATEMENT_TYPE).toBe('https://in-toto.io/Statement/v1');
  });

  it('rejects an empty subject list at compile time', () => {
    // @ts-expect-error — `subject` is a non-empty tuple.
    const bad: Attestation = { ...valid, subject: [] };
    expect(bad).toBeDefined();
  });

  it('rejects a subject whose digest names no algorithm at compile time', () => {
    // @ts-expect-error — a digest must carry at least one algorithm.
    const bad: AttestationSubject = { name: 'x', digest: {} };
    expect(bad).toBeDefined();
  });

  it('accepts a digest carrying any ONE algorithm — in-toto does not require all three', () => {
    const one: AttestationSubject = { name: 'image', digest: { sha256: 'ab'.repeat(32) } };
    expect(parseAttestation({ ...valid, subject: [one] }).ok).toBe(true);
  });
});

describe('T856a · parseAttestation — the runtime fence for bodies no compiler saw', () => {
  it('accepts a well-formed Statement', () => {
    const parsed = parseAttestation(valid);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.subject[0].digest.gitCommit).toBe(subject.digest.gitCommit);
  });

  it.each([
    ['a missing subject', { ...valid, subject: undefined }],
    ['an empty subject list', { ...valid, subject: [] }],
    ['a subject with no digest', { ...valid, subject: [{ name: 'x' }] }],
    ['a subject with an empty digest', { ...valid, subject: [{ name: 'x', digest: {} }] }],
    ['a digest with an empty value', { ...valid, subject: [{ name: 'x', digest: { sha256: '' } }] }],
    ['an unknown digest algorithm only', { ...valid, subject: [{ name: 'x', digest: { md5: 'aa' } }] }],
  ])('refuses %s as no-subject-digest', (_label, body) => {
    expect(parseAttestation(body)).toMatchObject({ ok: false, reason: 'no-subject-digest' });
  });

  it.each([
    ['a wrong _type', { ...valid, _type: 'https://in-toto.io/Statement/v0.1' }],
    ['a missing predicateType', { ...valid, predicateType: '' }],
    ['a non-URI predicateType', { ...valid, predicateType: 'test-result' }],
    ['not an object', 'a string'],
  ])('refuses %s as malformed', (_label, body) => {
    expect(parseAttestation(body)).toMatchObject({ ok: false, reason: 'malformed' });
  });
});
