/**
 * `T1487` (EPIC-042) — contract tests for the governance routes against
 * `specs/042-pmi-spec-kit-extension/contracts/governance-api.md` §1, §2, §6.
 *
 * Route surface from the controllers' routing metadata (the `/v1` prefix is
 * global), the session controller's universal rules driven directly with
 * in-memory services (validation names the field; the owner gate refuses a
 * writer without the grant; a cross-workspace project is the opaque 404), and
 * the connector controller's guard and scopes. The composed-application run of
 * the same routes is `tests/integration/governance-api.spec.ts`.
 * Written to FAIL before `T1488`.
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { InvalidConnectorCredentialError, toErrorBody, toHttpStatus } from '../../src/core/errors.js';
import { ConnectorAuthGuard } from '../../src/modules/connector/connector-auth.guard.js';
import { CONNECTOR_SCOPE_KEY } from '../../src/modules/connector/connector-scope.js';
import { ConstitutionRenderService } from '../../src/modules/governance/constitution-render.service.js';
import { InMemoryConstitutionRenderStore } from '../../src/modules/governance/constitution-render.store.js';
import { DecompositionPolicyService } from '../../src/modules/governance/decomposition-policy.service.js';
import { InMemoryDecompositionPolicyStore } from '../../src/modules/governance/decomposition-policy.store.js';
import { GovernanceConnectorController } from '../../src/modules/governance/governance-connector.controller.js';
import { GovernanceController } from '../../src/modules/governance/governance.controller.js';
import { OwnerGate } from '../../src/modules/governance/owner-gate.js';
import { ProjectConstraintService } from '../../src/modules/governance/project-constraint.service.js';
import { InMemoryProjectConstraintStore } from '../../src/modules/governance/project-constraint.store.js';

const PATH = 'path';
const METHOD = 'method';

function route(ctor: { prototype: object }, handler: string): { path: string; method: RequestMethod } {
  const fn = (ctor.prototype as Record<string, object>)[handler] as object;
  return { path: Reflect.getMetadata(PATH, fn) as string, method: Reflect.getMetadata(METHOD, fn) as RequestMethod };
}

const OWNER = { workspaceId: 'ws_a', userId: 'u_owner' };
const WRITER = { workspaceId: 'ws_a', userId: 'u_writer' };
const OTHER_WS = { workspaceId: 'ws_b', userId: 'u_owner' };
const scopesSeen: string[] = [];
const session = (ctx: { workspaceId: string; userId: string }) => ({ ...ctx, headers: {}, params: {} }) as never;

function controller() {
  const audit = { record: async (): Promise<void> => undefined };
  const constraints = new ProjectConstraintService({ store: new InMemoryProjectConstraintStore(), audit });
  const policy = new DecompositionPolicyService({ store: new InMemoryDecompositionPolicyStore(), audit });
  const projects = {
    get: async (workspaceId: string, id: string) => {
      if (workspaceId !== 'ws_a' || id !== 'p_a') throw new Error('not found');
      return { id: 'p_a', name: 'Alpha', ownerUserId: 'u_owner' };
    },
  };
  const renders = new ConstitutionRenderService({
    store: new InMemoryConstitutionRenderStore(),
    constraints,
    policy,
    projects,
    steering: { resolvedForProject: async () => [] },
    audit,
  });
  const gate = new OwnerGate({ projects, grants: { activeGrants: async () => [] }, audit });
  // The guard is faked: a bearer of `ok` becomes project p_a's connector; anything else is the one refusal.
  const guard = {
    authenticate: async (req: { headers: Record<string, string>; connector?: unknown }, scope: string) => {
      scopesSeen.push(scope);
      if (req.headers['authorization'] !== 'Bearer ok') throw new InvalidConnectorCredentialError();
      req.connector = { credentialId: 'cred_a', workspaceId: 'ws_a', projectId: 'p_a', principal: { principalId: 'pr_a' } };
      return req.connector;
    },
  } as unknown as ConnectorAuthGuard;
  return new GovernanceController(constraints, policy, renders, gate, guard, audit);
}

describe('T1487 · session route surface (governance-api.md §1)', () => {
  it('is served under /projects', () => {
    expect(Reflect.getMetadata(PATH, GovernanceController)).toBe('projects');
  });

  it.each([
    ['list', ':id/constraints', RequestMethod.GET],
    ['create', ':id/constraints', RequestMethod.POST],
    ['edit', ':id/constraints/:cid', RequestMethod.PATCH],
    ['retire', ':id/constraints/:cid/retire', RequestMethod.POST],
    ['getPolicy', ':id/policy', RequestMethod.GET],
    ['putPolicy', ':id/policy', RequestMethod.PUT],
    ['constitution', ':id/constitution', RequestMethod.GET],
  ])('%s → %s', (handler, path, method) => {
    expect(route(GovernanceController, handler)).toEqual({ path, method });
  });

  it('retire answers 200, not 201', () => {
    expect(Reflect.getMetadata('__httpCode__', GovernanceController.prototype.retire)).toBe(200);
  });
});

describe('T1487 · connector route surface (governance-api.md §2)', () => {
  it('decomposition is served under /projects behind the connector guard with its scope', () => {
    expect(Reflect.getMetadata(PATH, GovernanceConnectorController)).toBe('projects');
    const guards = Reflect.getMetadata('__guards__', GovernanceConnectorController) as unknown[];
    expect(guards).toContain(ConnectorAuthGuard);
    expect(route(GovernanceConnectorController, 'decomposition')).toEqual({ path: ':projectId/decomposition', method: RequestMethod.GET });
    expect(Reflect.getMetadata(CONNECTOR_SCOPE_KEY, GovernanceConnectorController.prototype.decomposition)).toBe('decomposition.read');
  });

  it('GET …/constitution with a bearer runs the guard for constitution.read and answers the connector view; a bad bearer is the one refusal (R-042-10)', async () => {
    const c = controller();
    scopesSeen.length = 0;
    const view = await c.constitution({ headers: { authorization: 'Bearer ok' }, params: {} } as never, 'me', 'f'.repeat(64));
    expect(scopesSeen).toEqual(['constitution.read']);
    expect(view).toMatchObject({ version: 1, state: 'drift' });
    expect((view as { content: string }).content).toContain('# Alpha Constitution');
    const bad = await c.constitution({ headers: { authorization: 'Bearer nope' }, params: {} } as never, 'me').catch((e: unknown) => e);
    expect(toHttpStatus(bad)).toBe(401);
  });
});

describe('T1487 · universal rules', () => {
  it('a missing session is 401', async () => {
    const err = await controller().list(undefined, 'p_a').catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(401);
  });

  it('a project of another workspace is the opaque 404 on read and write', async () => {
    const c = controller();
    expect(toHttpStatus(await c.list(OTHER_WS, 'p_a').catch((e: unknown) => e))).toBe(404);
    expect(toHttpStatus(await c.create(OTHER_WS, 'p_a', { kind: 'principle', title: 'x', body: '' }).catch((e: unknown) => e))).toBe(404);
  });

  it('a writer without the owner grant is 403 owner_grant_required; a member may still read', async () => {
    const c = controller();
    const err = await c.create(WRITER, 'p_a', { kind: 'principle', title: 'x', body: '' }).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(403);
    expect(JSON.stringify(toErrorBody(err))).toContain('owner_grant_required');
    expect(await c.list(WRITER, 'p_a')).toEqual([]);
    expect((await c.getPolicy(WRITER, 'p_a')).taskCeiling).toBe(50);
  });

  it('validation names the field (400) — kind, title, taskCeiling, offlineMode', async () => {
    const c = controller();
    const bad = await c.create(OWNER, 'p_a', { kind: 'rule', title: '', body: '' }).catch((e: unknown) => e);
    expect(toHttpStatus(bad)).toBe(400);
    const fields = (toErrorBody(bad).error.details as { fields: { field: string }[] }).fields.map((f) => f.field);
    expect(fields).toEqual(expect.arrayContaining(['kind', 'title']));
    const badPolicy = await c.putPolicy(OWNER, 'p_a', { oneSpecPerEpic: true, taskCeiling: 0, splitRequiresConfirmation: true, offlineMode: 'never' }).catch((e: unknown) => e);
    expect(toHttpStatus(badPolicy)).toBe(400);
    const pf = (toErrorBody(badPolicy).error.details as { fields: { field: string }[] }).fields.map((f) => f.field);
    expect(pf).toEqual(expect.arrayContaining(['taskCeiling', 'offlineMode']));
    expect(toHttpStatus(await c.list(OWNER, 'p_a', 'rule').catch((e: unknown) => e))).toBe(400);
  });

  it('an unknown constraint id is 404 constraint_not_found in shape', async () => {
    const c = controller();
    const err = await c.edit(OWNER, 'p_a', 'c_nope', { body: 'x' }).catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(404);
  });

  it('GET …/constitution renders when no render matches the current inputs, and repeats the same version until they change', async () => {
    const c = controller();
    const first = await c.constitution(session(OWNER), 'p_a');
    expect(first.version).toBe(1);
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.content).toContain('# Alpha Constitution');
    expect((await c.constitution(session(OWNER), 'p_a')).version).toBe(1);
    await c.create(OWNER, 'p_a', { kind: 'principle', title: 'Spec first', body: 'Write it down.' });
    const second = await c.constitution(session(OWNER), 'p_a');
    expect(second.version).toBe(2);
    expect(second.content).toContain('### Spec first');
  });
});
