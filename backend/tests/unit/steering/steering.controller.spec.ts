/**
 * T237 — the steering controller over a mocked service.
 * Written to FAIL before T238 exists (Constitution V).
 */
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import {
  SteeringController,
  type SteeringApi,
} from '../../../src/modules/steering/steering.controller.js';
import { NotFoundError, toErrorBody, toHttpStatus } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' } as never;

const DOC = {
  id: 'sd1',
  subject: 'coding_standards',
  scope: { scopeType: 'organization', scopeRef: 'org_1' },
  content: 'Framework-free services.',
  version: 1,
  status: 'active',
};

function api(): SteeringApi {
  return {
    create: vi.fn(async () => DOC),
    list: vi.fn(async () => [DOC]),
    get: vi.fn(async () => DOC),
    edit: vi.fn(async () => ({ ...DOC, version: 2 })),
    retire: vi.fn(async () => ({ ...DOC, status: 'retired' })),
    history: vi.fn(async () => [DOC]),
  } as unknown as SteeringApi;
}

describe('T237 · route wiring', () => {
  it('create passes subject, scope and content through and returns the document', async () => {
    const service = api();
    const controller = new SteeringController(service);
    const body = {
      subject: 'coding_standards',
      scopeType: 'organization',
      scopeRef: 'org_1',
      content: 'Framework-free services.',
    };
    const out = await controller.create(CTX, body as never);
    expect(out.version).toBe(1);
    expect(service.create).toHaveBeenCalledWith(
      { workspaceId: 'ws_a', userId: 'u1' },
      expect.objectContaining({ subject: 'coding_standards' }),
    );
  });

  it('edit returns the NEW version', async () => {
    const out = await new SteeringController(api()).edit(CTX, 'sd1', { content: 'More.' } as never);
    expect(out.version).toBe(2);
  });

  it('retire flips status, never deletes', async () => {
    const out = await new SteeringController(api()).retire(CTX, 'sd1');
    expect(out.status).toBe('retired');
  });

  it('history lists every version', async () => {
    const out = await new SteeringController(api()).history(CTX, 'sd1');
    expect(out.length).toBe(1);
  });
});

describe('T237 · refusals', () => {
  it('no session → 401 before the service is touched', async () => {
    const service = api();
    const err = await new SteeringController(service)
      .list(undefined as never)
      .catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('cross-workspace get is an OPAQUE 404 — existence undisclosed', async () => {
    const service = api();
    (service.get as ReturnType<typeof vi.fn>).mockRejectedValue(new NotFoundError('Not found.'));
    const err = await new SteeringController(service).get(CTX, 'sd_other').catch((e: unknown) => e);
    expect(toHttpStatus(err)).toBe(404);
    expect(toErrorBody(err).error.code).toBe('not_found');
  });
});
