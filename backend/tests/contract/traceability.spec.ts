/**
 * T129 — contract tests for trace and coverage endpoints against
 * `contracts/platform-api.md` (Traceability · US7).
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { TraceabilityController } from '../../src/modules/traceability/traceability.controller.js';
import { TraceabilityService } from '../../src/modules/traceability/traceability.service.js';
import { CoverageService } from '../../src/modules/traceability/coverage.service.js';
import {
  InMemoryTraceabilityLinkStore,
  LinkWriterService,
} from '../../src/modules/traceability/link-writer.service.js';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';

const PATH = 'path';
const METHOD = 'method';

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = TraceabilityController.prototype[handler as keyof TraceabilityController] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

async function controller(): Promise<TraceabilityController> {
  const store = new InMemoryTraceabilityLinkStore();
  const writer = new LinkWriterService(store);
  await writer.linkSpecificationToRequirements({
    workspaceId: 'ws_a',
    specificationId: 's1',
    requirementIds: ['r1'],
  });
  await writer.linkTasksToSpecification({
    workspaceId: 'ws_a',
    specificationId: 's1',
    taskIds: ['t1'],
  });
  const coverage = new CoverageService(store, {
    listRequirementIds: async () => ['r1', 'r2'],
    listSpecificationIds: async () => ['s1'],
  });
  return new TraceabilityController(new TraceabilityService(store), coverage);
}

describe('contract · Traceability route surface (US7)', () => {
  it.each([
    ['requirementTrace', 'requirements/:id/trace', RequestMethod.GET],
    ['taskTrace', 'tasks/:id/trace', RequestMethod.GET],
    ['specificationTrace', 'specifications/:id/trace', RequestMethod.GET],
    ['projectCoverage', 'projects/:projectId/coverage', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });
});

describe('contract · behaviour', () => {
  it('forward trace returns everything derived from a requirement (FR-030)', async () => {
    const c = await controller();
    const out = await c.requirementTrace(CTX, 'r1');
    expect(out.specifications).toHaveLength(1);
    expect(out.specifications[0]?.taskIds).toEqual(['t1']);
  });

  it('reverse trace resolves a task back to its requirements, each carrying its retirement flag (FR-030, US7/4)', async () => {
    const c = await controller();
    const out = await c.taskTrace(CTX, 't1');
    expect(out.specifications[0]?.requirements).toEqual([{ requirementId: 'r1', retired: false }]);
  });

  it('coverage derives gaps from absence (FR-031, SC-010)', async () => {
    const c = await controller();
    const out = await c.projectCoverage(CTX, 'p1');
    expect(out.uncoveredRequirementIds).toEqual(['r2']);
    expect(out.specificationsWithoutTasks).toEqual([]);
  });

  it('no session is 401 with code "unauthenticated"', async () => {
    const c = await controller();
    const err = await c.projectCoverage(undefined, 'p1').catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(401);
    expect(toErrorBody(err).error.code).toBe('unauthenticated');
  });
});
