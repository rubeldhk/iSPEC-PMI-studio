/**
 * T075 — engine output parsing (F-04.2).
 *
 * Written to FAIL before `output-parser.ts` exists (Constitution V).
 *
 * The rule this file defends: **unparseable and empty output are failures,
 * never a stored specification**. An adapter is third-party code; the fact that
 * it returned `ok: true` says the run finished, not that what came back is a
 * specification.
 *
 * Note the inversion recorded in plan.md: EPIC-021's review capability treats
 * "found nothing" as a PASS. Same contract, opposite meaning — which is why
 * emptiness is decided here, per capability, and not in the contract package.
 */
import { describe, expect, it } from 'vitest';
import { FAILURE_MESSAGES } from '../../../src/core/failure-taxonomy.js';
import { parseEngineOutput } from '../../../src/modules/specifications/output-parser.js';
import { OUTPUT } from './helpers.js';

describe('parseEngineOutput · well-formed output', () => {
  it('accepts a title, raw content, and parsed structure', () => {
    const result = parseEngineOutput(OUTPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Payments Specification');
    expect(result.value.contentRaw).toBe(OUTPUT.contentRaw);
    expect(result.value.contentParsed).toEqual(OUTPUT.contentParsed);
  });

  it('keeps the raw content VERBATIM — never trimmed, never rewritten (R-007)', () => {
    const raw = '\n\n# Payments\n\n  indented line  \n\n';
    const result = parseEngineOutput({ ...OUTPUT, contentRaw: raw });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A future parser fix must be able to re-derive structure from this string,
    // which is impossible if storage normalised it first.
    expect(result.value.contentRaw).toBe(raw);
  });

  it('trims the title — surrounding whitespace is not part of a name', () => {
    const result = parseEngineOutput({ ...OUTPUT, title: '  Payments Specification \n' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Payments Specification');
  });
});

describe('parseEngineOutput · empty output is a failure (FR-026)', () => {
  it.each([
    ['an empty raw string', ''],
    ['whitespace only', '   \n\t  '],
  ])('%s → empty_output', (_label, contentRaw) => {
    const result = parseEngineOutput({ ...OUTPUT, contentRaw });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('empty_output');
    expect(result.message).toBe(FAILURE_MESSAGES.empty_output);
  });

  it('never returns a value alongside a failure — there is no partial shape', () => {
    const result = parseEngineOutput({ ...OUTPUT, contentRaw: '' });
    expect(Object.hasOwn(result, 'value')).toBe(false);
  });
});

describe('parseEngineOutput · malformed output is a failure (FR-026)', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'a specification, honestly'],
    ['an array', []],
    ['a number', 7],
  ])('%s → malformed_output', (_label, output) => {
    const result = parseEngineOutput(output);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('malformed_output');
    expect(result.message).toBe(FAILURE_MESSAGES.malformed_output);
  });

  it.each([
    ['a missing title', { contentRaw: 'x', contentParsed: { a: 1 } }],
    ['a blank title', { title: '   ', contentRaw: 'x', contentParsed: { a: 1 } }],
    ['a non-string title', { title: 12, contentRaw: 'x', contentParsed: { a: 1 } }],
    ['a missing contentRaw', { title: 'T', contentParsed: { a: 1 } }],
    ['a non-string contentRaw', { title: 'T', contentRaw: {}, contentParsed: { a: 1 } }],
    ['a missing contentParsed', { title: 'T', contentRaw: 'x' }],
    ['an array contentParsed', { title: 'T', contentRaw: 'x', contentParsed: [] }],
    ['a null contentParsed', { title: 'T', contentRaw: 'x', contentParsed: null }],
    ['an empty contentParsed', { title: 'T', contentRaw: 'x', contentParsed: {} }],
  ])('%s → malformed_output', (_label, output) => {
    const result = parseEngineOutput(output);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('malformed_output');
  });

  it('names the offending field for an operator, without echoing engine output', () => {
    const result = parseEngineOutput({ title: 'T', contentRaw: 'x', contentParsed: null });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe('contentParsed');
    // R-011 / contract rule E9: engine output is never folded into a message.
    expect(result.message).not.toContain('x');
  });
});

describe('parseEngineOutput · the two reasons are distinct', () => {
  it('empty is not reported as malformed, and vice versa', () => {
    const empty = parseEngineOutput({ ...OUTPUT, contentRaw: '  ' });
    const malformed = parseEngineOutput({ ...OUTPUT, contentParsed: null });
    expect(empty.ok).toBe(false);
    expect(malformed.ok).toBe(false);
    if (empty.ok || malformed.ok) return;
    expect(empty.reason).not.toBe(malformed.reason);
  });
});
