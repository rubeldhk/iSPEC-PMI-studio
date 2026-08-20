/**
 * T082a — the specifications controller with a mocked service.
 * Written to FAIL before T083 / T083a exist (Constitution V).
 *
 * PC-1: the controller is a transport. Everything asserted here is delegation,
 * scope handling, and the response SHAPE the contract specifies — never a
 * business rule, because a rule that only exists behind a route cannot be
 * reached by the worker or by a Phase 3 MCP surface.
 */
import { describe, expect, it, vi } from 'vitest';
import { UnauthenticatedError } from '../../../src/core/errors.js';
import { SpecificationsController } from '../../../src/modules/specifications/specifications.controller.js';
import type { GenerationJobApi } from '../../../src/modules/specifications/generate-specification.service.js';
import type { SpecificationLifecycleApi } from '../../../src/modules/specifications/lifecycle.service.js';
import type { SpecificationSearchApi } from '../../../src/modules/specifications/specification-search.service.js';
import type {
  SpecificationDetail,
  SpecificationReadApi,
  SpecificationRecord,
} from '../../../src/modules/specifications/specifications-read.service.js';
import { CTX, PROJECT, WS } from './helpers.js';

const AT = new Date('2026-08-20T10:00:00.000Z');

const SPEC: SpecificationRecord = {
  id: 'spec_1',
  workspaceId: WS,
  projectId: PROJECT,
  title: 'Payments Specification',
  lifecycleState: 'draft',
  currentVersionId: 'ver_1',
  engineName: 'stub',
  engineVersion: '1.4.0+model-x',
  generatedAt: AT,
  isOutOfDate: false,
  createdAt: AT,
  createdById: 'u1',
  updatedAt: AT,
  updatedById: 'u1',
};

const DETAIL: SpecificationDetail = { ...SPEC, currentVersion: null };

const JOB = {
  id: 'job_1',
  kind: 'generate_specification' as const,
  state: 'queued' as const,
  failureReason: null,
  startedAt: null,
  endedAt: null,
  createdAt: AT,
  resultRef: null,
};

function mocks(): {
  jobs: GenerationJobApi;
  reads: SpecificationReadApi;
  search: SpecificationSearchApi;
} {
  return {
    jobs: {
      submit: vi.fn(async () => ({ job: JOB, joinedExisting: false })),
      job: vi.fn(async () => JOB),
      cancel: vi.fn(async () => ({ ...JOB, state: 'cancelled' as const, failureReason: 'cancelled' as const })),
      jobsForProject: vi.fn(async () => [JOB]),
    } as unknown as GenerationJobApi,
    reads: {
      list: vi.fn(async () => ({ rows: [SPEC], total: 1, page: 1, pageSize: 25 })),
      get: vi.fn(async () => DETAIL),
      edit: vi.fn(async () => SPEC),
    } as unknown as SpecificationReadApi,
    search: {
      search: vi.fn(async () => ({ rows: [{ ...SPEC, matchedIn: ['title'] }], total: 1, page: 1, pageSize: 25 })),
    } as unknown as SpecificationSearchApi,
  };
}

function controller(): { c: SpecificationsController } & ReturnType<typeof mocks> {
  const m = mocks();
  return {
    ...m,
    c: new SpecificationsController(
      m.jobs,
      m.reads,
      m.search,
      {} as unknown as SpecificationLifecycleApi,
    ),
  };
}

describe('SpecificationsController · generation jobs (F-04.5)', () => {
  it('submit delegates the acting context, project and selection', async () => {
    const { c, jobs } = controller();
    await c.generate(CTX, PROJECT, { requirementIds: ['req_1', 'req_2'] });
    expect(jobs.submit).toHaveBeenCalledWith(CTX, PROJECT, ['req_1', 'req_2']);
  });

  it('submit answers with the contract’s job shape', async () => {
    const { c } = controller();
    expect(await c.generate(CTX, PROJECT, { requirementIds: ['req_1'] })).toEqual({
      id: 'job_1',
      kind: 'generate_specification',
      state: 'queued',
      failureReason: null,
      startedAt: null,
      resultRef: null,
    });
  });

  it('a missing requirementIds body becomes an empty selection, not a crash', async () => {
    const { c, jobs } = controller();
    await c.generate(CTX, PROJECT, {} as never);
    expect(jobs.submit).toHaveBeenCalledWith(CTX, PROJECT, []);
  });

  it('job read and cancel delegate under the session workspace', async () => {
    const { c, jobs } = controller();
    await c.job(CTX, 'job_1');
    await c.cancel(CTX, 'job_1');
    expect(jobs.job).toHaveBeenCalledWith(WS, 'job_1');
    expect(jobs.cancel).toHaveBeenCalledWith(WS, 'job_1');
  });

  it('a cancelled job still names its reason (FR-026)', async () => {
    const { c } = controller();
    const body = await c.cancel(CTX, 'job_1');
    expect(body.state).toBe('cancelled');
    expect(body.failureReason).toBe('cancelled');
  });

  it('the project job list delegates workspace and project', async () => {
    const { c, jobs } = controller();
    await c.jobs(CTX, PROJECT);
    expect(jobs.jobsForProject).toHaveBeenCalledWith(WS, PROJECT);
  });
});

describe('SpecificationsController · read surface (F-04.6, FR-012)', () => {
  it('list delegates workspace, project and the paging query', async () => {
    const { c, reads } = controller();
    await c.list(CTX, PROJECT, { page: '2', pageSize: '10' });
    expect(reads.list).toHaveBeenCalledWith(WS, PROJECT, { page: 2, pageSize: 10 });
  });

  it('list routes to SEARCH when a term is supplied, scoped to the project', async () => {
    const { c, reads, search } = controller();
    await c.list(CTX, PROJECT, { q: 'payments' });
    expect(search.search).toHaveBeenCalledWith(WS, { term: 'payments', projectId: PROJECT });
    expect(reads.list).not.toHaveBeenCalled();
  });

  it('passes the search filters through', async () => {
    const { c, search } = controller();
    await c.list(CTX, PROJECT, { q: 'payments', lifecycleState: 'approved', isOutOfDate: 'true' });
    expect(search.search).toHaveBeenCalledWith(WS, {
      term: 'payments',
      projectId: PROJECT,
      lifecycleState: 'approved',
      isOutOfDate: true,
    });
  });

  it('detail and edit delegate under the session workspace', async () => {
    const { c, reads } = controller();
    await c.get(CTX, 'spec_1');
    await c.patch(CTX, 'spec_1', { title: 'Renamed' });
    expect(reads.get).toHaveBeenCalledWith(WS, 'spec_1');
    expect(reads.edit).toHaveBeenCalledWith(CTX, 'spec_1', { title: 'Renamed' });
  });

  it('strips scope fields from a PATCH body — scope comes from the session (T014)', async () => {
    const { c, reads } = controller();
    await c.patch(CTX, 'spec_1', {
      title: 'Renamed',
      workspaceId: 'ws_hijack',
      projectId: 'proj_hijack',
      id: 'spec_other',
      lifecycleState: 'approved',
    } as never);
    expect(reads.edit).toHaveBeenCalledWith(CTX, 'spec_1', { title: 'Renamed' });
  });
});

describe('SpecificationsController · authentication', () => {
  it.each([
    ['generate', (c: SpecificationsController) => c.generate(undefined, PROJECT, { requirementIds: [] })],
    ['job', (c: SpecificationsController) => c.job(undefined, 'job_1')],
    ['cancel', (c: SpecificationsController) => c.cancel(undefined, 'job_1')],
    ['jobs', (c: SpecificationsController) => c.jobs(undefined, PROJECT)],
    ['list', (c: SpecificationsController) => c.list(undefined, PROJECT, {})],
    ['get', (c: SpecificationsController) => c.get(undefined, 'spec_1')],
    ['patch', (c: SpecificationsController) => c.patch(undefined, 'spec_1', { title: 'x' })],
  ])('%s refuses a request with no session', async (_label, call) => {
    const { c } = controller();
    await expect(call(c)).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
