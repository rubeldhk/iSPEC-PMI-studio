/**
 * T260 — the impact query with a configured depth bound (FR-ENH-009/010,
 * R-017-5: a bounded recursive traversal, not a materialised closure table).
 *
 * One request returns EVERY affected artifact with its path and distance
 * (SC-ENH-002); a truncated result carries `bounded = true`, never a silent
 * shortening. An optional status port marks dependents that rest on retired
 * or archived artifacts (T261).
 */
import { buildImpactPaths, type ImpactResult } from './impact-path.js';
import type { ArtifactRef, DependencyStore } from './dependencies.service.js';

export const DEFAULT_IMPACT_DEPTH = 25;

export interface ArtifactStatusPort {
  /** 'active' | 'retired' | 'archived' — anything non-active is flagged. */
  statusOf(workspaceId: string, ref: ArtifactRef): Promise<string>;
}

export interface FlaggedImpactResult extends ImpactResult {
  affected: (ImpactResult['affected'][number] & { flag?: string })[];
}

export class ImpactService {
  private readonly maxDepth: number;

  constructor(
    private readonly store: DependencyStore,
    private readonly options: { maxDepth?: number; statuses?: ArtifactStatusPort } = {},
  ) {
    this.maxDepth = options.maxDepth ?? DEFAULT_IMPACT_DEPTH;
  }

  async impact(workspaceId: string, changed: ArtifactRef): Promise<FlaggedImpactResult> {
    const edges = await this.store.listForWorkspace(workspaceId);
    const result = buildImpactPaths(
      edges.map((e) => ({ source: e.source, target: e.target })),
      changed,
      { maxDepth: this.maxDepth },
    );

    if (!this.options.statuses) return result;

    // A dependency on a retired or archived artifact is RETURNED AND MARKED,
    // never omitted — the same rule EPIC-011 applies to retired links.
    const affected = await Promise.all(
      result.affected.map(async (entry) => {
        const status = await this.options.statuses!.statusOf(workspaceId, entry.artifact);
        return status === 'active' ? entry : { ...entry, flag: status };
      }),
    );
    return { affected, bounded: result.bounded };
  }
}
