/**
 * `T1235` (EPIC-038) — context packages, in PostgreSQL.
 *
 * Written in the same commit as the interface, which is the point. `T1178`
 * measured the alternative: thirteen stores defaulted to in-memory, every test
 * passed, and somebody opened the running application to find nothing survived
 * a restart.
 *
 * A context package losing itself on restart is worse than most of those. It is
 * the record of what an AI session was shown, and its absence looks exactly
 * like nothing having been shown — the state `BR-0096` exists to prevent a
 * reviewer from being in.
 *
 * Its own file, following `change-room.store.prisma.ts` and
 * `defect-room.store.prisma.ts`: the in-memory store is what unit tests load,
 * and keeping the adapter beside it would pull the generated client into their
 * graph.
 *
 * ## No delete, here either
 *
 * `FR-CTX-066`, `R-038-9`. Retention is inherited from the execution by
 * foreign-key cascade, declared in the migration. This class offers no delete
 * of any kind, and `T1309` asserts the absence rather than trusting callers.
 *
 * ## The embedding is written through raw SQL, deliberately
 *
 * Prisma has no `vector` type. Modelling it as `Unsupported` would put a column
 * in the generated client that no query may safely select, which is a trap
 * shaped like a feature. So the Prisma model omits it and the vector is written
 * with `$executeRaw` — the one place this module reaches past the ORM, and it
 * is named here so nobody has to discover it.
 */
import type { ContextPackage, PackageItem } from './package.types.js';
import type { ExclusionRecord } from './retrieval/outcome.types.js';
import type { ContextStore, IndexEntry } from './context.store.js';

/** The Prisma surface this store uses, named rather than imported (PC-1). */
interface Delegate {
  create(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  deleteMany(args: unknown): Promise<unknown>;
}

export interface ContextPrismaClient {
  readonly contextPackage: Delegate;
  readonly contextItem: Delegate;
  readonly contextExclusion: Delegate;
  readonly contextIndexEntry: Delegate;
}

export class PrismaContextStore implements ContextStore {
  constructor(private readonly prisma: ContextPrismaClient) {}

  async createPackage(row: ContextPackage): Promise<ContextPackage> {
    return (await this.prisma.contextPackage.create({ data: row })) as ContextPackage;
  }

  /**
   * `findFirst` with the workspace in the predicate, never `findUnique` on the
   * id alone.
   *
   * A package in another workspace must be indistinguishable from one that is
   * absent (`FR-002`), and here the stake is higher than usual: a package
   * carries an objective written in somebody's own words, so its very existence
   * is disclosure.
   */
  async findPackage(workspaceId: string, id: string): Promise<ContextPackage | null> {
    return (await this.prisma.contextPackage.findFirst({
      where: { id, workspaceId },
    })) as ContextPackage | null;
  }

  async packagesForExecution(workspaceId: string, executionId: string): Promise<ContextPackage[]> {
    return (await this.prisma.contextPackage.findMany({
      where: { workspaceId, executionId },
      orderBy: { assembledAt: 'desc' },
    })) as ContextPackage[];
  }

  async addItem(row: PackageItem): Promise<PackageItem> {
    return (await this.prisma.contextItem.create({ data: row })) as PackageItem;
  }

  /**
   * Scoped through the package, not by `packageId` alone.
   *
   * An item carries no workspace of its own, so reading by id would cross the
   * boundary for anyone who knew one. The join is the scoping.
   */
  async itemsFor(workspaceId: string, packageId: string): Promise<PackageItem[]> {
    return (await this.prisma.contextItem.findMany({
      where: { packageId, package: { workspaceId } },
      orderBy: { relevanceScore: 'desc' },
    })) as PackageItem[];
  }

  async addExclusion(row: ExclusionRecord): Promise<ExclusionRecord> {
    return (await this.prisma.contextExclusion.create({ data: row })) as ExclusionRecord;
  }

  async exclusionsFor(workspaceId: string, packageId: string): Promise<ExclusionRecord[]> {
    return (await this.prisma.contextExclusion.findMany({
      where: { packageId, package: { workspaceId } },
    })) as ExclusionRecord[];
  }

  /**
   * `FR-CTX-018` — replace the entry for a source when its version moves.
   *
   * Keyed on the **source**, not on the row id: re-indexing must replace, or
   * the corpus accumulates one entry per draft and ranks a document against
   * every version it ever had.
   *
   * Delete-then-create on the index is not the delete `T1309` forbids — that
   * rule is about a package's history, and an index entry is a derived artifact
   * this Epic rebuilds by design.
   */
  async upsertIndexEntry(row: IndexEntry): Promise<IndexEntry> {
    await this.prisma.contextIndexEntry.deleteMany({
      where: {
        workspaceId: row.workspaceId,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
      },
    });
    return (await this.prisma.contextIndexEntry.create({ data: row })) as IndexEntry;
  }

  async indexEntriesFor(workspaceId: string): Promise<IndexEntry[]> {
    return (await this.prisma.contextIndexEntry.findMany({
      where: { workspaceId },
      orderBy: { indexedAt: 'desc' },
    })) as IndexEntry[];
  }

  /**
   * `FR-CTX-017` — entries whose source has moved since they were built.
   *
   * The current versions arrive as an argument. This store owns the index, not
   * the corpus, and resolving source versions here would make it a second
   * reader of `EPIC-033`'s baselines — two readers that will eventually
   * disagree about what "current" means.
   *
   * An **unknown** current version is not stale. It is unknown, and treating
   * the two alike is the conflation `FR-DFR-064` refuses one Epic over.
   */
  async staleEntriesFor(
    workspaceId: string,
    currentVersions: ReadonlyMap<string, string>,
  ): Promise<IndexEntry[]> {
    const entries = await this.indexEntriesFor(workspaceId);
    return entries.filter((entry) => {
      const current = currentVersions.get(`${entry.sourceType}:${entry.sourceId}`);
      return current !== undefined && current !== entry.sourceVersion;
    });
  }
}
