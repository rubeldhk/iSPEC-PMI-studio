/**
 * `T1243`, `T1246` (EPIC-038) — the callable surface.
 *
 * PC-1: a transport. Every capability lives in a service and is reachable
 * without HTTP; this file decides only what a caller may say and what the
 * session decides for them.
 *
 * ## What the session decides, and why the body cannot
 *
 * `actorId` and `actorRole` are the permissions a package was filtered against
 * (`FR-CTX-031`). A body-supplied actor would let one person assemble a package
 * under another's permissions and have the record say so — the package would be
 * internally consistent and describe something that did not happen.
 *
 * So they are stripped from the body before the service sees them, and taken
 * from the resolved session. `strip` changes no outcome on its own — the values
 * are overwritten anyway — but it states the rule where a reader looks first,
 * which is what `DEF-033-001` was missing when a body looked authoritative
 * because nothing visibly took it away.
 *
 * ## Assembly refuses in this deployment, and says which seam is unbound
 *
 * `EmbeddingPort` has no owner anywhere in the programme (`FR-CTX-013`), so
 * `POST /context/packages` answers `503` **naming the seam**, because a 503
 * saying nothing is the same defect with a better number. `AccessPolicy` is
 * `EPIC-024`'s and is bound (`T1258`).
 *
 * The inspection routes do not depend on that seam: they read what was stored,
 * and are served by a service that has no assembler (`FR-CTX-063`).
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { NotFoundError, UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { AssemblyService, type AssembleInput } from './assembly.service.js';
import { CONTEXT_SOURCES, CONTEXT_STORE } from './context.tokens.js';
import { InspectionService, type Inspection, type SourceVersionReader } from './inspection.service.js';
import { IndexService, type IndexHealth } from './retrieval/index.service.js';
import type { ContextStore } from './context.store.js';

interface ActingPrincipal {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: string;
}

/** A product endpoint with no session is 401 — the local helper the siblings carry. */
function requireAuth(ctx: WorkspaceContext | undefined | null): ActingPrincipal {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    // The role the package records as having filtered it. Falls back to a
    // stated placeholder rather than an empty string: `FR-CTX-031` requires the
    // role to be recorded, and `''` would record that nobody had one.
    role: (ctx as { role?: string }).role ?? 'unspecified',
  };
}

/**
 * Identity fields a body may not smuggle in.
 *
 * Overwritten from the session below, so stripping changes no outcome — it is
 * the same rule stated where a reader looks first.
 */
function strip(body: unknown): Record<string, unknown> {
  const {
    workspaceId: _ws,
    actorId: _actor,
    actorRole: _role,
    ...safe
  } = (body ?? {}) as Record<string, unknown>;
  return safe;
}

/** What a caller may supply. Everything the session decides is absent from the type. */
type AssembleRest = Omit<AssembleInput, 'workspaceId' | 'actorId' | 'actorRole'>;

@Controller()
export class ContextController {
  constructor(
    // @Inject by token: esbuild/tsx emits no `design:paramtypes` (DEF-001-005).
    @Inject(AssemblyService) private readonly assembly: AssemblyService,
    @Inject(CONTEXT_STORE) private readonly store: ContextStore,
    @Inject(InspectionService) private readonly inspection: InspectionService,
    @Inject(IndexService) private readonly index: IndexService,
    @Inject(CONTEXT_SOURCES) private readonly versions: SourceVersionReader,
  ) {}

  /**
   * `FR-CTX-030`–`FR-CTX-039` — assemble a package.
   *
   * `503` while `EmbeddingPort` is unowned, `400` for a stated refusal a caller
   * can act on. No path degrades: a package assembled without ranking, without
   * an access adjudicator or without a corpus would be wrong rather than
   * smaller, and a wrong package is one nobody can tell is wrong.
   */
  @Post('context/packages')
  assemblePackage(
    @Req() ctx: WorkspaceContext | undefined,
    @Body() body: unknown,
  ): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body) as Partial<AssembleRest>;
    return this.assembly.assemble({
      // `T1859` — passed as given; the service type-checks. `String(x ?? '')`
      // stored "[object Object]" as an objective.
      projectId: (rest.projectId ?? '') as string,
      objective: (rest.objective ?? '') as string,
      // `T1849` — passed as given and validated by the service. `Number(x ?? 0)`
      // turned a missing budget into zero and `true` into one: a budget nobody
      // stated, recorded as if somebody had.
      budgetTokens: rest.budgetTokens as number,
      budgetCost: rest.budgetCost as number,
      // `FR-CTX-038` — absent means nothing was marked essential, which is a
      // different thing from marking nothing and is treated the same way.
      essentialSources: rest.essentialSources === undefined ? [] : (rest.essentialSources as AssembleInput['essentialSources']),
      // `FR-CTX-020` — opt-in, and only an explicit `true` opts in.
      includeLiveState: rest.includeLiveState === true,
      // `FR-CTX-062` — the execution this feeds, when the caller has one. The
      // foreign key to `executions` refuses an id that names nothing.
      // `T1859` — a non-text id is refused by the service, never dropped.
      ...(rest.executionId !== undefined && rest.executionId !== null && rest.executionId !== ''
        ? { executionId: rest.executionId as string }
        : {}),
      workspaceId: principal.workspaceId,
      actorId: principal.userId,
      actorRole: principal.role,
    });
  }

  /**
   * `FR-CTX-062` — the packages one execution was given.
   *
   * `executionId` is required, and its absence is a `400` naming it: a
   * workspace-wide listing would become the thing people page through instead
   * of the audit path.
   */
  @Get('context/packages')
  packagesForExecution(
    @Req() ctx: WorkspaceContext | undefined,
    @Query('executionId') executionId: string | undefined,
  ): Promise<Inspection[]> {
    const principal = requireAuth(ctx);
    return this.inspection.forExecution(principal.workspaceId, executionId ?? '');
  }

  /**
   * `FR-CTX-060`, `FR-CTX-063` — one package as supplied. `404` for another
   * workspace's package: absent rather than forbidden (`FR-002`).
   */
  @Get('context/packages/:id')
  async package(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
  ): Promise<Inspection> {
    const principal = requireAuth(ctx);
    const found = await this.inspection.inspect(principal.workspaceId, id);
    if (found === null) throw new NotFoundError('Not found.');
    return found;
  }

  /**
   * `T1830`, `FR-CTX-062` — bind a package assembled ahead of its execution,
   * once. `404` for another workspace's package, `409` if already bound to a
   * different execution, `400` for an execution `EPIC-037` has not registered.
   */
  @Post('context/packages/:id/execution')
  @HttpCode(200)
  async bindExecution(
    @Req() ctx: WorkspaceContext | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Inspection> {
    const principal = requireAuth(ctx);
    const rest = strip(body);
    await this.assembly.bindExecution(principal.workspaceId, id, String(rest['executionId'] ?? ''));
    const bound = await this.inspection.inspect(principal.workspaceId, id);
    if (bound === null) throw new NotFoundError('Not found.');
    return bound;
  }

  /**
   * `FR-CTX-018`, `R-038-6` — re-index ONE source. `200` whether it was
   * indexed or already current; there is deliberately no rebuild-all route.
   */
  @Post('context/index/reindex')
  @HttpCode(200)
  reindex(@Req() ctx: WorkspaceContext | undefined, @Body() body: unknown): Promise<unknown> {
    const principal = requireAuth(ctx);
    const rest = strip(body);
    return this.index.reindex({
      workspaceId: principal.workspaceId,
      sourceType: String(rest['sourceType'] ?? ''),
      sourceId: String(rest['sourceId'] ?? ''),
      sourceVersion: String(rest['sourceVersion'] ?? ''),
    });
  }

  /**
   * `FR-CTX-012`, `FR-CTX-017` — what the index knows about itself. The stale
   * count is the point, and is `null` with a reason when it cannot be known.
   */
  @Get('context/index/health')
  health(@Req() ctx: WorkspaceContext | undefined): Promise<IndexHealth> {
    const principal = requireAuth(ctx);
    return this.index.health(principal.workspaceId, this.versions);
  }

  /**
   * `FR-CTX-015`, `FR-CTX-036` — the approved source set and its classes.
   *
   * Exists so *"why is my document never retrieved"* is answerable without
   * reading configuration files. A capability whose rules are only visible to
   * whoever can open the repository is one people work around.
   */
  @Get('context/sources')
  sources(@Req() ctx: WorkspaceContext | undefined): Promise<unknown> {
    const principal = requireAuth(ctx);
    return this.store.sourceClassesFor(principal.workspaceId);
  }
}
