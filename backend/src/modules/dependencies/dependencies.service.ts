/**
 * T256 — the dependency service (FR-ENH-008, FR-ENH-011).
 *
 * A cycle-forming edge is refused BEFORE storage — direct, two-hop, and
 * multi-hop alike, via the pure detector over the workspace's current edge
 * set. Framework-free (PC-1); persistence behind a port.
 */
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { wouldCreateCycle, type ArtifactNode } from './cycle-detector.js';

const OPAQUE = 'Not found.';

export type ArtifactRef = ArtifactNode;

export interface DependencyEdgeRecord {
  id: string;
  workspaceId: string;
  source: ArtifactRef;
  target: ArtifactRef;
  dependencyType: string;
  createdById: string;
}

export interface DependencyStore {
  append(edge: DependencyEdgeRecord): Promise<DependencyEdgeRecord>;
  findById(id: string): Promise<DependencyEdgeRecord | null>;
  listForWorkspace(workspaceId: string): Promise<DependencyEdgeRecord[]>;
  remove(id: string): Promise<void>;
}

/** Optional endpoint-existence check: both ends must live in the workspace. */
export interface ArtifactDirectoryPort {
  exists(workspaceId: string, ref: ArtifactRef): Promise<boolean>;
}

export interface CreateEdgeInput {
  source: ArtifactRef;
  target: ArtifactRef;
  dependencyType: string;
}

let seq = 0;

export class DependenciesService {
  constructor(
    private readonly store: DependencyStore,
    private readonly options: { artifacts?: ArtifactDirectoryPort } = {},
  ) {}

  async create(
    workspaceId: string,
    input: CreateEdgeInput,
    createdById: string,
  ): Promise<DependencyEdgeRecord> {
    const { source, target } = input;
    if (source.artifactType === target.artifactType && source.artifactId === target.artifactId) {
      throw new ValidationFailedError('An artifact cannot depend on itself.');
    }
    if (this.options.artifacts) {
      const [sourceOk, targetOk] = await Promise.all([
        this.options.artifacts.exists(workspaceId, source),
        this.options.artifacts.exists(workspaceId, target),
      ]);
      // Absent and another tenant's artifact are the same opaque answer.
      if (!sourceOk || !targetOk) throw new NotFoundError(OPAQUE);
    }

    const edges = await this.store.listForWorkspace(workspaceId);
    if (
      edges.some(
        (e) =>
          e.source.artifactType === source.artifactType &&
          e.source.artifactId === source.artifactId &&
          e.target.artifactType === target.artifactType &&
          e.target.artifactId === target.artifactId,
      )
    ) {
      throw new ConflictError('This dependency already exists.');
    }
    // FR-ENH-011 — refused BEFORE storage, on the path, not only the edge.
    if (wouldCreateCycle(edges, { source, target })) {
      throw new ValidationFailedError(
        'This edge would create a circular dependency and was refused.',
      );
    }

    return this.store.append({
      id: `de_${++seq}_${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      source,
      target,
      dependencyType: input.dependencyType,
      createdById,
    });
  }

  async listForArtifact(
    workspaceId: string,
    ref: ArtifactRef,
  ): Promise<{ outgoing: DependencyEdgeRecord[]; incoming: DependencyEdgeRecord[] }> {
    const edges = await this.store.listForWorkspace(workspaceId);
    return {
      outgoing: edges.filter(
        (e) => e.source.artifactType === ref.artifactType && e.source.artifactId === ref.artifactId,
      ),
      incoming: edges.filter(
        (e) => e.target.artifactType === ref.artifactType && e.target.artifactId === ref.artifactId,
      ),
    };
  }

  /** Sources of edges pointing AT the ref — who depends on it, one hop. */
  async directDependents(workspaceId: string, ref: ArtifactRef): Promise<ArtifactRef[]> {
    return (await this.listForArtifact(workspaceId, ref)).incoming.map((e) => e.source);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const edge = await this.store.findById(id);
    if (!edge || edge.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    await this.store.remove(id);
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryDependencyStore implements DependencyStore {
  private readonly rows: DependencyEdgeRecord[] = [];

  async append(edge: DependencyEdgeRecord): Promise<DependencyEdgeRecord> {
    this.rows.push({ ...edge });
    return { ...edge };
  }

  async findById(id: string): Promise<DependencyEdgeRecord | null> {
    const hit = this.rows.find((r) => r.id === id);
    return hit ? { ...hit } : null;
  }

  async listForWorkspace(workspaceId: string): Promise<DependencyEdgeRecord[]> {
    return this.rows.filter((r) => r.workspaceId === workspaceId).map((r) => ({ ...r }));
  }

  async remove(id: string): Promise<void> {
    const at = this.rows.findIndex((r) => r.id === id);
    if (at !== -1) this.rows.splice(at, 1);
  }
}
