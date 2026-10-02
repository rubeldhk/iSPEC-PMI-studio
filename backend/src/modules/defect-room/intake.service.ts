/**
 * `T999a`, `T999c` (EPIC-035) — where defects arrive.
 *
 * `FR-DFR-010` to `FR-DFR-013`, `SC-DFR-006`. `BR-0051`'s stake, stated once:
 * **an unlinked defect is invisible to per-Epic quality accounting.**
 *
 * ## Six origins, because the question is asked later
 *
 * A free-text `source` column accepts all six and answers none of the questions
 * the Room exists to answer. *"Which of our defects were caught by a test and
 * which reached production"* is `SC-DFR-008`'s subject, and it is unanswerable
 * over a column holding `prod`, `production`, `Production incident` and
 * `PagerDuty` — all four written by people who were right.
 *
 * ## Held, not refused and not swallowed
 *
 * `FR-DFR-012` takes neither of the two obvious paths. **Refusing** the report
 * that cannot name an Epic means the defect stays with whoever saw it.
 * **Accepting it quietly** writes a row that never appears in per-Epic
 * accounting again. So: recorded, findable, and the missing link *named* —
 * `SC-DFR-006`'s word is **visibly**.
 *
 * The hold has a way out (`linkToEpic`) and a way to be seen (`heldForTriage`).
 * A held state with neither is a grave, and the measure would read 100% while
 * nothing was ever linked.
 *
 * ## And `agent` is an origin, not an authority
 *
 * The specification's edge cases accept an AI-filed defect. It grants nothing:
 * `FR-DFR-023` still forbids an agent confirming one, which lives in
 * `TriageService` where confirmation happens rather than being restated here.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { DefectRoomStore, DefectRow } from './defect-room.store.js';
import type { DefectAnalyticsService } from './analytics.service.js';

/**
 * `FR-DFR-010`, and the database CHECK is the other spelling.
 *
 * Five come from the requirement; `agent` from the specification's edge cases.
 * `T999` reads the CHECK out of the migration and compares — the constant and
 * the constraint are two recollections of one vocabulary, and `DEF-034-001`
 * began as two that never met.
 */
export const DEFECT_ORIGINS = Object.freeze([
  'automated-test',
  'manual-report',
  'monitoring',
  'review-tool',
  'production-incident',
  'agent',
] as const);

export type DefectOrigin = (typeof DEFECT_ORIGINS)[number];

export interface IntakeInput {
  readonly workspaceId: string;
  readonly projectId: string;
  /**
   * `FR-DFR-012` — the one link that may legitimately be missing at intake.
   *
   * Nullable rather than optional: `null` is a stated *"nobody could say"*, and
   * an absent key is a question nobody asked.
   */
  readonly epicId: string | null;
  readonly origin: string;
  readonly originDetail?: string | null;
  readonly contestedArtifactRef: string;
  /** `FR-DFR-024` — the version REPORTED. Nothing re-targets it later. */
  readonly contestedArtifactVersion: string;
  readonly severity: string;
  readonly reportedBy: string;
  readonly affectedRequirementRef?: string | null;
  readonly affectedSpecificationRef?: string | null;
}

export interface IntakeResult {
  readonly defect: DefectRow;
  /**
   * `FR-DFR-012` — what is missing, in words, or `null` when nothing is.
   *
   * The caller filing the report is told at the moment they file it. A null
   * column tells a reader who already suspected something was wrong.
   */
  readonly heldFor: string | null;
}

/** Blank is absent. `''` is a link nobody made, and it satisfies NOT NULL. */
function present(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export class DefectIntakeService {
  constructor(
    private readonly store: DefectRoomStore,
    /**
     * `FR-DFR-082` — capture happens at intake, so it is here.
     *
     * Not a port: escape data is this Room's own record, not somebody else's
     * service. A row written at closure instead would lose every defect still
     * open, which is the first quarter of any real dataset.
     */
    private readonly analytics: DefectAnalyticsService,
  ) {}

  async report(input: IntakeInput): Promise<IntakeResult> {
    if (!(DEFECT_ORIGINS as readonly string[]).includes(input.origin)) {
      // Enumerated, not free text. The refusal names the six so a caller can
      // pick one rather than inventing a seventh in a detail field.
      throw new ValidationFailedError(
        `origin must be one of: ${DEFECT_ORIGINS.join(', ')} (FR-DFR-010, FR-DFR-013)`,
      );
    }

    const projectId = present(input.projectId);
    if (!projectId) {
      // Refused, not held. A defect with no project cannot be stored, let alone
      // found — and holding it would claim to have recorded something nothing
      // wrote. The project is the context the report arrived in; the Epic is
      // the link that can legitimately be unknown.
      throw new ValidationFailedError(
        'a defect report names the project it arrived in (FR-DFR-011)',
      );
    }

    for (const field of [
      'contestedArtifactRef',
      'contestedArtifactVersion',
      'severity',
      'reportedBy',
    ] as const) {
      if (!present(input[field])) {
        throw new ValidationFailedError(`a defect report states its ${field} (FR-DFR-010)`);
      }
    }

    const epicId = present(input.epicId);
    const defect = await this.store.createDefect({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      projectId,
      epicId,
      // `FR-DFR-012` — the state carries the fact, so a query can find it.
      state: epicId ? 'triaged' : 'held-for-triage',
      origin: input.origin,
      originDetail: present(input.originDetail),
      contestedArtifactRef: present(input.contestedArtifactRef)!,
      contestedArtifactVersion: present(input.contestedArtifactVersion)!,
      severity: present(input.severity)!,
      reportedBy: present(input.reportedBy)!,
      reportedAt: new Date(),
    });

    // `FR-DFR-082`. Written for held defects too: skipping it would leave them
    // out of escape analysis for exactly as long as they stayed unlinked, which
    // is the population most worth looking at.
    await this.analytics.captureAtIntake({
      workspaceId: input.workspaceId,
      defectId: defect.id,
      origin: defect.origin,
      severity: defect.severity,
      affectedRequirementRef: input.affectedRequirementRef ?? null,
      affectedSpecificationRef: input.affectedSpecificationRef ?? null,
    });

    return {
      defect,
      heldFor: epicId
        ? null
        : 'held for triage: no Epic could be linked, so this defect is invisible to per-Epic ' +
          'quality accounting until one is (FR-DFR-012, BR-0051)',
    };
  }

  /**
   * `SC-DFR-006` — the way out of the hold.
   *
   * Without it every unlinkable defect stays uncounted forever, and the measure
   * reads 100% because nothing was ever linked rather than because everything
   * was.
   */
  async linkToEpic(
    workspaceId: string,
    defectId: string,
    epicId: string,
    linkedBy: string,
  ): Promise<DefectRow> {
    const epic = present(epicId);
    if (!epic) {
      throw new ValidationFailedError('linking names an Epic (FR-DFR-011)');
    }
    if (!present(linkedBy)) {
      throw new ValidationFailedError('linking records who did it (FR-DFR-011)');
    }

    const defect = await this.store.findDefect(workspaceId, defectId);
    // Absent rather than forbidden — the caller learns nothing about a defect
    // it may not see (`FR-002`).
    if (!defect) throw new NotFoundError('Not found.');

    return this.store.linkEpic(workspaceId, defectId, epic);
  }

  /**
   * `SC-DFR-006` — what is held, without opening every record.
   *
   * The measure's word is *visibly*. A held defect findable only one at a time
   * is indistinguishable from one nobody held.
   */
  async heldForTriage(workspaceId: string): Promise<readonly DefectRow[]> {
    return this.store.heldForTriage(workspaceId);
  }
}
