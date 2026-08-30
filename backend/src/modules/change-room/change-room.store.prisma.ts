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
import type {
  ChangeDecisionRow,
  ChangeRequestRow,
  ChangeRoomStore,
  OpenQuestion,
} from './change-room.store.js';
import {
  IMPACT_AREAS,
  type ImpactArea,
  type ImpactAreaName,
  type ImpactView,
  type TouchedDecision,
} from './impact.types.js';
import type { ChangeOption } from './option.types.js';

/** The Prisma surface this store uses, named rather than imported (PC-1). */
interface Delegate {
  create(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
  update(args: unknown): Promise<unknown>;
}

export interface ChangeRoomPrismaClient {
  readonly changeRequest: Delegate;
  readonly changeImpactView: Delegate;
  readonly changeImpactArea: Delegate;
  readonly changeDecision: Delegate;
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

  /**
   * `FR-CHR-035` — append-only.
   *
   * The eight areas are written as rows rather than a JSON blob, so
   * `change_impact_areas_unknown_states_say_why` can enforce `FR-CHR-032` in
   * the database: an `unknown` area with no reason cannot be stored at all.
   * That is the one guarantee worth a join.
   */
  async saveImpactView(view: ImpactView): Promise<ImpactView> {
    const clash = await this.prisma.changeImpactView.findFirst({ where: { id: view.id } });
    if (clash) {
      throw new Error(`impact view ${view.id} already exists; views are append-only (FR-CHR-035)`);
    }
    await this.prisma.changeImpactView.create({
      data: {
        id: view.id,
        workspaceId: view.workspaceId,
        changeRequestId: view.changeRequestId,
        computedAt: view.computedAt,
        traversalDepth: view.traversalDepth,
        retainedForDecision: view.retainedForDecision,
        architectureDecisions: view.architecture.decisions as unknown,
        architectureDetail: view.architecture.detail,
        violationCheckStatus: view.architecture.violationCheck.status,
        violationCheckBecause: view.architecture.violationCheck.because,
      },
    });
    for (const area of IMPACT_AREAS) {
      const row = view.areas[area];
      await this.prisma.changeImpactArea.create({
        data: {
          id: `${view.id}:${area}`,
          workspaceId: view.workspaceId,
          impactViewId: view.id,
          area: row.area,
          state: row.state,
          detail: row.detail,
          itemCount: row.itemCount,
          // The CHECK requires this exactly when the state is `unknown`, and
          // `detail` is where the composer already put the reason.
          unknownReason: row.state === 'unknown' ? row.detail : null,
        },
      });
    }
    return view;
  }

  /**
   * `FR-CHR-043` — the decision, with what was declined.
   *
   * `chosenOption` and `declinedOptions` are stored as JSON rather than
   * normalised into an options table, because the data model has none: options
   * exist to be weighed, and what survives is the weighing (`EPIC-033`'s
   * wording, and the same reasoning here). Normalising them would create a
   * second home for an option whose only purpose is to be quoted back.
   */
  async recordDecision(row: ChangeDecisionRow): Promise<ChangeDecisionRow> {
    await this.prisma.changeDecision.create({
      data: {
        ...row,
        chosenOption: row.chosenOption as unknown,
        declinedOptions: row.declinedOptions as unknown,
      },
    });
    return row;
  }

  async listDecisionsFor(
    workspaceId: string,
    changeRequestId: string,
  ): Promise<ChangeDecisionRow[]> {
    const rows = await this.prisma.changeDecision.findMany({
      where: { workspaceId, changeRequestId },
      orderBy: { decidedAt: 'asc' },
    });
    return rows.map((row) => {
      const record = row as ChangeDecisionRow & {
        chosenOption: unknown;
        declinedOptions: unknown;
      };
      return {
        ...record,
        chosenOption: record.chosenOption as ChangeOption,
        // `[]` on a malformed row rather than a guess: a decision whose
        // declined set cannot be read has lost it, and pretending otherwise
        // would report a decision with no alternatives — the exact reading
        // `FR-CHR-043` exists to prevent. The empty case is visible to a
        // reader; a fabricated one would not be.
        declinedOptions: Array.isArray(record.declinedOptions)
          ? (record.declinedOptions as ChangeOption[])
          : [],
      };
    });
  }

  async findImpactView(workspaceId: string, id: string): Promise<ImpactView | null> {
    const row = await this.prisma.changeImpactView.findFirst({ where: { id, workspaceId } });
    return row ? this.hydrate(row) : null;
  }

  async listImpactViewsFor(workspaceId: string, changeRequestId: string): Promise<ImpactView[]> {
    const rows = await this.prisma.changeImpactView.findMany({
      where: { workspaceId, changeRequestId },
      orderBy: { computedAt: 'asc' },
    });
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async latestImpactViewFor(
    workspaceId: string,
    changeRequestId: string,
  ): Promise<ImpactView | null> {
    const all = await this.listImpactViewsFor(workspaceId, changeRequestId);
    return all.length === 0 ? null : all[all.length - 1]!;
  }

  /** Marks the view. There is no path here that edits one. */
  async retainForDecision(workspaceId: string, id: string): Promise<ImpactView> {
    const existing = await this.findImpactView(workspaceId, id);
    if (!existing) throw new Error(`no impact view ${id}`);
    await this.prisma.changeImpactView.update({
      where: { id },
      data: { retainedForDecision: true },
    });
    return { ...existing, retainedForDecision: true };
  }

  /**
   * Rebuilds the eight-area `Record` from rows.
   *
   * An area missing from the database is `unknown` with a reason saying so —
   * never dropped, and never `not-impacted`. `FR-CHR-032` applies to a view
   * read back just as much as to one computed: a row lost in storage is an area
   * nobody can vouch for.
   */
  private async hydrate(row: unknown): Promise<ImpactView> {
    const view = row as {
      id: string;
      workspaceId: string;
      changeRequestId: string;
      computedAt: Date;
      traversalDepth: number;
      retainedForDecision: boolean;
      architectureDecisions: unknown;
      architectureDetail: string;
      violationCheckStatus: string;
      violationCheckBecause: string;
    };
    const rows = (await this.prisma.changeImpactArea.findMany({
      where: { impactViewId: view.id },
    })) as ImpactArea[];
    const byName = new Map(rows.map((area) => [area.area, area]));

    const areas = {} as Record<ImpactAreaName, ImpactArea>;
    for (const name of IMPACT_AREAS) {
      areas[name] = byName.get(name) ?? {
        area: name,
        state: 'unknown',
        detail: `no stored row for ${name} in impact view ${view.id}`,
        itemCount: null,
      };
    }

    return {
      id: view.id,
      workspaceId: view.workspaceId,
      changeRequestId: view.changeRequestId,
      computedAt: view.computedAt,
      traversalDepth: view.traversalDepth,
      retainedForDecision: view.retainedForDecision,
      areas,
      architecture: {
        decisions: Array.isArray(view.architectureDecisions)
          ? (view.architectureDecisions as TouchedDecision[])
          : null,
        detail: view.architectureDetail,
        // The stored status, not a re-derived one. `FR-CHR-034` is a fact about
        // the moment the view was taken.
        violationCheck: {
          status: view.violationCheckStatus as 'not-run',
          because: view.violationCheckBecause,
        },
      },
    };
  }
}
