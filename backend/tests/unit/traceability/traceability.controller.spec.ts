/**
 * T132a — trace and coverage endpoints with a mocked service.
 * Written to FAIL before T133 exists (Constitution V).
 */
import { describe, expect, it, vi } from 'vitest';
import { TraceabilityController } from '../../../src/modules/traceability/traceability.controller.js';
import type { CoverageService } from '../../../src/modules/traceability/coverage.service.js';
import type { TraceabilityService } from '../../../src/modules/traceability/traceability.service.js';
import { UnauthenticatedError } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

function mocks(): { trace: TraceabilityService; coverage: CoverageService } {
  return {
    trace: {
      forwardTrace: vi.fn(async () => ({ requirementId: 'r1', specifications: [] })),
      reverseTrace: vi.fn(async () => ({ taskId: 't1', specifications: [] })),
      bothFor: vi.fn(async () => ({ specificationId: 's1', requirements: [], tasks: [] })),
    } as unknown as TraceabilityService,
    coverage: {
      forProject: vi.fn(async () => ({
        uncoveredRequirementIds: [],
        specificationsWithoutTasks: [],
        requirementCount: 0,
        specificationCount: 0,
      })),
    } as unknown as CoverageService,
  };
}

describe('TraceabilityController · wiring', () => {
  it('GET /requirements/{id}/trace → forward, workspace-scoped', async () => {
    const { trace, coverage } = mocks();
    const c = new TraceabilityController(trace, coverage);
    await c.requirementTrace(CTX, 'r1');
    expect(trace.forwardTrace).toHaveBeenCalledWith('ws_a', 'r1');
  });

  it('GET /tasks/{id}/trace → reverse', async () => {
    const { trace, coverage } = mocks();
    const c = new TraceabilityController(trace, coverage);
    await c.taskTrace(CTX, 't1');
    expect(trace.reverseTrace).toHaveBeenCalledWith('ws_a', 't1');
  });

  it('GET /specifications/{id}/trace → both directions', async () => {
    const { trace, coverage } = mocks();
    const c = new TraceabilityController(trace, coverage);
    await c.specificationTrace(CTX, 's1');
    expect(trace.bothFor).toHaveBeenCalledWith('ws_a', 's1');
  });

  it('GET /projects/{id}/coverage → the gap report', async () => {
    const { trace, coverage } = mocks();
    const c = new TraceabilityController(trace, coverage);
    await c.projectCoverage(CTX, 'p1');
    expect(coverage.forProject).toHaveBeenCalledWith('ws_a', 'p1');
  });

  it('no session is 401 on every route', async () => {
    const { trace, coverage } = mocks();
    const c = new TraceabilityController(trace, coverage);
    for (const call of [
      (): Promise<unknown> => c.requirementTrace(undefined, 'r1'),
      (): Promise<unknown> => c.taskTrace(undefined, 't1'),
      (): Promise<unknown> => c.specificationTrace(undefined, 's1'),
      (): Promise<unknown> => c.projectCoverage(undefined, 'p1'),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });

  it('exposes ONLY read routes — the graph is written by generation, not by hand', () => {
    const methods = Object.getOwnPropertyNames(TraceabilityController.prototype).filter(
      (m) => m !== 'constructor',
    );
    expect(methods.sort()).toEqual(
      ['projectCoverage', 'requirementTrace', 'specificationTrace', 'taskTrace'].sort(),
    );
  });
});
