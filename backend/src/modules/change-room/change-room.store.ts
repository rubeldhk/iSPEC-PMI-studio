/**
 * `T996b` (EPIC-034) — where change requests live.
 *
 * **Persistent from the first commit, deliberately.** `T1178` measured what the
 * usual pattern costs: thirteen modules defaulted to in-memory, none was ever
 * overridden at the composition root, and a Room opened in the running
 * application vanished on restart. The in-memory store here exists for unit
 * tests and nothing else, and `DATABASE_URL` decides — the same seam
 * `AuthModule.register` uses.
 *
 * A change request that disappeared on restart would be worse than most: it is
 * the record that a baseline was questioned, and `RULE-02` routes every
 * in-place edit here.
 */

import type { ImpactView } from './impact.types.js';
import type { ChangeOption } from './option.types.js';

export interface ChangeRequestRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly roomObjectId: string;
  readonly targetBaselineId: string;
  /** `FR-CHR-010` — a change is always against a baseline. */
  readonly targetBaselineVersion: number;
  readonly requestedOutcome: string;
  readonly reason: string;
  readonly requester: string;
  /** `FR-CHR-021` — recorded, never read to skip a gate. */
  readonly urgency: string;
  readonly openQuestions: readonly OpenQuestion[];
  readonly origin: 'direct' | 'defect-transfer';
  readonly originDefectRef: string | null;
  readonly state: 'open' | 'withdrawn' | 'decided' | 'applied' | 'closed';
  readonly rebasedFrom: number | null;
  readonly createdAt: Date;
}

/** `FR-CHR-022` — presented as one set, answerable in place. */
export interface OpenQuestion {
  readonly id: string;
  readonly question: string;
  readonly answer: string | null;
  readonly answeredBy: string | null;
}

export interface ChangeRoomStore {
  create(row: ChangeRequestRow): Promise<ChangeRequestRow>;
  findById(workspaceId: string, id: string): Promise<ChangeRequestRow | null>;
  listForBaseline(workspaceId: string, targetBaselineId: string): Promise<ChangeRequestRow[]>;
  /**
   * `FR-CHR-023` — a withdrawn request is **retained**, with its analysis.
   *
   * A state change, never a delete: the record that somebody questioned a
   * baseline and then thought better of it is part of how the baseline earned
   * its standing.
   */
  setState(
    workspaceId: string,
    id: string,
    state: ChangeRequestRow['state'],
  ): Promise<ChangeRequestRow>;
  setQuestions(
    workspaceId: string,
    id: string,
    questions: readonly OpenQuestion[],
  ): Promise<ChangeRequestRow>;

  /**
   * `FR-CHR-035` — retain the impact view with the change.
   *
   * **Append-only, deliberately.** Storing *the* view against a change and
   * overwriting it on each recomputation answers "what does the impact look
   * like now", which nobody asked. The question a decision must survive is
   * "what did the person deciding see", and an overwritten row cannot answer
   * it. So there is no update and no delete here: a recomputation is a new
   * view, and `saveImpactView` refuses an id it already holds rather than
   * replacing it quietly.
   */
  saveImpactView(view: ImpactView): Promise<ImpactView>;
  findImpactView(workspaceId: string, id: string): Promise<ImpactView | null>;
  /** Every snapshot for a change, oldest first — `R-034-5` compares two. */
  listImpactViewsFor(workspaceId: string, changeRequestId: string): Promise<ImpactView[]>;
  latestImpactViewFor(workspaceId: string, changeRequestId: string): Promise<ImpactView | null>;
  /** Marks a view as referenced by a decision. Marks it — never edits it. */
  retainForDecision(workspaceId: string, id: string): Promise<ImpactView>;

  /**
   * `FR-CHR-043` — the decision, with what was declined.
   *
   * Append-only for the same reason the views are: a decision that could be
   * edited is not a record of what was decided.
   */
  recordDecision(row: ChangeDecisionRow): Promise<ChangeDecisionRow>;
  listDecisionsFor(workspaceId: string, changeRequestId: string): Promise<ChangeDecisionRow[]>;
}

/** `FR-CHR-043`, `FR-CHR-052`. What survives a change decision. */
export interface ChangeDecisionRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly changeRequestId: string;
  readonly decidedBy: string;
  /** `RULE-03` — `human`, and the database CHECKs it too. */
  readonly decidedByKind: string;
  /** From `EPIC-031`'s `BR-0005` record. Copied so it survives a policy change. */
  readonly authorityBasis: string;
  readonly objectVersion: number;
  readonly decidedAt: Date;
  /** `EPIC-031`'s Decision, which evaluated the band. Not redefined here. */
  readonly decisionId: string;
  /** The whole option, not its id: an id sends a reader looking for a set nothing kept. */
  readonly chosenOption: ChangeOption;
  /** Whole, with their trade-offs — the only question they exist to answer. */
  readonly declinedOptions: readonly ChangeOption[];
  readonly rationale: string;
  /** `FR-CHR-035` — the snapshot this was decided against. */
  readonly impactViewId: string;
}

/** For unit tests and database-less runs. Loses data, and does so visibly. */
export class InMemoryChangeRoomStore implements ChangeRoomStore {
  readonly #rows = new Map<string, ChangeRequestRow>();

  async create(row: ChangeRequestRow): Promise<ChangeRequestRow> {
    this.#rows.set(row.id, row);
    return row;
  }

  async findById(workspaceId: string, id: string): Promise<ChangeRequestRow | null> {
    const row = this.#rows.get(id);
    // A row in another workspace is indistinguishable from one that is absent
    // (`FR-002`), and both mean the caller may not have it.
    return row && row.workspaceId === workspaceId ? row : null;
  }

  async listForBaseline(
    workspaceId: string,
    targetBaselineId: string,
  ): Promise<ChangeRequestRow[]> {
    return [...this.#rows.values()].filter(
      (row) => row.workspaceId === workspaceId && row.targetBaselineId === targetBaselineId,
    );
  }

  async setState(
    workspaceId: string,
    id: string,
    state: ChangeRequestRow['state'],
  ): Promise<ChangeRequestRow> {
    const row = await this.findById(workspaceId, id);
    if (!row) throw new Error(`no change request ${id}`);
    const next = { ...row, state };
    this.#rows.set(id, next);
    return next;
  }

  async setQuestions(
    workspaceId: string,
    id: string,
    questions: readonly OpenQuestion[],
  ): Promise<ChangeRequestRow> {
    const row = await this.findById(workspaceId, id);
    if (!row) throw new Error(`no change request ${id}`);
    const next = { ...row, openQuestions: questions };
    this.#rows.set(id, next);
    return next;
  }

  readonly #views: ImpactView[] = [];

  async saveImpactView(view: ImpactView): Promise<ImpactView> {
    // Refused rather than replaced. A silent overwrite is the one way this
    // store could lose what a decision was taken against.
    if (this.#views.some((existing) => existing.id === view.id)) {
      throw new Error(`impact view ${view.id} already exists; views are append-only (FR-CHR-035)`);
    }
    this.#views.push(view);
    return view;
  }

  async findImpactView(workspaceId: string, id: string): Promise<ImpactView | null> {
    return this.#views.find((view) => view.id === id && view.workspaceId === workspaceId) ?? null;
  }

  async listImpactViewsFor(workspaceId: string, changeRequestId: string): Promise<ImpactView[]> {
    return this.#views.filter(
      (view) => view.changeRequestId === changeRequestId && view.workspaceId === workspaceId,
    );
  }

  async latestImpactViewFor(
    workspaceId: string,
    changeRequestId: string,
  ): Promise<ImpactView | null> {
    const all = await this.listImpactViewsFor(workspaceId, changeRequestId);
    return all.length === 0 ? null : all[all.length - 1]!;
  }

  readonly #decisions: ChangeDecisionRow[] = [];

  async recordDecision(row: ChangeDecisionRow): Promise<ChangeDecisionRow> {
    this.#decisions.push(row);
    return row;
  }

  async listDecisionsFor(
    workspaceId: string,
    changeRequestId: string,
  ): Promise<ChangeDecisionRow[]> {
    return this.#decisions.filter(
      (row) => row.workspaceId === workspaceId && row.changeRequestId === changeRequestId,
    );
  }

  async retainForDecision(workspaceId: string, id: string): Promise<ImpactView> {
    const index = this.#views.findIndex(
      (view) => view.id === id && view.workspaceId === workspaceId,
    );
    if (index < 0) throw new Error(`no impact view ${id}`);
    const next = { ...this.#views[index]!, retainedForDecision: true };
    this.#views[index] = next;
    return next;
  }

}
