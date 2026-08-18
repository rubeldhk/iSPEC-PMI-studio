/**
 * T600 · the projection generator's logic.
 *
 * `scripts/` is not on Constitution I's exempt list, so this is application code
 * and Constitution V is NON-NEGOTIABLE. EPIC-028 `T576a` was added for exactly
 * this reason after an analyse pass found a script with no test at all.
 *
 * The generator is the single point where a human-readable register becomes the
 * thing fourteen checks read. A parser bug here does not produce a failure — it
 * produces a *smaller register*, silently, and every completeness check stays
 * green because it iterates what it was given.
 *
 * That is the failure shape this repository has now hit four times in one week.
 * These tests are aimed squarely at it: malformed rows must be **rejected
 * loudly**, never skipped.
 */
import { describe, expect, it } from 'vitest';
import {
  parseTable,
  parseList,
  parseOptions,
  parseScalar,
  rowsToObjects,
  MalformedRowError,
} from '../build-register.mjs';

const TABLE = [
  '# Register: Clauses',
  '',
  'Prose that must not be parsed as a row.',
  '',
  '## Register',
  '',
  '| id | document | section | text | normativity | duplicates |',
  '|---|---|---|---|---|---|',
  '| CLA-001 | plan-amendment | §19 | This amendment is evolutionary. | shall | CLA-118 |',
  '| CLA-002 | native-speckit | §3 | Do NOT merge the two abstractions. | must | — |',
  '',
  'Trailing prose, also not a row.',
].join('\n');

describe('T600 · table extraction', () => {
  it('reads only the table under "## Register"', () => {
    const rows = parseTable(TABLE);
    expect(rows).toHaveLength(3); // header + 2 data rows
    expect(rows[0]).toEqual(['id', 'document', 'section', 'text', 'normativity', 'duplicates']);
  });

  it('ignores prose before and after the table', () => {
    const rows = parseTable(TABLE);
    expect(rows.flat().join(' ')).not.toContain('Trailing prose');
    expect(rows.flat().join(' ')).not.toContain('must not be parsed');
  });

  it('returns nothing when the "## Register" heading is absent', () => {
    // Silently returning [] here would be a bug; the STRUCTURE check (T597) is
    // what fails on it. This asserts the generator does not invent rows.
    expect(parseTable('# No register here\n\n| a | b |\n|---|---|\n| 1 | 2 |')).toEqual([]);
  });

  it('drops the separator row rather than treating it as data', () => {
    const rows = parseTable(TABLE);
    expect(rows.some((r) => r[0]?.startsWith('---'))).toBe(false);
  });
});

describe('T600 · field extraction', () => {
  it('maps header columns onto object keys', () => {
    const objects = rowsToObjects(parseTable(TABLE));
    expect(objects[0]).toMatchObject({
      id: 'CLA-001',
      document: 'plan-amendment',
      section: '§19',
      normativity: 'shall',
    });
  });

  it('preserves the quoted clause text exactly', () => {
    // Paraphrase is where premises get lost. The generator must not normalise.
    const objects = rowsToObjects(parseTable(TABLE));
    expect(objects[0].text).toBe('This amendment is evolutionary.');
  });

  it('parses an em-dash as null, not as the string "—"', () => {
    expect(parseScalar('—')).toBeNull();
    expect(parseScalar('')).toBeNull();
    expect(parseScalar('null')).toBeNull();
    expect(parseScalar('CLA-001')).toBe('CLA-001');
  });

  it('parses semicolon-separated lists, and an em-dash as empty', () => {
    expect(parseList('CLA-118 ; CLA-204')).toEqual(['CLA-118', 'CLA-204']);
    expect(parseList('—')).toEqual([]);
    expect(parseList('')).toEqual([]);
  });

  it('parses booleans so `removed_because_external` is a boolean, not a string', () => {
    // §2 forbids removing a capability because an external product provides it.
    // A check reading the string "false" would find it truthy and pass forever.
    expect(parseScalar('false')).toBe(false);
    expect(parseScalar('true')).toBe(true);
  });

  it('parses integers so occurrence_count compares numerically', () => {
    expect(parseScalar('0')).toBe(0);
    expect(parseScalar('26')).toBe(26);
  });
});

describe('T600 · options parsing', () => {
  it('splits label :: consequence pairs on " ;; "', () => {
    const options = parseOptions('Build it :: costs a quarter ;; Integrate it :: costs a seam');
    expect(options).toEqual([
      { label: 'Build it', consequence: 'costs a quarter' },
      { label: 'Integrate it', consequence: 'costs a seam' },
    ]);
  });

  it('rejects an option with no consequence rather than inventing one', () => {
    // A decision whose options carry no consequences is a decision presented
    // without its trade-offs, which is the thing FR-AMD-008 forbids.
    expect(() => parseOptions('Build it ;; Integrate it :: costs a seam')).toThrow(
      MalformedRowError,
    );
  });

  it('returns an empty list for an em-dash, so non-decision rows are unaffected', () => {
    expect(parseOptions('—')).toEqual([]);
  });
});

describe('T600 · malformed rows are REJECTED, never skipped', () => {
  it('throws when a row has fewer cells than the header', () => {
    // Skipping is the dangerous behaviour: the register would be quietly
    // smaller and every completeness check would still pass.
    const short = ['## Register', '', '| id | document |', '|---|---|', '| CLA-001 |'].join('\n');
    expect(() => rowsToObjects(parseTable(short))).toThrow(MalformedRowError);
  });

  it('throws when a row has more cells than the header', () => {
    const long = [
      '## Register',
      '',
      '| id | document |',
      '|---|---|',
      '| CLA-001 | plan-amendment | extra |',
    ].join('\n');
    expect(() => rowsToObjects(parseTable(long))).toThrow(MalformedRowError);
  });

  it('names the offending row so the failure is actionable', () => {
    const short = ['## Register', '', '| id | document |', '|---|---|', '| CLA-009 |'].join('\n');
    expect(() => rowsToObjects(parseTable(short))).toThrow(/CLA-009|row 1/);
  });
});
