/**
 * T057a — the API client: error-shape parsing and session expiry.
 * Written to FAIL before T058 exists (Constitution V).
 *
 * Every later frontend epic consumes this client, so its error handling is
 * foundational rather than incidental (plan.md design note).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../../../src/services/api';

type FetchImpl = typeof fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWith(
  response: Response | ((url: string, init?: RequestInit) => Response),
  onSessionExpired?: () => void,
): { client: ApiClient; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
    typeof response === 'function' ? response(String(url), init) : response,
  );
  const client = new ApiClient({
    fetchImpl: fetchMock as unknown as FetchImpl,
    ...(onSessionExpired ? { onSessionExpired } : {}),
  });
  return { client, fetchMock };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiClient · request shape', () => {
  it('targets /v1, sends JSON, and includes credentials (the session cookie)', async () => {
    const { client, fetchMock } = clientWith(jsonResponse(200, { user: {}, workspace: {} }));
    await client.signIn('a@b.test', 'pw');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/v1/auth/sign-in');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.test', password: 'pw' });
  });
});

describe('ApiClient · error-shape parsing', () => {
  it('parses the contract error envelope into a typed ApiError', async () => {
    const { client } = clientWith(
      jsonResponse(400, {
        error: {
          code: 'validation_failed',
          message: 'Requirement cannot be saved.',
          details: { fields: [{ field: 'description', reason: 'required' }] },
        },
      }),
    );
    const err = await client.createProject({ name: '' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.code).toBe('validation_failed');
    expect(apiErr.message).toBe('Requirement cannot be saved.');
    expect(apiErr.status).toBe(400);
    expect(apiErr.details).toEqual({ fields: [{ field: 'description', reason: 'required' }] });
  });

  it('names the offending fields via fieldErrors()', async () => {
    const { client } = clientWith(
      jsonResponse(400, {
        error: {
          code: 'validation_failed',
          message: 'Cannot save.',
          details: { fields: [{ field: 'name', reason: 'required' }] },
        },
      }),
    );
    const err = (await client.createProject({}).catch((e: unknown) => e)) as ApiError;
    expect(err.fieldErrors()).toEqual([{ field: 'name', reason: 'required' }]);
  });

  it('a non-JSON error body still becomes a typed error, never a parse crash', async () => {
    const { client } = clientWith(new Response('<html>Bad gateway</html>', { status: 502 }));
    const err = await client.listProjects().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('internal_error');
    expect((err as ApiError).status).toBe(502);
  });
});

describe('ApiClient · session expiry', () => {
  it('a 401 invokes onSessionExpired and still rejects with the typed error', async () => {
    const expired = vi.fn();
    const { client } = clientWith(
      jsonResponse(401, { error: { code: 'unauthenticated', message: 'No valid session.' } }),
      expired,
    );
    const err = await client.me().catch((e: unknown) => e);
    expect(expired).toHaveBeenCalledTimes(1);
    expect((err as ApiError).code).toBe('unauthenticated');
    expect((err as ApiError).isSessionExpiry()).toBe(true);
  });

  it('a 401 on any endpoint triggers the same handling', async () => {
    const expired = vi.fn();
    const { client } = clientWith(
      jsonResponse(401, { error: { code: 'unauthenticated', message: 'No valid session.' } }),
      expired,
    );
    await client.listProjects().catch(() => undefined);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('other failures do NOT masquerade as expiry', async () => {
    const expired = vi.fn();
    const { client } = clientWith(
      jsonResponse(404, { error: { code: 'not_found', message: 'Not found.' } }),
      expired,
    );
    const err = await client.getProject('p1').catch((e: unknown) => e);
    expect(expired).not.toHaveBeenCalled();
    expect((err as ApiError).isSessionExpiry()).toBe(false);
  });
});

describe('ApiClient · surfaces', () => {
  it('covers auth, projects, and requirements per the contract tables', () => {
    const client = new ApiClient({ fetchImpl: vi.fn() as unknown as FetchImpl });
    for (const method of [
      'signIn',
      'signOut',
      'me',
      'listProjects',
      'createProject',
      'getProject',
      'updateProject',
      'archiveProject',
      'listRequirements',
      'createRequirement',
      'getRequirement',
      'updateRequirement',
      'retireRequirement',
      'listRequirementVersions',
    ]) {
      expect(typeof (client as unknown as Record<string, unknown>)[method], method).toBe('function');
    }
  });

  it('requirement list filters become query parameters', async () => {
    const { client, fetchMock } = clientWith(jsonResponse(200, []));
    await client.listRequirements('p1', { type: 'functional', status: 'active' });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/v1/projects/p1/requirements?');
    expect(url).toContain('type=functional');
    expect(url).toContain('status=active');
  });
});
