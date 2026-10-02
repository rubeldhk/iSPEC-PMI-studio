/**
 * `T1373` (EPIC-041) — the client methods the project screen needs
 * (`FR-LPW-042`), plus the provisioning and credential methods US5 mounts.
 *
 * `generateSpecification(projectId, requirementIds)` posts to
 * `/projects/:id/jobs/generate-specification` and returns the `202` job;
 * `startRun` posts to `/projects/:id/runs`; both surface the refusal body on
 * `4xx`. The provisioning and credential methods target the routes in
 * specs/041-local-project-workspace/contracts/provisioning-api.md.
 *
 * Written to FAIL before `T1374` exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../../../src/services/api';

type FetchImpl = typeof fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function clientWith(response: Response): { client: ApiClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async () => response);
  const client = new ApiClient({ fetchImpl: fetchMock as unknown as FetchImpl });
  return { client, fetchMock };
}

function call(fetchMock: ReturnType<typeof vi.fn>): { url: string; method: string | undefined; body: unknown } {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const JOB = { id: 'j1', kind: 'generate_specification', state: 'queued', failureReason: null, startedAt: null, resultRef: null };

describe('T1373 · generateSpecification', () => {
  it('posts the selected requirement ids and returns the 202 job', async () => {
    const { client, fetchMock } = clientWith(jsonResponse(202, JOB));
    const job = await client.generateSpecification('p1', ['r1', 'r2']);
    expect(call(fetchMock)).toEqual({ url: '/v1/projects/p1/jobs/generate-specification', method: 'POST', body: { requirementIds: ['r1', 'r2'] } });
    expect(job).toEqual(JOB);
  });

  it('surfaces the refusal body on 4xx as a typed ApiError', async () => {
    const { client } = clientWith(jsonResponse(400, { error: { code: 'validation_failed', message: 'Select at least one requirement.', details: { fields: [{ field: 'requirementIds', reason: 'required' }] } } }));
    const error = await client.generateSpecification('p1', []).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('validation_failed');
    expect((error as ApiError).message).toBe('Select at least one requirement.');
    expect((error as ApiError).fieldErrors()).toEqual([{ field: 'requirementIds', reason: 'required' }]);
  });
});

describe('T1373 · startRun', () => {
  it('posts to /projects/:id/runs with the mode and stop range', async () => {
    const run = { id: 'run_1', projectId: 'p1', mode: 'autopilot', stopRange: 'specify', state: 'queued' };
    const { client, fetchMock } = clientWith(jsonResponse(202, run));
    const result = await client.startRun('p1', { mode: 'autopilot', stopRange: 'specify' });
    expect(call(fetchMock)).toEqual({ url: '/v1/projects/p1/runs', method: 'POST', body: { mode: 'autopilot', stopRange: 'specify' } });
    expect(result).toEqual(run);
  });

  it('surfaces a refusal', async () => {
    const { client } = clientWith(jsonResponse(409, { error: { code: 'conflict', message: 'A run is already active.' } }));
    await expect(client.startRun('p1', {})).rejects.toMatchObject({ code: 'conflict', status: 409 });
  });
});

describe('T1373 · provisioning', () => {
  it('provisionProject posts the root path, integration and script type', async () => {
    const { client, fetchMock } = clientWith(jsonResponse(202, { project: { id: 'p1' }, record: { outcome: 'succeeded' } }));
    await client.provisionProject('p1', { rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' });
    expect(call(fetchMock)).toEqual({ url: '/v1/projects/p1/provision', method: 'POST', body: { rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' } });
  });

  it('listProvisioning reads the history', async () => {
    const { client, fetchMock } = clientWith(jsonResponse(200, []));
    await client.listProvisioning('p1');
    expect(call(fetchMock)).toMatchObject({ url: '/v1/projects/p1/provisioning', method: 'GET' });
  });

  it('createProject carries the provisioning fields when given', async () => {
    const { client, fetchMock } = clientWith(jsonResponse(201, { id: 'p1' }));
    await client.createProject({ name: 'A', rootPath: 'a', agentIntegration: 'claude', scriptType: 'ps' });
    expect(call(fetchMock).body).toEqual({ name: 'A', rootPath: 'a', agentIntegration: 'claude', scriptType: 'ps' });
  });
});

describe('T1373 · connector credentials', () => {
  it('listConnectorCredentials passes the revoked and label filters as query parameters', async () => {
    const filtered = clientWith(jsonResponse(200, []));
    await filtered.client.listConnectorCredentials('p1', { revoked: true, label: 'ci box' });
    expect(call(filtered.fetchMock).url).toBe('/v1/projects/p1/connector-credentials?revoked=true&label=ci+box');
    const unfiltered = clientWith(jsonResponse(200, []));
    await unfiltered.client.listConnectorCredentials('p1');
    expect(call(unfiltered.fetchMock).url).toBe('/v1/projects/p1/connector-credentials');
  });

  it('mintConnectorCredential posts the label and returns the value once', async () => {
    const { client, fetchMock } = clientWith(jsonResponse(201, { id: 'c1', label: 'laptop', tokenPrefix: 'abcdefgh', value: 'pmi_ct_x' }));
    const minted = await client.mintConnectorCredential('p1', 'laptop');
    expect(call(fetchMock)).toEqual({ url: '/v1/projects/p1/connector-credentials', method: 'POST', body: { label: 'laptop' } });
    expect(minted.value).toBe('pmi_ct_x');
  });

  it('revokeConnectorCredential posts to /connector-credentials/:id/revoke', async () => {
    const { client, fetchMock } = clientWith(jsonResponse(201, { id: 'c1', revokedAt: '2026-09-04T00:00:00Z' }));
    await client.revokeConnectorCredential('c1');
    expect(call(fetchMock)).toMatchObject({ url: '/v1/connector-credentials/c1/revoke', method: 'POST' });
  });
});
