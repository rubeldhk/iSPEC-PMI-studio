/**
 * T063 — contract tests for `/requirements` against `contracts/platform-api.md`.
 *
 * Route surface from routing metadata (the `/v1` prefix is global, D-8), plus
 * the rules the contract states for US2: `description` required with the field
 * named (FR-007), PATCH creates a version with prior text retrievable (FR-009),
 * retire marks and never deletes (FR-006), filters on the list (FR-008).
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { RequirementsController } from '../../src/modules/requirements/requirements.controller.js';
import { RequirementRetireService } from '../../src/modules/requirements/requirement-retire.service.js';
import {
  InMemoryRequirementStore,
  RequirementsService,
} from '../../src/modules/requirements/requirements.service.js';
import {
  InMemoryRequirementVersionStore,
  RequirementVersionService,
} from '../../src/modules/requirements/requirement-version.service.js';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';

const PATH = 'path';
const METHOD = 'method';

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = RequirementsController.prototype[handler as keyof RequirementsController] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const VALID = { description: 'The system shall.', type: 'functional', priority: 'p1' } as const;

function controller(): RequirementsController {
  const store = new InMemoryRequirementStore();
  const service = new RequirementsService(
    store,
    new RequirementVersionService(new InMemoryRequirementVersionStore()),
  );
  return new RequirementsController(service, new RequirementRetireService(store));
}

describe('contract · Requirements route surface (US2)', () => {
  it.each([
    ['list', 'projects/:projectId/requirements', RequestMethod.GET],
    ['create', 'projects/:projectId/requirements', RequestMethod.POST],
    ['get', 'requirements/:id', RequestMethod.GET],
    ['patch', 'requirements/:id', RequestMethod.PATCH],
    ['retire', 'requirements/:id/retire', RequestMethod.POST],
    ['versions', 'requirements/:id/versions', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });

  it('retire returns 200, not Nest\'s POST default', () => {
    expect(Reflect.getMetadata('__httpCode__', RequirementsController.prototype.retire)).toBe(200);
  });
});

describe('contract · rules on /requirements', () => {
  it('POST without a description is refused NAMING it (FR-007, 400)', async () => {
    const err = await controller()
      .create(CTX, 'p1', { type: 'functional', priority: 'p1' })
      .catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(400);
    const body = toErrorBody(err);
    expect(body.error.code).toBe('validation_failed');
    const details = body.error.details as { fields: { field: string }[] };
    expect(details.fields.some((f) => f.field === 'description')).toBe(true);
  });

  it('PATCH creates a version; prior text stays retrievable (FR-009)', async () => {
    const c = controller();
    const created = await c.create(CTX, 'p1', VALID);
    await c.patch(CTX, created.id, { description: 'Amended.' });
    const versions = await c.versions(CTX, created.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.description).toBe('The system shall.');
  });

  it('retire marks — the record remains retrievable, flagged retired (FR-006)', async () => {
    const c = controller();
    const created = await c.create(CTX, 'p1', VALID);
    const retired = await c.retire(CTX, created.id);
    expect(retired.status).toBe('retired');
    const read = await c.get(CTX, created.id);
    expect(read.id).toBe(created.id);
    expect(read.description).toBe(VALID.description);
  });

  it('the list filters by type, priority, and status (FR-008)', async () => {
    const c = controller();
    await c.create(CTX, 'p1', VALID);
    await c.create(CTX, 'p1', { description: 'B', type: 'business', priority: 'p2' });
    const filtered = await c.list(CTX, 'p1', { type: 'business' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.type).toBe('business');
  });

  it('cross-workspace and absent are one identical 404', async () => {
    const c = controller();
    const theirs = await c.create({ workspaceId: 'ws_b', userId: 'u9' }, 'p1', VALID);
    const crossErr = await c.get(CTX, theirs.id).catch((e: unknown) => e);
    const absentErr = await c.get(CTX, 'never').catch((e: unknown) => e);
    expect(toHttpStatus(crossErr)).toBe(404);
    expect(JSON.stringify(toErrorBody(crossErr))).toBe(JSON.stringify(toErrorBody(absentErr)));
  });

  it('no session is 401 unauthenticated', async () => {
    const err = await controller().list(undefined, 'p1', {}).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(401);
    expect(toErrorBody(err).error.code).toBe('unauthenticated');
  });
});
