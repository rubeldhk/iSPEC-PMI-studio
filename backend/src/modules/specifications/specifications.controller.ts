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
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
// Value imports: these classes are the DI TOKENS the module provides. The
// interfaces above them stay the declared types, so the controller still
// depends on the narrow contract and not on the implementation (PC-1).
import { GenerateSpecificationService } from './generate-specification.service.js';
import { SpecificationSearchService } from './specification-search.service.js';
import { SpecificationsReadService } from './specifications-read.service.js';
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
    // @Inject by token, not by type — twice over. esbuild/tsx emits no
    // design:paramtypes, AND these parameters are INTERFACES, which erase
    // entirely: there is no class for Nest to find even in principle. The
    // module's factory provider for this controller looked like the wiring
    // but is never used — Nest builds controllers from `controllers:` by DI
    // and ignores a same-token entry in `providers:`. Guarded by
    // controller-composition.spec.ts (DEF-001-005).
    @Inject(GenerateSpecificationService) private readonly generation: GenerationJobApi,
    @Inject(SpecificationsReadService) private readonly reads: SpecificationReadApi,
    @Inject(SpecificationSearchService) private readonly search: SpecificationSearchApi,
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

// ---------------------------------------------------------------------------
// T113 + T123 (EPIC-009) — the six lifecycle transitions, the version
// endpoints, and the validation endpoints. Exactly the extension the header
// above reserved: "they extend this same controller when their epics run."
//
// A second @Controller class in the same file, not new methods on the first:
// the generation surface and the lifecycle surface have different service
// dependencies, and keeping them separate keeps each constructor honest.
// ---------------------------------------------------------------------------

import { SpecificationLifecycleService } from './lifecycle-api.service.js';
import type {
  ApproveOutcome,
  SpecificationLifecycleApi,
  ValidationJobBody,
} from './lifecycle-api.service.js';
import type { VersionDiff } from './version-diff.service.js';
import type { StoredFinding } from './validate-specification.service.js';
import type { SpecificationVersionRecord } from './specifications-read.service.js';

@Controller()
export class SpecificationLifecycleController {
  constructor(
    // @Inject by token: esbuild/tsx emits no design:paramtypes (DEF-001-005).
    @Inject(SpecificationLifecycleService)
    private readonly lifecycle: SpecificationLifecycleApi,
  ) {}

  private acting(ctx: WorkspaceContext | undefined): { workspaceId: string; userId: string } {
    const auth = requireAuth(ctx);
    return { workspaceId: auth.workspaceId, userId: auth.userId };
  }

  @Post('specifications/:id/submit-for-review')
  @HttpCode(200)
  async submitForReview(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SpecificationRecord> {
    return this.lifecycle.transition(this.acting(ctx), id, 'review');
  }

  @Post('specifications/:id/reject')
  @HttpCode(200)
  async reject(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SpecificationRecord> {
    // review -> draft: rejection returns it for rework (FR-011).
    return this.lifecycle.transition(this.acting(ctx), id, 'draft');
  }

  @Post('specifications/:id/approve')
  @HttpCode(200)
  async approve(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<ApproveOutcome> {
    // Outstanding findings ride the response (US6 scenario 3).
    return this.lifecycle.approve(this.acting(ctx), id);
  }

  @Post('specifications/:id/baseline')
  @HttpCode(200)
  async baseline(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SpecificationRecord> {
    return this.lifecycle.transition(this.acting(ctx), id, 'baselined');
  }

  @Post('specifications/:id/mark-implemented')
  @HttpCode(200)
  async markImplemented(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SpecificationRecord> {
    return this.lifecycle.transition(this.acting(ctx), id, 'implemented');
  }

  @Post('specifications/:id/archive')
  @HttpCode(200)
  async archive(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SpecificationRecord> {
    // FR-011b: from approved, baselined, or implemented — the guard names the set.
    return this.lifecycle.archive(this.acting(ctx), id);
  }

  @Get('specifications/:id/versions')
  async versions(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SpecificationVersionRecord[]> {
    return this.lifecycle.versions(requireAuth(ctx).workspaceId, id);
  }

  @Get('specifications/:id/versions/:a/diff/:b')
  async diff(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Param('a') a: string,
    @Param('b') b: string,
  ): Promise<VersionDiff> {
    return this.lifecycle.diff(requireAuth(ctx).workspaceId, id, Number(a), Number(b));
  }

  @Get('specifications/:id/findings')
  async findings(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<StoredFinding[]> {
    return this.lifecycle.findings(requireAuth(ctx).workspaceId, id);
  }

  @Post('specifications/:id/jobs/validate')
  @HttpCode(202)
  async validate(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<ValidationJobBody> {
    // Always asynchronous (R-001): a job, never a synchronous result.
    return this.lifecycle.submitValidation(this.acting(ctx), id);
  }
}
