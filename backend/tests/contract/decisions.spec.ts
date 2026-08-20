/**
 * T144c — contract tests for the four ADR endpoints against
 * `contracts/platform-api.md` (Architecture Decision Records · FR-034).
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { DecisionsController } from '../../src/modules/decisions/decisions.controller.js';
import {
  DecisionsService,
  InMemoryAdrStore,
  InMemoryAdrSpecificationLinkStore,
} from '../../src/modules/decisions/decisions.service.js';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';

const PATH = 'path';
const METHOD = 'method';

function route(handler: string): { path: string; method: RequestMethod } {
  const fn = DecisionsController.prototype[handler as keyof DecisionsController] as object;
  return {
    path: Reflect.getMetadata(PATH, fn) as string,
    method: Reflect.getMetadata(METHOD, fn) as RequestMethod,
  };
}

const CTX = { workspaceId: 'ws_a', userId: 'u1' };
const VALID = {
  title: 'Adopt PostgreSQL',
  context: 'c',
  decision: 'd',
  consequences: 'q',
};

function controller(): DecisionsController {
  return new DecisionsController(
    new DecisionsService(new InMemoryAdrStore(), new InMemoryAdrSpecificationLinkStore()),
  );
}

describe('contract · ADR route surface (FR-034)', () => {
  it.each([
    ['list', 'projects/:projectId/decisions', RequestMethod.GET],
    ['create', 'projects/:projectId/decisions', RequestMethod.POST],
    ['get', 'decisions/:id', RequestMethod.GET],
    ['patch', 'decisions/:id', RequestMethod.PATCH],
    ['link', 'decisions/:id/links', RequestMethod.POST],
  ])('%s → %s', (handler, path, method) => {
    expect(route(handler)).toEqual({ path, method });
  });
});

describe('contract · behaviour', () => {
  it('title, context, decision, consequences are REQUIRED — 400 naming every gap', async () => {
    const err = await controller().create(CTX, 'p1', {}).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(400);
    const details = toErrorBody(err).error.details as { fields: { field: string }[] };
    expect(details.fields.map((f) => f.field).sort()).toEqual([
      'consequences',
      'context',
      'decision',
      'title',
    ]);
  });

  it('PATCH carries status changes (proposed → accepted → superseded)', async () => {
    const c = controller();
    const adr = await c.create(CTX, 'p1', VALID);
    const accepted = await c.patch(CTX, adr.id, { status: 'accepted' });
    expect(accepted.status).toBe('accepted');
  });

  it('POST /decisions/{id}/links links affected specifications', async () => {
    const c = controller();
    const adr = await c.create(CTX, 'p1', VALID);
    const linked = await c.link(CTX, adr.id, { specificationIds: ['s1', 's2'] });
    expect(linked.specificationIds.sort()).toEqual(['s1', 's2']);
  });

  it('cross-workspace and absent are one identical 404', async () => {
    const c = controller();
    const adr = await c.create({ workspaceId: 'ws_b', userId: 'u9' }, 'p1', VALID);
    const crossErr = await c.get(CTX, adr.id).catch((e: unknown) => e);
    const absentErr = await c.get(CTX, 'never').catch((e: unknown) => e);
    expect(toHttpStatus(crossErr)).toBe(404);
    expect(JSON.stringify(toErrorBody(crossErr))).toBe(JSON.stringify(toErrorBody(absentErr)));
  });
});
