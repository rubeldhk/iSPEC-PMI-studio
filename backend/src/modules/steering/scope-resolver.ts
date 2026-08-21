/**
 * T230 — scope path resolution and parent validation (FR-ENH-001).
 *
 * `organization → workspace → project → product`, strictly ordered. A scope
 * resolves to a full path from the organization down to itself, and every
 * level must agree with the lineage the caller supplies — a scope that names
 * a ref its lineage does not hold is someone else's scope.
 *
 * Pure: no database, no framework (PC-1). Which is what makes SC-ENH-001
 * testable without generating anything.
 */

export const SCOPE_ORDER = ['organization', 'workspace', 'project', 'product'] as const;

export type SteeringScopeType = (typeof SCOPE_ORDER)[number];

export interface ScopeDescriptor {
  scopeType: SteeringScopeType;
  scopeRef: string;
}

/** The refs a caller's position in the hierarchy actually holds. */
export interface ScopeLineage {
  organizationId: string;
  workspaceId?: string;
  projectId?: string;
  productId?: string;
}

export class InvalidScopePathError extends Error {
  readonly code = 'invalid_scope_path' as const;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidScopePathError';
  }
}

const LINEAGE_KEYS: Record<SteeringScopeType, keyof ScopeLineage> = {
  organization: 'organizationId',
  workspace: 'workspaceId',
  project: 'projectId',
  product: 'productId',
};

/**
 * Resolve a scope to its full path, broadest first, validating that every
 * level above it exists in the lineage and that the scope's own ref is the
 * one the lineage names at that level.
 */
export function resolveScopePath(scope: ScopeDescriptor, lineage: ScopeLineage): ScopeDescriptor[] {
  const depth = SCOPE_ORDER.indexOf(scope.scopeType);
  if (depth === -1) {
    throw new InvalidScopePathError(
      `Unknown scope type "${scope.scopeType}". Scopes are ${SCOPE_ORDER.join(' → ')}.`,
    );
  }

  const path: ScopeDescriptor[] = [];
  for (let level = 0; level <= depth; level++) {
    const scopeType = SCOPE_ORDER[level] as SteeringScopeType;
    const ref = lineage[LINEAGE_KEYS[scopeType]];
    if (ref === undefined || ref === '') {
      throw new InvalidScopePathError(
        `A ${scope.scopeType} scope must resolve to a parent at every level above it; ` +
          `the lineage names no ${scopeType}.`,
      );
    }
    path.push({ scopeType, scopeRef: ref });
  }

  const self = path[depth];
  if (self === undefined || self.scopeRef !== scope.scopeRef) {
    throw new InvalidScopePathError(
      `Scope ref "${scope.scopeRef}" is not the ${scope.scopeType} this lineage holds.`,
    );
  }
  return path;
}

/** True when `a` is strictly narrower (deeper) than `b`. */
export function isNarrowerThan(a: SteeringScopeType, b: SteeringScopeType): boolean {
  return SCOPE_ORDER.indexOf(a) > SCOPE_ORDER.indexOf(b);
}
