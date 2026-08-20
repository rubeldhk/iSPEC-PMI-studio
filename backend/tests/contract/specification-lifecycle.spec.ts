/**
 * T108 — contract tests for the six lifecycle transition endpoints and the
 * version endpoints, against `contracts/platform-api.md` (Specifications ·
 * US5, US6).
 *
 * Written to FAIL before T113 exists (Constitution V).
 *
 * Driven through the controller against REAL services — the machine, the
 * recorder, the store — not mocks. T112a asserts the wiring; this asserts the
 * behaviour the contract promises, including the two refusals it names
 * explicitly: `approved → draft` is not permitted (US5 scenario 4), and
 * approval surfaces outstanding findings first (US6 scenario 3).
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';
import {
  InMemoryTransitionRecorder,
  LifecycleMachine,
} from '../../src/modules/specifications/lifecycle.machine.js';
import { ApprovalService } from '../../src/modules/specifications/approval.service.js';
import { SpecificationLifecycleService } from '../../src/modules/specifications/lifecycle.service.js';
import { SpecificationsController } from '../../src/modules/specifications/specifications.controller.js';
import {
  InMemorySpecificationStore,
  SpecificationsReadService,
  type SpecLifecycleState,
} from '../../src/modules/specifications/specifications-read.service.js';
import { SpecificationSearchService } from '../../src/modules/specifications/specification-search.service.js';
import type { GenerationJobApi } from '../../src/modules/specifications/generate-specification.service.js';

const PATH = 'path';
const METHOD = 'method';

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = SpecificationsController.prototype[handler as keyof SpecificationsController] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const OTHER = { workspaceId: 'ws_b', userId: 'u2' };

interface World {
  c: SpecificationsController;
  store: InMemorySpecificationStore;
  recorder: InMemoryTransitionRecorder;
  id: string;
}

async function world(
  state: SpecLifecycleState = 'draft',
  outstanding: { location: string; severity: string; message: string }[] = [],
): Promise<World> {
  const store = new InMemorySpecificationStore();
  const recorder = new InMemoryTransitionRecorder();
  const machine = new LifecycleMachine(recorder);
  const approvals = new ApprovalService(
    { outstandingFor: async () => outstanding as never },
    recorder,
  );

  const id = 'spec_1';
  await store.commitGeneration({
    specification: {
      id,
      workspaceId: CTX.workspaceId,
      projectId: 'proj_1',
      title: 'Payments',
      lifecycleState: 'draft',
      currentVersionId: 'ver_1',
      engineName: 'stub',
      engineVersion: '1.0.0',
      generatedAt: new Date('2026-08-20T10:00:00.000Z'),
      isOutOfDate: false,
      createdById: 'u1',
      updatedById: 'u1',
    },
    version: {
      id: 'ver_1',
      workspaceId: CTX.workspaceId,
      specificationId: id,
      versionNumber: 1,
      contentRaw: '# Payments\n\nOne transaction.',
      contentParsed: { sections: ['a'] },
      lifecycleStateAtCreation: 'draft',
      authoredById: 'u1',
    },
    links: [
      {
        workspaceId: CTX.workspaceId,
        sourceType: 'specification',
        sourceId: id,
        targetType: 'requirement',
        targetId: 'req_1',
        relationship: 'generated_from',
      },
    ],
    job: { id: 'job_1', state: 'succeeded', resultRef: id },
  });
  if (state !== 'draft') await store.setLifecycleState(id, state);

  const lifecycle = new SpecificationLifecycleService(store, machine, {
    approvals,
    findings: { outstandingFor: async () => outstanding as never },
  });

  return {
    store,
    recorder,
    id,
    c: new SpecificationsController(
      {} as unknown as GenerationJobApi,
      new SpecificationsReadService(store),
      new SpecificationSearchService(store),
      lifecycle,
    ),
  };
}

describe('contract · lifecycle route surface (US5, US6)', () => {
  it.each([
    ['submitForReview', 'specifications/:id/submit-for-review', RequestMethod.POST],
    ['reject', 'specifications/:id/reject', RequestMethod.POST],
    ['approve', 'specifications/:id/approve', RequestMethod.POST],
    ['baseline', 'specifications/:id/baseline', RequestMethod.POST],
    ['markImplemented', 'specifications/:id/mark-implemented', RequestMethod.POST],
    ['archive', 'specifications/:id/archive', RequestMethod.POST],
    ['versions', 'specifications/:id/versions', RequestMethod.GET],
    ['diff', 'specifications/:id/versions/:a/diff/:b', RequestMethod.GET],
    ['findings', 'specifications/:id/findings', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });
});

describe('contract · the eight permitted transitions', () => {
  it('draft → review', async () => {
    const { c, id } = await world('draft');
    expect((await c.submitForReview(CTX, id)).specification.lifecycleState).toBe('review');
  });

  it('review → draft (rejection returns it for rework)', async () => {
    const { c, id } = await world('review');
    expect((await c.reject(CTX, id)).specification.lifecycleState).toBe('draft');
  });

  it('review → approved', async () => {
    const { c, id } = await world('review');
    expect((await c.approve(CTX, id)).specification.lifecycleState).toBe('approved');
  });

  it('approved → baselined', async () => {
    const { c, id } = await world('approved');
    expect((await c.baseline(CTX, id)).specification.lifecycleState).toBe('baselined');
  });

  it('baselined → implemented', async () => {
    const { c, id } = await world('baselined');
    expect((await c.markImplemented(CTX, id)).specification.lifecycleState).toBe('implemented');
  });

  it.each([['approved'], ['baselined'], ['implemented']] as const)(
    '%s → archived (FR-011b)',
    async (from) => {
      const { c, id } = await world(from);
      expect((await c.archive(CTX, id)).specification.lifecycleState).toBe('archived');
    },
  );
});

describe('contract · refusals name the permitted set (FR-011)', () => {
  it('approved → draft is refused — the transition does not exist (US5 scenario 4)', async () => {
    const { c, id, store } = await world('approved');
    const error = await c.reject(CTX, id).catch((e: unknown) => e);

    expect(toHttpStatus(error)).toBe(422);
    const body = toErrorBody(error);
    expect(body.error.code).toBe('invalid_lifecycle_transition');
    const details = body.error.details as { from: string; to: string; permitted: string[] };
    expect(details).toMatchObject({ from: 'approved', to: 'draft' });
    expect(details.permitted.sort()).toEqual(['archived', 'baselined']);
    // Refused means unchanged.
    expect(store.byId(id)!.lifecycleState).toBe('approved');
  });

  it('an archived specification has nowhere left to go', async () => {
    const { c, id } = await world('archived');
    const error = await c.submitForReview(CTX, id).catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(422);
    expect((toErrorBody(error).error.details as { permitted: string[] }).permitted).toEqual([]);
  });

  it('a refused transition records NO history (FR-014)', async () => {
    // Refusals are audit events (FR-033), not lifecycle history. A rejected
    // attempt in the transition table would make the record a log of what
    // people tried rather than of what happened.
    const { c, id, recorder } = await world('approved');
    await c.reject(CTX, id).catch(() => undefined);
    expect(recorder.records).toEqual([]);
  });
});

describe('contract · every performed transition records who and when (FR-014)', () => {
  it('appends one record naming the actor', async () => {
    const { c, id, recorder } = await world('draft');
    await c.submitForReview(CTX, id);

    expect(recorder.records).toHaveLength(1);
    expect(recorder.records[0]).toMatchObject({
      specificationId: id,
      fromState: 'draft',
      toState: 'review',
      actorId: 'u1',
    });
    expect(recorder.records[0]!.occurredAt).toBeInstanceOf(Date);
  });
});

describe('contract · approval surfaces outstanding findings first (US6 scenario 3)', () => {
  it('returns the findings alongside the approval', async () => {
    const { c, id } = await world('review', [
      { location: '§2 Scope', severity: 'error', message: 'Unresolved placeholder' },
    ]);
    const body = await c.approve(CTX, id);
    expect(body.outstandingFindings).toHaveLength(1);
    expect(body.outstandingFindings![0]).toMatchObject({ location: '§2 Scope' });
  });

  it('reports an empty list rather than omitting the field when there are none', async () => {
    const { c, id } = await world('review');
    expect((await c.approve(CTX, id)).outstandingFindings).toEqual([]);
  });
});

describe('contract · version endpoints', () => {
  it('lists versions newest first', async () => {
    const { c, id } = await world('draft');
    const versions = await c.versions(CTX, id);
    expect(versions.map((v) => v.versionNumber)).toEqual([1]);
  });

  it('compares two versions, reporting that they differ (FR-015)', async () => {
    const { c, id } = await world('draft');
    await c.patch(CTX, id, { contentRaw: '# Payments v2', contentParsed: { sections: ['b'] } });

    expect((await c.versions(CTX, id)).map((v) => v.versionNumber)).toEqual([2, 1]);
    expect(await c.diff(CTX, id, '1', '2')).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      identical: false,
    });
  });

  it('comparing a version with itself reports no change', async () => {
    const { c, id } = await world('draft');
    expect(await c.diff(CTX, id, '1', '1')).toMatchObject({ identical: true });
  });
});

describe('contract · tenancy (FR-002, SC-004)', () => {
  it.each([
    ['submitForReview', (c: SpecificationsController, id: string) => c.submitForReview(OTHER, id)],
    ['versions', (c: SpecificationsController, id: string) => c.versions(OTHER, id)],
    ['findings', (c: SpecificationsController, id: string) => c.findings(OTHER, id)],
  ])('%s is 404 across a workspace boundary, never 403', async (_label, call) => {
    const { c, id } = await world('draft');
    const error = await call(c, id).catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(404);
    expect(toErrorBody(error).error.message).toBe('Not found.');
  });
});
