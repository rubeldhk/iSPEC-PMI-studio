/**
 * T128 — coverage gap detection. Written to FAIL before T132 exists
 * (Constitution V).
 *
 * FR-031 / SC-010: gaps are derived from ABSENCE — requirements no
 * specification traces to, specifications no task traces to.
 */
import { describe, expect, it } from 'vitest';
import { CoverageService } from '../../../src/modules/traceability/coverage.service.js';
import { buildTraceFixture } from './helpers.js';

const ARTIFACTS = {
  listRequirementIds: async (workspaceId: string, projectId: string): Promise<string[]> =>
    workspaceId === 'ws_a' && projectId === 'p1' ? ['r1', 'r2', 'r_retired', 'r_uncovered'] : [],
  listSpecificationIds: async (workspaceId: string, projectId: string): Promise<string[]> =>
    workspaceId === 'ws_a' && projectId === 'p1' ? ['s1', 's2'] : [],
};

describe('coverage gaps (FR-031)', () => {
  it('names requirements with NO specification', async () => {
    const { store } = await buildTraceFixture();
    const svc = new CoverageService(store, ARTIFACTS);
    const coverage = await svc.forProject('ws_a', 'p1');
    expect(coverage.uncoveredRequirementIds).toEqual(['r_uncovered']);
  });

  it('names specifications with NO tasks', async () => {
    const { store } = await buildTraceFixture();
    const svc = new CoverageService(store, ARTIFACTS);
    const coverage = await svc.forProject('ws_a', 'p1');
    expect(coverage.specificationsWithoutTasks).toEqual(['s2']);
  });

  it('reports totals so a percentage is derivable (SC-010)', async () => {
    const { store } = await buildTraceFixture();
    const svc = new CoverageService(store, ARTIFACTS);
    const coverage = await svc.forProject('ws_a', 'p1');
    expect(coverage.requirementCount).toBe(4);
    expect(coverage.specificationCount).toBe(2);
  });

  it('full coverage reports empty gaps, not absence of a report', async () => {
    const { store } = await buildTraceFixture();
    const svc = new CoverageService(store, {
      listRequirementIds: async () => ['r1'],
      listSpecificationIds: async () => ['s1'],
    });
    const coverage = await svc.forProject('ws_a', 'p1');
    expect(coverage.uncoveredRequirementIds).toEqual([]);
    expect(coverage.specificationsWithoutTasks).toEqual([]);
  });

  it('is workspace-scoped (FR-002)', async () => {
    const { store } = await buildTraceFixture();
    const svc = new CoverageService(store, ARTIFACTS);
    const coverage = await svc.forProject('ws_b', 'p1');
    expect(coverage.requirementCount).toBe(0);
  });
});
