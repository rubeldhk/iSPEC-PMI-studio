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
 * The restriction model: an artifact with NO active grant rows is OPEN —
 * restriction begins the moment the first grant is created. FR-ACC-024's
 * "no grant → absent" applies to restricted artifacts.
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
    // Open artifact — no grants means no restriction yet.
    if (active.length === 0) return true;
    // edit satisfies read.
    return active.some((g) => g.userId === userId);
  }

  async directlyEditable(workspaceId: string, userId: string, artifact: ArtifactRef): Promise<boolean> {
    const active = await this.grants.activeForArtifact(workspaceId, artifact);
    if (active.length === 0) return true;
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
