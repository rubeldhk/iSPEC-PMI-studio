/**
 * T011a — Workspace/User schema constraints.
 * Written to FAIL before T012/T013 exist (Constitution V).
 *
 * Asserts against the Prisma schema source rather than a live database: these
 * are declarative guarantees, and checking them here catches a mistake before
 * a migration is ever generated.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

function model(name: string): string {
  const m = schema.match(new RegExp(`model ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m?.[1]) throw new Error(`model ${name} not found in schema.prisma`);
  return m[1];
}

describe('Workspace', () => {
  it('exists with a name', () => {
    expect(model('Workspace')).toMatch(/name\s+String/);
  });
});

describe('User', () => {
  const user = () => model('User');

  it('has a unique email', () => {
    expect(user()).toMatch(/email\s+String\s+@unique/);
  });

  it('stores a password hash, never a password', () => {
    expect(user()).toMatch(/passwordHash\s+String/);
    expect(user()).not.toMatch(/\bpassword\s+String/);
  });

  it('belongs to a workspace', () => {
    expect(user()).toMatch(/workspaceId\s+String/);
  });
});

describe('universal columns (T013)', () => {
  // FR-002: every tenant-scoped row carries its workspace, from migration 1,
  // so Phase 3 row-level security is a switch and not a data migration.
  const tenantScoped = ['User', 'Project', 'GenerationJob', 'AuditEntry'];

  it.each(tenantScoped)('%s carries workspaceId', (name) => {
    expect(model(name)).toMatch(/workspaceId\s+String/);
  });

  it.each(['User', 'Project', 'GenerationJob'])('%s carries createdAt', (name) => {
    expect(model(name)).toMatch(/createdAt\s+DateTime/);
  });
});

describe('Project stub (EPIC-001 plan decision)', () => {
  // Structural only. GenerationJob needs a project to belong to; EPIC-006 owns
  // the behaviour and will extend this. It must NOT grow before then.
  const project = () => model('Project');

  it('exists with the minimum structural fields', () => {
    expect(project()).toMatch(/workspaceId\s+String/);
    expect(project()).toMatch(/name\s+String/);
    expect(project()).toMatch(/ownerUserId\s+String/);
  });

  it('carries no product behaviour yet', () => {
    // Archival, templates, health and engine selection belong to EPIC-006.
    expect(project()).not.toMatch(/status\s+ProjectStatus/);
    expect(project()).not.toMatch(/archivedAt/);
  });
});

describe('AuditEntry', () => {
  it('records actor, action, target and outcome', () => {
    const a = model('AuditEntry');
    expect(a).toMatch(/action\s+AuditAction/);
    expect(a).toMatch(/outcome\s+AuditOutcome/);
    expect(a).toMatch(/targetType\s+String/);
  });

  it('allows a null actor only for unauthenticated refusals', () => {
    expect(model('AuditEntry')).toMatch(/actorId\s+String\?/);
  });
});
