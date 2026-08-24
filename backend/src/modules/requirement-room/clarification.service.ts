/**
 * T338r — clarification questions, as one set. `FR-RQR-012`, `FR-RQR-013`,
 * `BR-0022`. Unit test: `T338q`.
 *
 * **One set, and there is no method that asks one question.** Asking one at a
 * time is how a clarification pass becomes six round trips, each costing the
 * reader the context of the last — which is the shape `BR-0022` exists to
 * replace. `ask` takes the whole set, validates the whole set, and writes the
 * whole set or none of it.
 *
 * **Retained, and enforced by omission.** There is no delete here and none on
 * the port, mirroring the `clarifications_are_retained` trigger, which refuses
 * a `DELETE` outright while permitting the `UPDATE` that carries an answer. A
 * service method that could remove one would be able to do what the database
 * refuses, and the two would disagree only in production. `FR-RQR-013`'s reason
 * is worth restating: the question somebody had to ask is **evidence about the
 * requirement's clarity**, and it stops being evidence the moment it can be
 * tidied away once answered.
 *
 * **An answer is written once.** A second answer replacing the first discards
 * it, which `FR-RQR-013` forbids as squarely as a delete would — so it is
 * refused rather than applied.
 *
 * Framework-free (PC-1).
 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { ClarificationRow, RequirementRoomStore } from './requirement-room.store.js';

export interface AskedQuestion {
  readonly question: string;
  /**
   * The candidate this question is about.
   *
   * Present ⇒ the question is a **blocking kind**: an open question on a
   * candidate intended for implementation (data-model §2). Absent ⇒ a question
   * about the set, which does not hold up a baseline on its own.
   */
  readonly candidateId?: string;
}

export interface AskInput {
  readonly workspaceId: string;
  readonly roomObjectId: string;
  /** An actor id, or an `AgentExecutionRecord` id when AI-generated (`BR-0104`). */
  readonly askedBy: string;
  readonly questions: readonly AskedQuestion[];
}

export interface AnswerInput {
  readonly workspaceId: string;
  readonly id: string;
  readonly answer: string;
  readonly answeredBy: string;
}

const NOT_FOUND = 'Not found.';

export class ClarificationService {
  constructor(private readonly store: RequirementRoomStore) {}

  /** `FR-RQR-012` — the whole set, or nothing. */
  async ask(input: AskInput): Promise<ClarificationRow[]> {
    if (!input.workspaceId || !input.roomObjectId || !input.askedBy?.trim()) {
      throw new ValidationFailedError(
        'asking requires: workspaceId, roomObjectId, askedBy',
      );
    }
    if (input.questions.length === 0) {
      // `200 []` reads as "the AI had no questions", which is a finding. An
      // empty request is not that finding; it is a malformed call.
      throw new ValidationFailedError('a clarification set contains at least one question');
    }
    // Validated before anything is written: a set that half-landed is worse
    // than one that did not, because the reader answers what they can see and
    // never learns what was dropped. Positions are 1-based — this message is
    // read by a person looking at their own list.
    input.questions.forEach((asked, index) => {
      if (typeof asked?.question !== 'string' || asked.question.trim().length === 0) {
        throw new ValidationFailedError(`question ${index + 1} of the set is empty`);
      }
    });

    const now = new Date();
    return this.store.createClarifications(
      input.questions.map((asked) => ({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        roomObjectId: input.roomObjectId,
        candidateId: asked.candidateId ?? null,
        question: asked.question.trim(),
        askedBy: input.askedBy,
        answer: null,
        answeredBy: null,
        answeredAt: null,
        blocksBaseline: asked.candidateId !== undefined,
        createdAt: now,
      })),
    );
  }

  /**
   * The set, open and answered alike.
   *
   * Filtering to the open ones would leave `FR-RQR-013`'s retained answers
   * unreachable through the only method that reads them — retained in the table
   * and gone from the product.
   */
  async list(workspaceId: string, roomObjectId: string): Promise<ClarificationRow[]> {
    return this.store.listClarifications(workspaceId, roomObjectId);
  }

  /** `FR-RQR-012` — answered in place: the same row, gaining an answer. */
  async answer(input: AnswerInput): Promise<ClarificationRow> {
    if (typeof input.answer !== 'string' || input.answer.trim().length === 0) {
      // An answered question carrying no answer is worse than an open one: it
      // leaves the list, and nobody comes back to it.
      throw new ValidationFailedError('an answer requires text');
    }
    if (!input.answeredBy?.trim()) {
      throw new ValidationFailedError('an answer requires: answeredBy');
    }
    const existing = await this.store.findClarificationById(input.id);
    // FR-002 / SC-004 — another workspace is indistinguishable from absent.
    if (!existing || existing.workspaceId !== input.workspaceId) {
      throw new NotFoundError(NOT_FOUND);
    }
    if (existing.answer !== null) {
      throw new ConflictError(
        `This clarification was already answered by ${existing.answeredBy}. Replacing an answer ` +
          'would discard the first one (FR-RQR-013); ask a new question instead.',
      );
    }
    return this.store.answerClarification(input.id, {
      answer: input.answer.trim(),
      answeredBy: input.answeredBy,
      answeredAt: new Date(),
    });
  }

  /**
   * What is holding up a baseline, **derived**.
   *
   * `blocksBaseline` records that a question is of a blocking *kind*; `answer`
   * says whether it still blocks. Reading both is what keeps this free of an
   * invalidation path — storing "no longer blocking" as a second flag would
   * give the same question two answers, disagreeing after the one code path
   * that forgot to update both. `EPIC-031` applied the same reasoning to its
   * Inbox, and `BaselineReadiness` (data-model §8) reads this.
   */
  async blockers(workspaceId: string, roomObjectId: string): Promise<ClarificationRow[]> {
    const all = await this.store.listClarifications(workspaceId, roomObjectId);
    return all.filter((row) => row.blocksBaseline && row.answer === null);
  }
}
