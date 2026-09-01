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
 * ## The routes refuse in this deployment, and say which seam is unbound
 *
 * `EmbeddingPort` has no owner anywhere in the programme (`FR-CTX-013`), and
 * `AccessPolicy` is bound in `T1258`. Until then `POST /context/packages`
 * answers `503` **naming the seam**, because a 503 saying nothing is the same
 * defect with a better number.
 */
import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import { UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { AssemblyService, type AssembleInput } from './assembly.service.js';
import { CONTEXT_STORE } from './context.tokens.js';
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
      projectId: String(rest.projectId ?? ''),
      objective: String(rest.objective ?? ''),
      budgetTokens: Number(rest.budgetTokens ?? 0),
      budgetCost: Number(rest.budgetCost ?? 0),
      // `FR-CTX-038` — absent means nothing was marked essential, which is a
      // different thing from marking nothing and is treated the same way.
      essentialSources: rest.essentialSources ?? [],
      workspaceId: principal.workspaceId,
      actorId: principal.userId,
      actorRole: principal.role,
    });
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
