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
  // Requirement + RequirementVersion joined the list with EPIC-007 T064;
  // Specification + SpecificationVersion with EPIC-008 T077.
  const tenantScoped = [
    'User',
    'Project',
    'GenerationJob',
    'AuditEntry',
    'Requirement',
    'RequirementVersion',
    'TraceabilityLink',
    'ArchitectureDecisionRecord',
    // The deferred half arrived: Specification + SpecificationVersion with the
    // EPIC-008 integration, LifecycleTransition + ValidationFinding with
    // EPIC-009 T109/T120.
    'Specification',
    'SpecificationVersion',
    'LifecycleTransition',
    'ValidationFinding',
    'Task',
  ];

  it.each(tenantScoped)('%s carries workspaceId', (name) => {
    expect(model(name)).toMatch(/workspaceId\s+String/);
  });

  it.each(['User', 'Project', 'GenerationJob'])('%s carries createdAt', (name) => {
    expect(model(name)).toMatch(/createdAt\s+DateTime/);
  });
});

describe('Project (EPIC-006 T053 — ownership taken 2026-08-20)', () => {
  // Until PMI-DOC-004 v1.0 discharged the D-10 hold, this block asserted the
  // opposite: that the EPIC-001 stub had NOT grown. The stub guard did its job
  // and retired the day the owning epic arrived — same file, inverted claim.
  const project = () => model('Project');

  it('keeps the structural fields the stub established', () => {
    expect(project()).toMatch(/workspaceId\s+String/);
    expect(project()).toMatch(/name\s+String/);
    expect(project()).toMatch(/ownerUserId\s+String/);
  });

  it('carries the behavioural fields EPIC-006 owns (FR-001, FR-019)', () => {
    expect(project()).toMatch(/status\s+ProjectStatus/);
    expect(project()).toMatch(/archivedAt\s+DateTime\?/);
    expect(project()).toMatch(/description\s+String\?/);
    // Null = inherit the default engine — EngineResolverService's contract.
    expect(project()).toMatch(/engineName\s+String\?/);
  });

  it('names are unique within a workspace, not globally', () => {
    expect(project()).toMatch(/@@unique\(\[workspaceId, name\]\)/);
  });
});

describe('Requirement register (EPIC-007 T064)', () => {
  it('Requirement indexes type, priority, and status per project (FR-008)', () => {
    const req = model('Requirement');
    expect(req).toMatch(/@@index\(\[projectId, type\]\)/);
    expect(req).toMatch(/@@index\(\[projectId, priority\]\)/);
    expect(req).toMatch(/@@index\(\[projectId, status\]\)/);
    expect(req).toMatch(/@@unique\(\[projectId, reference\]\)/);
  });

  it('RequirementVersion is history — it records author and time, never a status', () => {
    const version = model('RequirementVersion');
    expect(version).toMatch(/authoredById\s+String/);
    expect(version).toMatch(/authoredAt\s+DateTime/);
    // Append-only rows have no lifecycle of their own.
    expect(version).not.toMatch(/status/);
    expect(version).not.toMatch(/updatedAt/);
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

// T034 — EngineRegistration. Added by EPIC-003.
describe('EngineRegistration (EPIC-003 T034)', () => {
  const engine = () => model('EngineRegistration');

  it('records the engine set a deployment accepted', () => {
    expect(engine()).toMatch(/name\s+String\s+@unique/);
    expect(engine()).toMatch(/version\s+String/);
    expect(engine()).toMatch(/capabilities\s+String\[\]/);
    expect(engine()).toMatch(/isDefault\s+Boolean/);
  });

  it('is NOT tenant-scoped — an engine belongs to the deployment, not a customer', () => {
    // FR-002's universal-column rule covers tenant-scoped models. Asserting the
    // exception so a future reader knows it was decided, not forgotten.
    expect(engine()).not.toMatch(/workspaceId/);
  });

  it('holds no per-project selection itself — the selection lives on Project (FR-019)', () => {
    // EPIC-006 T053 put `engineName` on Project (asserted above); the registry
    // stays deployment-scoped and never references a project.
    expect(engine()).not.toMatch(/projectId/);
  });
});
