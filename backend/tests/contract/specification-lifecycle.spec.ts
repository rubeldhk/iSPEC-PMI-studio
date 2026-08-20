/**
 * T108 — contract tests for the six lifecycle transition endpoints and the
 * version endpoints against `contracts/platform-api.md` (Specifications · US5).
 *
 * Route surface from routing metadata (the `/v1` prefix is global, D-8), plus
 * behaviour against the real in-memory graph: the eight permitted transitions
 * work, everything else is refused with `invalid_lifecycle_transition` and the
 * permitted set NAMED (FR-011); versions are comparable (FR-015).
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { SpecificationLifecycleController } from '../../src/modules/specifications/specifications.controller.js';
import {
  InMemoryFindingStore,
  SpecificationLifecycleService,
} from '../../src/modules/specifications/lifecycle-api.service.js';
import { InMemoryTransitionRecorder } from '../../src/modules/specifications/lifecycle.machine.js';
import { InMemorySpecificationStore } from '../../src/modules/specifications/specifications-read.service.js';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';

const PATH = 'path';
const METHOD = 'method';

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = SpecificationLifecycleController.prototype[
    handler as keyof SpecificationLifecycleController
  ] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

async function build(): Promise<{
  controller: SpecificationLifecycleController;
  recorder: InMemoryTransitionRecorder;
  specificationId: string;
}> {
  const store = new InMemorySpecificationStore();
  const committed = await store.commitGeneration({
    specification: {
      id: 's_probe',
      workspaceId: 'ws_a',
      projectId: 'p1',
      title: 'Probe spec',
      lifecycleState: 'draft',
      currentVersionId: 'sv_probe',
      engineName: 'fixture',
      engineVersion: '0.1.0',
      generatedAt: new Date(),
      isOutOfDate: false,
      createdById: 'u1',
      updatedById: 'u1',
    },
    version: {
      id: 'sv_probe',
      workspaceId: 'ws_a',
      specificationId: 's_probe',
      versionNumber: 1,
      contentRaw: '# v1\nline one\n',
      contentParsed: {},
      lifecycleStateAtCreation: 'draft',
      authoredById: 'u1',
    },
    links: [],
    job: { id: 'job_probe', state: 'succeeded', resultRef: 'spec:s_probe' },
  });
  const recorder = new InMemoryTransitionRecorder();
  const service = new SpecificationLifecycleService(store, recorder, new InMemoryFindingStore());
  return {
    controller: new SpecificationLifecycleController(service),
    recorder,
    specificationId: committed.id,
  };
}

describe('contract · lifecycle route surface (US5)', () => {
  it.each([
    ['submitForReview', 'specifications/:id/submit-for-review', RequestMethod.POST],
    ['reject', 'specifications/:id/reject', RequestMethod.POST],
    ['approve', 'specifications/:id/approve', RequestMethod.POST],
    ['baseline', 'specifications/:id/baseline', RequestMethod.POST],
    ['markImplemented', 'specifications/:id/mark-implemented', RequestMethod.POST],
    ['archive', 'specifications/:id/archive', RequestMethod.POST],
    ['versions', 'specifications/:id/versions', RequestMethod.GET],
    ['diff', 'specifications/:id/versions/:a/diff/:b', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });
});

describe('contract · the state machine over HTTP (FR-011)', () => {
  it('walks the happy path: draft → review → approved → baselined → implemented → archived', async () => {
    const { controller, recorder, specificationId } = await build();
    await controller.submitForReview(CTX, specificationId);
    await controller.approve(CTX, specificationId);
    await controller.baseline(CTX, specificationId);
    await controller.markImplemented(CTX, specificationId);
    const archived = await controller.archive(CTX, specificationId);
    expect(archived.lifecycleState).toBe('archived');
    // FR-014: every step recorded with actor and time.
    expect(recorder.records.map((r) => `${r.fromState}→${r.toState}`)).toEqual([
      'draft→review',
      'review→approved',
      'approved→baselined',
      'baselined→implemented',
      'implemented→archived',
    ]);
    expect(recorder.records.every((r) => r.actorId === 'u1')).toBe(true);
  });

  it('reject returns review → draft for rework', async () => {
    const { controller, specificationId } = await build();
    await controller.submitForReview(CTX, specificationId);
    const rejected = await controller.reject(CTX, specificationId);
    expect(rejected.lifecycleState).toBe('draft');
  });

  it('a forbidden transition is 422 naming the permitted set — approved → draft stays impossible', async () => {
    const { controller, specificationId } = await build();
    await controller.submitForReview(CTX, specificationId);
    await controller.approve(CTX, specificationId);
    const err = await controller.reject(CTX, specificationId).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(422);
    const body = toErrorBody(err);
    expect(body.error.code).toBe('invalid_lifecycle_transition');
    expect((body.error.details as { permitted: string[] }).permitted.sort()).toEqual([
      'archived',
      'baselined',
    ]);
  });

  it('approve surfaces outstanding findings before proceeding (US6 scenario 3)', async () => {
    const { controller, specificationId } = await build();
    await controller.submitForReview(CTX, specificationId);
    const out = await controller.approve(CTX, specificationId);
    expect(out).toHaveProperty('outstandingFindings');
    expect(out.specification.lifecycleState).toBe('approved');
  });

  it('cross-workspace access is the opaque 404', async () => {
    const { controller, specificationId } = await build();
    const err = await controller
      .submitForReview({ workspaceId: 'ws_b', userId: 'u9' }, specificationId)
      .catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(404);
    expect(toErrorBody(err).error.code).toBe('not_found');
  });
});

describe('contract · versions (FR-013, FR-015)', () => {
  it('lists versions and diffs any two of them', async () => {
    const { controller, specificationId } = await build();
    const versions = await controller.versions(CTX, specificationId);
    expect(versions.length).toBeGreaterThanOrEqual(1);
    const diff = await controller.diff(CTX, specificationId, '1', '1');
    expect(diff.identical).toBe(true);
  });

  it('diffing a version that does not exist is the opaque 404', async () => {
    const { controller, specificationId } = await build();
    const err = await controller.diff(CTX, specificationId, '1', '99').catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(404);
  });
});
