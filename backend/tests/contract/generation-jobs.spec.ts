/**
 * T076 — contract tests for the generation job endpoints against
 * `contracts/platform-api.md` (Jobs · US3).
 *
 * Written to FAIL before T083 exists (Constitution V).
 *
 * The contract's claims, asserted one by one:
 *
 *   - generation is ALWAYS asynchronous — every submission answers `202` with a
 *     job, never a specification;
 *   - the job body carries `id`, `kind`, `state`, `failureReason`, `startedAt`,
 *     `resultRef`;
 *   - `failureReason` is never null on a non-success terminal state (FR-026);
 *   - an empty selection is `empty_selection`, decided before a job exists;
 *   - a duplicate submission returns the EXISTING job, not a second one.
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';
import { JobsService } from '../../src/modules/jobs/jobs.service.js';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
  InMemoryRequirementSelection,
} from '../../src/modules/specifications/generate-specification.service.js';
import { SpecificationSearchService } from '../../src/modules/specifications/specification-search.service.js';
import { SpecificationsController } from '../../src/modules/specifications/specifications.controller.js';
import {
  InMemorySpecificationStore,
  SpecificationsReadService,
} from '../../src/modules/specifications/specifications-read.service.js';
import type { SpecificationLifecycleApi } from '../../src/modules/specifications/lifecycle.service.js';
import { StubEngine } from '../unit/specifications/helpers.js';

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
const PROJECT = 'proj_1';

function controller(): SpecificationsController {
  const ledger = new InMemoryGenerationJobLedger();
  const store = new InMemorySpecificationStore();
  const generation = new GenerateSpecificationService(
    { resolveForProject: async () => StubEngine.returning() },
    store,
    {
      jobs: new JobsService(ledger),
      ledger,
      // T843 — the selection is scoped before it becomes a job (FR-002). The
      // contract's own examples select `req_1` and `req_2`, so the register
      // this controller is pointed at holds exactly those.
      requirements: new InMemoryRequirementSelection([
        { id: 'req_1', workspaceId: CTX.workspaceId, projectId: PROJECT },
        { id: 'req_2', workspaceId: CTX.workspaceId, projectId: PROJECT },
      ]),
    },
  );
  return new SpecificationsController(
    generation,
    new SpecificationsReadService(store),
    new SpecificationSearchService(store),
    // Lifecycle is EPIC-009's; these suites exercise EPIC-008's routes and
    // never reach it.
    {} as unknown as SpecificationLifecycleApi,
  );
}

describe('contract · generation job route surface (US3)', () => {
  it.each([
    ['generate', 'projects/:projectId/jobs/generate-specification', RequestMethod.POST],
    ['job', 'jobs/:id', RequestMethod.GET],
    ['cancel', 'jobs/:id/cancel', RequestMethod.POST],
    ['jobs', 'projects/:projectId/jobs', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });

  it('submission answers 202 Accepted — generation is never synchronous', () => {
    expect(Reflect.getMetadata('__httpCode__', SpecificationsController.prototype.generate)).toBe(
      202,
    );
  });

  it('cancellation answers 202 — the request to stop is accepted, not the stop itself', () => {
    expect(Reflect.getMetadata('__httpCode__', SpecificationsController.prototype.cancel)).toBe(202);
  });
});

describe('contract · the job body', () => {
  it('carries exactly the documented fields', async () => {
    const body = await controller().generate(CTX, PROJECT, { requirementIds: ['req_1'] });
    expect(Object.keys(body).sort()).toEqual(
      ['failureReason', 'id', 'kind', 'resultRef', 'startedAt', 'state'].sort(),
    );
  });

  it('reports the kind and a live state', async () => {
    const body = await controller().generate(CTX, PROJECT, { requirementIds: ['req_1'] });
    expect(body.kind).toBe('generate_specification');
    expect(['queued', 'running']).toContain(body.state);
    expect(body.failureReason).toBeNull();
    expect(body.resultRef).toBeNull();
  });

  it('is readable again by id', async () => {
    const c = controller();
    const submitted = await c.generate(CTX, PROJECT, { requirementIds: ['req_1'] });
    expect((await c.job(CTX, submitted.id)).id).toBe(submitted.id);
  });

  it('a non-success terminal state always names a reason (FR-026, SC-005)', async () => {
    const c = controller();
    const submitted = await c.generate(CTX, PROJECT, { requirementIds: ['req_1'] });
    const cancelled = await c.cancel(CTX, submitted.id);
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.failureReason).toBe('cancelled');
  });
});

describe('contract · empty selection (E7)', () => {
  it('is refused with `empty_selection`, before any job exists', async () => {
    const c = controller();
    const error = await c
      .generate(CTX, PROJECT, { requirementIds: [] })
      .catch((e: unknown) => e);

    expect(toHttpStatus(error)).toBe(400);
    const body = toErrorBody(error);
    expect(body.error.code).toBe('validation_failed');
    expect((body.error.details as { reason: string }).reason).toBe('empty_selection');
    expect(await c.jobs(CTX, PROJECT)).toEqual([]);
  });
});

describe('contract · idempotency', () => {
  it('a duplicate submission returns the EXISTING job, not a second one', async () => {
    const c = controller();
    const first = await c.generate(CTX, PROJECT, { requirementIds: ['req_1', 'req_2'] });
    const second = await c.generate(CTX, PROJECT, { requirementIds: ['req_1', 'req_2'] });

    expect(second.id).toBe(first.id);
    expect(await c.jobs(CTX, PROJECT)).toHaveLength(1);
  });

  it('selection ORDER does not make a second, billable run', async () => {
    const c = controller();
    const first = await c.generate(CTX, PROJECT, { requirementIds: ['req_1', 'req_2'] });
    const second = await c.generate(CTX, PROJECT, { requirementIds: ['req_2', 'req_1'] });
    expect(second.id).toBe(first.id);
  });
});

describe('contract · tenancy (FR-002, SC-004)', () => {
  it('a job in another workspace is not found, never forbidden', async () => {
    const c = controller();
    const submitted = await c.generate(CTX, PROJECT, { requirementIds: ['req_1'] });
    const error = await c
      .job({ workspaceId: 'ws_b', userId: 'u2' }, submitted.id)
      .catch((e: unknown) => e);

    expect(toHttpStatus(error)).toBe(404);
    expect(toErrorBody(error).error.code).toBe('not_found');
  });

  it('the project job list is workspace-scoped', async () => {
    const c = controller();
    await c.generate(CTX, PROJECT, { requirementIds: ['req_1'] });
    expect(await c.jobs({ workspaceId: 'ws_b', userId: 'u2' }, PROJECT)).toEqual([]);
  });
});

describe('contract · cancellation (FR-024)', () => {
  it('a finished job cannot be cancelled again', async () => {
    const c = controller();
    const submitted = await c.generate(CTX, PROJECT, { requirementIds: ['req_1'] });
    await c.cancel(CTX, submitted.id);
    const error = await c.cancel(CTX, submitted.id).catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(409);
  });
});
