/**
 * `T997z` (EPIC-035) — escape capture, at intake.
 *
 * `FR-DFR-080`, `FR-DFR-082`.
 *
 * ## Why intake rather than closure
 *
 * Escape analysis asks *where did this get through?*, and the obvious place to
 * answer it is at closure, when somebody knows. That is also the moment the
 * data stops being collectable for every defect closed before the feature
 * shipped, and for every defect still open.
 *
 * Writing the row at intake with `escapePoint` null costs nothing and makes the
 * population complete from the first defect. Adding the column later leaves the
 * first quarter's defects permanently outside the analysis, and no amount of
 * care afterwards recovers them — the numbers simply start part-way through and
 * nobody can tell by looking.
 *
 * ## `escapePoint` may be null; the row may not
 *
 * A null `escapePoint` says *nobody has determined this yet* — a real state
 * somebody can act on. A missing row says nothing, and is indistinguishable
 * from a defect that escaped nowhere.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { DefectRoomStore } from './defect-room.store.js';

/** The eight points a defect can escape past, per the data model §8. */
export const ESCAPE_POINTS = Object.freeze([
  'requirements',
  'specification',
  'design',
  'implementation',
  'review',
  'test',
  'release',
  'production',
] as const);

export type EscapePoint = (typeof ESCAPE_POINTS)[number];

export interface EscapeRecordRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly defectId: string;
  /** Denormalised at intake, so the analysis does not depend on the defect
   * record still saying what it said then. */
  readonly origin: string;
  readonly severity: string;
  /** `null` until somebody determines it. The row is never null. */
  readonly escapePoint: EscapePoint | null;
  readonly affectedRequirementRef: string | null;
  readonly affectedSpecificationRef: string | null;
  readonly resolutionEvidenceRef: string | null;
  readonly capturedAt: Date;
}

/** One bucket of a distribution: a value and how many carry it. */
export interface Bucket {
  readonly key: string;
  readonly count: number;
}

/**
 * `FR-DFR-083` — what this distribution cannot see.
 *
 * `complete` is `false` and there is **no `true` arm**. A caller cannot build a
 * complete distribution because the type has no such shape, and a renderer
 * cannot skip the note because the field is not optional.
 *
 * `EPIC-034` used this for `violationCheck: { status: 'not-run' }`, for the
 * same reason: when `BR-0163` gets an owner, adding the other arm is a
 * deliberate edit somebody reviews, rather than a boolean quietly flipping.
 */
/**
 * `FR-DFR-083` — the one note this Room can honestly attach today.
 *
 * Frozen and module-level: one wording, in one place, so two screens cannot
 * describe the same gap differently. **A distribution that omits a source it
 * cannot see is a chart that lies by arithmetic** — every number in it correct,
 * and the conclusion a reader draws false.
 *
 * It does not claim the counts are wrong. They are right; the population is
 * partial. And it does not estimate how much is missing, because nobody knows
 * and a number with no source gets quoted as though it had one.
 */
export const TELEMETRY_UNAVAILABLE: CompletenessNote = Object.freeze({
  complete: false,
  missing: Object.freeze([
    'telemetry-originated defect linkage (BR-0163, capability area U-19)',
  ]) as readonly string[],
  because:
    'Defects that production telemetry would have raised are not linked automatically: BR-0163 ' +
    'is capability area U-19 and has no owning Epic. The counts below are correct for the ' +
    'sources this Room does receive, and are not the whole population.',
});

export interface CompletenessNote {
  readonly complete: false;
  readonly missing: readonly string[];
  readonly because: string;
}

/**
 * `FR-DFR-081`, `SC-DFR-008` — the answer, without opening each record.
 *
 * `notDetermined` is reported rather than dropped: a defect whose escape point
 * nobody has decided is not a defect that escaped nowhere, and a distribution
 * summing to less than `total` looks like a bug instead of a fact.
 */
export interface EscapeDistribution {
  readonly total: number;
  readonly byOrigin: readonly Bucket[];
  readonly byEscapePoint: readonly Bucket[];
  readonly bySeverity: readonly Bucket[];
  readonly notDetermined: number;
  readonly withResolutionEvidence: number;
  readonly completeness: CompletenessNote;
}

/** What the store computes, before the note is attached. */
export interface EscapeAggregate {
  readonly total: number;
  readonly byOrigin: readonly Bucket[];
  readonly byEscapePoint: readonly Bucket[];
  readonly bySeverity: readonly Bucket[];
  readonly notDetermined: number;
  readonly withResolutionEvidence: number;
}

export interface EscapeStore {
  create(row: EscapeRecordRow): Promise<EscapeRecordRow>;
  findForDefect(workspaceId: string, defectId: string): Promise<EscapeRecordRow | null>;
  setEscapePoint(
    workspaceId: string,
    defectId: string,
    escapePoint: EscapePoint,
    determinedBy: string,
  ): Promise<EscapeRecordRow>;
  /** `FR-DFR-080` — the sixth retained field, which had no writer until now. */
  setResolutionEvidence(
    workspaceId: string,
    defectId: string,
    evidenceRef: string,
  ): Promise<EscapeRecordRow>;
  /**
   * `FR-DFR-081` — counts, computed where the rows are.
   *
   * On the store rather than in the service, so the PostgreSQL adapter can
   * group in the database. A service that fetched every row and counted in
   * memory would be a survey with extra steps: correct today, and the first
   * thing to be quietly capped when a workspace gets large.
   */
  aggregate(workspaceId: string): Promise<EscapeAggregate>;
}

/** For unit tests and database-less runs. Loses data, and does so visibly. */
export class InMemoryEscapeStore implements EscapeStore {
  readonly #rows = new Map<string, EscapeRecordRow>();

  #key(workspaceId: string, defectId: string): string {
    return `${workspaceId}::${defectId}`;
  }

  async create(row: EscapeRecordRow): Promise<EscapeRecordRow> {
    this.#rows.set(this.#key(row.workspaceId, row.defectId), row);
    return row;
  }

  async findForDefect(workspaceId: string, defectId: string): Promise<EscapeRecordRow | null> {
    return this.#rows.get(this.#key(workspaceId, defectId)) ?? null;
  }

  async setEscapePoint(
    workspaceId: string,
    defectId: string,
    escapePoint: EscapePoint,
  ): Promise<EscapeRecordRow> {
    const row = await this.findForDefect(workspaceId, defectId);
    if (!row) throw new Error(`no escape record for defect ${defectId}`);
    const next = { ...row, escapePoint };
    this.#rows.set(this.#key(workspaceId, defectId), next);
    return next;
  }

  async setResolutionEvidence(
    workspaceId: string,
    defectId: string,
    evidenceRef: string,
  ): Promise<EscapeRecordRow> {
    const row = await this.findForDefect(workspaceId, defectId);
    if (!row) throw new Error(`no escape record for defect ${defectId}`);
    const next = { ...row, resolutionEvidenceRef: evidenceRef };
    this.#rows.set(this.#key(workspaceId, defectId), next);
    return next;
  }

  /**
   * Grouped in memory, because this store IS memory.
   *
   * The interface exists so the PostgreSQL adapter can group in the database;
   * here there is nowhere else to do it. Deliberately does not call
   * `findForDefect` — `T999d` wires that to throw and asserts the aggregate
   * still answers.
   */
  async aggregate(workspaceId: string): Promise<EscapeAggregate> {
    const rows = [...this.#rows.values()].filter((row) => row.workspaceId === workspaceId);
    const tally = (of: (row: EscapeRecordRow) => string | null): Bucket[] => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const key = of(row);
        if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts].map(([key, count]) => ({ key, count }));
    };

    return {
      total: rows.length,
      byOrigin: tally((row) => row.origin),
      byEscapePoint: tally((row) => row.escapePoint),
      bySeverity: tally((row) => row.severity),
      notDetermined: rows.filter((row) => row.escapePoint === null).length,
      withResolutionEvidence: rows.filter((row) => row.resolutionEvidenceRef !== null).length,
    };
  }
}

export interface CaptureAtIntakeInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly origin: string;
  readonly severity: string;
  readonly affectedRequirementRef?: string | null;
  readonly affectedSpecificationRef?: string | null;
}

export class DefectAnalyticsService {
  constructor(private readonly store: EscapeStore) {}

  /**
   * `FR-DFR-082` — write the row when the defect arrives.
   *
   * Every check happens before anything is written, so a refused capture cannot
   * leave a half-formed record behind.
   */
  async captureAtIntake(input: CaptureAtIntakeInput): Promise<EscapeRecordRow> {
    for (const field of ['origin', 'severity'] as const) {
      if ((input[field] ?? '').trim() === '') {
        // Both are known at intake — that is why capture happens here. A blank
        // one leaves a row that cannot answer the question it exists for.
        throw new ValidationFailedError(
          `an escape record states its ${field} at intake (FR-DFR-082)`,
        );
      }
    }

    const existing = await this.store.findForDefect(input.workspaceId, input.defectId);
    if (existing) {
      // One-to-one. Two rows would double-count the defect in every escape
      // metric, which is the quietest way to make an analysis wrong.
      throw new ValidationFailedError(
        `defect ${input.defectId} already has an escape record`,
      );
    }

    return this.store.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      defectId: input.defectId,
      origin: input.origin,
      severity: input.severity,
      // Null, not absent. Nobody has determined it yet, and that is a state
      // somebody can act on.
      escapePoint: null,
      affectedRequirementRef: input.affectedRequirementRef ?? null,
      affectedSpecificationRef: input.affectedSpecificationRef ?? null,
      resolutionEvidenceRef: null,
      capturedAt: new Date(),
    });
  }

  /**
   * Set the escape point once somebody has determined it.
   *
   * Refuses a defect with no row rather than creating one. If that ever
   * happens, capture did not run at intake — and creating the row here would
   * reintroduce the gap this whole task exists to close, silently.
   */
  async recordEscapePoint(
    workspaceId: string,
    defectId: string,
    escapePoint: EscapePoint,
    determinedBy: string,
  ): Promise<EscapeRecordRow> {
    if (!(ESCAPE_POINTS as readonly string[]).includes(escapePoint)) {
      throw new ValidationFailedError(
        `escape point must be one of: ${ESCAPE_POINTS.join(', ')}`,
      );
    }
    const existing = await this.store.findForDefect(workspaceId, defectId);
    if (!existing) {
      throw new ValidationFailedError(
        `no escape record for defect ${defectId} — capture runs at intake (FR-DFR-082), so its ` +
          'absence means intake did not, and creating one here would hide that',
      );
    }
    return this.store.setEscapePoint(workspaceId, defectId, escapePoint, determinedBy);
  }

  /**
   * `FR-DFR-080` — the resolution evidence, retained.
   *
   * The column existed from the first migration with nothing writing it. Left
   * that way it would have aggregated as null forever and read as *"no defect
   * was ever resolved with evidence"*, which is not what an unfilled column
   * means — and nothing in the data would have said which it was.
   */
  async recordResolutionEvidence(
    workspaceId: string,
    defectId: string,
    evidenceRef: string,
  ): Promise<EscapeRecordRow> {
    if (evidenceRef.trim() === '') {
      // Worse than null: an empty string satisfies "is it set?" while pointing
      // at nothing in `EPIC-032`.
      throw new ValidationFailedError(
        'resolution evidence is a reference into EPIC-032, not a blank (FR-DFR-080)',
      );
    }
    const existing = await this.store.findForDefect(workspaceId, defectId);
    if (!existing) {
      throw new ValidationFailedError(
        `no escape record for defect ${defectId} — capture runs at intake (FR-DFR-082), so its ` +
          'absence means intake did not, and creating one here would hide that',
      );
    }
    return this.store.setResolutionEvidence(workspaceId, defectId, evidenceRef.trim());
  }

  /**
   * `FR-DFR-081`, `FR-DFR-083`, `SC-DFR-008` — the distribution, and what it
   * cannot see.
   *
   * The note is attached here rather than by the caller, because a caller who
   * has to remember it is a caller who will not. It is attached to the
   * distribution rather than to each bucket, because a per-bucket note vanishes
   * the moment somebody filters or sorts — and filtering is what people do with
   * distributions.
   */
  async distribution(workspaceId: string): Promise<EscapeDistribution> {
    const aggregate = await this.store.aggregate(workspaceId);
    return { ...aggregate, completeness: TELEMETRY_UNAVAILABLE };
  }
}

/**
 * `T999f` (EPIC-035) — what is blocking this defect.
 *
 * `FR-DFR-093`, `UX-0032`: *what is blocking progress MUST be visible without
 * opening another screen.*
 *
 * ## Why this is a service and not a rendering concern
 *
 * The obvious implementation is a badge on the Room page, computed in the
 * component from whatever the page happened to fetch. Then the page fetches one
 * thing less, the badge silently stops appearing, and every test still passes
 * because none of them assert the absence of a thing that used to be there.
 *
 * Derived here, from the record, the answer is the same on the page, in the API
 * and in a report. And `needs` names who would clear it — a blocker that says
 * *"blocked"* and nothing else sends somebody to ask in chat, which is the
 * screen `UX-0032` is trying to save them from opening.
 *
 * ## A separate class in this file, deliberately
 *
 * `DefectAnalyticsService` takes an `EscapeStore` and cannot reach the defect
 * table; that separation is why escape aggregation cannot accidentally grow a
 * join. This class needs the defect store and has no business with escape rows,
 * so it takes the other one. They share a file because they share a task
 * (`T999f`), not a dependency.
 */
export interface Blocker {
  /** Short enough for a badge. */
  readonly what: string;
  /** The requirement, so the rule is chaseable rather than folklore. */
  readonly because: string;
  /** What would clear it. A blocker with no exit is a complaint. */
  readonly needs: string;
}

export class DefectBlockersService {
  constructor(private readonly store: DefectRoomStore) {}

  /**
   * Every blocker at once, in the order they must be cleared.
   *
   * Not the first one: a person told *"not triaged"*, who triages, and is then
   * told *"no failing test"*, has been sent round the loop twice for something
   * that could have been said once. `UX-0032` is about the screen they do not
   * have to open, and a queue of one-at-a-time answers is that screen with
   * extra steps.
   */
  async blockersFor(workspaceId: string, defectId: string): Promise<readonly Blocker[]> {
    const defect = await this.store.findDefect(workspaceId, defectId);
    // Absent rather than forbidden (`FR-002`).
    if (!defect) throw new NotFoundError('Not found.');

    const blockers: Blocker[] = [];

    if (defect.epicId === null || defect.epicId === undefined) {
      blockers.push({
        what: 'Not linked to an Epic',
        because:
          'FR-DFR-012 — an unlinked defect is invisible to per-Epic quality accounting (BR-0051).',
        needs: 'POST /rooms/defect/:id/link-epic',
      });
    }

    const classification = await this.store.currentClassification(workspaceId, defectId);
    if (!classification) {
      blockers.push({
        what: 'Not triaged',
        because:
          'FR-DFR-020 — a defect is judged against approved behaviour before implementation ' +
          'work begins (SC-DFR-002).',
        needs: 'POST /rooms/defect/:id/triage',
      });
      // The rest of the chain is downstream of a judgement that has not
      // happened. Listing "no failing test" beside it would be true and
      // useless: nobody writes a test for a defect nobody has confirmed.
      return blockers;
    }

    if (classification.outcome !== 'confirmed-defect') {
      const routings = await this.store.routingsFor(workspaceId, defectId);
      const settled = routings.some((row) => row.state === 'accepted');
      if (!settled) {
        blockers.push({
          what: `Classified ${classification.outcome}, not yet routed`,
          because:
            'SC-DFR-010 — a classification that is not a defect rests with the Room that owns ' +
            'it, and nothing is recorded as routed to a destination that never received it.',
          needs:
            classification.outcome === 'change-request'
              ? 'POST /rooms/defect/:id/transfer'
              : 'POST /rooms/defect/:id/route-gap',
        });
      }
      return blockers;
    }

    const tests = await this.store.testsFor(workspaceId, defectId);
    if (tests.length === 0) {
      blockers.push({
        what: 'No failing test on record',
        because:
          'FR-DFR-041 — a fix submitted with no failing test is not accepted, unless the defect ' +
          'is recorded as not-automatable with alternative evidence (FR-DFR-043).',
        needs: 'POST /rooms/defect/:id/test',
      });
    }

    if (defect.state !== 'closed') {
      // Not a deployment fact. `R-035-1`: BR-0080 has no callable owner
      // ANYWHERE in the programme, so this blocks every closure everywhere
      // until somebody builds the surface. Saying so here is the difference
      // between a Room that looks broken and one that is waiting on a named
      // dependency.
      blockers.push({
        what: 'Closure needs a test run, and nothing can run tests',
        because:
          'FR-DFR-062, R-035-1 — test execution is requested from EPIC-015 (BR-0080), which ' +
          'built a promotion gate rather than a callable surface. This Epic must not build a ' +
          'second test runner.',
        needs: 'an owner for BR-0080 test execution',
      });
    }

    return blockers;
  }
}
