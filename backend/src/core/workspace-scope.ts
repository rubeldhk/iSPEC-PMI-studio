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

/**
 * T456 — FR-003. A project scope is missing, and running unscoped would leak.
 *
 * Separate from `MissingWorkspaceScopeError` because they mean different
 * things: one is a tenancy fault, the other is a content-isolation fault
 * inside a tenant. A caller that catches "missing scope" generically would
 * otherwise treat a cross-tenant read and a cross-project read as one event.
 */
export class MissingProjectScopeError extends Error {
  constructor() {
    super('A project scope is required. Refusing to run a query that spans projects.');
    this.name = 'MissingProjectScopeError';
  }
}

function assertScope(workspaceId: string): asserts workspaceId is string {
  if (!workspaceId || workspaceId.trim() === '') throw new MissingWorkspaceScopeError();
}

function assertProjectScope(projectId: string): asserts projectId is string {
  if (!projectId || projectId.trim() === '') throw new MissingProjectScopeError();
}

export interface ScopedQuery {
  where: Record<string, unknown> & { workspaceId: string };
  [option: string]: unknown;
}

/** A read scoped to one project *within* one workspace — both, never either. */
export interface ProjectScopedQuery extends ScopedQuery {
  where: Record<string, unknown> & { workspaceId: string; projectId: string };
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

/**
 * T456 — apply project scoping **alongside** workspace scoping (FR-003).
 *
 * Built on `scoped()` rather than beside it, deliberately. The tempting
 * implementation filters on `projectId` alone, reasoning that a project belongs
 * to exactly one workspace so the workspace filter is redundant. It is not:
 * tenancy is enforced by the filter, never by an id's provenance. The moment a
 * project id is guessed, leaked in a URL, or copied between environments, a
 * project-only query reaches another tenant's content with no boundary at all.
 *
 * Delegating means the workspace scope cannot be dropped here without deleting
 * a call — and `scoped()` has enforced the override rule since `T014`.
 *
 * Ordering is the same as its parent: caller filters first, scope last, so the
 * scope always wins.
 */
export function projectScoped(
  workspaceId: string,
  projectId: string,
  query: QueryLike = {},
): ProjectScopedQuery {
  // Workspace first: an unscoped tenancy read is the graver fault, and a caller
  // that supplied neither should hear about that one.
  assertScope(workspaceId);
  assertProjectScope(projectId);

  const base = scoped(workspaceId, query);
  return { ...base, where: { ...base.where, projectId } };
}

/**
 * T456 — the write counterpart.
 *
 * A row is only reachable by `projectScoped()` because something stamped a
 * `projectId` on it. Without this, every caller sets both ids by hand, which is
 * exactly the error `scopedCreate` was written to remove — and a row missing
 * either id is invisible to every scoped read rather than loudly wrong.
 */
export function projectScopedCreate<T extends Record<string, unknown>>(
  workspaceId: string,
  projectId: string,
  data: T,
): T & { workspaceId: string; projectId: string } {
  assertScope(workspaceId);
  assertProjectScope(projectId);
  return { ...scopedCreate(workspaceId, data), projectId };
}

/** Run work under an asserted scope. */
export async function withWorkspace<T>(
  workspaceId: string,
  fn: (workspaceId: string) => Promise<T>,
): Promise<T> {
  assertScope(workspaceId);
  return fn(workspaceId);
}
