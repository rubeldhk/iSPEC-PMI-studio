/**
 * `T998a` (EPIC-035) — where defects live.
 *
 * **Persistent from the first commit**, as `EPIC-034`'s store was and for the
 * reason `T1178` measured: thirteen modules defaulted to in-memory, none was
 * ever overridden at the composition root, and a Room opened in the running
 * application vanished on restart. Every test passed throughout.
 *
 * A defect that disappeared on restart would be worse than most: it is the
 * record that somebody said the system was wrong, and losing it looks exactly
 * like nobody ever said so.
 *
 * ## Reclassification is a new row, never an update
 *
 * `FR-DFR-025`, `ADR-0016`. The never-delete rule is about auditability, and
 * **an updated row destroys the same history a deleted one does, more
 * quietly** — the record simply says what it says now, with nothing to show it
 * once said otherwise. So there is no `updateClassification` here, and the
 * supersession is a pointer from the new row to the one it replaced.
 */
import type { Classification } from './classification.types.js';

export interface DefectRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  /** `FR-DFR-012` — nullable, and an unlinked defect is held for triage. */
  readonly epicId?: string | null;
  readonly state: string;
  readonly origin: string;
  readonly originDetail?: string | null;
  readonly contestedArtifactRef: string;
  /** `FR-DFR-024` — the version REPORTED, never silently re-targeted. */
  readonly contestedArtifactVersion: string;
  readonly severity: string;
  readonly reportedBy: string;
  readonly reportedAt: Date;
  readonly withdrawnAt?: Date | null;
  readonly withdrawnReason?: string | null;
}

/**
 * `T998h` — the row behind `DefectTest`.
 *
 * The domain type in `test-first.types.ts` is what a caller reasons about; this
 * adds what the table carries: the workspace, and the last run's outcome and
 * evidence. `lastRunOutcome` starts at `not-run`, which is a third value rather
 * than a boolean's false — *"nobody has run it"* and *"it failed"* are different
 * facts, and a boolean would make them the same one.
 */
export interface DefectTestRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly defectId: string;
  readonly testRef: string;
  /** `FR-DFR-042` — the behaviour, not only the defect. */
  readonly contestedBehaviourRef: string;
  /** `FR-DFR-040` — NOT NULL. The field the whole requirement rests on. */
  readonly firstObservedFailingAt: Date;
  readonly lastRunOutcome: string;
  readonly lastRunEvidenceRef?: string | null;
  readonly createdAt: Date;
}

/** `T998k` — the row behind `Reproduction`. Evidence by reference only. */
export interface ReproductionRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly defectId: string;
  readonly reproducible: string;
  readonly environment: string;
  /** `FR-DFR-032` — ids into `EPIC-032`. Never inline content. */
  readonly evidenceRefs: readonly string[];
  readonly affectedBehaviourRef: string;
  /** `FR-DFR-043` — required exactly when `reproducible` is `not-automatable`. */
  readonly notAutomatableReason: string | null;
  readonly observedAt: Date;
  readonly createdAt: Date;
}

/**
 * `T998p` — the row behind a routing, offer and outcome in one record.
 *
 * `FR-DFR-073` asks that a declined transfer retain **both** the offer and the
 * decline, and this row does that by keeping `offeredReason` while gaining
 * `declinedReason` — the state moves, and no column that recorded the offer is
 * overwritten. That is why a state change here is not the history loss
 * `ADR-0016` forbids for a classification: nothing a routing row said earlier
 * stops being readable.
 */
export interface RoutingRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly defectId: string;
  /** Not the defect alone: a transfer is a consequence of a judgement. */
  readonly classificationId: string;
  readonly destination: string;
  /** `FR-DFR-072`, `UX-0034` — NOT NULL, and non-empty. */
  readonly offeredReason: string;
  readonly state: string;
  readonly declinedAt: Date | null;
  readonly declinedReason: string | null;
  /** `FR-DFR-074` — what the destination said when it refused. */
  readonly refusalDetail: string | null;
  /** `FR-DFR-071` — references into `EPIC-032`, never copies. */
  readonly carriedEvidenceRefs: readonly string[];
  /** `SC-DFR-010` — what the destination called the thing it created. */
  readonly targetRef: string | null;
  readonly createdAt: Date;
}

/**
 * `T998v` — the row behind an `EvidenceCheck`.
 *
 * A table rather than a status field, because `US4` scenario 2 requires **which
 * path was taken** to be recorded, and because an intermittent defect can pass
 * through this step more than once (`FR-DFR-031`). One row per defect would keep
 * only the most recent reading and lose the pattern — which is the only
 * evidence intermittency ever produces.
 */
export interface EvidenceCheckRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly defectId: string;
  readonly defectTestId: string;
  /** The column vocabulary: `refine-test` | `investigate` | `reclassify`. */
  readonly path: string;
  readonly resolvedBy: string;
  readonly resolvedAt: Date;
  readonly rationale: string;
  readonly createdAt: Date;
}

/**
 * `R-035-3` — the link `TaskRecord` has nowhere to put.
 *
 * `EPIC-012`'s row is created unmodified; this is where the defect and the test
 * that proved it are recorded, on this Room's side of the boundary.
 */
export interface RepairLinkRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly defectId: string;
  /** `FR-DFR-050` — NOT NULL. Repair work traces to the test that proved it. */
  readonly defectTestId: string;
  readonly taskId: string;
  /** `US7` scenario 4 — set when a reclassification cuts these tasks loose. */
  readonly orphanedByClassificationId: string | null;
  readonly createdAt: Date;
}

export interface DefectRoomStore {
  createDefect(row: DefectRow): Promise<DefectRow>;
  findDefect(workspaceId: string, id: string): Promise<DefectRow | null>;
  setDefectState(workspaceId: string, id: string, state: string): Promise<DefectRow>;

  /**
   * `FR-DFR-012` — link an Epic to a defect that arrived without one.
   *
   * The Epic and the state move together, because they are one fact: a linked
   * defect is no longer held FOR anything. Two calls could half-succeed and
   * leave a linked defect sitting in a queue nobody works, or a held one that
   * every per-Epic report counts.
   */
  linkEpic(workspaceId: string, id: string, epicId: string): Promise<DefectRow>;

  /** `SC-DFR-006` — what is held, without opening every record. */
  heldForTriage(workspaceId: string): Promise<readonly DefectRow[]>;

  /** `FR-DFR-050` — one row per repair task, linking it to the defect and test. */
  recordRepairLink(row: RepairLinkRow): Promise<RepairLinkRow>;
  repairLinksFor(workspaceId: string, defectId: string): Promise<readonly RepairLinkRow[]>;
  /**
   * `FR-DFR-025`, `US7` scenario 4 — mark, never delete.
   *
   * Marks only rows not already cut loose: the first classification that
   * orphaned them is the honest answer, and a later one overwriting it would
   * claim the tasks survived until then.
   */
  orphanRepairLinks(
    workspaceId: string,
    defectId: string,
    classificationId: string,
  ): Promise<readonly RepairLinkRow[]>;

  /**
   * `FR-DFR-025` — append-only.
   *
   * There is deliberately no `updateClassification`. A reclassification is a
   * new row pointing at the one it supersedes, because an updated row destroys
   * the same history a deleted one does and leaves nothing to show it happened.
   */
  recordClassification(row: Classification): Promise<Classification>;
  /**
   * `FR-DFR-025` — mark a classification superseded by a newer one.
   *
   * The only mutation this store offers on a classification, and it moves one
   * field. `EPIC-033`'s baseline `supersede` has the same shape and states the
   * same reason: the row stands, and only the pointer moves. Nothing here
   * rewrites an outcome, a rationale or a behaviour reference.
   */
  markSuperseded(
    workspaceId: string,
    id: string,
    bySupersedingId: string,
    at: Date,
  ): Promise<Classification>;
  listClassifications(workspaceId: string, defectId: string): Promise<Classification[]>;
  currentClassification(workspaceId: string, defectId: string): Promise<Classification | null>;

  /** `FR-DFR-040` — the test that was seen to fail. */
  recordTest(row: DefectTestRow): Promise<DefectTestRow>;
  testsFor(workspaceId: string, defectId: string): Promise<DefectTestRow[]>;
  /**
   * The outcome of the most recent run, and the evidence for it.
   *
   * An update rather than a new row, and the one place this store updates a
   * test: the run history lives in `EPIC-032` as attestations, so a second copy
   * here would be a history that could disagree with the evidence it cites.
   * `firstObservedFailingAt` is never touched — that instant is the record.
   */
  setTestRun(
    workspaceId: string,
    id: string,
    outcome: string,
    evidenceRef: string | null,
  ): Promise<DefectTestRow>;

  /** `FR-DFR-030` — reproducibility, environment, evidence, affected behaviour. */
  recordReproduction(row: ReproductionRow): Promise<ReproductionRow>;
  reproductionsFor(workspaceId: string, defectId: string): Promise<ReproductionRow[]>;
  /**
   * `FR-DFR-043` — every stated exception in the workspace.
   *
   * A query rather than a filter a caller assembles, because "visible and
   * enumerable" is a requirement and a requirement nobody can call is one
   * nobody meets. An exception that can only be found by opening every defect
   * is indistinguishable from a policy.
   */
  notAutomatableIn(workspaceId: string): Promise<ReproductionRow[]>;

  /** `FR-DFR-070` to `FR-DFR-076` — where an item went, and what happened. */
  recordRouting(row: RoutingRow): Promise<RoutingRow>;
  routingsFor(workspaceId: string, defectId: string): Promise<RoutingRow[]>;
  /**
   * Four narrow transitions rather than one patch.
   *
   * Each writes exactly the columns its state requires, which is what the
   * table's CHECKs already say: a decline carries a time and a reason, a
   * refusal carries detail, an acceptance carries a target. A general
   * `update(patch)` would let a caller reach `accepted` with no target — the
   * state where this Room believes somebody else has the item and nobody does.
   */
  declineRouting(
    workspaceId: string,
    id: string,
    reason: string,
    at: Date,
  ): Promise<RoutingRow>;
  acceptRouting(workspaceId: string, id: string, targetRef: string): Promise<RoutingRow>;
  refuseRouting(workspaceId: string, id: string, detail: string): Promise<RoutingRow>;
  returnRouting(workspaceId: string, id: string, detail: string): Promise<RoutingRow>;

  /** `FR-DFR-044` — which of the three paths was taken, and by whom. */
  recordEvidenceCheck(row: EvidenceCheckRow): Promise<EvidenceCheckRow>;
  evidenceChecksFor(workspaceId: string, defectId: string): Promise<EvidenceCheckRow[]>;
}

/** For unit tests and database-less runs. Loses data, and does so visibly. */
export class InMemoryDefectRoomStore implements DefectRoomStore {
  readonly #defects = new Map<string, DefectRow>();
  readonly #classifications: Classification[] = [];
  #repairLinks: RepairLinkRow[] = [];
  readonly #tests: DefectTestRow[] = [];
  readonly #reproductions: ReproductionRow[] = [];
  readonly #routings: RoutingRow[] = [];
  readonly #evidenceChecks: EvidenceCheckRow[] = [];

  async createDefect(row: DefectRow): Promise<DefectRow> {
    this.#defects.set(row.id, row);
    return row;
  }

  async findDefect(workspaceId: string, id: string): Promise<DefectRow | null> {
    const row = this.#defects.get(id);
    // A row in another workspace is indistinguishable from one that is absent
    // (`FR-002`), and both mean the caller may not have it.
    return row && row.workspaceId === workspaceId ? row : null;
  }

  async setDefectState(workspaceId: string, id: string, state: string): Promise<DefectRow> {
    const row = await this.findDefect(workspaceId, id);
    if (!row) throw new Error(`no defect ${id}`);
    const next = { ...row, state };
    this.#defects.set(id, next);
    return next;
  }

  async linkEpic(workspaceId: string, id: string, epicId: string): Promise<DefectRow> {
    const row = await this.findDefect(workspaceId, id);
    if (!row) throw new Error(`no defect ${id}`);
    // Both fields in one write, for the reason on the interface.
    const next = { ...row, epicId, state: row.state === 'held-for-triage' ? 'triaged' : row.state };
    this.#defects.set(id, next);
    return next;
  }

  async heldForTriage(workspaceId: string): Promise<readonly DefectRow[]> {
    return [...this.#defects.values()].filter(
      (row) => row.workspaceId === workspaceId && row.state === 'held-for-triage',
    );
  }

  async recordRepairLink(row: RepairLinkRow): Promise<RepairLinkRow> {
    this.#repairLinks.push(row);
    return row;
  }

  async repairLinksFor(workspaceId: string, defectId: string): Promise<readonly RepairLinkRow[]> {
    return this.#repairLinks.filter(
      (row) => row.workspaceId === workspaceId && row.defectId === defectId,
    );
  }

  async orphanRepairLinks(
    workspaceId: string,
    defectId: string,
    classificationId: string,
  ): Promise<readonly RepairLinkRow[]> {
    const marked: RepairLinkRow[] = [];
    this.#repairLinks = this.#repairLinks.map((row) => {
      if (
        row.workspaceId !== workspaceId ||
        row.defectId !== defectId ||
        row.orphanedByClassificationId !== null
      ) {
        return row;
      }
      const next = { ...row, orphanedByClassificationId: classificationId };
      marked.push(next);
      return next;
    });
    return marked;
  }

  async recordClassification(row: Classification): Promise<Classification> {
    this.#classifications.push(row);
    return row;
  }

  async markSuperseded(
    workspaceId: string,
    id: string,
    bySupersedingId: string,
    at: Date,
  ): Promise<Classification> {
    const index = this.#classifications.findIndex(
      (row) => row.id === id && row.workspaceId === workspaceId,
    );
    if (index < 0) throw new Error(`no classification ${id}`);
    const next: Classification = {
      ...this.#classifications[index]!,
      supersededByClassificationId: bySupersedingId,
      reclassifiedAt: at,
    };
    this.#classifications[index] = next;
    return next;
  }

  async listClassifications(workspaceId: string, defectId: string): Promise<Classification[]> {
    return this.#classifications.filter(
      (row) => row.workspaceId === workspaceId && row.defectId === defectId,
    );
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
    const all = await this.listClassifications(workspaceId, defectId);
    // The row nothing has superseded. A forward pointer makes this a filter
    // rather than a set difference — and, more usefully, makes "superseded" a
    // fact the old row states about itself rather than one inferred from the
    // absence of a newer one.
    const live = all.filter((row) => row.supersededByClassificationId === null);
    return live.length === 0 ? null : live[live.length - 1]!;
  }

  async recordTest(row: DefectTestRow): Promise<DefectTestRow> {
    this.#tests.push(row);
    return row;
  }

  async testsFor(workspaceId: string, defectId: string): Promise<DefectTestRow[]> {
    return this.#tests.filter(
      (row) => row.workspaceId === workspaceId && row.defectId === defectId,
    );
  }

  async setTestRun(
    workspaceId: string,
    id: string,
    outcome: string,
    evidenceRef: string | null,
  ): Promise<DefectTestRow> {
    const index = this.#tests.findIndex(
      (row) => row.id === id && row.workspaceId === workspaceId,
    );
    if (index < 0) throw new Error(`no defect test ${id}`);
    const next: DefectTestRow = {
      ...this.#tests[index]!,
      lastRunOutcome: outcome,
      lastRunEvidenceRef: evidenceRef,
    };
    this.#tests[index] = next;
    return next;
  }

  async recordReproduction(row: ReproductionRow): Promise<ReproductionRow> {
    this.#reproductions.push(row);
    return row;
  }

  async reproductionsFor(workspaceId: string, defectId: string): Promise<ReproductionRow[]> {
    return this.#reproductions.filter(
      (row) => row.workspaceId === workspaceId && row.defectId === defectId,
    );
  }

  async notAutomatableIn(workspaceId: string): Promise<ReproductionRow[]> {
    return this.#reproductions.filter(
      (row) => row.workspaceId === workspaceId && row.reproducible === 'not-automatable',
    );
  }
  async recordRouting(row: RoutingRow): Promise<RoutingRow> {
    this.#routings.push(row);
    return row;
  }

  async routingsFor(workspaceId: string, defectId: string): Promise<RoutingRow[]> {
    return this.#routings.filter(
      (row) => row.workspaceId === workspaceId && row.defectId === defectId,
    );
  }

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
    patch: Partial<RoutingRow>,
  ): Promise<RoutingRow> {
    const index = this.#routings.findIndex(
      (row) => row.id === id && row.workspaceId === workspaceId,
    );
    if (index < 0) throw new Error(`no routing ${id}`);
    const next = { ...this.#routings[index]!, ...patch };
    this.#routings[index] = next;
    return next;
  }
  async recordEvidenceCheck(row: EvidenceCheckRow): Promise<EvidenceCheckRow> {
    this.#evidenceChecks.push(row);
    return row;
  }

  async evidenceChecksFor(workspaceId: string, defectId: string): Promise<EvidenceCheckRow[]> {
    return this.#evidenceChecks.filter(
      (row) => row.workspaceId === workspaceId && row.defectId === defectId,
    );
  }
}
