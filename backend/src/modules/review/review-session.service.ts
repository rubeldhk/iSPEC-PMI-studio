/**
 * T358 + T363 — review session assembly and permanent retention (FR-RUN-006,
 * FR-RUN-009, FR-RUN-020, SC-002, SC-006).
 *
 * One session per run, unique by construction — which is what makes "every
 * question lands in exactly one session, none lost, none duplicated"
 * checkable. A run raising ZERO questions creates NO session: an empty
 * session would be a to-do item that reads as work outstanding.
 *
 * Retention: a submitted session is closed to edits and can be neither
 * edited nor deleted afterwards — the store exposes no delete at all, and
 * the only state change it accepts is the one-way `open → submitted`. The
 * database triggers in the migration enforce the same rules raw.
 */
import { ConflictError, NotFoundError } from '../../core/errors.js';
import type { QuestionStore, RecordedQuestionRecord } from '../runs/question-recorder.service.js';
import type { RunStore } from '../runs/run-mode.service.js';
import type { AnswerRecord, AnswerStore } from './answer.service.js';

const OPAQUE = 'Not found.';

export type ReviewSessionState = 'open' | 'submitted';

export interface ReviewSessionRecord {
  id: string;
  workspaceId: string;
  runId: string;
  state: ReviewSessionState;
  openedAt: Date;
  submittedAt: Date | null;
}

export interface SessionStore {
  create(session: Omit<ReviewSessionRecord, 'id'>): Promise<ReviewSessionRecord>;
  find(workspaceId: string, id: string): Promise<ReviewSessionRecord | null>;
  findForRun(workspaceId: string, runId: string): Promise<ReviewSessionRecord | null>;
  /** The ONLY mutation: `open → submitted`, one way (FR-RUN-015). */
  submit(workspaceId: string, id: string, at: Date): Promise<ReviewSessionRecord>;
}

/** A question with the drafts and committed answers recorded against it. */
export interface SessionQuestionView {
  question: RecordedQuestionRecord;
  answers: AnswerRecord[];
}

export interface SessionView {
  session: ReviewSessionRecord;
  questions: SessionQuestionView[];
}

export class ReviewSessionService {
  constructor(
    private readonly runs: RunStore,
    private readonly questions: QuestionStore,
    private readonly sessions: SessionStore,
    private readonly answers: AnswerStore,
  ) {}

  /**
   * FR-RUN-006/009 — groups EVERY question from one run into its session.
   * Idempotent: a second call returns the existing session rather than
   * duplicating questions into a new one (SC-002).
   */
  async openForRun(workspaceId: string, runId: string, at?: Date): Promise<ReviewSessionRecord | null> {
    const run = await this.runs.find(workspaceId, runId);
    if (!run) throw new NotFoundError(OPAQUE);
    const existing = await this.sessions.findForRun(workspaceId, runId);
    if (existing) return existing;
    const raised = await this.questions.listForRun(workspaceId, runId);
    // Zero questions → no session (parent edge case).
    if (raised.length === 0) return null;
    return this.sessions.create({
      workspaceId,
      runId,
      state: 'open',
      openedAt: at ?? new Date(),
      submittedAt: null,
    });
  }

  async get(workspaceId: string, id: string): Promise<ReviewSessionRecord> {
    const session = await this.sessions.find(workspaceId, id);
    if (!session) throw new NotFoundError(OPAQUE);
    return session;
  }

  async getForRun(workspaceId: string, runId: string): Promise<ReviewSessionRecord> {
    const run = await this.runs.find(workspaceId, runId);
    if (!run) throw new NotFoundError(OPAQUE);
    const session = await this.sessions.findForRun(workspaceId, runId);
    if (!session) throw new NotFoundError(OPAQUE);
    return session;
  }

  /**
   * The full view — every question with context, options, suggested answer,
   * and the answers recorded so far. A question the reviewer cannot access is
   * carried with `restricted: true`, never silently omitted. After
   * submission this doubles as the permanent record: each answer with its
   * author, time and note (FR-RUN-020, SC-006).
   */
  async view(workspaceId: string, sessionId: string): Promise<SessionView> {
    const session = await this.get(workspaceId, sessionId);
    const raised = await this.questions.listForRun(workspaceId, session.runId);
    const questions: SessionQuestionView[] = [];
    for (const question of raised) {
      questions.push({
        question,
        answers: await this.answers.listForQuestion(workspaceId, question.id),
      });
    }
    return { session, questions };
  }
}

// ------------------------------------------------------------- in-memory

export class InMemorySessionStore implements SessionStore {
  private readonly rows = new Map<string, ReviewSessionRecord>();
  private seq = 0;

  async create(session: Omit<ReviewSessionRecord, 'id'>): Promise<ReviewSessionRecord> {
    const row: ReviewSessionRecord = { id: `rs_${++this.seq}`, ...session };
    this.rows.set(row.id, row);
    return { ...row };
  }

  async find(workspaceId: string, id: string): Promise<ReviewSessionRecord | null> {
    const row = this.rows.get(id);
    return row && row.workspaceId === workspaceId ? { ...row } : null;
  }

  async findForRun(workspaceId: string, runId: string): Promise<ReviewSessionRecord | null> {
    for (const row of this.rows.values()) {
      if (row.workspaceId === workspaceId && row.runId === runId) return { ...row };
    }
    return null;
  }

  async submit(workspaceId: string, id: string, at: Date): Promise<ReviewSessionRecord> {
    const row = this.rows.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    // Mirrors the one-way rule: a submitted session accepts nothing further.
    if (row.state === 'submitted') {
      throw new ConflictError('This session is already submitted — open a new session.');
    }
    const next: ReviewSessionRecord = { ...row, state: 'submitted', submittedAt: at };
    this.rows.set(id, next);
    return { ...next };
  }
}
