/**
 * T083 + T083a — `/projects/{id}/jobs/*`, `/jobs/*`, `/projects/{id}/specifications`
 * and `/specifications/*` per `contracts/platform-api.md` (Jobs · US3,
 * Specifications · US3).
 *
 * PC-1: a transport. It resolves the session, shapes the contract's job body,
 * and delegates. No rule lives here — the worker calls the same services with
 * no HTTP in sight, and a Phase 3 MCP surface will too.
 *
 * NOT here, deliberately: the six lifecycle transitions and the version
 * endpoints (EPIC-009 `T113`), and the validation endpoints (EPIC-009 `T123`).
 * They extend this same controller when their epics run.
 */
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import type { GenerationJobApi, JobView } from './generate-specification.service.js';
import type {
  SpecificationSearchApi,
  SpecificationSearchHit,
} from './specification-search.service.js';
import type {
  EditSpecificationInput,
  Page,
  SpecificationDetail,
  SpecificationReadApi,
  SpecificationRecord,
} from './specifications-read.service.js';

/** The job body the contract specifies — not the ledger row. */
export interface JobBody {
  id: string;
  kind: string;
  state: string;
  failureReason: string | null;
  startedAt: Date | null;
  resultRef: string | null;
}

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

function toJobBody(job: JobView): JobBody {
  return {
    id: job.id,
    kind: job.kind,
    state: job.state,
    failureReason: job.failureReason,
    startedAt: job.startedAt,
    resultRef: job.resultRef,
  };
}

/** Scope comes from the session and the route — never from a body (T014). */
function stripScope(body: Record<string, unknown>): EditSpecificationInput {
  const {
    workspaceId: _ws,
    projectId: _p,
    id: _id,
    // Lifecycle moves through its own endpoints (EPIC-009), never through PATCH.
    lifecycleState: _l,
    isOutOfDate: _o,
    engineName: _e,
    engineVersion: _v,
    ...safe
  } = body;
  return safe as EditSpecificationInput;
}

/** Query strings arrive as text; the services want numbers and booleans. */
function toPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export interface SpecificationListQuery {
  page?: string | number;
  pageSize?: string | number;
  q?: string;
  lifecycleState?: string;
  isOutOfDate?: string;
}

@Controller()
export class SpecificationsController {
  constructor(
    private readonly generation: GenerationJobApi,
    private readonly reads: SpecificationReadApi,
    private readonly search: SpecificationSearchApi,
  ) {}

  // ------------------------------------------------------------------- jobs

  /**
   * 202, always. Generation is an AI agent run, not a function call — there is
   * no shape of this endpoint that returns a specification (research R-001).
   */
  @Post('projects/:projectId/jobs/generate-specification')
  @HttpCode(202)
  async generate(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
    @Body() body: { requirementIds?: string[] },
  ): Promise<JobBody> {
    const acting = requireAuth(ctx);
    const submitted = await this.generation.submit(
      { workspaceId: acting.workspaceId, userId: acting.userId },
      projectId,
      body?.requirementIds ?? [],
    );
    return toJobBody(submitted.job);
  }

  @Get('jobs/:id')
  async job(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<JobBody> {
    return toJobBody(await this.generation.job(requireAuth(ctx).workspaceId, id));
  }

  /** 202: the request to stop is accepted; the engine stops cooperatively (FR-024). */
  @Post('jobs/:id/cancel')
  @HttpCode(202)
  async cancel(@Req() ctx: WorkspaceContext | undefined, @Param('id') id: string): Promise<JobBody> {
    return toJobBody(await this.generation.cancel(requireAuth(ctx).workspaceId, id));
  }

  @Get('projects/:projectId/jobs')
  async jobs(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
  ): Promise<JobBody[]> {
    const jobs = await this.generation.jobsForProject(requireAuth(ctx).workspaceId, projectId);
    return jobs.map(toJobBody);
  }

  // ---------------------------------------------------------- specifications

  /**
   * The project's specifications — or, when `q` is supplied, a search within
   * the same project scope.
   *
   * One route rather than a second `/search` path: the contract declares this
   * collection, and search is a filter on it. Adding an uncontracted path to
   * express "the same list, narrowed" would be a second surface to keep in
   * step for no gain.
   */
  @Get('projects/:projectId/specifications')
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
    @Query() query: SpecificationListQuery,
  ): Promise<Page<SpecificationRecord> | Page<SpecificationSearchHit>> {
    const { workspaceId } = requireAuth(ctx);
    const term = query?.q?.trim();

    if (term) {
      return this.search.search(workspaceId, {
        term,
        projectId,
        ...(query.lifecycleState ? { lifecycleState: query.lifecycleState as never } : {}),
        ...(query.isOutOfDate === undefined ? {} : { isOutOfDate: query.isOutOfDate === 'true' }),
        ...(toPositiveInt(query.page) === undefined ? {} : { page: toPositiveInt(query.page)! }),
        ...(toPositiveInt(query.pageSize) === undefined
          ? {}
          : { pageSize: toPositiveInt(query.pageSize)! }),
      });
    }

    return this.reads.list(workspaceId, projectId, {
      ...(toPositiveInt(query?.page) === undefined ? {} : { page: toPositiveInt(query.page)! }),
      ...(toPositiveInt(query?.pageSize) === undefined
        ? {}
        : { pageSize: toPositiveInt(query.pageSize)! }),
    });
  }

  @Get('specifications/:id')
  async get(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SpecificationDetail> {
    return this.reads.get(requireAuth(ctx).workspaceId, id);
  }

  @Patch('specifications/:id')
  async patch(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: EditSpecificationInput,
  ): Promise<SpecificationRecord> {
    const acting = requireAuth(ctx);
    return this.reads.edit(
      { workspaceId: acting.workspaceId, userId: acting.userId },
      id,
      stripScope((body ?? {}) as Record<string, unknown>),
    );
  }
}
