/**
 * T016 — the tenancy guard.
 *
 * FR-002 / SC-004. Cross-workspace access and a genuinely missing resource
 * produce an IDENTICAL outcome, because returning 403 for the first would
 * confirm the resource exists.
 *
 * Every refusal is recorded before the error is thrown (FR-033) — the blocked
 * attempts are exactly the ones worth having in an audit trail.
 */
import { NotFoundError } from './errors.js';

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
}

export interface RefusalRecord {
  workspaceId: string;
  targetType: string;
  outcome: 'refused';
}

export interface GuardOptions {
  onRefused?: (record: RefusalRecord) => void;
  targetType?: string;
}

/** One message for both cases. Do not make this more specific. */
const OPAQUE = 'Not found.';

export function assertSameWorkspace(
  actingWorkspaceId: string,
  resource: { workspaceId: string } | null | undefined,
  options: GuardOptions = {},
): void {
  const permitted = resource != null && resource.workspaceId === actingWorkspaceId;
  if (permitted) return;

  options.onRefused?.({
    workspaceId: actingWorkspaceId,
    targetType: options.targetType ?? 'unknown',
    outcome: 'refused',
  });

  throw new NotFoundError(OPAQUE);
}

export function requireWorkspaceContext(ctx: WorkspaceContext | undefined | null): string {
  if (!ctx?.workspaceId) throw new NotFoundError(OPAQUE);
  return ctx.workspaceId;
}
