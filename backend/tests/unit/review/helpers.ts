/**
 * EPIC-023 test harness — the full run/review service graph over in-memory
 * stores, seeded with one project whose owner is `OWNER` and whose runs are
 * started by `INITIATOR`. Every spec in `unit/runs`, `unit/review` and the
 * contract/integration suites composes from here rather than re-wiring.
 */
import { InMemoryAnswerStore, AnswerService } from '../../../src/modules/review/answer.service.js';
import { InMemoryProjectOwners } from '../../../src/modules/review/authority.js';
import { ConflictService } from '../../../src/modules/review/conflict.service.js';
import { RerunService } from '../../../src/modules/review/rerun.service.js';
import {
  InMemorySessionStore,
  ReviewSessionService,
  type ReviewSessionRecord,
} from '../../../src/modules/review/review-session.service.js';
import {
  InMemoryWorkChangeLog,
  StaleAnswersService,
} from '../../../src/modules/review/stale-answers.service.js';
import { SubmissionService } from '../../../src/modules/review/submission.service.js';
import {
  InMemoryOverrideStore,
  ProvisionalApprovalService,
} from '../../../src/modules/runs/provisional-approval.service.js';
import { InMemoryMarkingStore, ProvisionalService } from '../../../src/modules/runs/provisional.service.js';
import {
  InMemoryQuestionStore,
  QuestionRecorderService,
  type RecordedQuestionRecord,
} from '../../../src/modules/runs/question-recorder.service.js';
import {
  InMemoryRunStore,
  RunModeService,
  type RunRecord,
} from '../../../src/modules/runs/run-mode.service.js';

export const WS = 'ws_a';
export const OTHER_WS = 'ws_b';
export const PROJECT = 'proj_1';
export const OWNER = 'u_owner';
export const INITIATOR = 'u_init';
export const REVIEWER = 'u_reviewer';
export const REVIEWER_2 = 'u_reviewer_2';

export interface Harness {
  runs: InMemoryRunStore;
  questions: InMemoryQuestionStore;
  markings: InMemoryMarkingStore;
  overrides: InMemoryOverrideStore;
  sessions: InMemorySessionStore;
  answers: InMemoryAnswerStore;
  owners: InMemoryProjectOwners;
  changes: InMemoryWorkChangeLog;
  runMode: RunModeService;
  recorder: QuestionRecorderService;
  provisional: ProvisionalService;
  approval: ProvisionalApprovalService;
  reviewSessions: ReviewSessionService;
  answerService: AnswerService;
  conflicts: ConflictService;
  submission: SubmissionService;
  stale: StaleAnswersService;
  rerun: RerunService;
}

export function harness(): Harness {
  const runs = new InMemoryRunStore();
  const questions = new InMemoryQuestionStore();
  const markings = new InMemoryMarkingStore();
  const overrides = new InMemoryOverrideStore();
  const sessions = new InMemorySessionStore();
  const answers = new InMemoryAnswerStore();
  const owners = new InMemoryProjectOwners();
  const changes = new InMemoryWorkChangeLog();
  owners.setOwner(PROJECT, OWNER);

  const runMode = new RunModeService(runs);
  const recorder = new QuestionRecorderService(runs, questions);
  const provisional = new ProvisionalService(markings);
  const approval = new ProvisionalApprovalService(provisional, overrides);
  const reviewSessions = new ReviewSessionService(runs, questions, sessions, answers);
  const answerService = new AnswerService(sessions, questions, answers);
  const conflicts = new ConflictService(runs, questions, sessions, answers, owners);
  const submission = new SubmissionService(runs, questions, sessions, answers, owners);
  const stale = new StaleAnswersService(questions, answers, changes);
  const rerun = new RerunService(runs, questions, sessions, answers, provisional, stale, reviewSessions);

  return {
    runs, questions, markings, overrides, sessions, answers, owners, changes,
    runMode, recorder, provisional, approval, reviewSessions, answerService,
    conflicts, submission, stale, rerun,
  };
}

export async function startUnattended(h: Harness, at?: Date): Promise<RunRecord> {
  return h.runMode.start(
    WS,
    { projectId: PROJECT, mode: 'unattended', stopRange: 'after_specification', initiatedById: INITIATOR },
    at,
  );
}

export async function ask(
  h: Harness,
  runId: string,
  count: number,
  at?: Date,
): Promise<RecordedQuestionRecord[]> {
  const raised: RecordedQuestionRecord[] = [];
  for (let i = 1; i <= count; i++) {
    const { question } = await h.recorder.record(
      WS,
      runId,
      {
        context: `Question ${i}: which storage engine should the generated module use?`,
        optionsConsidered: ['postgres', 'sqlite'],
        suggestedAnswer: 'postgres',
      },
      at,
    );
    raised.push(question);
  }
  return raised;
}

export interface SubmittedRun {
  run: RunRecord;
  session: ReviewSessionRecord;
  questions: RecordedQuestionRecord[];
}

/** A run with `count` questions, all answered by REVIEWER and submitted by OWNER. */
export async function submittedRun(h: Harness, count = 2, at?: Date): Promise<SubmittedRun> {
  const run = await startUnattended(h, at);
  const raised = await ask(h, run.id, count, at);
  const session = (await h.reviewSessions.openForRun(WS, run.id, at)) as ReviewSessionRecord;
  for (const question of raised) {
    await h.answerService.draft(
      WS,
      session.id,
      { questionId: question.id, authorId: REVIEWER, value: 'postgres' },
      at,
    );
  }
  const { session: submitted } = await h.submission.submit(WS, session.id, OWNER, at);
  return { run, session: submitted, questions: raised };
}
