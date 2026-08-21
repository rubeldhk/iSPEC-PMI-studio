/**
 * T369 + T370 + T809 — the re-run that closes the loop (FR-RUN-016,
 * FR-RUN-017, FR-RUN-018, FR-RUN-019a, SC-016).
 *
 * Without this, the team's answers are just notes. A re-run:
 *
 *   - applies each submitted answer in place of the provisional one and
 *     clears that question's markings — selectively, one question at a time;
 *   - does not needlessly repeat work: an answer that confirms the
 *     provisional guess leaves the work already done standing; only an answer
 *     that DIFFERS forces regeneration;
 *   - asks stale answers AGAIN instead of applying them (T809, FR-RUN-019a),
 *     re-raised into a NEW session on the new run — never reopening the
 *     submitted one (FR-RUN-018) — and proceeds provisionally rather than
 *     blocking, so the run still completes without human input (SC-001).
 */
import { ConflictError, NotFoundError } from '../../core/errors.js';
import type { QuestionStore, RecordedQuestionRecord } from '../runs/question-recorder.service.js';
import type { ProvisionalService } from '../runs/provisional.service.js';
import type { RunRecord, RunStore } from '../runs/run-mode.service.js';
import type { AnswerStore } from './answer.service.js';
import type { ReviewSessionRecord, ReviewSessionService, SessionStore } from './review-session.service.js';
import { committedAnswerFor, type StaleAnswersService, type StaleAnswerWarning } from './stale-answers.service.js';

const OPAQUE = 'Not found.';

export interface AppliedAnswer {
  questionId: string;
  value: string;
  /** How many provisional markings the application cleared (FR-RUN-017). */
  markingsCleared: number;
}

export interface RerunResult {
  run: RunRecord;
  /** Submitted answers applied in place of provisional ones (FR-RUN-016). */
  applied: AppliedAnswer[];
  /** Questions whose answer confirmed the guess — work stands, not repeated. */
  reusedWork: string[];
  /** Questions whose answer differed — the work is redone under the answer. */
  regenerated: string[];
  /** Stale answers re-raised as fresh questions, NOT applied (FR-RUN-019a). */
  reRaised: RecordedQuestionRecord[];
  /** FR-RUN-019 — the warning half survives T808. */
  staleWarnings: StaleAnswerWarning[];
  /** A NEW session for the re-raised questions; null when there are none. */
  newSession: ReviewSessionRecord | null;
}

export class RerunService {
  constructor(
    private readonly runs: RunStore,
    private readonly questions: QuestionStore,
    private readonly sessions: SessionStore,
    private readonly answers: AnswerStore,
    private readonly provisional: ProvisionalService,
    private readonly stale: StaleAnswersService,
    private readonly reviewSessions: ReviewSessionService,
  ) {}

  async rerun(
    workspaceId: string,
    sourceRunId: string,
    initiatedById: string,
    at?: Date,
  ): Promise<RerunResult> {
    const source = await this.runs.find(workspaceId, sourceRunId);
    if (!source) throw new NotFoundError(OPAQUE);
    const sourceSession = await this.sessions.findForRun(workspaceId, sourceRunId);
    if (!sourceSession || sourceSession.state !== 'submitted') {
      throw new ConflictError('A re-run applies SUBMITTED answers — submit the review session first.');
    }

    const when = at ?? new Date();
    const run = await this.runs.create({
      workspaceId,
      projectId: source.projectId,
      mode: source.mode,
      stopRange: source.stopRange,
      state: 'running',
      accessSnapshot: source.accessSnapshot,
      initiatedById,
      startedAt: when,
      endedAt: null,
      outcomeReason: null,
    });

    // FR-RUN-019 — warn first; the warning is part of the record either way.
    const staleWarnings = await this.stale.staleFor(workspaceId, sourceRunId);
    const staleQuestionIds = new Set(staleWarnings.map((w) => w.questionId));

    const applied: AppliedAnswer[] = [];
    const reusedWork: string[] = [];
    const regenerated: string[] = [];
    const reRaised: RecordedQuestionRecord[] = [];

    for (const question of await this.questions.listForRun(workspaceId, sourceRunId)) {
      const rows = await this.answers.listForQuestion(workspaceId, question.id);
      const governing = committedAnswerFor(rows);
      if (!governing) continue;

      if (staleQuestionIds.has(question.id)) {
        // T809 — asked again, never applied; the run does not stop for it.
        reRaised.push(await this.stale.reRaise(workspaceId, run.id, question, governing, when));
        continue;
      }

      // FR-RUN-016/017 — applied in place of the provisional answer; that
      // question's markings clear, and only that question's (SC-004).
      const markingsCleared = await this.provisional.clearForQuestion(workspaceId, question.id, when);
      applied.push({ questionId: question.id, value: governing.value, markingsCleared });

      if (governing.value === question.provisionalAnswerApplied) {
        // The team confirmed the guess — the work already done stands.
        reusedWork.push(question.id);
      } else {
        regenerated.push(question.id);
      }
    }

    // FR-RUN-018 — new questions open a NEW session on the NEW run. The
    // submitted session is never reopened; zero re-raised questions, no
    // session at all.
    const newSession =
      reRaised.length > 0 ? await this.reviewSessions.openForRun(workspaceId, run.id, when) : null;

    return { run, applied, reusedWork, regenerated, reRaised, staleWarnings, newSession };
  }
}
