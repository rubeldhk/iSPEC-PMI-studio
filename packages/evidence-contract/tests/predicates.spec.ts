/**
 * T856c — the predicateType registry, written to fail first.
 *
 * `FR-EVS-003`: evidence is typed by what it proves. `BR-0140` names nine kinds,
 * and each needs exactly one URI. The origin of each URI is recorded so that a
 * future standard predicate can replace a PMI one without the gate changing —
 * the gate matches URIs, and never asks where one came from.
 */
import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_KINDS,
  PREDICATE_TYPES,
  isPmiPredicate,
  isStandardPredicate,
  declaresFailure,
  kindOf,
  predicateTypeFor,
} from '../src/predicates.js';

describe('T856c · FR-EVS-003 — nine kinds of proof, one URI each', () => {
  it('covers every kind BR-0140 names, and no tenth', () => {
    expect(EVIDENCE_KINDS).toEqual([
      'test-result',
      'scan',
      'build',
      'approval',
      'screenshot',
      'transcript',
      'review-finding',
      'deployment',
      'external-output',
    ]);
    expect(Object.isFrozen(EVIDENCE_KINDS)).toBe(true);
  });

  it('gives each kind a distinct URI', () => {
    const uris = EVIDENCE_KINDS.map(predicateTypeFor);
    expect(new Set(uris).size).toBe(EVIDENCE_KINDS.length);
    for (const uri of uris) expect(uri).toMatch(/^https:\/\//);
  });

  it('adopts the in-toto and SLSA URIs where a standard predicate exists', () => {
    expect(predicateTypeFor('test-result')).toBe('https://in-toto.io/attestation/test-result/v0.1');
    expect(predicateTypeFor('scan')).toBe('https://in-toto.io/attestation/vulns/v0.2');
    expect(predicateTypeFor('build')).toBe('https://slsa.dev/provenance/v1');
  });

  it('distinguishes standard predicates from PMI-defined ones', () => {
    expect(isStandardPredicate(predicateTypeFor('test-result'))).toBe(true);
    expect(isPmiPredicate(predicateTypeFor('test-result'))).toBe(false);
    expect(isPmiPredicate(predicateTypeFor('approval'))).toBe(true);
    expect(isStandardPredicate(predicateTypeFor('approval'))).toBe(false);
  });

  it('defines PMI predicates only under the PMI namespace', () => {
    for (const entry of PREDICATE_TYPES.filter((p) => p.origin === 'pmi')) {
      expect(entry.uri.startsWith('https://pmi.studio/attestation/')).toBe(true);
    }
  });

  it('maps a URI back to its kind, and an unknown URI to null rather than a guess', () => {
    expect(kindOf('https://in-toto.io/attestation/vulns/v0.2')).toBe('scan');
    expect(kindOf('https://example.com/attestation/unknown/v1')).toBeNull();
  });
});

describe('declaresFailure — a FAILED test result is evidence of failure, not of passing', () => {
  const TR = 'https://in-toto.io/attestation/test-result/v0.1';

  it.each([
    ['FAILED', true],
    ['PASSED', false],
    ['WARNED', false],
  ])('reads a test-result whose result is %s as failure=%s', (result, expected) => {
    expect(declaresFailure(TR, { result })).toBe(expected);
  });

  it('reads no other predicate type — their content is for a reader, not the gate', () => {
    expect(declaresFailure('https://in-toto.io/attestation/vulns/v0.2', { result: 'FAILED' })).toBe(false);
  });

  it('reads a missing or malformed predicate as not declaring failure', () => {
    expect(declaresFailure(TR, null)).toBe(false);
    expect(declaresFailure(TR, 'FAILED')).toBe(false);
  });
});
