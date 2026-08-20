/**
 * T012a — the generated migration applies the universal columns to EVERY table.
 *
 * T011a already asserts the *convention* in `schema.prisma`. This asserts the
 * thing that actually reaches the database: the migration SQL. The two are not
 * the same claim, and only one of them is what PostgreSQL executes.
 *
 * FR-002: every tenant-scoped table carries a workspace reference from the
 * FIRST migration, so Phase 3 row-level security is a switch rather than a data
 * migration. A table that misses it is not a style problem — it is a table that
 * cannot be isolated later without moving data.
 *
 * COLUMN NAMING: camelCase, not the snake_case of `specs/_shared/schema.sql`.
 * `tech-stack.md` makes `schema.prisma` authoritative at implementation and the
 * design DDL "design-level"; the built application reads `workspaceId`
 * throughout, and `schema-constraints.spec.ts` already asserts that form.
 *
 * KNOWN DIVERGENCE — see `defects/DEF-004-001-created-by-columns.md`: the design
 * DDL carries `created_by`/`updated_by`; the Prisma schema carries neither. That
 * is recorded as a defect rather than asserted here, because inventing the
 * columns in a test would fail a build over a decision nobody has taken.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/**
 * `workspaces` IS the tenant, so it carries no reference to itself.
 * `engine_registrations` belongs to the deployment, not a customer — the
 * exception is asserted deliberately in `schema-constraints.spec.ts` so that a
 * future reader knows it was decided rather than forgotten.
 */
const NOT_TENANT_SCOPED = new Set(['workspaces', 'engine_registrations', '_prisma_migrations']);

function migrationSql(): string {
  expect(existsSync(MIGRATIONS), `no migrations directory at ${MIGRATIONS}`).toBe(true);
  const dirs = readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d));
  expect(dirs.length, 'no migration has been generated — T013 is not done').toBeGreaterThan(0);
  return dirs
    .sort()
    .map((d) => readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8'))
    .join('\n');
}

/** Table name → the body of its CREATE TABLE statement. */
function createdTables(sql: string): Map<string, string> {
  const tables = new Map<string, string>();
  for (const match of sql.matchAll(/CREATE TABLE\s+"?(\w+)"?\s*\(([\s\S]*?)\n\);/g)) {
    const [, name, body] = match;
    if (name && body) tables.set(name, body);
  }
  return tables;
}

const sql = migrationSql();
const tables = createdTables(sql);
const tenantScoped = [...tables.keys()].filter((t) => !NOT_TENANT_SCOPED.has(t));

describe('T012a · universal columns reach the database (FR-002)', () => {
  it('creates the Phase 1 table set', () => {
    // requirements + requirement_versions arrived with EPIC-007 T064, the
    // first product-surface tables after the PMI-DOC-004 hold discharged.
    // traceability_links (EPIC-011 T078) and architecture_decision_records
    // (EPIC-016 T143) arrived with the lifecycle wave. specifications +
    // specification_versions join when EPIC-008's migration commit lands —
    // its branch carries that half.
    expect([...tables.keys()].sort()).toEqual([
      'architecture_decision_records',
      'audit_entries',
      'engine_registrations',
      'generation_jobs',
      'projects',
      'requirement_versions',
      'requirements',
      'traceability_links',
      'users',
      'workspaces',
    ]);
  });

  it('gives every tenant-scoped table a workspaceId', () => {
    const missing = tenantScoped.filter((t) => !/"workspaceId"/.test(tables.get(t) ?? ''));
    expect(
      missing,
      'these tables cannot be tenant-isolated without a later data migration',
    ).toEqual([]);
  });

  it('indexes workspaceId on every tenant-scoped table', () => {
    // Without the index the scoping helper (T014) turns every read into a
    // sequential scan the moment a second tenant exists.
    const missing = tenantScoped.filter(
      (t) => !new RegExp(`ON "${t}"\\([^)]*"workspaceId"`, 'i').test(sql),
    );
    expect(missing, 'workspaceId is unindexed on these tables').toEqual([]);
  });

  it('gives every table a creation timestamp', () => {
    // Two tables name it for their domain: an engine is *registered* and an
    // audit event *occurs* — neither is "created". The exceptions are listed
    // rather than the rule relaxed, so a table that simply forgets its
    // timestamp still fails.
    const CREATION_COLUMN: Record<string, string> = {
      engine_registrations: 'registeredAt',
      audit_entries: 'occurredAt',
      // A version row is *authored* — its timestamp is part of the history it
      // records, not bookkeeping about the row (EPIC-007 T064, EPIC-008 T077).
      requirement_versions: 'authoredAt',
      specification_versions: 'authoredAt',
    };

    const missing = [...tables.entries()]
      .filter(([name, body]) => !new RegExp(`"${CREATION_COLUMN[name] ?? 'createdAt'}"`).test(body))
      .map(([name]) => name);
    expect(missing, 'these tables record no creation time').toEqual([]);
  });

  it('declares the workspaces table without a self-referential workspaceId', () => {
    expect(tables.get('workspaces'), 'the tenant table is missing entirely').toBeDefined();
    expect(/"workspaceId"/.test(tables.get('workspaces') ?? '')).toBe(false);
  });

  it('keeps engine_registrations deployment-scoped, not tenant-scoped', () => {
    // Mirrors schema-constraints.spec.ts: the exception is asserted so it stays
    // decided. If a future migration adds workspaceId here, this fails loudly.
    expect(/"workspaceId"/.test(tables.get('engine_registrations') ?? '')).toBe(false);
  });
});
