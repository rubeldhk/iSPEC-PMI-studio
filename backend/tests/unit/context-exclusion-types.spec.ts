/**
 * `T1227` (EPIC-038) — the exclusion vocabulary, closed and required.
 *
 * `FR-CTX-033`, `FR-CTX-034`, `FR-CTX-035`, `FR-CTX-053`, `FR-CTX-017`.
 *
 * ## Why an exclusion is a row rather than a log line
 *
 * Without this table, an empty package and a heavily filtered one are the same
 * record with no children. The only honest answer to *"why isn't the security
 * policy in here?"* becomes *"nobody knows"* — and that question is the one
 * people actually ask a year later. They rarely ask what a package contained;
 * they ask why it did not contain the thing they expected.
 *
 * `EPIC-035` reached the same conclusion from the other direction: an absence
 * recorded is a finding, and an absence unrecorded is indistinguishable from
 * nothing having been there.
 *
 * ## Five reasons, and no default
 *
 * A default would answer the question wrongly rather than not at all, which is
 * worse: a reader trusts a stated reason. `R-035-6`'s rule from one Epic over —
 * *a path taken by omission is a decision nobody made*.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EXCLUSION_REASONS,
  type ExclusionRecord,
} from '../../src/modules/context/retrieval/outcome.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const CODE = readFileSync(
  resolve(here, '../../src/modules/context/retrieval/outcome.types.ts'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

describe('T1227 · five reasons, closed', () => {
  it('names exactly the five', () => {
    expect([...EXCLUSION_REASONS].sort()).toEqual(
      ['boundary', 'budget', 'classification', 'permission', 'stale'].sort(),
    );
  });

  it('and each maps to a requirement rather than to a convenience', () => {
    // The vocabulary is not a taxonomy somebody liked the shape of: each reason
    // is a rule that exists elsewhere in the spec, and a sixth would mean a
    // rule nobody wrote.
    const owed = {
      permission: 'FR-CTX-033',
      classification: 'FR-CTX-034',
      budget: 'FR-CTX-035',
      boundary: 'FR-CTX-053',
      stale: 'FR-CTX-017',
    } as const;
    expect(Object.keys(owed).sort()).toEqual([...EXCLUSION_REASONS].sort());
  });

  it('the reason field is required, with no default', () => {
    expect(CODE).toMatch(/readonly reason: ExclusionReason;/);
    expect(CODE).not.toMatch(/readonly reason\?:/);
    expect(CODE).not.toMatch(/reason\s*=\s*['"]/);
  });

  it('the default check can fire', () => {
    expect(/reason\s*=\s*['"]/.test("reason = 'budget'")).toBe(true);
  });
});

describe('T1227 · an exclusion says enough to act on', () => {
  it('carries the specific rule or limit, not only the category', () => {
    // `permission` alone tells a reader which *kind* of rule fired. `detail`
    // tells them which rule — the difference between a chart and an answer.
    const row: ExclusionRecord = {
      id: 'ex_1',
      packageId: 'cp_1',
      sourceType: 'specification',
      sourceId: 'sp_4',
      reason: 'budget',
      detail: 'excluded at 12,400 of a 12,000-token budget',
      wasEssential: false,
    };
    expect(row.detail).toMatch(/12,000/);
  });

  it('and records whether the excluded item was essential', () => {
    // `FR-CTX-038`, `FR-CTX-039`. On the exclusion rather than only on the
    // candidate, because the refusal it causes must be explainable after the
    // fact: the package refused, and this is the item that caused it.
    expect(CODE).toMatch(/readonly wasEssential: boolean;/);
    expect(CODE).not.toMatch(/readonly wasEssential\?:/);
  });
});
