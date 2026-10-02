/**
 * `T1420` (EPIC-043, `contracts/mounted-registry-api.md`) — the mounted
 * controller is a transport: it derives what the credential says and refuses
 * what a body asserts.
 *
 * Written to FAIL before `T1421`.
 */
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionsController } from '../../../src/modules/executions/executions.controller.js';
import type { ConnectorRequestContext } from '../../../src/modules/connector/connector-auth.guard.js';

const IDENTITY = {
  authenticatedPrincipalId: 'pr_1',
  agentSnapshotId: 'snap_1',
  connectorRegistrationId: 'reg_1',
  sponsorUserId: 'u_owner',
  delegationId: 'del_1',
  delegationIdentityVersion: 1,
};

function connector(): ConnectorRequestContext {
  return {
    credentialId: 'cred_1',
    workspaceId: 'ws_a',
    projectId: 'proj_1',
    principal: { principalId: 'pr_1', kind: 'connector', workspaceId: 'ws_a', sponsorUserId: 'u_owner', identityVersion: 1, connectorRegistrationId: 'reg_1' } as ConnectorRequestContext['principal'],
  };
}

function req(over: { headers?: Record<string, string>; connector?: ConnectorRequestContext | undefined } = {}) {
  return {
    headers: { 'x-contract-version': '1.0', ...(over.headers ?? {}) },
    connector: 'connector' in over ? over.connector : connector(),
  };
}

function harness(over: { projectIdOf?: (ws: string, id: string) => Promise<string | null> } = {}) {
  const registry = {
    register: vi.fn(async (r: Record<string, unknown>) => ({ executionId: 'exec_1', ...r })),
    appendEvent: vi.fn(async (r: Record<string, unknown>) => ({ sequence: 2, ...r })),
    complete: vi.fn(async (r: Record<string, unknown>) => ({ sequence: 3, ...r })),
    comment: vi.fn(async (r: Record<string, unknown>) => ({ commentId: 'c_1', ...r })),
    proposeTransition: vi.fn(async (r: Record<string, unknown>) => ({ sequence: 4, ...r })),
    history: vi.fn(async () => [{ sequence: 1 }]),
    snapshot: vi.fn(async () => ({ executionId: 'exec_1', workspaceId: 'ws_a' })),
  };
  const identity = { forRequest: vi.fn(async () => IDENTITY) };
  const ownership = { projectIdOf: vi.fn(over.projectIdOf ?? (async () => 'proj_1')) };
  const c = new ExecutionsController(registry as never, identity as never, ownership as never);
  return { c, registry, identity, ownership };
}

const BODY = {
  command: 'specify',
  argsSanitized: {},
  input: { targetType: 'project', targetId: 'proj_1' },
  correlationId: 'corr_1',
  idempotencyKey: 'k_1',
  contractVersion: '1.0',
};

describe('T1420 · derived fields', () => {
  it('register takes workspace, project, identity and surface from the credential and the transport, not the body', async () => {
    const { c, registry } = harness();
    await c.register(req(), BODY as never);
    expect(registry.register).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws_a', projectId: 'proj_1', identity: IDENTITY, surface: 'local-cli', command: 'specify' }),
    );
  });

  it('x-pmi-surface: mcp-client yields mcp-client; any other value is surface_not_accepted', async () => {
    const { c, registry } = harness();
    await c.register(req({ headers: { 'x-pmi-surface': 'mcp-client' } }), BODY as never);
    expect(registry.register).toHaveBeenLastCalledWith(expect.objectContaining({ surface: 'mcp-client' }));
    await expect(c.register(req({ headers: { 'x-pmi-surface': 'managed-sandbox' } }), BODY as never)).rejects.toMatchObject({ code: 'surface_not_accepted' });
  });

  it.each([['identity', { identity: IDENTITY }], ['workspaceId', { workspaceId: 'ws_other' }], ['projectId', { projectId: 'proj_9' }], ['surface', { surface: 'mcp-client' }], ['assurance', { assurance: 'managed' }]])(
    'a body carrying %s is refused naming the field',
    async (field, extra) => {
      const { c, registry } = harness();
      await expect(c.register(req(), { ...BODY, ...extra } as never)).rejects.toMatchObject({
        code: field === 'surface' || field === 'assurance' ? 'surface_not_accepted' : 'identity_not_accepted',
        details: expect.objectContaining({ field }),
      });
      expect(registry.register).not.toHaveBeenCalled();
    },
  );

  it('a missing or mismatched contract-version header is unsupported_contract_version with supported and received', async () => {
    const { c } = harness();
    await expect(c.register({ headers: {}, connector: connector() }, BODY as never)).rejects.toMatchObject({
      code: 'unsupported_contract_version',
      details: { supported: '1.0', received: null },
    });
    await expect(c.register(req({ headers: { 'x-contract-version': '2.0' } }), BODY as never)).rejects.toMatchObject({
      code: 'unsupported_contract_version',
      details: { supported: '1.0', received: '2.0' },
    });
  });

  it('append, complete and propose inject the derived identity and the path execution id', async () => {
    const { c, registry } = harness();
    await c.append(req(), 'exec_1', { type: 'progress-reported', payload: {}, occurredAt: 'now', idempotencyKey: 'k_2' } as never);
    expect(registry.appendEvent).toHaveBeenCalledWith(expect.objectContaining({ executionId: 'exec_1', workspaceId: 'ws_a', identity: IDENTITY }));
    await c.complete(req(), 'exec_1', { outcome: 'completed', occurredAt: 'now', completionComment: 'done', idempotencyKey: 'k_3' } as never);
    expect(registry.complete).toHaveBeenCalledWith(expect.objectContaining({ executionId: 'exec_1', identity: IDENTITY }));
    const res = { status: vi.fn() };
    await c.propose(req(), 'exec_1', { targetRef: 'spec_1', targetVersion: 1, expectedCurrentStatus: 'draft', proposedState: 'review', rationale: 'r', correlationId: 'corr', idempotencyKey: 'k_4' } as never, res);
    expect(registry.proposeTransition).toHaveBeenCalledWith(expect.objectContaining({ executionId: 'exec_1', identity: IDENTITY }));
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('reads answer 404 for an execution whose project is not the credential\'s (FR-PIC-032, analysis C2)', async () => {
    const { c } = harness({ projectIdOf: async () => 'proj_OTHER' });
    await expect(c.history(req(), 'exec_1')).rejects.toMatchObject({ code: 'not_found' });
    await expect(c.snapshot(req(), 'exec_1')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('reads answer when the execution is the credential\'s project', async () => {
    const { c, registry } = harness();
    await expect(c.history(req(), 'exec_1')).resolves.toEqual([{ sequence: 1 }]);
    expect(registry.history).toHaveBeenCalledWith('ws_a', 'exec_1');
  });

  it('sync is reserved: not_available_until naming EPIC-037 (FR-PIC-034)', async () => {
    const { c } = harness();
    await expect(c.sync(req(), {} as never)).rejects.toMatchObject({ code: 'not_available_until', details: { epic: 'EPIC-037' } });
  });

  it('a request without a connector context is the one credential refusal', async () => {
    const { c } = harness();
    await expect(c.register(req({ connector: undefined }), BODY as never)).rejects.toMatchObject({ code: 'invalid_connector_credential' });
  });
});
