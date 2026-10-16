/**
 * `T2306` (EPIC-048) — claimed and approved scope (`FR-LRN-014`, `FR-LRN-028`).
 *
 * A claimed scope is a **proposal**, not a grant. A reviewer may narrow it and
 * never widen it in the same decision; widening is its own candidate
 * (`widen-scope`), decided by a human (`FR-LRN-042`).
 *
 * The order is project ⊆ projects ⊆ workspace, by set inclusion over the
 * project ids — `workspace` standing for every project of the workspace.
 */
import type { ScopeKind } from './states.js';

export type ClaimedScope =
  | { readonly kind: 'project'; readonly projectIds: readonly [string] }
  | { readonly kind: 'workspace'; readonly projectIds: readonly [] }
  | { readonly kind: 'projects'; readonly projectIds: readonly [string, string, ...string[]] };

export type ScopeProblem = string;

/**
 * Validate an unknown value as a scope. Never throws.
 *
 * `project` names exactly one id; `projects` at least two distinct ids;
 * `workspace` none (an absent `projectIds` is read as none).
 */
export function parseScope(value: unknown): { ok: true; value: ClaimedScope } | { ok: false; problem: ScopeProblem } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, problem: 'scope must be an object {kind, projectIds}' };
  }
  const raw = value as { kind?: unknown; projectIds?: unknown };
  const kind = raw.kind;
  const idsRaw = raw.projectIds ?? [];
  if (!Array.isArray(idsRaw) || idsRaw.some((id) => typeof id !== 'string' || id.trim() === '')) {
    return { ok: false, problem: 'projectIds must be a list of project ids' };
  }
  const ids = idsRaw as string[];
  if (kind === 'project') {
    if (ids.length !== 1) return { ok: false, problem: 'a project scope names exactly one project' };
    return { ok: true, value: { kind, projectIds: [ids[0]!] } };
  }
  if (kind === 'workspace') {
    if (ids.length !== 0) return { ok: false, problem: 'a workspace scope names no project' };
    return { ok: true, value: { kind, projectIds: [] } };
  }
  if (kind === 'projects') {
    const distinct = [...new Set(ids)];
    if (distinct.length !== ids.length) return { ok: false, problem: 'a named set may not repeat a project' };
    if (distinct.length < 2) return { ok: false, problem: 'a named set names at least two projects' };
    return { ok: true, value: { kind, projectIds: distinct as unknown as readonly [string, string, ...string[]] } };
  }
  return { ok: false, problem: `scope kind must be one of project, workspace, projects` };
}

export function scopeKindOf(scope: ClaimedScope): ScopeKind {
  return scope.kind;
}

/** Whether `scope` covers `projectId`. A workspace scope covers every project. */
export function scopeIncludesProject(scope: ClaimedScope, projectId: string): boolean {
  if (scope.kind === 'workspace') return true;
  return (scope.projectIds as readonly string[]).includes(projectId);
}

/**
 * `narrower ⊆ wider` — `FR-LRN-028`. Reflexive. Nothing is narrower than or
 * equal to a scope that excludes one of its projects.
 */
export function isNarrowerOrEqual(narrower: ClaimedScope, wider: ClaimedScope): boolean {
  if (wider.kind === 'workspace') return true;
  if (narrower.kind === 'workspace') return false;
  const widerIds = new Set<string>(wider.projectIds);
  return (narrower.projectIds as readonly string[]).every((id) => widerIds.has(id));
}

/** `candidate ⊋ current` — a `widen-scope` candidate must be strictly wider (`FR-LRN-042`). */
export function isStrictlyWider(candidate: ClaimedScope, current: ClaimedScope): boolean {
  return isNarrowerOrEqual(current, candidate) && !isNarrowerOrEqual(candidate, current);
}

/** A stable, human-readable rendering — used in admission details and inclusion notes. */
export function describeScope(scope: ClaimedScope): string {
  if (scope.kind === 'workspace') return 'workspace';
  if (scope.kind === 'project') return `project ${scope.projectIds[0]}`;
  return `projects ${[...scope.projectIds].sort().join(',')}`;
}
