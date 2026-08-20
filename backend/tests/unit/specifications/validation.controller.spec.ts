/**
 * T122a — the validation endpoints with a mocked service.
 * Written to FAIL before T123 exists (Constitution V).
 *
 * Validation is an engine capability, so it is a JOB like generation is
 * (research R-001): the endpoint answers 202 and a job, never a verdict. The
 * findings are read separately, once there are some.
 */
import { describe, expect, it, vi } from 'vitest';
import { UnauthenticatedError } from '../../../src/core/errors.js';
import { SpecificationsController } from '../../../src/modules/specifications/specifications.controller.js';
import type { GenerationJobApi } from '../../../src/modules/specifications/generate-specification.service.js';
import type { SpecificationLifecycleApi } from '../../../src/modules/specifications/lifecycle.service.js';
import type { SpecificationSearchApi } from '../../../src/modules/specifications/specification-search.service.js';
import type { SpecificationReadApi } from '../../../src/modules/specifications/specifications-read.service.js';
import { CTX, WS } from './helpers.js';

const AT = new Date('2026-08-20T10:00:00.000Z');

const JOB = {
  id: 'job_v1',
  workspaceId: WS,
  projectId: 'proj_1',
  jobKey: 'k',
  kind: 'validate_specification' as const,
  state: 'queued' as const,
  failureReason: null,
  startedAt: null,
  endedAt: null,
  createdAt: AT,
  resultRef: null,
};

const FINDING = { id: 'f1', location: '§2 Scope', severity: 'error', message: 'Unresolved placeholder' };

function build(): {
  c: SpecificationsController;
  jobs: GenerationJobApi;
  lifecycle: SpecificationLifecycleApi;
} {
  const jobs = {
    submitValidation: vi.fn(async () => ({ job: JOB, joinedExisting: false })),
  } as unknown as GenerationJobApi;
  const lifecycle = {
    findings: vi.fn(async () => [FINDING]),
  } as unknown as SpecificationLifecycleApi;

  return {
    jobs,
    lifecycle,
    c: new SpecificationsController(
      jobs,
      {} as unknown as SpecificationReadApi,
      {} as unknown as SpecificationSearchApi,
      lifecycle,
    ),
  };
}

describe('POST /specifications/{id}/jobs/validate', () => {
  it('delegates the acting context and the specification', async () => {
    const { c, jobs } = build();
    await c.validate(CTX, 'spec_1');
    expect(jobs.submitValidation).toHaveBeenCalledWith(CTX, 'spec_1');
  });

  it('answers the contract’s job shape, not a verdict', async () => {
    const { c } = build();
    const body = await c.validate(CTX, 'spec_1');
    expect(body).toEqual({
      id: 'job_v1',
      kind: 'validate_specification',
      state: 'queued',
      failureReason: null,
      startedAt: null,
      resultRef: null,
    });
  });
});

describe('GET /specifications/{id}/findings (FR-023)', () => {
  it('returns findings, each naming the part of the specification it concerns', async () => {
    const { c, lifecycle } = build();
    const findings = await c.findings(CTX, 'spec_1');
    expect(lifecycle.findings).toHaveBeenCalledWith(WS, 'spec_1');
    expect(findings[0]).toMatchObject({ location: '§2 Scope' });
  });
});

describe('authentication', () => {
  it.each([
    ['validate', (c: SpecificationsController) => c.validate(undefined, 'spec_1')],
    ['findings', (c: SpecificationsController) => c.findings(undefined, 'spec_1')],
  ])('%s refuses a request with no session', async (_label, call) => {
    const { c } = build();
    await expect(call(c)).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
