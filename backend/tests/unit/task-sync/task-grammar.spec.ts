/**
 * `T1696` / `T1776` (EPIC-046) — the `tasks.md` grammar, against the repository's
 * own corpus (`FR-KAN-001` to `FR-KAN-009`, `SC-KAN-001`, `SC-KAN-002`).
 *
 * The corpus at `tests/fixtures/task-grammar/corpus.md` is the specification;
 * this file asserts the parser agrees with it. Three verdicts, and the boundary
 * between the first two is the whole design:
 *
 *   **ignored**  — not a task-list item at the start of a line. Not counted,
 *                  not reported. Headings, prose, tables, nested items.
 *   **refused**  — it opened as one and then failed. Counted and REPORTED with
 *                  a code (`FR-KAN-003`), never dropped.
 *   **parsed**   — a task.
 *
 * `SC-KAN-001` is the arithmetic that keeps the boundary honest:
 * `linesConsidered === parsed + refused + duplicates`, and every considered line
 * appears exactly once in the manifest.
 *
 * Written to FAIL before `T1697`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TASK_GRAMMAR, parseTasks } from '../../../src/modules/task-sync/task-grammar.js';

const CORPUS = readFileSync(
  join(resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures/task-grammar'), 'corpus.md'),
  'utf8',
);

const result = parseTasks(CORPUS, DEFAULT_TASK_GRAMMAR);
const byKey = (key: string) => result.lines.find((l) => l.taskKey === key);
const keys = result.lines.filter((l) => l.outcome === 'parsed').map((l) => l.taskKey);

describe('T1696 · the grammar, against the corpus', () => {
  describe('accepted', () => {
    it.each([
      ['T1701', false, false],
      ['T1702', true, false],
      ['T1703', true, false],
      ['T1704', false, true],
      ['T1705', false, false],
      ['T1706', false, false],
      ['T1707', false, false],
    ])('%s parses, checked=%s parallel=%s', (key, checked, parallel) => {
      const line = byKey(key);
      expect(line?.outcome, `${key} was not parsed`).toBe('parsed');
      expect(line?.checked).toBe(checked);
      expect(line?.parallel).toBe(parallel);
      expect(line?.description.length, `${key} has no description`).toBeGreaterThan(0);
    });

    it('reads `[x]` and `[X]` as the same checked state', () => {
      expect(byKey('T1702')?.checked).toBe(true);
      expect(byKey('T1703')?.checked).toBe(true);
    });

    it('keeps a cross-reference inside a description as text, never a second task', () => {
      expect(byKey('T1707')?.description).toContain('(unit test: T0nn)');
      expect(keys).not.toContain('T0nn');
    });
  });

  describe('ignored without report — the boundary that makes the counts mean something', () => {
    it.each(['T1708', 'T1709', 'T1710', 'T1711', 'T1712', 'T1713'])('%s is not considered at all', (key) => {
      expect(byKey(key), `${key} was considered; it should have been ignored`).toBeUndefined();
    });

    it('reports no refusal for a heading, prose, a table row or a nested item', () => {
      // The corpus has exactly five refusals, all in its "Refused" section. If a
      // heading or a table row leaked into `considered`, this count moves.
      expect(result.lines.filter((l) => l.outcome !== 'parsed')).toHaveLength(5);
    });
  });

  describe('refused with a code — reported, never dropped (FR-KAN-003)', () => {
    it('refuses a line whose identifier slot holds an ordinary word', () => {
      const line = result.lines.find((l) => l.rawText.includes('Tidy up the module'));
      expect(line?.outcome).toBe('refused');
      // The slot is occupied and the occupant fails the pattern, so this is the
      // same failure as `Txyz` — `malformed_identifier` is reserved for an EMPTY
      // slot, which is a different mistake and gets a different message.
      expect(line?.refusalCode).toBe('identifier_not_matched');
      expect(line?.lineNumber).toBeGreaterThan(0);
    });

    it('refuses a line whose identifier slot is empty', () => {
      const r = parseTasks('- [ ] ', DEFAULT_TASK_GRAMMAR);
      expect(r.lines[0]?.refusalCode).toBe('malformed_identifier');
      expect(r.counts).toMatchObject({ linesConsidered: 1, refused: 1, parsed: 0 });
    });

    it('refuses an identifier that does not match the configured pattern', () => {
      const line = result.lines.find((l) => l.rawText.includes('Txyz'));
      expect(line?.outcome).toBe('refused');
      expect(line?.refusalCode).toBe('identifier_not_matched');
    });

    it('refuses an identifier with no description', () => {
      const line = result.lines.find((l) => /T1714\s*$/.test(l.rawText));
      expect(line?.outcome).toBe('refused');
      expect(line?.refusalCode).toBe('missing_description');
    });

    it('refuses a description carrying a credential shape, and never quotes the match', () => {
      const line = result.lines.find((l) => l.rawText.includes('pmi_ct_'));
      expect(line?.outcome).toBe('refused');
      expect(line?.refusalCode).toBe('credential_in_description');
      // FR-KAN-073: the refusal names the family and stops. Quoting the match
      // would put the secret in a row, a comment and a transcript at once.
      expect(line?.refusalDetail ?? '').not.toContain('pmi_ct_AAAA');
      expect(line?.description).toBe('');
    });

    it('keeps the first of a duplicated identifier and reports the second with both line numbers', () => {
      const dupes = result.lines.filter((l) => l.outcome === 'duplicate');
      expect(dupes).toHaveLength(1);
      expect(dupes[0]?.taskKey).toBe('T1701');
      expect(dupes[0]?.refusalCode).toBe('duplicate_identifier');
      expect(dupes[0]?.firstSeenOnLine).toBe(byKey('T1701')?.lineNumber);
      // FR-KAN-007: the sync does not fail on account of it.
      expect(keys.filter((k) => k === 'T1701')).toHaveLength(1);
    });

    it('refuses a description over the configured limit', () => {
      const long = parseTasks(`- [ ] T1 ${'x'.repeat(600)}`, DEFAULT_TASK_GRAMMAR);
      expect(long.lines[0]?.refusalCode).toBe('description_too_long');
    });
  });

  describe('nothing is inferred (FR-KAN-004)', () => {
    it('leaves an unchecked line under a heading called Done unchecked', () => {
      expect(byKey('T1716')?.checked).toBe(false);
      expect(byKey('T1716')?.outcome).toBe('parsed');
    });

    it('generates no identifier, rewrites no description, and orders nothing by section', () => {
      expect(result.lines.every((l) => l.taskKey === null || CORPUS.includes(l.taskKey))).toBe(true);
      expect(result.lines.filter((l) => l.outcome === 'parsed').every((l) => CORPUS.includes(l.description))).toBe(true);
    });
  });

  describe('T1776 · the repository paths a description names (FR-KAN-005, DS-1)', () => {
    it('records one path', () => {
      expect(byKey('T1701')?.sourcePaths).toEqual(['backend/tests/unit/task-sync/task-grammar.spec.ts']);
    });

    it('records several', () => {
      expect(byKey('T1706')?.sourcePaths).toEqual(['frontend/src/pages/TaskBoard.tsx', 'frontend/src/services/api.ts']);
    });

    it('records an empty list when the description names none — a fact, not a refusal', () => {
      expect(byKey('T1705')?.sourcePaths).toEqual([]);
      expect(byKey('T1705')?.outcome).toBe('parsed');
    });

    it('does not mistake a backticked non-path for one', () => {
      const r = parseTasks('- [ ] T1 Rename `presentInLatestParse` and touch `a/b.ts`', DEFAULT_TASK_GRAMMAR);
      expect(r.lines[0]?.sourcePaths).toEqual(['a/b.ts']);
    });
  });

  describe('the counts (FR-KAN-006, SC-KAN-001)', () => {
    it('accounts for every considered line exactly once', () => {
      const { linesConsidered, parsed, refused, duplicates } = result.counts;
      expect(linesConsidered).toBe(parsed + refused + duplicates);
      expect(linesConsidered).toBe(result.lines.length);
      expect(new Set(result.lines.map((l) => l.lineNumber)).size).toBe(result.lines.length);
    });

    it('counts the corpus as 8 parsed, 4 refused, 1 duplicate', () => {
      expect(result.counts).toMatchObject({ parsed: 8, refused: 4, duplicates: 1, linesConsidered: 13 });
    });
  });

  describe('the grammar is configuration, not a code path (FR-KAN-002)', () => {
    it('accepts a different identifier pattern without a code change', () => {
      const r = parseTasks('- [ ] TASK-9 Do it in `a/b.ts`', { ...DEFAULT_TASK_GRAMMAR, identifierPattern: /^TASK-\d+$/ });
      expect(r.lines[0]?.outcome).toBe('parsed');
      expect(r.lines[0]?.taskKey).toBe('TASK-9');
    });

    it('refuses the default identifier shape under the changed pattern', () => {
      const r = parseTasks('- [ ] T9 Do it', { ...DEFAULT_TASK_GRAMMAR, identifierPattern: /^TASK-\d+$/ });
      expect(r.lines[0]?.refusalCode).toBe('identifier_not_matched');
    });
  });

  describe('purity (FR-KAN-009)', () => {
    it('gives the same answer twice for the same input', () => {
      expect(parseTasks(CORPUS, DEFAULT_TASK_GRAMMAR)).toEqual(parseTasks(CORPUS, DEFAULT_TASK_GRAMMAR));
    });

    it('reads no clock and no store — an empty file is an empty result, not an error', () => {
      const empty = parseTasks('', DEFAULT_TASK_GRAMMAR);
      expect(empty.counts).toEqual({ linesConsidered: 0, parsed: 0, refused: 0, duplicates: 0 });
      expect(empty.lines).toEqual([]);
    });
  });
});
