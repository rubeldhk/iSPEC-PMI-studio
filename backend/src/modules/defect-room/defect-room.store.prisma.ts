/**
 * `T998f` (EPIC-035) — the Defect Room, in PostgreSQL.
 *
 * Written in the same commit as the endpoint that first needs it, which is the
 * whole point. `T1178` measured the alternative: thirteen stores defaulted to
 * in-memory, every test passed, and a human opened the application and found
 * that nothing survived a restart.
 *
 * A defect record is the fact that somebody said the system was wrong, and a
 * classification is the fact that somebody weighed that claim against approved
 * behaviour. Losing either on restart looks exactly like nobody ever said so.
 *
 * Its own file, following `change-room.store.prisma.ts` and
 * `requirement-room.store.prisma.ts`: the in-memory store is what unit tests
 * load, and keeping the adapter beside it would pull the generated client into
 * their graph.
 *
 * ## No delete, and no update of substance
 *
 * `FR-DFR-025`, `ADR-0016`. This file offers no delete of any kind, and the only
 * write it makes to an existing classification is `markSuperseded`, which moves
 * two fields that belong together and touches nothing else. The retention
 * promise is kept by the absence of the capability rather than by everyone
 * remembering not to use it.
 */
import type { Classification } from './classification.types.js';
import type { DefectRoomStore, DefectRow } from './defect-room.store.js';

/** The Prisma surface this store uses, named rather than imported (PC-1). */
interface Delegate {
  create(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  update(args: unknown): Promise<unknown>;
}

export interface DefectRoomPrismaClient {
  readonly defectRecord: Delegate;
  readonly classification: Delegate;
}

export class PrismaDefectRoomStore implements DefectRoomStore {
  constructor(private readonly prisma: DefectRoomPrismaClient) {}

  async createDefect(row: DefectRow): Promise<DefectRow> {
    return (await this.prisma.defectRecord.create({ data: row })) as DefectRow;
  }

  /**
   * `findFirst` with the workspace in the predicate, never `findUnique` on the
   * id alone.
   *
   * A row in another workspace must be indistinguishable from one that is
   * absent (`FR-002`); fetching by id and then comparing would make the
   * difference observable in timing and, one refactor later, in the response.
   */
  async findDefect(workspaceId: string, id: string): Promise<DefectRow | null> {
    return (await this.prisma.defectRecord.findFirst({
      where: { id, workspaceId },
    })) as DefectRow | null;
  }

  /** A state change. There is no delete here, deliberately. */
  async setDefectState(workspaceId: string, id: string, state: string): Promise<DefectRow> {
    // Scoped first, so a caller cannot move the state of a defect it may not
    // see by naming its id.
    const existing = await this.findDefect(workspaceId, id);
    if (!existing) throw new Error(`no defect ${id}`);
    return (await this.prisma.defectRecord.update({ where: { id }, data: { state } })) as DefectRow;
  }

  async recordClassification(row: Classification): Promise<Classification> {
    return (await this.prisma.classification.create({ data: row })) as Classification;
  }

  /**
   * `FR-DFR-025` — the only mutation this store makes to a classification.
   *
   * Two fields, written together because the database CHECK
   * (`defect_classifications_supersession_says_when`) refuses either alone: a
   * row pointing at its successor with no date cannot say when it stopped
   * standing, and a date with no successor claims the row was replaced by
   * nothing. Nothing here rewrites an outcome, a rationale or a behaviour
   * reference — that is what the new row is for.
   */
  async markSuperseded(
    workspaceId: string,
    id: string,
    bySupersedingId: string,
    at: Date,
  ): Promise<Classification> {
    const existing = await this.prisma.classification.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new Error(`no classification ${id}`);
    return (await this.prisma.classification.update({
      where: { id },
      data: { supersededByClassificationId: bySupersedingId, reclassifiedAt: at },
    })) as Classification;
  }

  async listClassifications(workspaceId: string, defectId: string): Promise<Classification[]> {
    return (await this.prisma.classification.findMany({
      where: { workspaceId, defectId },
      orderBy: { createdAt: 'asc' },
    })) as Classification[];
  }

  /**
   * The one nothing supersedes.
   *
   * Derived rather than stored: a `current` flag would be a second place the
   * answer lives, and the two would disagree the first time a write half
   * failed.
   */
  async currentClassification(
    workspaceId: string,
    defectId: string,
  ): Promise<Classification | null> {
    const rows = (await this.prisma.classification.findMany({
      where: { workspaceId, defectId, supersededByClassificationId: null },
      orderBy: { createdAt: 'asc' },
    })) as Classification[];
    return rows.length === 0 ? null : rows[rows.length - 1]!;
  }
}
