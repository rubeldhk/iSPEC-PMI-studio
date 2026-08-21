/**
 * T345 — question deferral with suggested answers (FR-RUN-003, FR-RUN-004,
 * FR-RUN-007).
 *
 * The run never pauses: recording a question is how it AVOIDS asking one. The
 * record carries the options considered, the engine's suggested answer, and
 * enough context for someone who did not start the run to understand what is
 * being asked (PP-016 — the suggestion is reviewable BEFORE it becomes a
 * decision). The run then proceeds using the suggested answer as a
 * PROVISIONAL answer, never a decision.
 */
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { RunStore } from './run-mode.service.js';

const OPAQUE = 'Not found.';

export interface RecordedQuestionRecord {
  id: string;
  workspaceId: string;
  runId: string;
  context: string;
  optionsConsidered: string[];
  suggestedAnswer: string;
  /** What the run actually proceeded on (FR-RUN-004). */
  provisionalAnswerApplied: string | null;
  restricted: boolean;
  createdAt: Date;
}

export interface QuestionStore {
  create(question: Omit<RecordedQuestionRecord, 'id'>): Promise<RecordedQuestionRecord>;
  find(workspaceId: string, id: string): Promise<RecordedQuestionRecord | null>;
  listForRun(workspaceId: string, runId: string): Promise<RecordedQuestionRecord[]>;
}

export interface RecordQuestionInput {
  context?: string;
  optionsConsidered?: string[];
  suggestedAnswer?: string;
  restricted?: boolean;
}

export interface DeferredQuestion {
  question: RecordedQuestionRecord;
  /** The provisional answer the run proceeds on — a guess, marked as one. */
  proceedWith: string;
}

export class QuestionRecorderService {
  constructor(
    private readonly runs: RunStore,
    private readonly questions: QuestionStore,
  ) {}

  /**
   * Defers a question instead of asking it. Returns the provisional answer the
   * run proceeds on — the caller keeps running; nothing here blocks.
   */
  async record(
    workspaceId: string,
    runId: string,
    input: RecordQuestionInput,
    at?: Date,
  ): Promise<DeferredQuestion> {
    const run = await this.runs.find(workspaceId, runId);
    if (!run) throw new NotFoundError(OPAQUE);
    if (run.state !== 'running') {
      throw new ConflictError(`Questions are recorded by a running run — this one is "${run.state}".`);
    }
    // FR-RUN-007 — context for someone who did not start the run. Required,
    // not decorative: a bare question is unanswerable in a review session.
    if (!input.context || input.context.trim() === '') {
      throw new ValidationFailedError('A recorded question requires context.', {
        fields: [{ field: 'context', reason: 'Required — enough for someone who did not start the run.' }],
      });
    }
    // FR-RUN-003 — the options considered and the suggested answer.
    if (!Array.isArray(input.optionsConsidered) || input.optionsConsidered.length === 0) {
      throw new ValidationFailedError('A recorded question names the options considered.', {
        fields: [{ field: 'optionsConsidered', reason: 'Required, non-empty.' }],
      });
    }
    if (!input.suggestedAnswer || input.suggestedAnswer.trim() === '') {
      throw new ValidationFailedError('A recorded question carries a suggested answer.', {
        fields: [{ field: 'suggestedAnswer', reason: 'Required.' }],
      });
    }
    const question = await this.questions.create({
      workspaceId,
      runId,
      context: input.context,
      optionsConsidered: [...input.optionsConsidered],
      suggestedAnswer: input.suggestedAnswer,
      // FR-RUN-004 — the run proceeds on the suggestion, as a provisional
      // answer rather than a decision.
      provisionalAnswerApplied: input.suggestedAnswer,
      restricted: input.restricted ?? false,
      createdAt: at ?? new Date(),
    });
    return { question, proceedWith: question.provisionalAnswerApplied as string };
  }

  async listForRun(workspaceId: string, runId: string): Promise<RecordedQuestionRecord[]> {
    const run = await this.runs.find(workspaceId, runId);
    if (!run) throw new NotFoundError(OPAQUE);
    return this.questions.listForRun(workspaceId, runId);
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryQuestionStore implements QuestionStore {
  private readonly rows = new Map<string, RecordedQuestionRecord>();
  private seq = 0;

  async create(question: Omit<RecordedQuestionRecord, 'id'>): Promise<RecordedQuestionRecord> {
    const row: RecordedQuestionRecord = { id: `q_${++this.seq}`, ...question };
    this.rows.set(row.id, row);
    return { ...row };
  }

  async find(workspaceId: string, id: string): Promise<RecordedQuestionRecord | null> {
    const row = this.rows.get(id);
    return row && row.workspaceId === workspaceId ? { ...row } : null;
  }

  async listForRun(workspaceId: string, runId: string): Promise<RecordedQuestionRecord[]> {
    return [...this.rows.values()]
      .filter((q) => q.workspaceId === workspaceId && q.runId === runId)
      .map((q) => ({ ...q }));
  }
}
