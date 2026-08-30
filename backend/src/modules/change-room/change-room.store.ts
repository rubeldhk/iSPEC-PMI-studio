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
}
