/**
 * `T1361` (EPIC-041) — the credential routes
 * (specs/041-local-project-workspace/contracts/provisioning-api.md).
 *
 * Mint returns `value` once; list never includes `value` or `tokenHash`; list
 * filters by `revoked` and `label`; `GET /connector/whoami` returns only the
 * project id.
 *
 * Written to FAIL before `T1362` exists.
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  ConnectorController,
  ConnectorCredentialsController,
  ProjectConnectorCredentialsController,
} from '../../../src/modules/connector/connector.controller.js';
import type { ConnectorCredentialService } from '../../../src/modules/connector/connector-credential.service.js';
import { CONNECTOR_SCOPE_KEY } from '../../../src/modules/connector/connector-scope.js';
import { UnauthenticatedError } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u_owner' };
const RECORD = {
  id: 'cred_1',
  workspaceId: 'ws_a',
  projectId: 'p_a',
  principalId: 'pr_1',
  tokenPrefix: 'abcdefgh',
  label: 'laptop',
  createdById: 'u_owner',
  createdAt: new Date('2026-09-04T12:00:00Z'),
  lastUsedAt: null,
  revokedAt: null,
  revokedById: null,
};

function service(over: Partial<Record<'mint' | 'list' | 'revoke', unknown>> = {}): ConnectorCredentialService {
  return {
    mint: vi.fn(async () => ({ record: RECORD, value: 'pmi_ct_secret' })),
    list: vi.fn(async () => [RECORD]),
    revoke: vi.fn(async () => ({ record: { ...RECORD, revokedAt: new Date(), revokedById: 'u_owner' }, changed: true })),
    ...over,
  } as unknown as ConnectorCredentialService;
}

function route(target: object, handler: string): { path: string; method: RequestMethod } {
  const fn = (target as Record<string, unknown>)[handler] as object;
  return { path: Reflect.getMetadata('path', fn) as string, method: Reflect.getMetadata('method', fn) as RequestMethod };
}

describe('T1361 · route surface', () => {
  it('is served where the contract says', () => {
    expect(Reflect.getMetadata('path', ProjectConnectorCredentialsController)).toBe('projects');
    expect(route(ProjectConnectorCredentialsController.prototype, 'mint')).toEqual({ path: ':id/connector-credentials', method: RequestMethod.POST });
    expect(route(ProjectConnectorCredentialsController.prototype, 'list')).toEqual({ path: ':id/connector-credentials', method: RequestMethod.GET });
    expect(Reflect.getMetadata('path', ConnectorCredentialsController)).toBe('connector-credentials');
    expect(route(ConnectorCredentialsController.prototype, 'revoke')).toEqual({ path: ':id/revoke', method: RequestMethod.POST });
    expect(Reflect.getMetadata('path', ConnectorController)).toBe('connector');
    expect(route(ConnectorController.prototype, 'whoami')).toEqual({ path: 'whoami', method: RequestMethod.GET });
  });

  it('whoami declares its scope with the decorator — the guard refuses a route that does not', () => {
    expect(Reflect.getMetadata(CONNECTOR_SCOPE_KEY, ConnectorController.prototype.whoami)).toBe('connector.whoami');
    expect(Reflect.getMetadata(CONNECTOR_SCOPE_KEY, ConnectorController.prototype.whoamiForProject)).toBe('connector.whoami');
  });
});

describe('T1361 · mint and list', () => {
  it('mint returns the value exactly once, with id, label, tokenPrefix, createdAt', async () => {
    const svc = service();
    const c = new ProjectConnectorCredentialsController(svc);
    const body = await c.mint(CTX, 'p_a', { label: 'laptop' });
    expect(body).toMatchObject({ id: 'cred_1', label: 'laptop', tokenPrefix: 'abcdefgh', value: 'pmi_ct_secret' });
    expect(body).not.toHaveProperty('tokenHash');
    expect(svc.mint).toHaveBeenCalledWith(CTX, 'p_a', { label: 'laptop' });
  });

  it('list never includes value or tokenHash, and passes the filters through', async () => {
    const svc = service();
    const c = new ProjectConnectorCredentialsController(svc);
    const rows = await c.list(CTX, 'p_a', 'true', 'laptop');
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('value');
    expect(rows[0]).not.toHaveProperty('tokenHash');
    expect(svc.list).toHaveBeenCalledWith('ws_a', 'p_a', { revoked: true, label: 'laptop' });
    await c.list(CTX, 'p_a', undefined, undefined);
    expect(svc.list).toHaveBeenLastCalledWith('ws_a', 'p_a', {});
  });

  it('strips scope-widening fields from the mint body and requires a session', async () => {
    const svc = service();
    const c = new ProjectConnectorCredentialsController(svc);
    await c.mint(CTX, 'p_a', { label: 'x', workspaceId: 'ws_other', projectId: 'p_other' } as never);
    expect(svc.mint).toHaveBeenCalledWith(CTX, 'p_a', { label: 'x' });
    await expect(c.mint(undefined, 'p_a', { label: 'x' })).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('T1361 · revoke', () => {
  it('is 201 with the record when it changed, 200 when already revoked', async () => {
    const svc = service();
    const c = new ConnectorCredentialsController(svc);
    const res = { status: vi.fn() };
    const body = await c.revoke(CTX, 'cred_1', res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(body.revokedById).toBe('u_owner');
    expect(body).not.toHaveProperty('tokenHash');
    const again = new ConnectorCredentialsController(service({ revoke: vi.fn(async () => ({ record: RECORD, changed: false })) }));
    const res2 = { status: vi.fn() };
    await again.revoke(CTX, 'cred_1', res2);
    expect(res2.status).toHaveBeenCalledWith(200);
  });
});

describe('T1361 · whoami', () => {
  it('returns only the project id the credential opens', () => {
    const c = new ConnectorController();
    expect(c.whoami({ connector: { projectId: 'p_a', workspaceId: 'ws_a', credentialId: 'cred_1', principal: {} as never } })).toEqual({ projectId: 'p_a' });
  });
});
