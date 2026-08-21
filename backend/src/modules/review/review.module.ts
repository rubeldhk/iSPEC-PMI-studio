/**
 * EPIC-023 — review module wiring (F-02.3, F-02.4).
 *
 * The owner lookup reads the LIVE project register through `PROJECT_STORE` —
 * the same composition seam the requirement selection uses: neither module
 * imports the other's service; they meet here, on a token.
 */
import { Module } from '@nestjs/common';
import { PROJECT_STORE, ProjectsModule } from '../projects/projects.module.js';
import type { ProjectStore } from '../projects/projects.service.js';
import { ProvisionalService } from '../runs/provisional.service.js';
import type { QuestionStore } from '../runs/question-recorder.service.js';
import { QUESTION_STORE, RUN_STORE, RunsModule } from '../runs/runs.module.js';
import type { RunStore } from '../runs/run-mode.service.js';
import { AnswerService, InMemoryAnswerStore, type AnswerStore } from './answer.service.js';
import type { ProjectOwnerLookup } from './authority.js';
import { ConflictService } from './conflict.service.js';
import { RerunService } from './rerun.service.js';
import { ReviewController } from './review.controller.js';
import { InMemorySessionStore, ReviewSessionService, type SessionStore } from './review-session.service.js';
import { InMemoryWorkChangeLog, StaleAnswersService, type WorkChangeDetector } from './stale-answers.service.js';
import { SubmissionService } from './submission.service.js';

export const SESSION_STORE = Symbol('SESSION_STORE');
export const ANSWER_STORE = Symbol('ANSWER_STORE');
export const PROJECT_OWNER_LOOKUP = Symbol('PROJECT_OWNER_LOOKUP');
export const WORK_CHANGE_DETECTOR = Symbol('WORK_CHANGE_DETECTOR');

/** FR-RUN-015a/013a — authority reads the live project register. */
export class ProjectStoreOwnerLookup implements ProjectOwnerLookup {
  constructor(private readonly projects: ProjectStore) {}

  async ownerOf(workspaceId: string, projectId: string): Promise<string | null> {
    const project = await this.projects.findById(projectId);
    return project && project.workspaceId === workspaceId ? project.ownerUserId : null;
  }
}

@Module({
  imports: [RunsModule, ProjectsModule],
  controllers: [ReviewController],
  providers: [
    { provide: SESSION_STORE, useFactory: (): SessionStore => new InMemorySessionStore() },
    { provide: ANSWER_STORE, useFactory: (): AnswerStore => new InMemoryAnswerStore() },
    { provide: WORK_CHANGE_DETECTOR, useFactory: (): WorkChangeDetector => new InMemoryWorkChangeLog() },
    {
      provide: PROJECT_OWNER_LOOKUP,
      inject: [PROJECT_STORE],
      useFactory: (projects: ProjectStore): ProjectOwnerLookup =>
        new ProjectStoreOwnerLookup(projects),
    },
    {
      provide: ReviewSessionService,
      inject: [RUN_STORE, QUESTION_STORE, SESSION_STORE, ANSWER_STORE],
      useFactory: (
        runs: RunStore,
        questions: QuestionStore,
        sessions: SessionStore,
        answers: AnswerStore,
      ): ReviewSessionService => new ReviewSessionService(runs, questions, sessions, answers),
    },
    {
      provide: AnswerService,
      inject: [SESSION_STORE, QUESTION_STORE, ANSWER_STORE],
      useFactory: (
        sessions: SessionStore,
        questions: QuestionStore,
        answers: AnswerStore,
      ): AnswerService => new AnswerService(sessions, questions, answers),
    },
    {
      provide: ConflictService,
      inject: [RUN_STORE, QUESTION_STORE, SESSION_STORE, ANSWER_STORE, PROJECT_OWNER_LOOKUP],
      useFactory: (
        runs: RunStore,
        questions: QuestionStore,
        sessions: SessionStore,
        answers: AnswerStore,
        owners: ProjectOwnerLookup,
      ): ConflictService => new ConflictService(runs, questions, sessions, answers, owners),
    },
    {
      provide: SubmissionService,
      inject: [RUN_STORE, QUESTION_STORE, SESSION_STORE, ANSWER_STORE, PROJECT_OWNER_LOOKUP],
      useFactory: (
        runs: RunStore,
        questions: QuestionStore,
        sessions: SessionStore,
        answers: AnswerStore,
        owners: ProjectOwnerLookup,
      ): SubmissionService => new SubmissionService(runs, questions, sessions, answers, owners),
    },
    {
      provide: StaleAnswersService,
      inject: [QUESTION_STORE, ANSWER_STORE, WORK_CHANGE_DETECTOR],
      useFactory: (
        questions: QuestionStore,
        answers: AnswerStore,
        changes: WorkChangeDetector,
      ): StaleAnswersService => new StaleAnswersService(questions, answers, changes),
    },
    {
      provide: RerunService,
      inject: [
        RUN_STORE,
        QUESTION_STORE,
        SESSION_STORE,
        ANSWER_STORE,
        ProvisionalService,
        StaleAnswersService,
        ReviewSessionService,
      ],
      useFactory: (
        runs: RunStore,
        questions: QuestionStore,
        sessions: SessionStore,
        answers: AnswerStore,
        provisional: ProvisionalService,
        stale: StaleAnswersService,
        reviewSessions: ReviewSessionService,
      ): RerunService =>
        new RerunService(runs, questions, sessions, answers, provisional, stale, reviewSessions),
    },
  ],
  exports: [
    ReviewSessionService,
    AnswerService,
    ConflictService,
    SubmissionService,
    StaleAnswersService,
    RerunService,
    SESSION_STORE,
    ANSWER_STORE,
    PROJECT_OWNER_LOOKUP,
    WORK_CHANGE_DETECTOR,
  ],
})
export class ReviewModule {}
