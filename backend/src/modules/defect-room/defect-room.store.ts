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

export interface DefectRoomStore {
  createDefect(row: DefectRow): Promise<DefectRow>;
  findDefect(workspaceId: string, id: string): Promise<DefectRow | null>;
  setDefectState(workspaceId: string, id: string, state: string): Promise<DefectRow>;

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
}

/** For unit tests and database-less runs. Loses data, and does so visibly. */
export class InMemoryDefectRoomStore implements DefectRoomStore {
  readonly #defects = new Map<string, DefectRow>();
  readonly #classifications: Classification[] = [];
  readonly #tests: DefectTestRow[] = [];
  readonly #reproductions: ReproductionRow[] = [];

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
}
