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
import { ValidationFailedError } from '../../core/errors.js';
import type { ContextPackage, PackageItem } from './package.types.js';
import type { ExclusionRecord } from './retrieval/outcome.types.js';
import type { BudgetPolicy, ContextStore, IndexEntry, SourceClass } from './context.store.js';
import type { ReusableAuthorisation } from './isolation.js';
import type { LiveStateElement } from './live-state.js';

/** The Prisma surface this store uses, named rather than imported (PC-1). */
interface Delegate {
  create(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  deleteMany(args: unknown): Promise<unknown>;
}

export interface ContextPrismaClient {
  readonly contextPackage: Delegate;
  readonly contextItem: Delegate;
  readonly contextExclusion: Delegate;
  readonly contextIndexEntry: Delegate;
  readonly contextSourceClass: Delegate;
  readonly contextReusableAuthorisation: Delegate;
  readonly contextLiveState: Delegate;
  readonly contextBudgetPolicy: Delegate;
}

export class PrismaContextStore implements ContextStore {
  constructor(private readonly prisma: ContextPrismaClient) {}

  async createPackage(row: ContextPackage): Promise<ContextPackage> {
    try {
      return (await this.prisma.contextPackage.create({ data: row })) as ContextPackage;
    } catch (error) {
      // `FR-CTX-062` — the foreign key to `executions` refused the binding.
      // Said in words a caller can act on, rather than a constraint name and a 500.
      if (/executionId_fkey/.test(error instanceof Error ? error.message : '')) {
        throw new ValidationFailedError(
          `execution ${row.executionId} is not registered, so no package can be bound to it (FR-CTX-062)`,
        );
      }
      throw error;
    }
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

  /**
   * `T1830` — moved only from null, by the predicate: two concurrent binds
   * cannot both win, and a bound package cannot be re-pointed. The foreign key
   * refuses an execution that is not registered.
   */
  async bindExecution(workspaceId: string, id: string, executionId: string): Promise<ContextPackage | null> {
    let count: number;
    try {
      ({ count } = await this.prisma.contextPackage.updateMany({
        where: { id, workspaceId, executionId: null },
        data: { executionId },
      }));
    } catch (error) {
      if (/executionId_fkey/.test(error instanceof Error ? error.message : '')) {
        throw new ValidationFailedError(
          `execution ${executionId} is not registered, so no package can be bound to it (FR-CTX-062)`,
        );
      }
      throw error;
    }
    return count === 0 ? null : this.findPackage(workspaceId, id);
  }

  async authorisationsInto(workspaceId: string): Promise<ReusableAuthorisation[]> {
    return (await this.prisma.contextReusableAuthorisation.findMany({
      // `T1853` — a project grant never crosses workspaces (CHECKed); filtered
      // here too, so a row the CHECK predates cannot be retrieved and then
      // fail the boundary with a false reason.
      where: { toWorkspaceId: workspaceId, NOT: { workspaceId }, fromProjectId: null },
    })) as ReusableAuthorisation[];
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
   * Scoped on the item's own `workspaceId`.
   *
   * This was a join through the package until `T012a` required the column
   * (`FR-002`) — and the column is the better answer: a predicate on the row
   * cannot be forgotten the way a join can, which matters most for the
   * requirement least worth leaving to memory.
   */
  async itemsFor(workspaceId: string, packageId: string): Promise<PackageItem[]> {
    return (await this.prisma.contextItem.findMany({
      where: { workspaceId, packageId },
      orderBy: { relevanceScore: 'desc' },
    })) as PackageItem[];
  }

  async addExclusion(row: ExclusionRecord): Promise<ExclusionRecord> {
    return (await this.prisma.contextExclusion.create({ data: row })) as ExclusionRecord;
  }

  async exclusionsFor(workspaceId: string, packageId: string): Promise<ExclusionRecord[]> {
    return (await this.prisma.contextExclusion.findMany({
      where: { workspaceId, packageId },
    })) as ExclusionRecord[];
  }

  async addLiveState(row: LiveStateElement): Promise<LiveStateElement> {
    return (await this.prisma.contextLiveState.create({ data: row })) as LiveStateElement;
  }

  /** Scoped on the element's own `workspaceId`, as items and exclusions are. */
  async liveStateFor(workspaceId: string, packageId: string): Promise<LiveStateElement[]> {
    return (await this.prisma.contextLiveState.findMany({
      where: { workspaceId, packageId },
      orderBy: { readAt: 'asc' },
    })) as LiveStateElement[];
  }

  /**
   * `FR-CTX-036` — `null` for a workspace with no policy. `costPerThousandTokens`
   * is a `NUMERIC`, which the client returns as a `Decimal`; it is converted
   * here so arithmetic downstream is on numbers.
   */
  async budgetPolicyFor(workspaceId: string): Promise<BudgetPolicy | null> {
    const row = (await this.prisma.contextBudgetPolicy.findFirst({ where: { workspaceId } })) as
      | (Omit<BudgetPolicy, 'costPerThousandTokens'> & { costPerThousandTokens: unknown })
      | null;
    return row === null
      ? null
      : {
          workspaceId: row.workspaceId,
          retrievalLimit: row.retrievalLimit,
          tokensPerCandidate: row.tokensPerCandidate,
          costPerThousandTokens: Number(row.costPerThousandTokens),
        };
  }

  /** `FR-CTX-034` — `null` for an unregistered type. Never a default. */
  async classifySource(workspaceId: string, sourceType: string): Promise<SourceClass | null> {
    return (await this.prisma.contextSourceClass.findFirst({
      where: { workspaceId, sourceType },
    })) as SourceClass | null;
  }

  async sourceClassesFor(workspaceId: string): Promise<SourceClass[]> {
    return (await this.prisma.contextSourceClass.findMany({
      where: { workspaceId },
      orderBy: { sourceType: 'asc' },
    })) as SourceClass[];
  }

  /**
   * `FR-CTX-053` — all four keys in the predicate, and direction is in two of
   * them. A lookup on the source alone lets every workspace in once one is let
   * in; a lookup ignoring direction grants the reverse crossing nobody stated.
   */
  async find(input: {
    sourceType: string;
    sourceId: string;
    fromWorkspaceId: string;
    toWorkspaceId: string;
    fromProjectId?: string | null;
    toProjectId?: string | null;
  }): Promise<ReusableAuthorisation | null> {
    return (await this.prisma.contextReusableAuthorisation.findFirst({
      where: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        workspaceId: input.fromWorkspaceId,
        toWorkspaceId: input.toWorkspaceId,
        // `T1808` — a workspace grant and a project grant are different grants.
        fromProjectId: input.fromProjectId ?? null,
        toProjectId: input.toProjectId ?? null,
      },
    })) as ReusableAuthorisation | null;
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

  /** On `(workspaceId, sourceType, sourceId)`, which the migration indexes. */
  async indexEntryFor(workspaceId: string, sourceType: string, sourceId: string): Promise<IndexEntry | null> {
    return (await this.prisma.contextIndexEntry.findFirst({
      where: { workspaceId, sourceType, sourceId },
    })) as IndexEntry | null;
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
