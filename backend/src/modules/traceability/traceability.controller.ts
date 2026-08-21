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
// Value imports: these classes are the DI TOKENS the module provides. The
// interfaces/types stay the declared shapes, so the controller still depends on
// the narrow contract and not on the implementation (PC-1, DEF-001-005).
import { CoverageService } from './coverage.service.js';
import type { CoverageReport } from './coverage.service.js';
import { flagRetiredLinks, type RequirementStatusSource } from './retired-flag.js';
import { TraceabilityService } from './traceability.service.js';
import type { ForwardTrace, SpecificationTrace } from './traceability.service.js';
import { ChainTraversalService } from './chain-traversal.service.js';
import type { ChainTraversalResult } from './chain-traversal.service.js';
import { ChainGapService } from './chain-gap.service.js';
import type { ChainGapReport } from './chain-gap.service.js';
import type { TraceArtifactType } from './link-writer.service.js';

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
    // @Inject by token: esbuild/tsx emits no `design:paramtypes`, so a
    // class-typed parameter resolves to undefined at runtime (DEF-001-005).
    @Inject(TraceabilityService) private readonly trace: TraceabilityService,
    @Inject(CoverageService) private readonly coverage: CoverageService,
    @Optional()
    @Inject(REQUIREMENT_STATUS_SOURCE)
    private readonly statuses: RequirementStatusSource = new AllActiveRequirementStatusSource(),
    // EPIC-022 T307 — optional with empty-graph defaults so constructions
    // that predate the chain stay valid; the MODULE injects the real store.
    @Optional()
    @Inject(ChainTraversalService)
    private readonly chainTraversal: ChainTraversalService = new ChainTraversalService({
      linksForWorkspace: async () => [],
    }),
    @Optional()
    @Inject(ChainGapService)
    private readonly chainGaps_: ChainGapService = new ChainGapService({
      linksForWorkspace: async () => [],
    }),
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

  // ---------------------------------------------------- EPIC-022 T307

  /** Full-chain traversal, either direction (FR-ENH-021). */
  @Get('artifacts/:type/:id/chain')
  async chain(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<{ up: ChainTraversalResult; down: ChainTraversalResult }> {
    const workspaceId = requireAuth(ctx).workspaceId;
    const start = { artifactType: type as TraceArtifactType, artifactId: id };
    const [up, down] = await Promise.all([
      this.chainTraversal.traverse(workspaceId, start, 'up'),
      this.chainTraversal.traverse(workspaceId, start, 'down'),
    ]);
    return { up, down };
  }

  /** First-missing-link report — never a silently shortened chain (FR-ENH-022). */
  @Get('artifacts/:type/:id/chain-gaps')
  async chainGaps(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<ChainGapReport> {
    return this.chainGaps_.report(requireAuth(ctx).workspaceId, {
      artifactType: type as TraceArtifactType,
      artifactId: id,
    });
  }
}
