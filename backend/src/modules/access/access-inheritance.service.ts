/**
 * T379 — derived-artifact restriction inheritance (FR-ACC-025).
 *
 * A derived artifact is AT LEAST as restricted as every source it derives
 * from — evaluated on read, not copied on write, so a later restriction on
 * any source propagates. Where sources differ, the MOST RESTRICTIVE wins: a
 * user needs a sufficient grant on ALL sources (clarified 2026-08-08).
 * Derivation never widens access, which is what stops a multi-source
 * artifact laundering it.
 *
 * The restriction model, **inverted in C2E (`X19`)**: an artifact with no
 * active grant rows is **CLOSED**, not open. It previously read "restriction
 * begins the moment the first grant is created", which meant a governed
 * artifact was readable and editable by anyone able to name the workspace
 * until somebody remembered to restrict it — and a newly created
 * specification had no grants at all.
 *
 * Deny-by-default is the whole point: `FR-ACC-024`'s "no grant → absent" now
 * applies to **every** artifact rather than only to ones already restricted.
 * Artifacts are given an owner grant at creation (`T1128`), so "no grants"
 * should be unreachable for anything governed — and where it is reached, it is
 * refused rather than waved through.
 */
import type { ArtifactRef, GrantStore } from './access-grant.service.js';

/** The seam to whatever records derivation (the traceability graph). */
export interface DerivationGraph {
  sourcesOf(workspaceId: string, artifact: ArtifactRef): Promise<ArtifactRef[]>;
}

function key(artifact: ArtifactRef): string {
  return `${artifact.artifactType}:${artifact.artifactId}`;
}

export class AccessInheritanceService {
  constructor(
    private readonly grants: GrantStore,
    private readonly derivations: DerivationGraph,
  ) {}

  /** Direct check on ONE artifact, ignoring derivation. */
  async directlyReadable(workspaceId: string, userId: string, artifact: ArtifactRef): Promise<boolean> {
    const active = await this.grants.activeForArtifact(workspaceId, artifact);
    // No grants means nobody has been given access — not that everybody has.
    if (active.length === 0) return false;
    // edit satisfies read.
    return active.some((g) => g.userId === userId);
  }

  async directlyEditable(workspaceId: string, userId: string, artifact: ArtifactRef): Promise<boolean> {
    const active = await this.grants.activeForArtifact(workspaceId, artifact);
    if (active.length === 0) return false;
    return active.some((g) => g.userId === userId && g.level === 'edit');
  }

  /**
   * FR-ACC-025 — readable only when the artifact itself AND every source,
   * transitively, is readable. A restricted source anywhere in the ancestry
   * hides the derived artifact from anyone lacking a grant on it.
   */
  async effectivelyReadable(
    workspaceId: string,
    userId: string,
    artifact: ArtifactRef,
    seen: Set<string> = new Set(),
  ): Promise<boolean> {
    if (seen.has(key(artifact))) return true; // cycle guard — already vouched for
    seen.add(key(artifact));
    if (!(await this.directlyReadable(workspaceId, userId, artifact))) return false;
    for (const source of await this.derivations.sourcesOf(workspaceId, artifact)) {
      if (!(await this.effectivelyReadable(workspaceId, userId, source, seen))) return false;
    }
    return true;
  }

  /** Edit on the artifact itself, and read on every source — never wider. */
  async effectivelyEditable(workspaceId: string, userId: string, artifact: ArtifactRef): Promise<boolean> {
    if (!(await this.directlyEditable(workspaceId, userId, artifact))) return false;
    for (const source of await this.derivations.sourcesOf(workspaceId, artifact)) {
      if (!(await this.effectivelyReadable(workspaceId, userId, source))) return false;
    }
    return true;
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryDerivationGraph implements DerivationGraph {
  private readonly sources = new Map<string, ArtifactRef[]>();

  derive(derived: ArtifactRef, from: ArtifactRef[]): void {
    this.sources.set(key(derived), from.map((s) => ({ ...s })));
  }

  async sourcesOf(_workspaceId: string, artifact: ArtifactRef): Promise<ArtifactRef[]> {
    return (this.sources.get(key(artifact)) ?? []).map((s) => ({ ...s }));
  }
}
