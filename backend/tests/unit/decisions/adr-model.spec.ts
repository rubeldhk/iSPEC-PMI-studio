/**
 * T144 — the ADR model: required context/decision/consequences, reference
 * unique PER PROJECT, status defaulting to proposed.
 * Written to FAIL before T143 exists (Constitution V).
 *
 * FR-034. Asserted against the Prisma schema source, the T011a pattern: these
 * are declarative guarantees, caught before a migration is generated.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

function model(name: string): string {
  const m = schema.match(new RegExp(`model ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m?.[1]) throw new Error(`model ${name} not found in schema.prisma`);
  return m[1];
}

describe('ArchitectureDecisionRecord (T143, FR-034)', () => {
  const adr = (): string => model('ArchitectureDecisionRecord');

  it('requires context, decision, and consequences — non-nullable', () => {
    expect(adr()).toMatch(/context\s+String\n/);
    expect(adr()).toMatch(/decision\s+String\n/);
    expect(adr()).toMatch(/consequences\s+String\n/);
    expect(adr()).not.toMatch(/context\s+String\?/);
    expect(adr()).not.toMatch(/decision\s+String\?/);
    expect(adr()).not.toMatch(/consequences\s+String\?/);
  });

  it('reference is unique PER PROJECT — two projects may each hold ADR-0001', () => {
    expect(adr()).toMatch(/@@unique\(\[projectId, reference\]\)/);
  });

  it('status is the three-value enum defaulting to proposed — no lifecycle machinery', () => {
    expect(schema).toMatch(/enum AdrStatus\s*\{\s*proposed\s+accepted\s+superseded\s*\}/);
    expect(adr()).toMatch(/status\s+AdrStatus\s+@default\(proposed\)/);
  });

  it('is tenant-scoped and project-bound (FR-002)', () => {
    expect(adr()).toMatch(/workspaceId\s+String/);
    expect(adr()).toMatch(/projectId\s+String/);
    expect(adr()).toMatch(/@@index\(\[workspaceId\]\)/);
  });
});
