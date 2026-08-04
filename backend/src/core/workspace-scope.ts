/**
 * T014 — the workspace-scoping helper.
 *
 * FR-002 / SC-004. Every repository read goes through here. The scope is
 * applied LAST and overrides anything the caller supplied, so a caller cannot
 * widen or redirect its own tenancy — accidentally or otherwise.
 *
 * Framework-free (PC-1): no HTTP, no ORM import. It shapes a query object.
 */

export class MissingWorkspaceScopeError extends Error {
  constructor() {
    super('A workspace scope is required. Refusing to run an unscoped query.');
    this.name = 'MissingWorkspaceScopeError';
  }
}

function assertScope(workspaceId: string): asserts workspaceId is string {
  if (!workspaceId || workspaceId.trim() === '') throw new MissingWorkspaceScopeError();
}

export interface ScopedQuery {
  where: Record<string, unknown> & { workspaceId: string };
  [option: string]: unknown;
}

export interface QueryLike {
  where?: Record<string, unknown>;
  [option: string]: unknown;
}

/**
 * Apply tenancy to a read.
 *
 * Note the ordering: `...query.where` first, `workspaceId` last. If a caller
 * passes `where: { workspaceId: 'someone-else' }`, ours wins.
 */
export function scoped(workspaceId: string, query: QueryLike = {}): ScopedQuery {
  assertScope(workspaceId);
  const { where, ...rest } = query;
  return { ...rest, where: { ...(where ?? {}), workspaceId } };
}

/** Apply tenancy to a write. Same override rule. */
export function scopedCreate<T extends Record<string, unknown>>(
  workspaceId: string,
  data: T,
): T & { workspaceId: string } {
  assertScope(workspaceId);
  return { ...data, workspaceId };
}

/** Run work under an asserted scope. */
export async function withWorkspace<T>(
  workspaceId: string,
  fn: (workspaceId: string) => Promise<T>,
): Promise<T> {
  assertScope(workspaceId);
  return fn(workspaceId);
}
