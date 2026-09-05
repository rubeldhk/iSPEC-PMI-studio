/**
 * `T1570` (EPIC-044) — contract test for the Epic routes against
 * `specs/044-epic-model-journey-board/contracts/epics-api.md` §1 and §3.
 *
 * Route surface from the controller's routing metadata (the `/v1` prefix is
 * global); the universal rules driven directly with in-memory services: a
 * writer without the grant is refused `owner_grant_required`, a closed Epic
 * refuses assignment with `epic_not_active`, a cross-project Epic is the
 * opaque 404, and the board read has the `BoardRead` shape. The
 * composed-application run of the same routes is
 * `tests/integration/epics-api.spec.ts`. Written to FAIL before `T1571`.
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toErrorBody, toHttpStatus } from '../../src/core/errors.js';
import { EpicsController } from '../../src/modules/epics/epics.controller.js';
import { harness } from '../unit/epics/epic.service.spec.js';
import { EpicStageService } from '../../src/modules/epics/epic-stage.service.js';

const PATH = 'path';
const METHOD = 'method';

function route(ctor: { prototype: object }, handler: string): { path: string; method: RequestMethod } {
  const fn = (ctor.prototype as Record<string, object>)[handler] as object;
  return { path: Reflect.getMetadata(PATH, fn) as string, method: Reflect.getMetadata(METHOD, fn) as RequestMethod };
}

const OWNER = { workspaceId: 'ws_a', userId: 'u_owner' };
const WRITER = { workspaceId: 'ws_a', userId: 'u_writer' };
const session = (ctx: { workspaceId: string; userId: string }) => ctx as never;

function controller() {
  const h = harness();
  const stages = new EpicStageService({ epics: h.store, evidence: { forProject: async () => [] } });
  return { controller: new EpicsController(h.service, stages), ...h };
}

describe('T1570 · route surface (epics-api.md §1)', () => {
  it('is served at the repository root prefix, with full paths per handler', () => {
    expect(Reflect.getMetadata(PATH, EpicsController)).toBe('/');
  });

  it.each([
    ['list', 'projects/:id/epics', RequestMethod.GET],
    ['create', 'projects/:id/epics', RequestMethod.POST],
    ['board', 'projects/:id/epics/stages', RequestMethod.GET],
    ['get', 'epics/:eid', RequestMethod.GET],
    ['edit', 'epics/:eid', RequestMethod.PATCH],
    ['close', 'epics/:eid/close', RequestMethod.POST],
    ['stage', 'epics/:eid/stage', RequestMethod.GET],
    ['assignRequirement', 'requirements/:rid/epic', RequestMethod.PUT],
    ['assignSpecification', 'specifications/:sid/epic', RequestMethod.PUT],
  ])('%s → %s', (handler, path, method) => {
    expect(route(EpicsController, handler)).toEqual({ path, method });
  });

  it('close answers 200, not 201', () => {
    expect(Reflect.getMetadata('__httpCode__', EpicsController.prototype.close)).toBe(200);
  });
});

describe('T1570 · universal rules (epics-api.md §3)', () => {
  it('a writer without the grant is refused owner_grant_required (403) and may still read', async () => {
    const { controller: c } = controller();
    await c.create(session(OWNER), 'p_a', { title: 'Intake' });
    const err = await c.create(session(WRITER), 'p_a', { title: 'Nope' }).catch((e: unknown) => e);
    expect(toHttpStatus(err as Error)).toBe(403);
    expect(toErrorBody(err as Error)).toMatchObject({ error: { code: 'forbidden', details: { code: 'owner_grant_required' } } });
    expect((await c.list(session(WRITER), 'p_a', undefined)).epics).toHaveLength(1);
  });

  it('assigning to a closed Epic is epic_not_active (409); an empty title is validation_failed naming the field', async () => {
    const { controller: c } = controller();
    const e = await c.create(session(OWNER), 'p_a', { title: 'Intake' });
    await c.close(session(OWNER), e.id);
    const conflict = await c.assignRequirement(session(OWNER), 'r1', { epicId: e.id }).catch((x: unknown) => x);
    expect(toHttpStatus(conflict as Error)).toBe(409);
    expect(toErrorBody(conflict as Error)).toMatchObject({ error: { code: 'conflict', details: { code: 'epic_not_active' } } });
    const invalid = await c.create(session(OWNER), 'p_a', { title: '' }).catch((x: unknown) => x);
    expect(toHttpStatus(invalid as Error)).toBe(400);
    expect(JSON.stringify(toErrorBody(invalid as Error))).toContain('title');
  });

  it('an Epic of another project is the opaque 404', async () => {
    const { controller: c } = controller();
    const e = await c.create(session(OWNER), 'p_b', { title: 'Elsewhere' });
    const err = await c.get(session(OWNER), e.id, 'p_a').catch((x: unknown) => x);
    expect(toHttpStatus(err as Error)).toBe(404);
  });

  it('the board read has the BoardRead shape', async () => {
    const { controller: c } = controller();
    await c.create(session(OWNER), 'p_a', { title: 'Intake' });
    const board = await c.board(session(OWNER), 'p_a');
    expect(Object.keys(board).sort()).toEqual(['columns', 'epics', 'packageVersion', 'profile', 'unbound']);
    expect(board.columns).toEqual(['Not started', 'Specified', 'Clarified', 'Checklisted', 'Planned', 'Tasked', 'Analyzed', 'Ready', 'Implementing', 'Converged']);
    expect(board.epics[0]).toMatchObject({ number: 1, stage: 'Not started', next: '/speckit-specify', derivedFrom: 'executions', readiness: { verdict: 'n/a' } });
  });
});
