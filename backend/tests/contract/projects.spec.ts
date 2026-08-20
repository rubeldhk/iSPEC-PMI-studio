/**
 * T051 — contract tests for `/projects` against `contracts/platform-api.md`.
 *
 * Route surface from the controller's routing metadata (the `/v1` prefix is
 * global, D-8), plus the universal rules the contract binds every endpoint to:
 * workspace-filtered queries, the opaque cross-workspace 404, named validation
 * fields, and 409 for a name conflict.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { ProjectsController } from '../../src/modules/projects/projects.controller.js';
import {
  InMemoryProjectStore,
  ProjectsService,
} from '../../src/modules/projects/projects.service.js';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';

const PATH = 'path';
const METHOD = 'method';

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = ProjectsController.prototype[handler as keyof ProjectsController] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

function controller(): ProjectsController {
  return new ProjectsController(new ProjectsService(new InMemoryProjectStore()));
}

describe('contract · Projects route surface (US1)', () => {
  it('is served under /projects', () => {
    expect(Reflect.getMetadata(PATH, ProjectsController)).toBe('projects');
  });

  it('GET /projects — workspace-scoped list', () => {
    expect(route('list')).toEqual({ path: '/', method: RequestMethod.GET });
  });

  it('POST /projects — create (201 Created, Nest default)', () => {
    expect(route('create')).toEqual({ path: '/', method: RequestMethod.POST });
    expect(Reflect.getMetadata('__httpCode__', ProjectsController.prototype.create)).toBeUndefined();
  });

  it('GET /projects/{id}', () => {
    expect(route('get')).toEqual({ path: ':id', method: RequestMethod.GET });
  });

  it('PATCH /projects/{id} — rename, description, engine selection', () => {
    expect(route('patch')).toEqual({ path: ':id', method: RequestMethod.PATCH });
  });

  it('POST /projects/{id}/archive — 200, content preserved', () => {
    expect(route('archive')).toEqual({ path: ':id/archive', method: RequestMethod.POST });
    expect(Reflect.getMetadata('__httpCode__', ProjectsController.prototype.archive)).toBe(200);
  });
});

describe('contract · universal rules on /projects', () => {
  it('`name` is required — validation failure names the field (400, FR-007 shape)', async () => {
    const err = await controller().create(CTX, {}).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(400);
    const body = toErrorBody(err);
    expect(body.error.code).toBe('validation_failed');
    const details = body.error.details as { fields: { field: string }[] };
    expect(details.fields[0]?.field).toBe('name');
  });

  it('a duplicate name within the workspace is 409 conflict', async () => {
    const c = controller();
    await c.create(CTX, { name: 'Platform' });
    const err = await c.create(CTX, { name: 'Platform' }).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(409);
    expect(toErrorBody(err).error.code).toBe('conflict');
  });

  it('a resource in another workspace is 404 — existence is not disclosed', async () => {
    const c = controller();
    const theirs = await c.create({ workspaceId: 'ws_b', userId: 'u9' }, { name: 'Theirs' });
    const crossErr = await c.get(CTX, theirs.id).catch((e: unknown) => e);
    const absentErr = await c.get(CTX, 'never-existed').catch((e: unknown) => e);
    for (const err of [crossErr, absentErr]) {
      expect(toHttpStatus(err)).toBe(404);
      expect(toErrorBody(err).error.code).toBe('not_found');
    }
    // Deliberately indistinguishable: identical bodies, byte for byte.
    expect(JSON.stringify(toErrorBody(crossErr))).toBe(JSON.stringify(toErrorBody(absentErr)));
  });

  it('every list is workspace-filtered (FR-002)', async () => {
    const c = controller();
    await c.create(CTX, { name: 'Mine' });
    await c.create({ workspaceId: 'ws_b', userId: 'u9' }, { name: 'Theirs' });
    const listed = await c.list(CTX);
    expect(listed.map((p) => p.name)).toEqual(['Mine']);
  });

  it('no session is 401 with code "unauthenticated"', async () => {
    const err = await controller().list(undefined).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(401);
    expect(toErrorBody(err).error.code).toBe('unauthenticated');
  });

  it('archive preserves content and returns the archived record (FR-001)', async () => {
    const c = controller();
    const p = await c.create(CTX, { name: 'P', description: 'kept' });
    const archived = await c.archive(CTX, p.id);
    expect(archived.status).toBe('archived');
    expect(archived.description).toBe('kept');
  });
});
