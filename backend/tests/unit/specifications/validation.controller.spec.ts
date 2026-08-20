/**
 * T122a — validation endpoints with a mocked service.
 * Written to FAIL before T123 exists (Constitution V).
 */
import { describe, expect, it, vi } from 'vitest';
import { SpecificationLifecycleController } from '../../../src/modules/specifications/specifications.controller.js';
import type { SpecificationLifecycleApi } from '../../../src/modules/specifications/lifecycle-api.service.js';
import { UnauthenticatedError } from '../../../src/core/errors.js';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

function api(): SpecificationLifecycleApi {
  return {
    findings: vi.fn(async () => [
      { id: 'f1', location: 'section 2', severity: 'warning', message: 'ambiguous' },
    ]),
    submitValidation: vi.fn(async () => ({
      id: 'job1',
      kind: 'validate_specification',
      state: 'queued',
      failureReason: null,
      startedAt: null,
      resultRef: null,
    })),
  } as unknown as SpecificationLifecycleApi;
}

describe('validation endpoints (T123)', () => {
  it('GET /specifications/{id}/findings — each finding carries a location (FR-023)', async () => {
    const service = api();
    const c = new SpecificationLifecycleController(service);
    const out = await c.findings(CTX, 's1');
    expect(service.findings).toHaveBeenCalledWith('ws_a', 's1');
    expect(out[0]).toHaveProperty('location');
  });

  it('POST /specifications/{id}/jobs/validate — always asynchronous, returns the job', async () => {
    const service = api();
    const c = new SpecificationLifecycleController(service);
    const out = await c.validate(CTX, 's1');
    expect(service.submitValidation).toHaveBeenCalledWith(
      { workspaceId: 'ws_a', userId: 'u1' },
      's1',
    );
    expect(out.kind).toBe('validate_specification');
    expect(out.state).toBe('queued');
  });

  it('no session is 401 on both routes', async () => {
    const c = new SpecificationLifecycleController(api());
    await expect(c.findings(undefined, 's1')).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(c.validate(undefined, 's1')).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
