/**
 * T273 — the twelve reviewing and authoring roles (FR-ENH-023/024).
 * Written to FAIL before T274 exists (Constitution V).
 *
 * The names come from the source document's "Recommended AI Agents" roster,
 * verbatim (kebab-cased). Each declares a responsibility and its permitted
 * artifact types; a role acting outside them is refused BY NAME.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REVIEW_ROLES,
  assertRoleMayActOn,
  roleByName,
} from '../../../src/modules/reviews/roles.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

const THE_TWELVE = [
  'requirements-analyst',
  'business-analyst',
  'solution-architect',
  'ux-designer',
  'planning-agent',
  'developer-agent',
  'qa-agent',
  'security-reviewer',
  'performance-reviewer',
  'documentation-agent',
  'release-manager',
  'operations-advisor',
];

describe('T273 · the roster is exactly the twelve named roles', () => {
  it('twelve roles, the source names, no additions', () => {
    expect(REVIEW_ROLES.map((r) => r.name).sort()).toEqual([...THE_TWELVE].sort());
  });

  it('every role declares a non-empty responsibility', () => {
    for (const role of REVIEW_ROLES) {
      expect(role.responsibility.trim().length, role.name).toBeGreaterThan(0);
    }
  });

  it('every role declares at least one permitted artifact type', () => {
    for (const role of REVIEW_ROLES) {
      expect(role.permittedArtifactTypes.length, role.name).toBeGreaterThan(0);
    }
  });

  it('an unknown role is refused by name', () => {
    expect(() => roleByName('vibes-reviewer')).toThrow(/vibes-reviewer/);
  });
});

describe('T273 · a role acting outside its permitted artifact types is refused', () => {
  it('the security reviewer may act on a specification', () => {
    expect(() => assertRoleMayActOn('security-reviewer', 'specification')).not.toThrow();
  });

  it('a role is refused BY NAME against an artifact type it does not declare', () => {
    const err = (() => {
      try {
        assertRoleMayActOn('release-manager', 'requirement');
        return null;
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/release-manager/);
    expect(err?.message).toMatch(/requirement/);
  });
});

describe('T273 · the Role model and seed (T274)', () => {
  it('the model exists, deployment-scoped like engine_registrations', () => {
    const match = /model ReviewRole \{[\s\S]*?\n\}/.exec(SCHEMA);
    expect(match, 'model ReviewRole missing').toBeTruthy();
    const block = match![0];
    expect(block).toMatch(/name\s+String\s+@unique/);
    expect(block).toMatch(/responsibility\s+String/);
    expect(block).toMatch(/permittedArtifactTypes\s+String\[\]/);
    expect(block).toMatch(/@@map\("review_roles"\)/);
  });

  it('the migration seeds all twelve', () => {
    const dir = readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .find((d) =>
        /CREATE TABLE "review_roles"/.test(readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8')),
      );
    expect(dir, 'no migration creates review_roles').toBeTruthy();
    const sql = readFileSync(join(MIGRATIONS, dir!, 'migration.sql'), 'utf8');
    for (const name of THE_TWELVE) {
      expect(sql, `seed missing ${name}`).toContain(name);
    }
  });
});
