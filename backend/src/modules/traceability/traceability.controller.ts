/**
 * T133 — trace and coverage endpoints per contracts/platform-api.md
 * (Traceability · US7).
 *
 * Read-only: the graph is WRITTEN by generation (T081), never by hand. The
 * paired test asserts no write route exists.
 *
 * PC-1: a transport.
 */
import { Controller, Get, Inject, Optional, Param, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import type { CoverageReport, CoverageService } from './coverage.service.js';
import { flagRetiredLinks, type RequirementStatusSource } from './retired-flag.js';
import type {
  ForwardTrace,
  SpecificationTrace,
  TraceabilityService,
} from './traceability.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

export const REQUIREMENT_STATUS_SOURCE = Symbol('REQUIREMENT_STATUS_SOURCE');

/** US7/4 on the wire: requirements carry their retirement flag. */
export interface FlaggedReverseTrace {
  taskId: string;
  specifications: {
    specificationId: string;
    requirements: { requirementId: string; retired: boolean }[];
  }[];
}

/**
 * The default until the composition root wires the requirements store:
 * everything reads active. Deliberately visible in the module header — an
 * unflagged retired link in a COMPOSED deployment means this default was
 * never replaced.
 */
export class AllActiveRequirementStatusSource implements RequirementStatusSource {
  async statusOf(_workspaceId: string, ids: string[]): Promise<Map<string, 'active' | 'retired'>> {
    return new Map(ids.map((id) => [id, 'active' as const]));
  }
}

@Controller()
export class TraceabilityController {
  constructor(
    private readonly trace: TraceabilityService,
    private readonly coverage: CoverageService,
    @Optional()
    @Inject(REQUIREMENT_STATUS_SOURCE)
    private readonly statuses: RequirementStatusSource = new AllActiveRequirementStatusSource(),
  ) {}

  @Get('requirements/:id/trace')
  async requirementTrace(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<ForwardTrace> {
    return this.trace.forwardTrace(requireAuth(ctx).workspaceId, id);
  }

  @Get('tasks/:id/trace')
  async taskTrace(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<FlaggedReverseTrace> {
    const workspaceId = requireAuth(ctx).workspaceId;
    const reverse = await this.trace.reverseTrace(workspaceId, id);
    // T131: links to retired requirements are returned FLAGGED (US7/4).
    const specifications = await Promise.all(
      reverse.specifications.map(async (spec) => {
        const flagged = await flagRetiredLinks(
          workspaceId,
          spec.requirementIds.map((requirementId) => ({
            targetType: 'requirement' as const,
            targetId: requirementId,
          })),
          this.statuses,
        );
        return {
          specificationId: spec.specificationId,
          requirements: flagged.map((f) => ({ requirementId: f.targetId, retired: f.retired })),
        };
      }),
    );
    return { taskId: reverse.taskId, specifications };
  }

  @Get('specifications/:id/trace')
  async specificationTrace(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<SpecificationTrace> {
    return this.trace.bothFor(requireAuth(ctx).workspaceId, id);
  }

  @Get('projects/:projectId/coverage')
  async projectCoverage(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
  ): Promise<CoverageReport> {
    return this.coverage.forProject(requireAuth(ctx).workspaceId, projectId);
  }
}
