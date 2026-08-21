/**
 * T360 + T803 — conflict detection, submission gating, and resolution
 * authority (FR-RUN-013, FR-RUN-013a, SC-005, SC-015).
 *
 * Conflicts are SURFACED, not resolved (R-002-6): two people answering
 * differently is a disagreement a human must settle, so both answers survive
 * and submission is blocked. Resolution is restricted to the same two roles
 * FR-RUN-015a trusts with submission — the project owner or the run's
 * initiator — and the answer that loses is KEPT: the record has to show that
 * the disagreement happened.
 */
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import type { QuestionStore } from '../runs/question-recorder.service.js';
import type { RunStore } from '../runs/run-mode.service.js';
import { isOwnerOrInitiator, type ProjectOwnerLookup } from './authority.js';
import type { AnswerRecord, AnswerStore } from './answer.service.js';
import type { SessionStore } from './review-session.service.js';

const OPAQUE = 'Not found.';

/**
 * Pure detection (data-model testability note #1): a question is in conflict
 * when two DIFFERENT authors hold drafts with DIFFERENT values. One person
 * revising their own mind is not a conflict.
 */
export function answersConflict(answers: readonly AnswerRecord[]): boolean {
  const drafts = answers.filter((a) => a.state === 'draft');
  const values = new Set(drafts.map((a) => a.value));
  const authors = new Set(drafts.map((a) => a.authorId));
  return values.size > 1 && authors.size > 1;
}

/** Resolved = a winner has been selected by someone with the authority. */
export function conflictResolved(answers: readonly AnswerRecord[]): boolean {
  return answers.some((a) => a.selectedAsWinner);
}

export interface UnresolvedConflict {
  questionId: string;
  answers: AnswerRecord[];
}

export interface ResolveConflictInput {
  winnerAnswerId: string;
  resolvedById: string;
}

export class ConflictService {
  constructor(
    private readonly runs: RunStore,
    private readonly questions: QuestionStore,
    private readonly sessions: SessionStore,
    private readonly answers: AnswerStore,
    private readonly owners: ProjectOwnerLookup,
  ) {}

  /** The conflicts that BLOCK submission (FR-RUN-013, SC-005). */
  async unresolved(workspaceId: string, sessionId: string): Promise<UnresolvedConflict[]> {
    const session = await this.sessions.find(workspaceId, sessionId);
    if (!session) throw new NotFoundError(OPAQUE);
    const raised = await this.questions.listForRun(workspaceId, session.runId);
    const conflicts: UnresolvedConflict[] = [];
    for (const question of raised) {
      const rows = await this.answers.listForQuestion(workspaceId, question.id);
      if (answersConflict(rows) && !conflictResolved(rows)) {
        conflicts.push({ questionId: question.id, answers: rows });
      }
    }
    return conflicts;
  }

  /**
   * FR-RUN-013a — resolution selects a winner and deletes NOTHING. Every
   * competing answer stays retrievable with its author and time (SC-015).
   */
  async resolve(
    workspaceId: string,
    sessionId: string,
    questionId: string,
    input: ResolveConflictInput,
    at?: Date,
  ): Promise<AnswerRecord[]> {
    const session = await this.sessions.find(workspaceId, sessionId);
    if (!session) throw new NotFoundError(OPAQUE);
    if (session.state === 'submitted') {
      throw new ConflictError('This session is submitted — conflicts were settled before commit.');
    }
    const question = await this.questions.find(workspaceId, questionId);
    if (!question || question.runId !== session.runId) throw new NotFoundError(OPAQUE);

    const run = await this.runs.find(workspaceId, session.runId);
    if (!run) throw new NotFoundError(OPAQUE);
    // FR-RUN-013a — the stated reason, not silent absence: the caller can see
    // the conflict and needs to know why they cannot settle it. Answering and
    // noting remain open to everyone with access.
    if (!(await isOwnerOrInitiator(this.owners, run, input.resolvedById))) {
      throw new ForbiddenError(
        'Only the project owner or the run initiator may resolve a conflict. Your answers and notes are kept.',
      );
    }

    const rows = await this.answers.listForQuestion(workspaceId, questionId);
    const winner = rows.find((a) => a.id === input.winnerAnswerId);
    if (!winner) throw new NotFoundError(OPAQUE);

    const when = at ?? new Date();
    for (const row of rows) {
      // Winner marked; every competing answer keeps its author and time and is
      // stamped with who settled it — never deleted (SC-015).
      await this.answers.update(workspaceId, row.id, {
        selectedAsWinner: row.id === winner.id,
        conflictResolvedById: input.resolvedById,
        conflictResolvedAt: when,
      });
    }
    return this.answers.listForQuestion(workspaceId, questionId);
  }
}
