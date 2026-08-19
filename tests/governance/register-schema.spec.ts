/**
 * T599 · `register.json` validates against the contract schema.
 *
 * The projection is what every other `G-27-*` check reads. If it is shaped
 * differently from `contracts/reconciliation-register.md`, those checks test a
 * fiction — and they test it *green*, because a missing key reads as an empty
 * array and an empty array satisfies "every row has…".
 *
 * Hand-written rather than pulling in a JSON-Schema validator: the contract is
 * ten array keys and a handful of required fields, and adding a dependency to a
 * repository that has none would be a technology decision this epic has no
 * mandate to take (`FR-AMD-016`, analysis only).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';

const PROJECTION = join(REPO_ROOT, 'specs/027-ai-native-amendment/register/register.json');

/** Array keys the contract declares, with the fields each row must carry. */
const REQUIRED: Readonly<Record<string, readonly string[]>> = {
  clauses: ['id', 'document', 'section', 'text', 'normativity'],
  verdicts: ['clause', 'verdict', 'owner', 'reasoning', 'action'],
  capabilities: ['id', 'capability', 'ownership', 'reason', 'removed_because_external'],
  capability_areas: ['area', 'verdict', 'home', 'posture'],
  premises: [
    'id',
    'claimed_capability',
    'claim_source',
    'search_performed',
    'occurrence_count',
    'verdict',
  ],
  decisions: ['id', 'question', 'options', 'owner', 'status'],
  research: ['id', 'question', 'blocks', 'owner', 'status'],
  adrs: ['subject', 'status'],
  preserved_element_changes: [
    'element',
    'reason',
    'affected_requirement',
    'migration_impact',
    'compatibility_impact',
    'alternative_considered',
  ],
  epic_status_changes: [],
};

const present = existsSync(PROJECTION);
const projection = present
  ? (JSON.parse(readFileSync(PROJECTION, 'utf8')) as Record<string, unknown>)
  : {};

describe('T599 · the projection exists and is well-formed', () => {
  it('register.json exists — `pnpm register:build` generates it', () => {
    expect(present, 'specs/027-ai-native-amendment/register/register.json is missing').toBe(true);
  });

  it('declares a version and a generated_from digest map', () => {
    if (!present) return;
    expect(projection['version']).toBe('1.0');
    expect(typeof projection['generated_from']).toBe('object');
  });

  it.each(Object.keys(REQUIRED))('declares "%s" as an array', (key) => {
    if (!present) return;
    expect(Array.isArray(projection[key]), `"${key}" is not an array`).toBe(true);
  });
});

describe('T599 · every row carries its required fields', () => {
  it.each(Object.entries(REQUIRED).filter((entry) => entry[1].length > 0))(
    '%s rows declare every contract field',
    (key, fields) => {
      if (!present) return;
      const rows = (projection[key] ?? []) as Record<string, unknown>[];
      const offenders: string[] = [];
      rows.forEach((row, index) => {
        for (const field of fields) {
          if (!(field in row)) offenders.push(`${key}[${index}] is missing "${field}"`);
        }
      });
      expect(offenders.slice(0, 10)).toEqual([]);
    },
  );

  it('impact_report declares its section count and placeholder count', () => {
    if (!present) return;
    const report = (projection['impact_report'] ?? {}) as Record<string, unknown>;
    expect(typeof report['sections']).toBe('number');
    expect(typeof report['placeholders']).toBe('number');
  });
});
