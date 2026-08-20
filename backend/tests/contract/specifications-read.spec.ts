/**
 * T076b — contract tests for `GET /projects/{id}/specifications`,
 * `GET /specifications/{id}` and `PATCH /specifications/{id}` against
 * `contracts/platform-api.md` (Specifications · US3, US5, US6) — **FR-012**.
 *
 * Written to FAIL before T083a exists (Constitution V).
 *
 * The three claims the contract makes about these routes:
 *
 *   - detail includes `isOutOfDate`, the engine and the engine version
 *     (FR-022, FR-032);
 *   - `PATCH` creates a new version (FR-013);
 *   - a resource in another workspace is **404, not 403** (FR-002, SC-004).
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';
import { JobsService } from '../../src/modules/jobs/jobs.service.js';
import {
  GenerateSpecificationService,
  InMemoryGenerationJobLedger,
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
const OTHER = { workspaceId: 'ws_b', userId: 'u2' };
const PROJECT = 'proj_1';

async function seeded(): Promise<{
  c: SpecificationsController;
  reads: SpecificationsReadService;
  specificationId: string;
}> {
  const store = new InMemorySpecificationStore();
  const ledger = new InMemoryGenerationJobLedger();
  const generation = new GenerateSpecificationService(
    { resolveForProject: async () => StubEngine.returning() },
    store,
    { jobs: new JobsService(ledger), ledger },
  );
  const reads = new SpecificationsReadService(store);
  const c = new SpecificationsController(
    generation,
    reads,
    new SpecificationSearchService(store),
    {} as unknown as SpecificationLifecycleApi,
  );

  const outcome = await generation.run({
    jobId: 'job_seed',
    workspaceId: CTX.workspaceId,
    projectId: PROJECT,
    requestedById: CTX.userId,
    correlationId: 'corr_seed',
    projectName: 'Payments',
    requirements: [
      {
        id: 'req_1',
        reference: 'REQ-001',
        description: 'The system shall settle payments.',
        type: 'functional',
        priority: 'p1',
      },
    ],
    timeoutMs: 1_000,
  });

  return { c, reads, specificationId: outcome.specification!.id };
}

describe('contract · specification route surface', () => {
  it.each([
    ['list', 'projects/:projectId/specifications', RequestMethod.GET],
    ['get', 'specifications/:id', RequestMethod.GET],
    ['patch', 'specifications/:id', RequestMethod.PATCH],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });

  it('exposes no delete route — a specification is archived, never removed (FR-011b)', () => {
    const handlers = Object.getOwnPropertyNames(SpecificationsController.prototype);
    const methods = handlers
      .filter((h) => h !== 'constructor')
      .map((h) => route(h).method)
      .filter((m) => m !== undefined);
    expect(methods).not.toContain(RequestMethod.DELETE);
  });
});

describe('contract · GET /projects/{id}/specifications', () => {
  it('answers a page, scoped to the project', async () => {
    const { c } = await seeded();
    const page = await c.list(CTX, PROJECT, {});
    expect(page.total).toBe(1);
    expect(page.rows[0]!.projectId).toBe(PROJECT);
  });

  it('returns another workspace nothing — not an error that confirms existence', async () => {
    const { c } = await seeded();
    expect((await c.list(OTHER, PROJECT, {})).rows).toEqual([]);
  });
});

describe('contract · GET /specifications/{id}', () => {
  it('includes isOutOfDate, engine and engine version (FR-022, FR-032)', async () => {
    const { c, specificationId } = await seeded();
    const body = await c.get(CTX, specificationId);
    expect(body.isOutOfDate).toBe(false);
    expect(body.engineName).toBe('stub');
    expect(body.engineVersion).toBe('1.4.0+model-x');
  });

  it('includes the current version, raw content and all (R-007)', async () => {
    const { c, specificationId } = await seeded();
    const body = await c.get(CTX, specificationId);
    expect(body.currentVersion?.versionNumber).toBe(1);
    expect(body.currentVersion?.contentRaw).toContain('# Payments');
  });

  it('is 404 across a workspace boundary, never 403', async () => {
    const { c, specificationId } = await seeded();
    const error = await c.get(OTHER, specificationId).catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(404);
    expect(toErrorBody(error).error.code).toBe('not_found');
    expect(toErrorBody(error).error.message).toBe('Not found.');
  });
});

describe('contract · PATCH /specifications/{id}', () => {
  it('creates a new version (FR-013)', async () => {
    const { c, specificationId } = await seeded();
    await c.patch(CTX, specificationId, {
      contentRaw: '# Payments v2',
      contentParsed: { sections: ['v2'] },
    });
    const body = await c.get(CTX, specificationId);
    expect(body.currentVersion?.versionNumber).toBe(2);
    expect(body.currentVersion?.contentRaw).toBe('# Payments v2');
  });

  it('leaves the prior version retrievable and unaltered (SC-007)', async () => {
    // Read through the service, not a route: `GET /specifications/{id}/versions`
    // is EPIC-009's `T113`. What THIS epic owes the contract is that a PATCH
    // does not overwrite what came before.
    const { c, reads, specificationId } = await seeded();
    const before = (await c.get(CTX, specificationId)).currentVersion!;
    await c.patch(CTX, specificationId, { contentRaw: '# v2', contentParsed: { a: 1 } });
    const versions = await reads.versions(CTX.workspaceId, specificationId);
    expect(versions.find((v) => v.versionNumber === 1)).toEqual(before);
  });

  it('refuses an empty body, naming the fields (FR-007 shape)', async () => {
    const { c, specificationId } = await seeded();
    const error = await c.patch(CTX, specificationId, {}).catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(400);
    expect(toErrorBody(error).error.code).toBe('validation_failed');
  });

  it('is 404 across a workspace boundary', async () => {
    const { c, specificationId } = await seeded();
    const error = await c.patch(OTHER, specificationId, { title: 'Hijacked' }).catch((e: unknown) => e);
    expect(toHttpStatus(error)).toBe(404);
  });
});
