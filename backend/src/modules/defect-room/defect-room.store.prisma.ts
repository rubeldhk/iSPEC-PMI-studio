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
import type {
  DefectRoomStore,
  DefectRow,
  DefectTestRow,
  EvidenceCheckRow,
  ReproductionRow,
  RoutingRow,
} from './defect-room.store.js';

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
  readonly defectTest: Delegate;
  readonly reproduction: Delegate;
  readonly routing: Delegate;
  readonly evidenceCheck: Delegate;
}

/** `carriedEvidenceRefs` is a JSON column, narrowed on the way out. */
function toRouting(row: unknown): RoutingRow {
  const record = row as RoutingRow & { carriedEvidenceRefs: unknown };
  return {
    ...record,
    carriedEvidenceRefs: Array.isArray(record.carriedEvidenceRefs)
      ? (record.carriedEvidenceRefs as string[])
      : [],
  };
}

/**
 * `evidenceRefs` is a JSON column, so it arrives as `unknown`.
 *
 * Narrowed on the way out rather than trusted: a row written by an older shape
 * would otherwise reach `FR-DFR-043`'s "alternative evidence is required" as
 * something that is not a list, and `length > 0` on a non-array is how an
 * exception with no evidence starts passing the check that exists to stop it.
 */
function toReproduction(row: unknown): ReproductionRow {
  const record = row as ReproductionRow & { evidenceRefs: unknown };
  return {
    ...record,
    evidenceRefs: Array.isArray(record.evidenceRefs)
      ? (record.evidenceRefs as string[])
      : [],
  };
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

  async recordTest(row: DefectTestRow): Promise<DefectTestRow> {
    return (await this.prisma.defectTest.create({ data: row })) as DefectTestRow;
  }

  async testsFor(workspaceId: string, defectId: string): Promise<DefectTestRow[]> {
    return (await this.prisma.defectTest.findMany({
      where: { workspaceId, defectId },
      orderBy: { createdAt: 'asc' },
    })) as DefectTestRow[];
  }

  /**
   * The only update this store makes to a test, and it touches two fields.
   *
   * `firstObservedFailingAt` is never among them: that instant is the record
   * `FR-DFR-040` rests on, and a later run cannot change when the defect was
   * first demonstrated.
   */
  async setTestRun(
    workspaceId: string,
    id: string,
    outcome: string,
    evidenceRef: string | null,
  ): Promise<DefectTestRow> {
    const existing = await this.prisma.defectTest.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new Error(`no defect test ${id}`);
    return (await this.prisma.defectTest.update({
      where: { id },
      data: { lastRunOutcome: outcome, lastRunEvidenceRef: evidenceRef },
    })) as DefectTestRow;
  }

  async recordReproduction(row: ReproductionRow): Promise<ReproductionRow> {
    return toReproduction(
      await this.prisma.reproduction.create({
        data: { ...row, evidenceRefs: row.evidenceRefs as unknown },
      }),
    );
  }

  async reproductionsFor(workspaceId: string, defectId: string): Promise<ReproductionRow[]> {
    const rows = await this.prisma.reproduction.findMany({
      where: { workspaceId, defectId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toReproduction);
  }

  /** `FR-DFR-043` — the exception, counted rather than described. */
  async notAutomatableIn(workspaceId: string): Promise<ReproductionRow[]> {
    const rows = await this.prisma.reproduction.findMany({
      where: { workspaceId, reproducible: 'not-automatable' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toReproduction);
  }
  async recordRouting(row: RoutingRow): Promise<RoutingRow> {
    return toRouting(
      await this.prisma.routing.create({
        data: { ...row, carriedEvidenceRefs: row.carriedEvidenceRefs as unknown },
      }),
    );
  }

  async routingsFor(workspaceId: string, defectId: string): Promise<RoutingRow[]> {
    const rows = await this.prisma.routing.findMany({
      where: { workspaceId, defectId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRouting);
  }

  /**
   * Four narrow transitions, each writing exactly the columns its state
   * requires — the same pairing the table's CHECKs enforce. Nothing that
   * recorded the offer is overwritten, which is how `FR-DFR-073` keeps both
   * halves.
   */
  async declineRouting(
    workspaceId: string,
    id: string,
    reason: string,
    at: Date,
  ): Promise<RoutingRow> {
    return this.#moveRouting(workspaceId, id, {
      state: 'declined',
      declinedAt: at,
      declinedReason: reason,
    });
  }

  async acceptRouting(workspaceId: string, id: string, targetRef: string): Promise<RoutingRow> {
    return this.#moveRouting(workspaceId, id, { state: 'accepted', targetRef });
  }

  async refuseRouting(workspaceId: string, id: string, detail: string): Promise<RoutingRow> {
    return this.#moveRouting(workspaceId, id, { state: 'refused', refusalDetail: detail });
  }

  async returnRouting(workspaceId: string, id: string, detail: string): Promise<RoutingRow> {
    return this.#moveRouting(workspaceId, id, { state: 'returned', refusalDetail: detail });
  }

  async #moveRouting(
    workspaceId: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<RoutingRow> {
    const existing = await this.prisma.routing.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new Error(`no routing ${id}`);
    return toRouting(await this.prisma.routing.update({ where: { id }, data }));
  }
  async recordEvidenceCheck(row: EvidenceCheckRow): Promise<EvidenceCheckRow> {
    return (await this.prisma.evidenceCheck.create({ data: row })) as EvidenceCheckRow;
  }

  /** Every entry, in order. `FR-DFR-031` — the pattern is the evidence. */
  async evidenceChecksFor(workspaceId: string, defectId: string): Promise<EvidenceCheckRow[]> {
    return (await this.prisma.evidenceCheck.findMany({
      where: { workspaceId, defectId },
      orderBy: { createdAt: 'asc' },
    })) as EvidenceCheckRow[];
  }
}
