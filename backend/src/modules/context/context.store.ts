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
import type { AuthorisationReader, ReusableAuthorisation } from './isolation.js';
import type { LiveStateElement } from './live-state.js';

/** `R-038-2`, `R-038-4` — one indexed unit of an approved source. */
export interface IndexEntry {
  readonly id: string;
  readonly workspaceId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  /** `FR-CTX-016` — staleness is a version comparison, never a timestamp. */
  readonly sourceVersion: string;
  /** `T1808` — the owning project, from the artifact source; `null` when it has none. */
  readonly projectId?: string | null;
  readonly embeddingModelId: string;
  readonly dimension: number;
  readonly indexedAt: Date;
}

/** `FR-CTX-015`, `FR-CTX-036` — a class of approved source, and its handling. */
export interface SourceClass {
  readonly id: string;
  readonly workspaceId: string;
  readonly sourceType: string;
  readonly securityClassification: string;
  /** `FR-CTX-015` — whether it enters the corpus at all. Defaults to false. */
  readonly indexable: boolean;
}

/**
 * `FR-CTX-031`, `FR-CTX-036` — a workspace's budget policy. Configuration, read
 * at assembly: never a constant in the code that runs.
 */
export interface BudgetPolicy {
  readonly workspaceId: string;
  /** `R-038-3` — how many candidates retrieval is asked for. */
  readonly retrievalLimit: number;
  /** What one candidate is estimated to cost against the token budget. */
  readonly tokensPerCandidate: number;
  /** The price turning tokens into cost. Zero is a real price, meaning "unmetered". */
  readonly costPerThousandTokens: number;
}

export interface ContextStore extends AuthorisationReader {
  createPackage(row: ContextPackage): Promise<ContextPackage>;
  findPackage(workspaceId: string, id: string): Promise<ContextPackage | null>;
  /**
   * `T1830`, `FR-CTX-062` — bind an unbound package to its execution, once.
   * Returns the bound row, or `null` when the package is absent or already
   * bound — the caller tells those apart. Not an update in general: the one
   * column that may move, and only from null.
   */
  bindExecution(workspaceId: string, id: string, executionId: string): Promise<ContextPackage | null>;
  packagesForExecution(workspaceId: string, executionId: string): Promise<ContextPackage[]>;

  addItem(row: PackageItem): Promise<PackageItem>;
  itemsFor(workspaceId: string, packageId: string): Promise<PackageItem[]>;

  /**
   * The load-bearing write. Without exclusions an empty package and a heavily
   * filtered one are the same row with no children.
   */
  addExclusion(row: ExclusionRecord): Promise<ExclusionRecord>;
  exclusionsFor(workspaceId: string, packageId: string): Promise<ExclusionRecord[]>;

  /** `FR-CTX-020`, `FR-CTX-021` — live state as the package was given it. */
  addLiveState(row: LiveStateElement): Promise<LiveStateElement>;
  liveStateFor(workspaceId: string, packageId: string): Promise<LiveStateElement[]>;

  /**
   * `FR-CTX-036`, `PP-014` — the classes are configuration, read not inferred.
   *
   * `null` for an unregistered type, never a permissive stand-in: `FR-CTX-034`
   * excludes what cannot be classified, and a default here would admit it.
   */
  classifySource(workspaceId: string, sourceType: string): Promise<SourceClass | null>;
  sourceClassesFor(workspaceId: string): Promise<SourceClass[]>;

  /**
   * `T1826`, `FR-CTX-051` — the cross-workspace authorisations INTO this
   * workspace, so search can rank those sources in their owners' partitions.
   */
  authorisationsInto(workspaceId: string): Promise<ReusableAuthorisation[]>;

  /** `FR-CTX-036` — `null` when the workspace has none. Never a default. */
  budgetPolicyFor(workspaceId: string): Promise<BudgetPolicy | null>;

  /**
   * `FR-CTX-051`, `FR-CTX-053` — the one authorisation for this source to
   * cross from its owner to the requester, or `null`.
   *
   * Matched on all four of source type, source id, owner and recipient. The
   * database's composite key (`T1260`) refuses an item citing anything looser,
   * and a reader that matched looser would offer authorisations the write
   * would then reject.
   */
  find(input: {
    sourceType: string;
    sourceId: string;
    fromWorkspaceId: string;
    toWorkspaceId: string;
    fromProjectId?: string | null;
    toProjectId?: string | null;
  }): Promise<ReusableAuthorisation | null>;

  /**
   * `FR-CTX-018` — replace an entry when its source version moves.
   *
   * An upsert rather than delete-then-insert: replacing an index entry is not
   * deleting a package's history, and a store that offered `delete` for this
   * would offer it for everything.
   */
  upsertIndexEntry(row: IndexEntry): Promise<IndexEntry>;
  indexEntriesFor(workspaceId: string): Promise<IndexEntry[]>;
  /** The one entry for a source, or `null`. Keyed, so re-indexing one source reads one row. */
  indexEntryFor(workspaceId: string, sourceType: string, sourceId: string): Promise<IndexEntry | null>;
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
  readonly #live: LiveStateElement[] = [];
  #entries: IndexEntry[] = [];
  readonly #classes: SourceClass[] = [];
  readonly #authorisations: ReusableAuthorisation[] = [];
  readonly #policies: BudgetPolicy[] = [];

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

  async bindExecution(workspaceId: string, id: string, executionId: string): Promise<ContextPackage | null> {
    const row = this.#packages.get(id);
    if (!row || row.workspaceId !== workspaceId || row.executionId !== null) return null;
    const bound = { ...row, executionId };
    this.#packages.set(id, bound);
    return bound;
  }

  async authorisationsInto(workspaceId: string): Promise<ReusableAuthorisation[]> {
    return this.#authorisations.filter(
      (row) =>
        row.toWorkspaceId === workspaceId &&
        row.workspaceId !== workspaceId &&
        (row.fromProjectId ?? null) === null,
    );
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
    // Scoped by the item's OWN workspace, not by a join. `FR-002` required the
    // column and the column removes the failure mode: an item read by
    // `packageId` alone can no longer cross a boundary for anyone who knows an
    // id, because the predicate is on the row itself.
    return this.#items.filter(
      (row) => row.workspaceId === workspaceId && row.packageId === packageId,
    );
  }

  async addExclusion(row: ExclusionRecord): Promise<ExclusionRecord> {
    this.#exclusions.push(row);
    return row;
  }

  async exclusionsFor(workspaceId: string, packageId: string): Promise<ExclusionRecord[]> {
    return this.#exclusions.filter(
      (row) => row.workspaceId === workspaceId && row.packageId === packageId,
    );
  }

  async addLiveState(row: LiveStateElement): Promise<LiveStateElement> {
    this.#live.push(row);
    return row;
  }

  async liveStateFor(workspaceId: string, packageId: string): Promise<LiveStateElement[]> {
    return this.#live.filter((row) => row.workspaceId === workspaceId && row.packageId === packageId);
  }

  async classifySource(workspaceId: string, sourceType: string): Promise<SourceClass | null> {
    return (
      this.#classes.find(
        (row) => row.workspaceId === workspaceId && row.sourceType === sourceType,
      ) ?? null
    );
  }

  async sourceClassesFor(workspaceId: string): Promise<SourceClass[]> {
    return this.#classes.filter((row) => row.workspaceId === workspaceId);
  }

  /** Test seam: configuration arrives from a migration or an operator, not code. */
  async addSourceClass(row: SourceClass): Promise<SourceClass> {
    this.#classes.push(row);
    return row;
  }

  /** Test seam: a budget policy is configured by an operator, not by code. */
  async addBudgetPolicy(row: BudgetPolicy): Promise<BudgetPolicy> {
    this.#policies.push(row);
    return row;
  }

  async budgetPolicyFor(workspaceId: string): Promise<BudgetPolicy | null> {
    return this.#policies.find((row) => row.workspaceId === workspaceId) ?? null;
  }

  /** Test seam: an authorisation is granted by an operator, not by assembly. */
  async addAuthorisation(row: ReusableAuthorisation): Promise<ReusableAuthorisation> {
    this.#authorisations.push(row);
    return row;
  }

  async find(input: {
    sourceType: string;
    sourceId: string;
    fromWorkspaceId: string;
    toWorkspaceId: string;
    fromProjectId?: string | null;
    toProjectId?: string | null;
  }): Promise<ReusableAuthorisation | null> {
    return (
      this.#authorisations.find(
        (row) =>
          row.sourceType === input.sourceType &&
          row.sourceId === input.sourceId &&
          row.workspaceId === input.fromWorkspaceId &&
          row.toWorkspaceId === input.toWorkspaceId &&
          // `T1808` — a workspace grant and a project grant are different
          // grants; neither stands in for the other.
          (row.fromProjectId ?? null) === (input.fromProjectId ?? null) &&
          (row.toProjectId ?? null) === (input.toProjectId ?? null),
      ) ?? null
    );
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

  async indexEntryFor(workspaceId: string, sourceType: string, sourceId: string): Promise<IndexEntry | null> {
    return (
      this.#entries.find(
        (row) => row.workspaceId === workspaceId && row.sourceType === sourceType && row.sourceId === sourceId,
      ) ?? null
    );
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
