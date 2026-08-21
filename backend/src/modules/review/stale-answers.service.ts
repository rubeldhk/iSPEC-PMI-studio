/**
 * T371 + T808 — stale answers: warned about, and asked again rather than
 * applied (FR-RUN-019, FR-RUN-019a, SC-016).
 *
 * An answer is STALE when the underlying work it governs changed after the
 * answer was recorded. T371's half warns which answers may be stale; T808's
 * half is the correction the analysis pass demanded: the stale answer is NOT
 * applied — its governing question is re-raised as a FRESH question in the
 * re-run's new review session, and the re-run proceeds provisionally under
 * FR-RUN-004 rather than blocking, so SC-001 survives.
 */
import type { QuestionStore, RecordedQuestionRecord } from '../runs/question-recorder.service.js';
import type { AnswerRecord, AnswerStore } from './answer.service.js';

/**
 * The seam to whatever tracks change in the underlying work. The run engine
 * records changes; this port answers one question: did the work this question
 * concerns change after `since`?
 */
export interface WorkChangeDetector {
  changedSince(workspaceId: string, questionId: string, since: Date): Promise<boolean>;
}

export interface StaleAnswerWarning {
  questionId: string;
  answerId: string;
  warning: string;
}

/** The committed answer that governs a question — the winner where one was chosen. */
export function committedAnswerFor(answers: readonly AnswerRecord[]): AnswerRecord | null {
  const committed = answers.filter((a) => a.state === 'committed');
  if (committed.length === 0) return null;
  return committed.find((a) => a.selectedAsWinner) ?? committed[0] ?? null;
}

export class StaleAnswersService {
  constructor(
    private readonly questions: QuestionStore,
    private readonly answers: AnswerStore,
    private readonly changes: WorkChangeDetector,
  ) {}

  /** FR-RUN-019 — warns which answers MAY be stale; decides nothing. */
  async staleFor(workspaceId: string, runId: string): Promise<StaleAnswerWarning[]> {
    const raised = await this.questions.listForRun(workspaceId, runId);
    const warnings: StaleAnswerWarning[] = [];
    for (const question of raised) {
      const rows = await this.answers.listForQuestion(workspaceId, question.id);
      const governing = committedAnswerFor(rows);
      if (!governing) continue;
      if (await this.changes.changedSince(workspaceId, question.id, governing.recordedAt)) {
        warnings.push({
          questionId: question.id,
          answerId: governing.id,
          warning:
            'The underlying work changed after this answer was recorded — the answer may be stale and will be asked again.',
        });
      }
    }
    return warnings;
  }

  /**
   * T808 — FR-RUN-019a: the stale answer's question reappears as a NEW
   * question on the re-run, carrying the original context plus what was
   * previously answered — and the re-run proceeds on the SUGGESTED answer as
   * provisional (FR-RUN-004), never on the stale one.
   */
  async reRaise(
    workspaceId: string,
    newRunId: string,
    stale: RecordedQuestionRecord,
    previousAnswer: AnswerRecord,
    at?: Date,
  ): Promise<RecordedQuestionRecord> {
    return this.questions.create({
      workspaceId,
      runId: newRunId,
      context:
        `${stale.context}\n\nAsked again: the underlying work changed after the team answered ` +
        `"${previousAnswer.value}" — that answer may be stale and was not applied.`,
      optionsConsidered: [...stale.optionsConsidered],
      suggestedAnswer: stale.suggestedAnswer,
      // FR-RUN-004 — proceeds provisionally; never blocks for the answer.
      provisionalAnswerApplied: stale.suggestedAnswer,
      restricted: stale.restricted,
      createdAt: at ?? new Date(),
    });
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryWorkChangeLog implements WorkChangeDetector {
  private readonly changes = new Map<string, Date[]>();

  markChanged(questionId: string, at: Date): void {
    const list = this.changes.get(questionId) ?? [];
    list.push(at);
    this.changes.set(questionId, list);
  }

  async changedSince(_workspaceId: string, questionId: string, since: Date): Promise<boolean> {
    return (this.changes.get(questionId) ?? []).some((at) => at.getTime() > since.getTime());
  }
}
