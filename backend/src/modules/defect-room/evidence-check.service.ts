/**
 * `T998v` (EPIC-035) — where a passing reproduction run goes, and what it is
 * not allowed to become.
 *
 * `FR-DFR-031`, `FR-DFR-044`, `SC-DFR-004`, `R-035-6`, and `ADR-0016`'s failure
 * mode stated in the imperative: *"Do NOT blindly classify every passing
 * reproduction test as a Change Request."*
 *
 * ## The inference this service refuses
 *
 * The reproduction test passes. The obvious reading is that the defect is not
 * real, so the item becomes a change request and everyone moves on. That
 * reading is wrong often enough to matter: the test may reproduce the wrong
 * thing, the environment may differ from the one the defect was reported in, or
 * the defect may be intermittent.
 *
 * A system that reclassifies on a green run is not reasoning. It is guessing,
 * and guessing in the direction that closes work — the direction nobody pushes
 * back on.
 *
 * ## Three paths, required, with no default
 *
 * `R-035-6` rejected defaulting to `investigate`, because **a path taken by
 * omission is a decision nobody made** and the whole requirement is that
 * somebody makes it.
 *
 * ## Even `reclassify` does not reclassify
 *
 * It records that somebody chose to, and answers with the route where the new
 * outcome is stated with its own rationale. This service cannot know *which*
 * outcome the item becomes — that is the judgement `FR-DFR-020` puts in front
 * of approved behaviour, and a check that guessed it would be the automatic
 * reclassification arriving one step later, past the place anybody looks.
 *
 * The `intermittent` rule (`FR-DFR-031`) lives here rather than in
 * `verification.service.ts` because this is where a passing reproduction run is
 * interpreted, and interpreting it is the act the requirement constrains.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { DefectRoomStore, EvidenceCheckRow } from './defect-room.store.js';
import {
  EVIDENCE_CHECK_PATHS,
  type EvidenceCheckPath,
} from './evidence-check.types.js';

/**
 * The `path` column's vocabulary, which is not the vocabulary the type uses.
 *
 * SQL CHECKs three short values; `EVIDENCE_CHECK_PATHS` names what a person
 * chose in words they would recognise. Two spellings of one fact, and this
 * function is the only place they meet — a second mapping elsewhere is how they
 * would come to disagree, which is `destinationColumnFor`'s reasoning one table
 * over.
 */
function pathColumnFor(path: EvidenceCheckPath): string {
  return { 'refine-the-test': 'refine-test', 'investigate-further': 'investigate', reclassify: 'reclassify' }[
    path
  ];
}

/** Where somebody states the new outcome, once they have chosen to. */
export const REEVALUATE_ROUTE = 'POST /rooms/defect/:id/reevaluate';

export interface RaiseCheckInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly testId: string;
  readonly outcome: 'pass' | 'fail';
  readonly evidenceRef: string | null;
}

export interface RaisedCheck {
  /** Exactly the three, read from the vocabulary rather than restated. */
  readonly paths: readonly EvidenceCheckPath[];
}

export interface ChoosePathInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly testId: string;
  readonly path: string;
  readonly chosenBy: string;
  readonly reason: string;
  readonly now?: Date;
}

export interface ChosenPath {
  readonly check: EvidenceCheckRow;
  /** The route to take next, when the path implies one. */
  readonly next: string | null;
}

export class EvidenceCheckService {
  constructor(private readonly store: DefectRoomStore) {}

  /**
   * `FR-DFR-044` — a passing run raises the check, and answers nothing.
   *
   * The raise is a question. A raise that also recorded an answer would be the
   * automatic path wearing a person's clothes.
   */
  async raise(input: RaiseCheckInput): Promise<RaisedCheck> {
    await this.require(input.workspaceId, input.defectId);

    if (input.outcome !== 'pass') {
      // A failing reproduction test is the ordinary state: the defect
      // reproduces. Raising a check would ask somebody to explain a result
      // nobody doubts.
      throw new ValidationFailedError(
        'an evidence check is raised by a PASSING reproduction run; a failing one is the defect ' +
          'reproducing (FR-DFR-044)',
      );
    }

    await this.store.setTestRun(input.workspaceId, input.testId, 'pass', input.evidenceRef);
    return { paths: EVIDENCE_CHECK_PATHS };
  }

  /** `FR-DFR-044`, `FR-DFR-031` — a person chooses one of the three, and says why. */
  async choose(input: ChoosePathInput): Promise<ChosenPath> {
    await this.require(input.workspaceId, input.defectId);

    if (!(EVIDENCE_CHECK_PATHS as readonly string[]).includes(input.path)) {
      throw new ValidationFailedError(
        `an evidence check takes one of ${EVIDENCE_CHECK_PATHS.join(', ')}; it has no default, ` +
          'because a path taken by omission is a decision nobody made (FR-DFR-044, R-035-6)',
      );
    }
    const path = input.path as EvidenceCheckPath;

    const rationale = input.reason.trim();
    if (rationale === '') {
      // Naming the field, not only the principle: a refusal a caller cannot act
      // on is one they work around.
      throw new ValidationFailedError(
        'an evidence check states its rationale — what was weighed, so a later reader can tell ' +
          'whether it still holds (FR-DFR-044)',
      );
    }

    const prior = await this.store.evidenceChecksFor(input.workspaceId, input.defectId);
    if (path === 'reclassify' && prior.length === 0) {
      const reproductions = await this.store.reproductionsFor(input.workspaceId, input.defectId);
      if (reproductions.some((row) => row.reproducible === 'intermittent')) {
        // `FR-DFR-031`. One green run on an intermittent defect has told you
        // what you already knew. The other two paths stay open — refusing every
        // answer would leave the check with no way out at all — and this one
        // opens again once a second run has been examined.
        throw new ValidationFailedError(
          'this defect is recorded as intermittent, and a single passing run must not reclassify ' +
            'it (FR-DFR-031); refine the test or investigate further, and reclassify when a ' +
            'second run has been examined',
        );
      }
    }

    const now = input.now ?? new Date();
    const check = await this.store.recordEvidenceCheck({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      defectId: input.defectId,
      defectTestId: input.testId,
      path: pathColumnFor(path),
      resolvedBy: input.chosenBy,
      resolvedAt: now,
      rationale,
      createdAt: now,
    });

    // Nothing is classified here, on any path. `SC-DFR-004` measures zero
    // passing reproduction tests automatically reclassified, and "automatic"
    // includes the version where the system infers the new outcome because
    // somebody ticked a box.
    return { check, next: path === 'reclassify' ? REEVALUATE_ROUTE : null };
  }

  private async require(workspaceId: string, defectId: string): Promise<void> {
    const defect = await this.store.findDefect(workspaceId, defectId);
    // Absent rather than forbidden — a caller learns nothing about a defect it
    // may not see.
    if (!defect) throw new NotFoundError('Not found.');
  }
}
