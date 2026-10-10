/**
 * `T2158` (EPIC-039, `R-039-9`) — JUnit XML from an untrusted artifact.
 *
 * `fflate.unzipSync` with a filter accepting only `*.xml` entries ≤ 50 MiB
 * expanded (the zip-bomb bound); `fast-xml-parser` with
 * `processEntities: false`, so an entity-expansion payload is NOT expanded;
 * more than 20,000 test names is `result-too-large`, never truncated.
 *
 * Written to FAIL before `T2159`.
 */
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { MAX_EXPANDED_BYTES, MAX_TEST_NAMES, parseJUnitArtifact, rollUp } from '../src/read-test-results.js';

const zip = (files: Record<string, string>): Uint8Array => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

describe('T2158 · reading JUnit from an artifact zip', () => {
  it('reads only *.xml entries, and classifies passed, failed and skipped', () => {
    const r = parseJUnitArtifact(
      zip({
        'junit.xml': '<testsuite name="s"><testcase classname="c" name="ok"/><testcase classname="c" name="bad"><failure message="x"/></testcase><testcase classname="c" name="later"><skipped/></testcase><testcase classname="c" name="boom"><error/></testcase></testsuite>',
        'notes.txt': '<testsuite name="ignored"><testcase name="never"/></testsuite>',
      }),
    );
    expect(r).toEqual({ ok: true, suites: 1, passedTests: ['s > ok'], failedTests: ['s > bad', 's > boom'], skippedTests: ['s > later'] });
  });

  it('declares the bound it filters on: 50 MiB expanded', () => {
    expect(MAX_EXPANDED_BYTES).toBe(50 * 1024 * 1024);
  });

  it('does not expand entities from untrusted XML', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lollollollollollollollollollol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><testsuite name="&lol2;"><testcase name="&lol2;"/></testsuite>';
    const r = parseJUnitArtifact(zip({ 'junit.xml': bomb }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r)).not.toContain('lollollol');
  });

  it('refuses more than 20,000 test names as result-too-large, never truncating', () => {
    expect(MAX_TEST_NAMES).toBe(20_000);
    const cases = Array.from({ length: 20_001 }, (_, i) => `<testcase name="t${i}"/>`).join('');
    expect(parseJUnitArtifact(zip({ 'big.xml': `<testsuite name="s">${cases}</testsuite>` }))).toMatchObject({ ok: false, errorCategory: 'result-too-large' });
  });

  it('refuses malformed XML as results-malformed, and an artifact with no XML as results-not-found', () => {
    expect(parseJUnitArtifact(zip({ 'junit.xml': '<testsuite name="s"><testcase' }))).toMatchObject({ ok: false, errorCategory: 'results-malformed' });
    expect(parseJUnitArtifact(zip({ 'readme.md': 'hello' }))).toMatchObject({ ok: false, errorCategory: 'results-not-found' });
    expect(parseJUnitArtifact(new Uint8Array([1, 2, 3]))).toMatchObject({ ok: false, errorCategory: 'results-malformed' });
  });
});

describe('T2158 · rolling runs up', () => {
  it('any run not completed → final: false; no runs → results-not-found', () => {
    expect(rollUp([{ status: 'in_progress' }, { status: 'completed' }])).toEqual({ final: false });
    expect(rollUp([])).toEqual({ final: true, none: true });
    expect(rollUp([{ status: 'completed' }])).toEqual({ final: true, none: false });
  });
});
