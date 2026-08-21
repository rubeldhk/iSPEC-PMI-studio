/**
 * T225 — the organization tier (FR-ENH-001, R-017-1).
 * Written to FAIL before T226/T227 exist (Constitution V).
 *
 * Three claims, all structural, all asserted against the schema and migration
 * the way `schema-constraints.spec.ts` does — because they are claims about
 * what the DATABASE guarantees, not about any service:
 *
 *   1. a workspace belongs to exactly ONE organization (required scalar FK);
 *   2. deleting an organization that still has workspaces is REFUSED;
 *   3. organization is reachable from any artifact by ONE join — which is
 *      true iff `organizationId` lives on `workspaces` and on NOTHING else.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

function model(name: string): string {
  const match = new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`, 'm').exec(SCHEMA);
  if (!match) throw new Error(`model ${name} not found in schema.prisma`);
  return match[0];
}

function organizationMigration(): string {
  const dir = readdirSync(MIGRATIONS)
    .filter((d) => /^\d/.test(d))
    .find((d) => /CREATE TABLE "organizations"/.test(readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8')));
  if (!dir) throw new Error('no migration creates the organizations table');
  return readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8');
}

describe('T225 · the Organization model (FR-ENH-001)', () => {
  it('exists, with a required unique name', () => {
    const organization = model('Organization');
    expect(organization).toMatch(/name\s+String\s+@unique/);
  });

  it('a workspace belongs to exactly one organization — required, not optional', () => {
    const workspace = model('Workspace');
    expect(workspace).toMatch(/organizationId\s+String/);
    // Optional would read `String?` — one workspace, one organization, always.
    expect(workspace).not.toMatch(/organizationId\s+String\?/);
    expect(workspace).toMatch(/organization\s+Organization\s+@relation/);
  });

  it('deleting an organization with workspaces is refused (onDelete: Restrict)', () => {
    const workspace = model('Workspace');
    expect(workspace).toMatch(/onDelete:\s*Restrict/);
  });

  it('organization is reachable from any artifact by ONE join — no other model carries organizationId', () => {
    const carriers = [...SCHEMA.matchAll(/model (\w+) \{[\s\S]*?\n\}/g)]
      .filter(([block]) => /organizationId/.test(block))
      .map(([, name]) => name);
    expect(carriers).toEqual(['Workspace']);
  });
});

describe('T225 · the organization migration (T227)', () => {
  it('creates organizations and gives ONLY workspaces the tenancy column', () => {
    const sql = organizationMigration();
    expect(sql).toMatch(/CREATE TABLE "organizations"/);
    const columnAdds = [...sql.matchAll(/ALTER TABLE "(\w+)" ADD COLUMN\s+"organizationId"/g)].map(
      ([, table]) => table,
    );
    expect(columnAdds).toEqual(['workspaces']);
  });

  it('the workspace FK refuses to orphan — RESTRICT, not CASCADE', () => {
    const sql = organizationMigration();
    expect(sql).toMatch(/FOREIGN KEY \("organizationId"\)[\s\S]*?ON DELETE RESTRICT/);
  });
});
