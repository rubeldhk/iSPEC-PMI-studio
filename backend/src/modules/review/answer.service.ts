/**
 * T359 — draft answers with attribution and notes (FR-RUN-010, FR-RUN-011,
 * FR-RUN-012, SC-006).
 *
 * A reviewer may take the suggested answer or write their own, and may attach
 * a note to either. Drafts save WITHOUT committing the session; who answered
 * and when is recorded on every draft, so every answer that is eventually
 * submitted is permanently attributable to a person and a time.
 *
 * One draft per (question, author): a reviewer changing their mind replaces
 * their own draft — a COLLEAGUE'S draft is never replaced, which is what
 * makes a disagreement a conflict rather than a last-write win (R-002-6).
 */
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { QuestionStore } from '../runs/question-recorder.service.js';
import { answersConflict } from './conflict.service.js';
import type { SessionStore } from './review-session.service.js';

const OPAQUE = 'Not found.';

export type AnswerState = 'draft' | 'committed';

export interface AnswerRecord {
  id: string;
  workspaceId: string;
  questionId: string;
  value: string;
  authorId: string;
  recordedAt: Date;
  note: string | null;
  state: AnswerState;
  conflict: boolean;
  selectedAsWinner: boolean;
  conflictResolvedById: string | null;
  conflictResolvedAt: Date | null;
}

export interface AnswerStore {
  upsertDraft(
    answer: Omit<AnswerRecord, 'id' | 'state' | 'conflict' | 'selectedAsWinner' | 'conflictResolvedById' | 'conflictResolvedAt'>,
  ): Promise<AnswerRecord>;
  listForQuestion(workspaceId: string, questionId: string): Promise<AnswerRecord[]>;
  update(workspaceId: string, id: string, patch: Partial<AnswerRecord>): Promise<AnswerRecord>;
  /**
   * FR-RUN-015 — every answer as ONE unit, all or none. Validates the full id
   * set before mutating anything, so a partial commit cannot exist.
   */
  commitAll(workspaceId: string, answerIds: string[], at: Date): Promise<AnswerRecord[]>;
}

export interface DraftAnswerInput {
  questionId: string;
  authorId: string;
  /** The reviewer's own answer — or omit and set `takeSuggested`. */
  value?: string;
  /** FR-RUN-010 — take the engine's suggestion as the answer. */
  takeSuggested?: boolean;
  /** Optional on either kind of answer (FR-RUN-010). */
  note?: string;
}

export class AnswerService {
  constructor(
    private readonly sessions: SessionStore,
    private readonly questions: QuestionStore,
    private readonly answers: AnswerStore,
  ) {}

  async draft(
    workspaceId: string,
    sessionId: string,
    input: DraftAnswerInput,
    at?: Date,
  ): Promise<AnswerRecord> {
    const session = await this.sessions.find(workspaceId, sessionId);
    if (!session) throw new NotFoundError(OPAQUE);
    // FR-RUN-015/018 — a submitted session is closed to further edits.
    if (session.state === 'submitted') {
      throw new ConflictError('This session is submitted and closed to edits — open a new session.');
    }
    const question = await this.questions.find(workspaceId, input.questionId);
    if (!question || question.runId !== session.runId) throw new NotFoundError(OPAQUE);

    const value = input.takeSuggested ? question.suggestedAnswer : input.value;
    if (!value || value.trim() === '') {
      throw new ValidationFailedError('An answer needs a value — your own, or the suggested one.', {
        fields: [{ field: 'value', reason: 'Required unless takeSuggested is set.' }],
      });
    }

    const saved = await this.answers.upsertDraft({
      workspaceId,
      questionId: question.id,
      value,
      authorId: input.authorId,
      recordedAt: at ?? new Date(),
      note: input.note ?? null,
    });

    // FR-RUN-013 — two people answering one question differently is flagged
    // the moment it happens, on every draft involved.
    const drafts = await this.answers.listForQuestion(workspaceId, question.id);
    const conflicted = answersConflict(drafts);
    for (const row of drafts) {
      if (row.conflict !== conflicted) {
        await this.answers.update(workspaceId, row.id, { conflict: conflicted });
      }
    }
    const fresh = (await this.answers.listForQuestion(workspaceId, question.id)).find(
      (a) => a.id === saved.id,
    );
    return fresh ?? saved;
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryAnswerStore implements AnswerStore {
  private readonly rows = new Map<string, AnswerRecord>();
  private seq = 0;

  async upsertDraft(
    answer: Omit<AnswerRecord, 'id' | 'state' | 'conflict' | 'selectedAsWinner' | 'conflictResolvedById' | 'conflictResolvedAt'>,
  ): Promise<AnswerRecord> {
    // Replace the SAME author's draft only — never a colleague's (R-002-6).
    for (const row of this.rows.values()) {
      if (
        row.workspaceId === answer.workspaceId &&
        row.questionId === answer.questionId &&
        row.authorId === answer.authorId &&
        row.state === 'draft'
      ) {
        const next: AnswerRecord = {
          ...row,
          value: answer.value,
          note: answer.note,
          recordedAt: answer.recordedAt,
        };
        this.rows.set(row.id, next);
        return { ...next };
      }
    }
    const created: AnswerRecord = {
      id: `ans_${++this.seq}`,
      state: 'draft',
      conflict: false,
      selectedAsWinner: false,
      conflictResolvedById: null,
      conflictResolvedAt: null,
      ...answer,
    };
    this.rows.set(created.id, created);
    return { ...created };
  }

  async listForQuestion(workspaceId: string, questionId: string): Promise<AnswerRecord[]> {
    return [...this.rows.values()]
      .filter((a) => a.workspaceId === workspaceId && a.questionId === questionId)
      .map((a) => ({ ...a }));
  }

  async update(workspaceId: string, id: string, patch: Partial<AnswerRecord>): Promise<AnswerRecord> {
    const row = this.rows.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    const next = { ...row, ...patch };
    this.rows.set(id, next);
    return { ...next };
  }

  async commitAll(workspaceId: string, answerIds: string[], at: Date): Promise<AnswerRecord[]> {
    // Validate EVERYTHING before mutating ANYTHING — all or none (FR-RUN-015).
    const rows: AnswerRecord[] = [];
    for (const id of answerIds) {
      const row = this.rows.get(id);
      if (!row || row.workspaceId !== workspaceId) {
        throw new NotFoundError('Not found.');
      }
      rows.push(row);
    }
    const committed: AnswerRecord[] = [];
    for (const row of rows) {
      const next: AnswerRecord = { ...row, state: 'committed', recordedAt: row.recordedAt };
      void at;
      this.rows.set(row.id, next);
      committed.push({ ...next });
    }
    return committed;
  }
}
