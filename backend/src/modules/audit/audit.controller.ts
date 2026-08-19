import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import { AUDIT_READER } from './audit.tokens.js';
import { scoped } from '../../core/workspace-scope.js';
import { requireWorkspaceContext, type WorkspaceContext } from '../../core/workspace.guard.js';

/**
 * T030 — read-only `/v1/audit`.
 *
 * FR-033: there is deliberately no create, update, or delete route. The only
 * method on this class is `list` — asserted by T029a, so adding a write route
 * fails a test rather than passing review.
 *
 * PC-1: this is a transport. It delegates and scopes; it holds no logic.
 */

export interface AuditReader {
  list(query: { where: Record<string, unknown> }): Promise<unknown[]>;
}

export interface AuditListFilters {
  targetType?: string;
  actorId?: string;
  action?: string;
  /** Deliberately ignored — see below. */
  workspaceId?: string;
}

@Controller('audit')
export class AuditController {
  // T674 — injected BY TOKEN. `AuditReader` is an interface and erases at
  // compile time, so Nest has no metadata to resolve and would fail to
  // instantiate this controller. Asserting the module's metadata alone would
  // not have caught that: the wiring looks right and the container still
  // cannot build it.
  constructor(@Inject(AUDIT_READER) private readonly reader: AuditReader) {}

  @Get()
  async list(
    @Req() ctx: WorkspaceContext | undefined,
    @Query() filters: AuditListFilters,
  ): Promise<unknown[]> {
    const workspaceId = requireWorkspaceContext(ctx);
    // `scoped` applies workspaceId LAST, so a caller-supplied one cannot widen
    // the query.
    const { workspaceId: _ignored, ...safeFilters } = filters;
    return this.reader.list(scoped(workspaceId, { where: { ...safeFilters } }));
  }
}
