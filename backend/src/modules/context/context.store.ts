/**
 * `T1235` (EPIC-038) — where context packages live.
 *
 * **PostgreSQL-backed from the first commit** (`context.store.prisma.ts`), for
 * `T1178`'s reason: thirteen modules defaulted to in-memory, none was ever
 * overridden at the composition root, and a feature opened in the running
 * application vanished on restart while every test passed.
 *
 * A context package losing itself on restart would be worse than most. It is
 * the record of what an AI session was shown, and its absence looks exactly
 * like nothing having been shown — which is the state `BR-0096` exists to
 * prevent a reviewer from ever being in.
 *
 * ## There is no delete, and that is the retention policy
 *
 * `FR-CTX-066`, `R-038-9`. A package lives exactly as long as the execution it
 * fed, by foreign-key cascade rather than by a sweep this store performs. Two
 * retention policies over one audit trail produce a window in which the
 * execution is inspectable and its context has gone.
 *
 * So the capability is absent rather than merely unused. `T1309` asserts that
 * absence, in the shape `EPIC-035`'s defect store took for `ADR-0016`.
 *
 * ## Scoping is on the read
 *
 * Every method takes a `workspaceId` and filters with it. A row in another
 * workspace is indistinguishable from one that is absent (`FR-002`) — and here
 * the existence of a package is itself disclosure, because a package carries an
 * objective written in somebody's own words.
 *
 * Framework-free (PC-1).
 */
import type { ContextPackage, PackageItem } from './package.types.js';
import type { ExclusionRecord } from './retrieval/outcome.types.js';

/** `R-038-2`, `R-038-4` — one indexed unit of an approved source. */
export interface IndexEntry {
  readonly id: string;
  readonly workspaceId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  /** `FR-CTX-016` — staleness is a version comparison, never a timestamp. */
  readonly sourceVersion: string;
  readonly embeddingModelId: string;
  readonly dimension: number;
  readonly indexedAt: Date;
}

export interface ContextStore {
  createPackage(row: ContextPackage): Promise<ContextPackage>;
  findPackage(workspaceId: string, id: string): Promise<ContextPackage | null>;
  packagesForExecution(workspaceId: string, executionId: string): Promise<ContextPackage[]>;

  addItem(row: PackageItem): Promise<PackageItem>;
  itemsFor(workspaceId: string, packageId: string): Promise<PackageItem[]>;

  /**
   * The load-bearing write. Without exclusions an empty package and a heavily
   * filtered one are the same row with no children.
   */
  addExclusion(row: ExclusionRecord): Promise<ExclusionRecord>;
  exclusionsFor(workspaceId: string, packageId: string): Promise<ExclusionRecord[]>;

  /**
   * `FR-CTX-018` — replace an entry when its source version moves.
   *
   * An upsert rather than delete-then-insert: replacing an index entry is not
   * deleting a package's history, and a store that offered `delete` for this
   * would offer it for everything.
   */
  upsertIndexEntry(row: IndexEntry): Promise<IndexEntry>;
  indexEntriesFor(workspaceId: string): Promise<IndexEntry[]>;
  staleEntriesFor(
    workspaceId: string,
    currentVersions: ReadonlyMap<string, string>,
  ): Promise<IndexEntry[]>;
}

/** For unit tests and database-less runs. Loses data, and does so visibly. */
export class InMemoryContextStore implements ContextStore {
  readonly #packages = new Map<string, ContextPackage>();
  readonly #items: PackageItem[] = [];
  readonly #exclusions: ExclusionRecord[] = [];
  #entries: IndexEntry[] = [];

  async createPackage(row: ContextPackage): Promise<ContextPackage> {
    this.#packages.set(row.id, row);
    return row;
  }

  async findPackage(workspaceId: string, id: string): Promise<ContextPackage | null> {
    const row = this.#packages.get(id);
    // Absent rather than forbidden (`FR-002`). A package's existence is itself
    // disclosure: its objective is somebody's own wording of a question.
    return row && row.workspaceId === workspaceId ? row : null;
  }

  async packagesForExecution(workspaceId: string, executionId: string): Promise<ContextPackage[]> {
    return [...this.#packages.values()].filter(
      (row) => row.workspaceId === workspaceId && row.executionId === executionId,
    );
  }

  async addItem(row: PackageItem): Promise<PackageItem> {
    this.#items.push(row);
    return row;
  }

  async itemsFor(workspaceId: string, packageId: string): Promise<PackageItem[]> {
    // Scoped through the package rather than trusting the caller: an item
    // carries no workspace of its own, and reading it by `packageId` alone
    // would cross the boundary for anyone who knew an id.
    if (!(await this.findPackage(workspaceId, packageId))) return [];
    return this.#items.filter((row) => row.packageId === packageId);
  }

  async addExclusion(row: ExclusionRecord): Promise<ExclusionRecord> {
    this.#exclusions.push(row);
    return row;
  }

  async exclusionsFor(workspaceId: string, packageId: string): Promise<ExclusionRecord[]> {
    if (!(await this.findPackage(workspaceId, packageId))) return [];
    return this.#exclusions.filter((row) => row.packageId === packageId);
  }

  async upsertIndexEntry(row: IndexEntry): Promise<IndexEntry> {
    // Keyed on the source, not on the row id: re-indexing the same source must
    // replace its entry rather than accumulate one per version, or the corpus
    // would rank a document against every draft it ever had.
    this.#entries = this.#entries.filter(
      (existing) =>
        !(
          existing.workspaceId === row.workspaceId &&
          existing.sourceType === row.sourceType &&
          existing.sourceId === row.sourceId
        ),
    );
    this.#entries.push(row);
    return row;
  }

  async indexEntriesFor(workspaceId: string): Promise<IndexEntry[]> {
    return this.#entries.filter((row) => row.workspaceId === workspaceId);
  }

  /**
   * `FR-CTX-017` — entries whose source has moved since they were built.
   *
   * Takes the current versions as an argument rather than reading them: this
   * store owns the index, not the corpus, and a store that resolved source
   * versions itself would be a second reader of `EPIC-033`'s baselines.
   */
  async staleEntriesFor(
    workspaceId: string,
    currentVersions: ReadonlyMap<string, string>,
  ): Promise<IndexEntry[]> {
    return (await this.indexEntriesFor(workspaceId)).filter((entry) => {
      const current = currentVersions.get(`${entry.sourceType}:${entry.sourceId}`);
      // An unknown current version is NOT stale — it is unknown, and treating
      // the two alike is the conflation `FR-DFR-064` refuses one Epic over.
      return current !== undefined && current !== entry.sourceVersion;
    });
  }
}
