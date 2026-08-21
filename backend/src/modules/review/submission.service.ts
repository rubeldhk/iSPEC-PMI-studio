/**
 * T361 + T362 — atomic batch submission behind three gates (FR-RUN-014,
 * FR-RUN-015, FR-RUN-015a, SC-005, SC-005a, SC-006).
 *
 * Gate order matters and is deliberate:
 *
 *   1. authority   — neither owner nor initiator? 403 with a stated reason,
 *                    and their drafts SURVIVE untouched (FR-RUN-015a);
 *   2. completeness — unanswered questions? 422 NAMING them (FR-RUN-014);
 *   3. conflicts   — unresolved? 409 naming the conflicting questions;
 *   4. commit      — every answer as ONE unit, all or none, and the session
 *                    closes to further edits (FR-RUN-015).
 *
 * Nothing is mutated before gate 4, which is what "drafts survive a refusal"
 * means in code rather than in a comment.
 */
import { ConflictError, NotFoundError, ForbiddenError, ReviewIncompleteError } from '../../core/errors.js';
import type { QuestionStore } from '../runs/question-recorder.service.js';
import type { RunStore } from '../runs/run-mode.service.js';
import { isOwnerOrInitiator, type ProjectOwnerLookup } from './authority.js';
import type { AnswerRecord, AnswerStore } from './answer.service.js';
import { answersConflict, conflictResolved } from './conflict.service.js';
import type { ReviewSessionRecord, SessionStore } from './review-session.service.js';

const OPAQUE = 'Not found.';

export interface SubmissionResult {
  session: ReviewSessionRecord;
  committed: AnswerRecord[];
}

export class SubmissionService {
  constructor(
    private readonly runs: RunStore,
    private readonly questions: QuestionStore,
    private readonly sessions: SessionStore,
    private readonly answers: AnswerStore,
    private readonly owners: ProjectOwnerLookup,
  ) {}

  async submit(
    workspaceId: string,
    sessionId: string,
    submittedById: string,
    at?: Date,
  ): Promise<SubmissionResult> {
    const session = await this.sessions.find(workspaceId, sessionId);
    if (!session) throw new NotFoundError(OPAQUE);
    // FR-RUN-018 — a submitted session is never reopened; a new one is.
    if (session.state === 'submitted') {
      throw new ConflictError('This session is already submitted — open a new session.');
    }

    const run = await this.runs.find(workspaceId, session.runId);
    if (!run) throw new NotFoundError(OPAQUE);

    // Gate 1 — FR-RUN-015a. Refusal states the reason; drafts are untouched.
    if (!(await isOwnerOrInitiator(this.owners, run, submittedById))) {
      throw new ForbiddenError(
        'Only the project owner or the run initiator may submit this session. Your draft answers are kept.',
      );
    }

    // Gate 2 — FR-RUN-014: refused NAMING the unanswered questions.
    const raised = await this.questions.listForRun(workspaceId, session.runId);
    const perQuestion = new Map<string, AnswerRecord[]>();
    for (const question of raised) {
      perQuestion.set(question.id, await this.answers.listForQuestion(workspaceId, question.id));
    }
    const unanswered = raised
      .filter((q) => (perQuestion.get(q.id) ?? []).filter((a) => a.state === 'draft').length === 0)
      .map((q) => q.id);
    if (unanswered.length > 0) throw new ReviewIncompleteError(unanswered);

    // Gate 3 — FR-RUN-013: unresolved conflict blocks, naming the questions.
    const conflicting = raised
      .filter((q) => {
        const rows = perQuestion.get(q.id) ?? [];
        return answersConflict(rows) && !conflictResolved(rows);
      })
      .map((q) => q.id);
    if (conflicting.length > 0) {
      throw new ConflictError('Submission refused — unresolved conflicts remain.', {
        conflictingQuestionIds: conflicting,
      });
    }

    // Gate 4 — FR-RUN-015: one unit, all or none, then closed to edits.
    const when = at ?? new Date();
    const draftIds = [...perQuestion.values()]
      .flat()
      .filter((a) => a.state === 'draft')
      .map((a) => a.id);
    const committed = await this.answers.commitAll(workspaceId, draftIds, when);
    const submitted = await this.sessions.submit(workspaceId, session.id, when);
    return { session: submitted, committed };
  }
}
