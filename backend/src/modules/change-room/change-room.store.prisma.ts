/**
 * `T996i` (EPIC-034) — the Change Room, in PostgreSQL.
 *
 * Written in the same commit as the endpoint that uses it, which is the whole
 * point. `T1178` measured the alternative: thirteen stores defaulted to
 * in-memory, every test passed, and a human opened the application and found
 * that nothing survived a restart. A change request is the record that somebody
 * questioned an approved baseline — losing it on restart would leave a trace
 * showing the baseline was never questioned at all.
 *
 * Its own file, following `requirement-room.store.prisma.ts`: the in-memory
 * store is what unit tests load, and keeping the adapter beside it would pull
 * the generated client into their graph.
 *
 * **`setState` updates and never deletes** (`FR-CHR-023`), and this file offers
 * no delete of any kind — the retention promise is kept by the absence of the
 * capability rather than by everyone remembering not to use it.
 */
import type { ChangeRequestRow, ChangeRoomStore, OpenQuestion } from './change-room.store.js';

/** The Prisma surface this store uses, named rather than imported (PC-1). */
interface Delegate {
  create(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  update(args: unknown): Promise<unknown>;
}

export interface ChangeRoomPrismaClient {
  readonly changeRequest: Delegate;
}

/**
 * `openQuestions` is a JSON column, so it arrives as `unknown`.
 *
 * Narrowed on the way out rather than trusted: a row written by an older shape
 * would otherwise reach `FR-CHR-022`'s "one set" as something that is not a set.
 */
function toRow(row: unknown): ChangeRequestRow {
  const record = row as ChangeRequestRow & { openQuestions: unknown };
  return {
    ...record,
    openQuestions: Array.isArray(record.openQuestions)
      ? (record.openQuestions as OpenQuestion[])
      : [],
  };
}

export class PrismaChangeRoomStore implements ChangeRoomStore {
  constructor(private readonly prisma: ChangeRoomPrismaClient) {}

  async create(row: ChangeRequestRow): Promise<ChangeRequestRow> {
    return toRow(
      await this.prisma.changeRequest.create({
        data: { ...row, openQuestions: row.openQuestions as unknown },
      }),
    );
  }

  /**
   * `findFirst` with the workspace in the predicate, never `findUnique` on the
   * id alone.
   *
   * A row in another workspace must be indistinguishable from one that is
   * absent (`FR-002`); fetching by id and then comparing would make the
   * difference observable in timing and, one refactor later, in the response.
   */
  async findById(workspaceId: string, id: string): Promise<ChangeRequestRow | null> {
    const row = await this.prisma.changeRequest.findFirst({ where: { id, workspaceId } });
    return row ? toRow(row) : null;
  }

  async listForBaseline(
    workspaceId: string,
    targetBaselineId: string,
  ): Promise<ChangeRequestRow[]> {
    const rows = await this.prisma.changeRequest.findMany({
      where: { workspaceId, targetBaselineId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRow);
  }

  /** `FR-CHR-023` — a state change. There is no delete here, deliberately. */
  async setState(
    workspaceId: string,
    id: string,
    state: ChangeRequestRow['state'],
  ): Promise<ChangeRequestRow> {
    await this.require(workspaceId, id);
    return toRow(await this.prisma.changeRequest.update({ where: { id }, data: { state } }));
  }

  async setQuestions(
    workspaceId: string,
    id: string,
    questions: readonly OpenQuestion[],
  ): Promise<ChangeRequestRow> {
    await this.require(workspaceId, id);
    return toRow(
      await this.prisma.changeRequest.update({
        where: { id },
        data: { openQuestions: questions as unknown },
      }),
    );
  }

  /**
   * The workspace check before every update.
   *
   * `update` takes the id alone because that is the unique key, so without this
   * read a caller in another workspace could write a row it may not even see.
   */
  private async require(workspaceId: string, id: string): Promise<void> {
    const row = await this.findById(workspaceId, id);
    if (!row) throw new Error(`no change request ${id}`);
  }
}
