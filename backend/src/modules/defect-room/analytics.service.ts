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
import { ValidationFailedError } from '../../core/errors.js';

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

export interface EscapeStore {
  create(row: EscapeRecordRow): Promise<EscapeRecordRow>;
  findForDefect(workspaceId: string, defectId: string): Promise<EscapeRecordRow | null>;
  setEscapePoint(
    workspaceId: string,
    defectId: string,
    escapePoint: EscapePoint,
    determinedBy: string,
  ): Promise<EscapeRecordRow>;
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
}
