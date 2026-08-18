/**
 * T597 · Register structure — every register file exists and is parseable.
 *
 * The register is nine markdown files a human reads and one JSON projection the
 * checks read (`R-027-1`). This check runs *first*: if a register file is
 * missing or its table header has drifted, every check downstream would either
 * throw or — worse — silently find zero rows and pass.
 *
 * **Zero rows passing is the failure mode this file exists for.** A check that
 * iterates an empty array is green, and an empty array is exactly what a renamed
 * column or a missing file produces. That is the shape of DEF-001-001,
 * DEF-018-001 and DEF-028-001 — a check that names the right condition and
 * cannot observe it — so this epic's very first check is aimed at it.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';

const REGISTER = join(REPO_ROOT, 'specs/027-ai-native-amendment/register');

/** file → the columns its table MUST declare, in order. */
export const REGISTER_TABLES: Readonly<Record<string, readonly string[]>> = {
  'clauses.md': ['id', 'document', 'section', 'text', 'normativity', 'duplicates'],
  'verdicts.md': [
    'clause',
    'verdict',
    'owner',
    'reasoning',
    'action',
    'new_identifier',
    'necessity',
  ],
  'capabilities.md': [
    'id',
    'capability',
    'ownership',
    'reason',
    'abstraction_boundary',
    'existing_home',
    'removed_because_external',
  ],
  'capability-areas.md': ['area', 'verdict', 'home', 'posture'],
  'premises.md': [
    'id',
    'claimed_capability',
    'claim_source',
    'search_performed',
    'occurrence_count',
    'locations',
    'verdict',
  ],
  'decisions.md': [
    'id',
    'question',
    'options',
    'recommendation',
    'owner',
    'status',
    'blocking_research',
  ],
  'research.md': ['id', 'question', 'blocks', 'owner', 'status'],
  'adrs.md': ['subject', 'status', 'awaits', 'supersedes', 'superseded_reasoning'],
  'preserved-elements.md': [
    'element',
    'reason',
    'affected_requirement',
    'migration_impact',
    'compatibility_impact',
    'alternative_considered',
  ],
};

/**
 * The pipe table under `## Register`.
 *
 * Exported so the generator and the checks parse identically. Two parsers for
 * one format is how a projection comes to disagree with its source while both
 * look correct.
 */
export function tableRows(markdown: string): string[][] {
  const section = markdown.split(/^## Register\s*$/m)[1];
  if (section === undefined) return [];
  const rows: string[][] = [];
  for (const line of section.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    if (/^\|[\s:|-]+\|$/.test(trimmed)) continue;
    rows.push(
      trimmed
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

describe('T597 · the register scaffold exists', () => {
  it.each(Object.keys(REGISTER_TABLES))('register/%s exists', (file) => {
    expect(
      existsSync(join(REGISTER, file)),
      `specs/027-ai-native-amendment/register/${file} is missing`,
    ).toBe(true);
  });
});

describe('T597 · every register table declares the schema columns', () => {
  it.each(Object.entries(REGISTER_TABLES))('%s header matches the contract', (file, columns) => {
    const path = join(REGISTER, file);
    if (!existsSync(path)) {
      expect.fail(`register/${file} is missing`);
    }
    const rows = tableRows(readFileSync(path, 'utf8'));
    expect(
      rows.length,
      `register/${file} has no table under the "## Register" heading`,
    ).toBeGreaterThan(0);
    expect(
      rows[0],
      `register/${file} column header drifted from contracts/reconciliation-register.md`,
    ).toEqual([...columns]);
  });
});
