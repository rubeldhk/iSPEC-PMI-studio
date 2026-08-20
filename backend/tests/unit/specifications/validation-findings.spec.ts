/**
 * T117 — every finding carries a location; a finding without one is malformed
 * output. Written to FAIL before T121 exists (Constitution V).
 *
 * FR-023 / FR-026. The engine contract already marks `location` REQUIRED; this
 * service is where a violation becomes the `malformed_output` failure rather
 * than a half-stored result (FR-027: no partial artifact).
 */
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
