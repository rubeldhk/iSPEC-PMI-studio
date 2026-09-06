/**
 * `T1636` (EPIC-045, `R-045-4`) — the port through which a synced `spec.md`
 * becomes the Epic's specification.
 *
 * The artifacts module owns this **interface**; the specifications module owns
 * the implementation (`specifications/specification-sync.service.ts`). So the
 * dependency runs one way — artifacts → specifications — and the specification
 * entity keeps its own module's invariants, notably that versions are appended
 * and never rewritten.
 *
 * ## Why a port and not `commitGeneration`
 *
 * The obvious reuse would be the generation path: it already creates a
 * specification and its first version. It also writes a **generation job**, and
 * a job row describing an engine invocation that never happened is a lie in the
 * ledger that other Epics read. Provenance here comes from the execution's
 * agent identity snapshot — a fact about what actually produced the file — or
 * from the connector when the execution carries no snapshot.
 *
 * The in-memory implementation below is for unit suites and database-less runs;
 * it is the same shape, not a simplification of it.
 */
import { randomUUID } from 'node:crypto';

export interface SpecificationProvenance {
  /** The adapter that produced the file, or `connector` when the execution carries no agent snapshot. */
  readonly engineName: string;
  /** The agent version, or the model, or the contract version — whichever the snapshot offers. */
  readonly engineVersion: string;
}

export interface SpecificationSyncInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly epicId: string;
  readonly sourcePath: string;
  readonly title: string;
  readonly contentRaw: string;
  /** The output parser's result; `{ parsed: false }` when it could not parse. */
  readonly contentParsed?: Record<string, unknown> | undefined;
  /** The execution's initiator. */
  readonly createdById: string;
  readonly ownerUserId: string;
  readonly provenance: SpecificationProvenance;
}

export interface SyncedSpecification {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly epicId: string | null;
  readonly sourcePath: string | null;
  readonly title: string;
  readonly lifecycleState: string;
  readonly engineName: string;
  readonly engineVersion: string;
  readonly createdById: string;
  readonly ownerUserId: string;
}

export interface SyncedSpecificationVersion {
  readonly id: string;
  readonly specificationId: string;
  readonly versionNumber: number;
  readonly contentRaw: string;
  readonly contentParsed: Record<string, unknown>;
  readonly authoredById: string;
}

export interface AppendVersionInput {
  readonly workspaceId: string;
  readonly specificationId: string;
  readonly contentRaw: string;
  readonly contentParsed?: Record<string, unknown> | undefined;
  readonly authoredById: string;
}

export interface AppendVersionOutcome {
  /** false when the content was identical and nothing was written (`FR-ART-031`). */
  readonly appended: boolean;
  readonly version: SyncedSpecificationVersion;
}

export interface SpecificationSyncPort {
  findByEpicSource(workspaceId: string, epicId: string, sourcePath: string): Promise<SyncedSpecification | null>;
  createFromSync(input: SpecificationSyncInput): Promise<SyncedSpecification>;
  appendVersionIfChanged(input: AppendVersionInput): Promise<AppendVersionOutcome>;
}

export class InMemorySpecificationSyncPort implements SpecificationSyncPort {
  private readonly specifications: SyncedSpecification[] = [];
  private readonly versions: SyncedSpecificationVersion[] = [];

  async findByEpicSource(workspaceId: string, epicId: string, sourcePath: string): Promise<SyncedSpecification | null> {
    return this.specifications.find((s) => s.workspaceId === workspaceId && s.epicId === epicId && s.sourcePath === sourcePath) ?? null;
  }

  async createFromSync(input: SpecificationSyncInput): Promise<SyncedSpecification> {
    const specification: SyncedSpecification = Object.freeze({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      epicId: input.epicId,
      sourcePath: input.sourcePath,
      title: input.title,
      // A synced document has been approved by nobody: it starts as a draft
      // and moves through the lifecycle the same way any other does.
      lifecycleState: 'draft',
      engineName: input.provenance.engineName,
      engineVersion: input.provenance.engineVersion,
      createdById: input.createdById,
      ownerUserId: input.ownerUserId,
    });
    this.specifications.push(specification);
    this.versions.push(
      Object.freeze({
        id: randomUUID(),
        specificationId: specification.id,
        versionNumber: 1,
        contentRaw: input.contentRaw,
        contentParsed: input.contentParsed ?? { parsed: false },
        authoredById: input.createdById,
      }),
    );
    return specification;
  }

  async appendVersionIfChanged(input: AppendVersionInput): Promise<AppendVersionOutcome> {
    const mine = this.versionsOf(input.specificationId);
    const latest = mine[mine.length - 1];
    if (latest !== undefined && latest.contentRaw === input.contentRaw) return { appended: false, version: latest };
    const version: SyncedSpecificationVersion = Object.freeze({
      id: randomUUID(),
      specificationId: input.specificationId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      contentRaw: input.contentRaw,
      contentParsed: input.contentParsed ?? { parsed: false },
      authoredById: input.authoredById,
    });
    this.versions.push(version);
    return { appended: true, version };
  }

  /** Test surface: everything created, and one specification's versions oldest first. */
  all(): readonly SyncedSpecification[] {
    return [...this.specifications];
  }

  versionsOf(specificationId: string): readonly SyncedSpecificationVersion[] {
    return this.versions.filter((v) => v.specificationId === specificationId).sort((a, b) => a.versionNumber - b.versionNumber);
  }
}
