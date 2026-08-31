/**
 * `T998h` (EPIC-035) — the failing-test precondition. `BR-0054`, `FR-DFR-040`
 * to `FR-DFR-043`.
 *
 * Constitution V's own rule, offered as a product capability. The Room exists
 * because *"we fixed it"* and *"something demonstrated it was broken"* are
 * different claims, and only the second can be checked later by somebody who
 * was not there.
 *
 * ## What is recorded is not "a test exists"
 *
 * A test written after the fix, green from its first run, satisfies *"is there
 * a test?"* and demonstrates nothing — it shows the code as written, not the
 * defect as reported. So the record is `firstObservedFailingAt`: an instant
 * somebody watched pass. Non-optional, non-nullable, and refused if it has not
 * happened yet.
 *
 * ## The refusal is a value, not an exception
 *
 * `acceptFix` returns `FixAcceptance`, whose two arms exist because a refusal
 * is a real outcome with its own shape. The `accepted: true` arm **carries** the
 * test rather than referencing it, so an acceptance without the test it rests on
 * does not typecheck. Turning the refusal into a `409` is the transport's job
 * (`defect-room.controller.ts`), and the reason it carries names the route that
 * fixes it — a refusal with nowhere to go is how a rule gets argued back in.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { DefectRoomStore, DefectTestRow } from './defect-room.store.js';
import type { DefectTest, FixAcceptance } from './test-first.types.js';

/**
 * The route a refusal points at, written once.
 *
 * `:id` rather than a filled-in identifier: this is the shape of the route, and
 * the caller already knows which defect it asked about.
 */
export const RECORD_TEST_ROUTE = 'POST /rooms/defect/:id/test';

export interface RecordTestInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly testRef: string;
  readonly contestedBehaviourRef: string;
  readonly firstObservedFailingAt: Date;
  readonly recordedBy: string;
  /** Supplied so "in the future" is decidable without reaching for a clock. */
  readonly now?: Date;
}

export interface AcceptFixInput {
  readonly workspaceId: string;
  readonly defectId: string;
  readonly acceptedBy: string;
}

function toDefectTest(row: DefectTestRow): DefectTest {
  return {
    id: row.id,
    defectId: row.defectId,
    contestedBehaviourRef: row.contestedBehaviourRef,
    reference: row.testRef,
    firstObservedFailingAt: row.firstObservedFailingAt,
  };
}

export class DefectTestService {
  constructor(private readonly store: DefectRoomStore) {}

  /** `FR-DFR-040`, `FR-DFR-042` — record the test that demonstrated the defect. */
  async recordTest(input: RecordTestInput): Promise<DefectTest> {
    const defect = await this.store.findDefect(input.workspaceId, input.defectId);
    // Absent rather than forbidden — a caller learns nothing about a defect it
    // may not see.
    if (!defect) throw new NotFoundError('Not found.');

    if (input.testRef.trim() === '') {
      throw new ValidationFailedError(
        'a defect test states its reference, so a reader can run the thing being cited ' +
          '(FR-DFR-040)',
      );
    }

    if (input.contestedBehaviourRef.trim() === '') {
      throw new ValidationFailedError(
        'a defect test is linked to the behaviour it contests, not only to the defect ' +
          '(FR-DFR-042)',
      );
    }

    const now = input.now ?? new Date();
    if (input.firstObservedFailingAt.getTime() > now.getTime()) {
      // An instant nobody has watched yet. The whole requirement rests on this
      // field being the record of something that happened.
      throw new ValidationFailedError(
        'a test cannot have been first observed failing at an instant that has not happened yet ' +
          '(FR-DFR-040)',
      );
    }

    const row = await this.store.recordTest({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      defectId: defect.id,
      testRef: input.testRef.trim(),
      contestedBehaviourRef: input.contestedBehaviourRef.trim(),
      firstObservedFailingAt: input.firstObservedFailingAt,
      // It was seen failing; that is the whole point of the record. A default
      // of `not-run` here would describe a run nobody made.
      lastRunOutcome: 'fail',
      lastRunEvidenceRef: null,
      createdAt: now,
    });

    return toDefectTest(row);
  }

  /**
   * `FR-DFR-041` — may this fix be accepted?
   *
   * Yes only when a test that was seen to fail is on record, or when the defect
   * carries the `FR-DFR-043` exception **with** the alternative evidence that
   * exception requires. Both halves, because "not automatable" without evidence
   * is a bypass with a checkbox — and it would be the only one this Room has.
   */
  async acceptFix(input: AcceptFixInput): Promise<FixAcceptance> {
    const defect = await this.store.findDefect(input.workspaceId, input.defectId);
    if (!defect) throw new NotFoundError('Not found.');

    const tests = await this.store.testsFor(input.workspaceId, defect.id);
    const failing = tests.find((row) => row.firstObservedFailingAt instanceof Date);
    if (failing) {
      return { accepted: true, test: toDefectTest(failing), acceptedBy: input.acceptedBy };
    }

    const reproductions = await this.store.reproductionsFor(input.workspaceId, defect.id);
    // `intermittent` is a member of `REPRODUCIBILITY`, not a synonym for this
    // exception. An intermittent defect is automatable — which is why
    // `FR-DFR-031` has to say a single passing run must not close one.
    const exception = reproductions.find((row) => row.reproducible === 'not-automatable');

    if (exception && exception.evidenceRefs.length > 0) {
      return {
        accepted: true,
        // The exception's evidence stands in for the test, and the record says
        // which reproduction carried it — so the exception is enumerable rather
        // than a gap in the test set that looks like an oversight.
        test: {
          id: exception.id,
          defectId: defect.id,
          contestedBehaviourRef: exception.affectedBehaviourRef,
          reference: `not-automatable: ${exception.notAutomatableReason ?? ''}`.trim(),
          firstObservedFailingAt: exception.observedAt,
        },
        acceptedBy: input.acceptedBy,
      };
    }

    if (exception) {
      return {
        accepted: false,
        reason:
          'this defect is recorded as not-automatable, and that exception requires alternative ' +
          'evidence (FR-DFR-043) — record it through EPIC-032 on the reproduction, at ' +
          'POST /rooms/defect/:id/reproduction',
      };
    }

    return {
      accepted: false,
      reason:
        'no failing test is on record for this defect, so nothing has demonstrated it ' +
        `(FR-DFR-041) — record one at ${RECORD_TEST_ROUTE}`,
    };
  }
}
