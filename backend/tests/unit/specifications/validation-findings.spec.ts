/**
 * T117 — every finding carries a location; a finding without one is malformed
 * output. Written to FAIL before T121 exists (Constitution V).
 *
 * FR-023 / FR-026. The engine contract already marks `location` REQUIRED; this
 * service is where a violation becomes the `malformed_output` failure rather
 * than a half-stored result (FR-027: no partial artifact).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  ValidateSpecificationService,
  type FindingSink,
} from '../../../src/modules/specifications/validate-specification.service.js';
import { engineOk, engineFail, type SpecificationEngine, type ValidationFinding } from '@pmi/engine-contract';

const DESCRIPTOR = {
  name: 'fixture',
  version: '0.1.0',
  capabilities: [
    'generate_specification',
    'generate_tasks',
    'validate_specification',
  ] as ('generate_specification' | 'generate_tasks' | 'validate_specification')[],
};

const CTX = {
  signal: new AbortController().signal,
  timeoutMs: 1000,
  correlationId: 'corr-1',
};

const TARGET = {
  workspaceId: 'ws_a',
  specificationId: 's1',
  specificationVersionId: 'sv1',
};

function engineReturning(findings: ValidationFinding[]): SpecificationEngine {
  return {
    descriptor: DESCRIPTOR,
    validateSpecification: vi.fn(async () => engineOk(findings, DESCRIPTOR)),
  } as unknown as SpecificationEngine;
}

function sink(): FindingSink & { stored: unknown[] } {
  const stored: unknown[] = [];
  return {
    stored,
    appendAll: vi.fn(async (rows: unknown[]) => {
      stored.push(...rows);
    }),
  };
}

describe('ValidateSpecificationService (FR-023)', () => {
  it('stores well-formed findings bound to the validated VERSION', async () => {
    const findings: ValidationFinding[] = [
      { location: 'section 2, requirement table', severity: 'warning', message: 'ambiguous term' },
      { location: 'acceptance criteria', severity: 'error', message: 'no measurable outcome' },
    ];
    const s = sink();
    const svc = new ValidateSpecificationService(s);
    const result = await svc.validate(
      engineReturning(findings),
      { specificationTitle: 'T', specificationContent: 'C' },
      CTX,
      TARGET,
    );

    expect(result.ok).toBe(true);
    expect(s.stored).toHaveLength(2);
    expect(s.stored[0]).toMatchObject({
      workspaceId: 'ws_a',
      specificationId: 's1',
      specificationVersionId: 'sv1',
      location: 'section 2, requirement table',
      severity: 'warning',
    });
  });

  it('a finding WITHOUT a location is malformed output — nothing is stored (FR-027)', async () => {
    const s = sink();
    const svc = new ValidateSpecificationService(s);
    const result = await svc.validate(
      engineReturning([
        { location: 'fine', severity: 'info', message: 'ok' },
        { location: '   ', severity: 'error', message: 'lost finding' },
      ]),
      { specificationTitle: 'T', specificationContent: 'C' },
      CTX,
      TARGET,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('malformed_output');
    // No partial artifact: the well-formed sibling is NOT stored either.
    expect(s.stored).toHaveLength(0);
  });

  it('an engine failure passes through untouched — never re-labelled', async () => {
    const failing = {
      descriptor: DESCRIPTOR,
      validateSpecification: vi.fn(async () => engineFail('engine_unavailable', 'down')),
    } as unknown as SpecificationEngine;
    const s = sink();
    const svc = new ValidateSpecificationService(s);
    const result = await svc.validate(
      failing,
      { specificationTitle: 'T', specificationContent: 'C' },
      CTX,
      TARGET,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('engine_unavailable');
    expect(s.stored).toHaveLength(0);
  });

  it('zero findings is a SUCCESS, not an empty failure', async () => {
    const s = sink();
    const svc = new ValidateSpecificationService(s);
    const result = await svc.validate(
      engineReturning([]),
      { specificationTitle: 'T', specificationContent: 'C' },
      CTX,
      TARGET,
    );
    expect(result.ok).toBe(true);
    expect(s.stored).toHaveLength(0);
  });
});

// ------------------------------------------------------- T120 · persistence
//
// Added when the EPIC-008-gated half of this Epic landed: a finding references
// the specification VERSION it was found in, so the table could not exist
// before T077 created that version table.

describe('T120 · ValidationFinding reaches the database (FR-023)', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(
    resolve(root, 'prisma/migrations/20260820100100_epic009_lifecycle_findings/migration.sql'),
    'utf8',
  );
  const model = /model ValidationFinding\s*\{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? '';

  it('binds a finding to the VERSION that was validated, not the specification alone', () => {
    // A later version has not been checked. Attaching findings to the
    // specification would carry a stale verdict forward silently.
    expect(model).toMatch(/specificationVersionId\s+String\b(?!\?)/);
    expect(model).toMatch(/specificationId\s+String\b(?!\?)/);
  });

  it('requires a location — never nullable (FR-023)', () => {
    expect(model).toMatch(/location\s+String\b(?!\?)/);
  });

  it('backs the location rule with a CHECK, so no bypass can store a blank one', () => {
    // The service refuses a finding with no location; this refuses it again at
    // the table, for the migration script the service never sees.
    expect(migration).toMatch(
      /validation_findings_location_present" CHECK \(char_length\(trim\("location"\)\) > 0\)/,
    );
  });

  it('carries the three severities the engine contract declares', () => {
    expect(schema).toMatch(/enum FindingSeverity\s*\{[\s\S]*info[\s\S]*warning[\s\S]*error[\s\S]*\n\}/);
  });

  it('indexes lookups by version — the read path the approval gate uses', () => {
    expect(model).toMatch(/@@index\(\[specificationVersionId\]\)/);
  });

  it('carries workspaceId like every tenant-scoped model (FR-002)', () => {
    expect(model).toMatch(/workspaceId\s+String/);
  });
});
