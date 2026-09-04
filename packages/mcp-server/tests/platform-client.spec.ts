/**
 * `T1423` (EPIC-043, `R-043-5`, `R-043-6`) — the REST client behind every tool.
 *
 * Every request carries the bearer credential, the contract version, the
 * surface header and, on POST, the idempotency key; a 4xx body becomes a
 * structured refusal with the platform's code; a network failure becomes
 * `platform_unreachable` carrying the host only; the credential never appears
 * in any result, message or thrown error. Written to FAIL before `T1424`.
 */
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import { describe, expect, it, vi } from 'vitest';
import { createPlatformClient } from '../src/platform-client.js';

const CREDENTIAL = 'pmi_ct_abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';

function fetchStub(status: number, body: unknown) {
  return vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

describe('T1423 · request shape', () => {
  it('sends the bearer credential, the contract version, the surface and the idempotency key', async () => {
    const fetch = fetchStub(201, { executionId: 'exec_1' });
    const client = createPlatformClient({ baseUrl: 'http://localhost:3000', credential: CREDENTIAL, fetch });
    const result = await client.call({ method: 'POST', path: '/v1/executions', body: { command: 'specify' }, surface: 'mcp-client', idempotencyKey: 'k_1' });
    expect(result).toEqual({ ok: true, status: 201, body: { executionId: 'exec_1' } });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/v1/executions');
    const headers = init.headers as Record<string, string>;
    expect(headers['authorization']).toBe(`Bearer ${CREDENTIAL}`);
    expect(headers['x-contract-version']).toBe(CONTRACT_VERSION);
    expect(headers['x-pmi-surface']).toBe('mcp-client');
    expect(headers['idempotency-key']).toBe('k_1');
    expect(headers['content-type']).toBe('application/json');
  });

  it('sends no idempotency key and no body on GET', async () => {
    const fetch = fetchStub(200, [{ sequence: 1 }]);
    const client = createPlatformClient({ baseUrl: 'http://localhost:3000/', credential: CREDENTIAL, fetch });
    await client.call({ method: 'GET', path: '/v1/executions/exec_1/history', surface: 'mcp-client' });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/v1/executions/exec_1/history');
    expect((init.headers as Record<string, string>)['idempotency-key']).toBeUndefined();
    expect(init.body).toBeUndefined();
  });
});

describe('T1423 · refusals', () => {
  it('a 4xx platform body becomes a structured refusal carrying the platform\'s code and detail', async () => {
    const fetch = fetchStub(403, { error: { code: 'scope_required', message: 'This operation requires the connector scope "execution.read".', details: { scope: 'execution.read' } } });
    const client = createPlatformClient({ baseUrl: 'http://localhost:3000', credential: CREDENTIAL, fetch });
    const result = await client.call({ method: 'GET', path: '/v1/executions/x', surface: 'mcp-client' });
    expect(result).toEqual({ ok: false, refusal: { code: 'scope_required', message: 'This operation requires the connector scope "execution.read".', scope: 'execution.read' } });
  });

  it('a 401 is the one credential refusal, verbatim', async () => {
    const fetch = fetchStub(401, { error: { code: 'invalid_connector_credential', message: 'Invalid connector credential.' } });
    const client = createPlatformClient({ baseUrl: 'http://localhost:3000', credential: CREDENTIAL, fetch });
    const result = await client.call({ method: 'GET', path: '/v1/executions/x', surface: 'mcp-client' });
    expect(result).toEqual({ ok: false, refusal: { code: 'invalid_connector_credential', message: 'Invalid connector credential.' } });
  });

  it('a network failure becomes platform_unreachable carrying the host, never the credential', async () => {
    const fetch = vi.fn(async () => {
      throw new Error(`connect ECONNREFUSED ${CREDENTIAL}`);
    });
    const client = createPlatformClient({ baseUrl: 'http://localhost:3000', credential: CREDENTIAL, fetch });
    const result = await client.call({ method: 'GET', path: '/v1/executions/x', surface: 'mcp-client' });
    expect(result).toMatchObject({ ok: false, refusal: { code: 'platform_unreachable', address: 'localhost:3000' } });
    expect(JSON.stringify(result)).not.toContain(CREDENTIAL);
  });

  it('a non-JSON error body still yields a refusal, sanitised', async () => {
    const fetch = vi.fn(async () => new Response(`bad gateway for ${CREDENTIAL}`, { status: 502 }));
    const client = createPlatformClient({ baseUrl: 'http://localhost:3000', credential: CREDENTIAL, fetch });
    const result = await client.call({ method: 'GET', path: '/v1/executions/x', surface: 'mcp-client' });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(CREDENTIAL);
    expect(JSON.stringify(result)).toContain('<credential>');
  });

  it('describe() says whether a credential is present without revealing it', () => {
    const present = createPlatformClient({ baseUrl: 'http://localhost:3000', credential: CREDENTIAL, fetch: fetchStub(200, {}) }).describe();
    expect(present).toEqual({ address: 'localhost:3000', credentialPresent: true });
    const absent = createPlatformClient({ baseUrl: 'http://localhost:3000', credential: '', fetch: fetchStub(200, {}) }).describe();
    expect(absent.credentialPresent).toBe(false);
  });

  it('an absent credential never reaches the platform: the one refusal, locally', async () => {
    const fetch = fetchStub(200, {});
    const client = createPlatformClient({ baseUrl: 'http://localhost:3000', credential: '', fetch });
    const result = await client.call({ method: 'GET', path: '/v1/executions/x', surface: 'mcp-client' });
    expect(result).toEqual({ ok: false, refusal: { code: 'invalid_connector_credential', message: 'Invalid connector credential.' } });
    expect(fetch).not.toHaveBeenCalled();
  });
});
