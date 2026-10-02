/**
 * `T994p` (EPIC-034) — closure. `BR-0048`, `FR-CHR-070`–`FR-CHR-073`.
 *
 * Four questions an auditor asks, answerable **without reconstruction**: what
 * changed, why, which tests and evidence validate it, and which baseline
 * supersedes the old state.
 *
 * ## Why the four are a Record over a frozen set
 *
 * `FR-CHR-073` is the clause that decides the shape. Three of the four could
 * otherwise be *"derivable, if you still have the other tables and know how
 * they join"* — which is reconstruction, and is exactly what the requirement
 * rules out. `SC-CHR-006` measures 100% of closed changes answering all four,
 * so a closure missing one does not compile rather than failing a check
 * somebody has to run.
 *
 * ## `FR-CHR-072` — a declaration is not evidence
 *
 * *"A declaration of completion MUST NOT substitute for the validating
 * evidence"* (`BR-0144`). The shortcut is a boolean — `complete`, `verified`,
 * `signedOff` — and it always arrives for a good reason: the evidence system is
 * down, the change is urgent, somebody senior has looked at it. There is no
 * such field here and no parameter through which one could be supplied, so an
 * unmet Evidence Contract refuses whatever else the caller sends.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { ValidationFailedError } from '../../core/errors.js';
import type { ChangeClosureRow, ChangeRoomStore } from './change-room.store.js';

/**
 * `BR-0048`'s four, in `FR-CHR-070`'s order.
 *
 * `change-room-closure.spec.ts` checks each against the requirement's own
 * sentence rather than restating it — `DEF-034-001`, where a constant and the
 * test that checked it were written from one misreading and agreed.
 */
export const CLOSURE_QUESTIONS = Object.freeze([
  'what-changed',
  'why',
  'validated-by',
  'superseding-baseline',
] as const);

export type ClosureQuestion = (typeof CLOSURE_QUESTIONS)[number];

/** What `EPIC-032` answers. Absent ⇒ refuse: nothing proved the change. */
export interface EvidenceContractPort {
  isSatisfied(
    evidenceContractRef: string,
    ctx: { workspaceId: string; projectId: string },
  ): Promise<{ readonly satisfied: boolean; readonly unmet: readonly string[] }>;
}

export interface CloseChangeInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly changeRequestId: string;
  readonly evidenceContractRef: string;
  readonly whatChanged: string;
  readonly why: string;
  /** Evidence and test-run references. `[]` is refused — `FR-CHR-072`. */
  readonly validatedBy: readonly string[];
  readonly supersedingBaselineId: string;
  readonly supersedingBaselineVersion: number;
  readonly closedBy: string;
  readonly now: Date;
}

export interface ClosureRecord extends ChangeClosureRow {
  /**
   * All four. A `Record` over the frozen set, so three is a compile error.
   *
   * Rendered as strings because `FR-CHR-073` is about a person reading the
   * record: an auditor asking "which baseline supersedes the old state" wants a
   * sentence, not a key to look up elsewhere.
   */
  readonly answers: Readonly<Record<ClosureQuestion, string>>;
}

export class ClosureService {
  constructor(
    private readonly store: ChangeRoomStore,
    private readonly evidence?: EvidenceContractPort | undefined,
  ) {}

  /**
   * Every check runs before anything is written, so a refused closure cannot
   * leave a half-closed change behind.
   */
  async close(input: CloseChangeInput): Promise<ClosureRecord> {
    for (const field of ['whatChanged', 'why'] as const) {
      if (input[field].trim() === '') {
        throw new ValidationFailedError(`a closure states: ${field} (FR-CHR-070, BR-0048)`);
      }
    }
    if (input.supersedingBaselineId.trim() === '') {
      // `BR-0048`'s fourth question. A closure that cannot say which baseline
      // now holds cannot say what the change achieved.
      throw new ValidationFailedError(
        'a closure names the superseding baseline (FR-CHR-070, BR-0048)',
      );
    }
    if (input.validatedBy.length === 0) {
      // `FR-CHR-072`, `BR-0144`. The prose can all be present and the change
      // still be unvalidated; that is the case this refuses.
      throw new ValidationFailedError(
        'a closure names the tests and evidence that validated the change; a declaration of ' +
          'completion does not substitute for them (FR-CHR-072, BR-0144)',
      );
    }

    const existing = await this.store.findClosure(input.workspaceId, input.changeRequestId);
    if (existing) {
      // Two closures would give the record two answers to each of the four
      // questions and nothing to say which one holds.
      throw new ValidationFailedError(`change ${input.changeRequestId} is already closed`);
    }

    if (!this.evidence) {
      throw new ValidationFailedError(
        'no Evidence Contract source is bound (EPIC-032 supplies it), so nothing has proved ' +
          'this change — closure is refused rather than recorded (FR-CHR-071)',
      );
    }
    const verdict = await this.evidence.isSatisfied(input.evidenceContractRef, {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    });
    if (!verdict.satisfied) {
      // Naming them is the requirement. "Evidence incomplete" sends somebody
      // hunting through a contract to find which two of nine are missing.
      throw new ValidationFailedError(
        `the Evidence Contract for this change is unmet (FR-CHR-071); outstanding: ${
          verdict.unmet.length === 0 ? '(the source named none)' : verdict.unmet.join('; ')
        }`,
      );
    }

    const row = await this.store.recordClosure({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      changeRequestId: input.changeRequestId,
      whatChanged: input.whatChanged.trim(),
      why: input.why.trim(),
      evidenceRefs: [...input.validatedBy],
      supersedingBaselineId: input.supersedingBaselineId,
      supersedingBaselineVersion: input.supersedingBaselineVersion,
      closedBy: input.closedBy,
      closedAt: input.now,
    });

    return { ...row, answers: answersOf(row) };
  }

  /** `FR-CHR-073` — the four, read back from the record and nothing else. */
  async closureFor(
    workspaceId: string,
    changeRequestId: string,
  ): Promise<ClosureRecord | null> {
    const row = await this.store.findClosure(workspaceId, changeRequestId);
    return row === null ? null : { ...row, answers: answersOf(row) };
  }
}

/**
 * The four answers, derived from the stored row alone.
 *
 * No other table is consulted — that is what "without reconstruction" means,
 * and a join here would be the reconstruction `FR-CHR-073` forbids arriving
 * inside the thing that claims to prevent it.
 */
function answersOf(row: ChangeClosureRow): Readonly<Record<ClosureQuestion, string>> {
  return {
    'what-changed': row.whatChanged,
    why: row.why,
    'validated-by': row.evidenceRefs.join(', '),
    'superseding-baseline': `${row.supersedingBaselineId} (v${row.supersedingBaselineVersion})`,
  };
}
