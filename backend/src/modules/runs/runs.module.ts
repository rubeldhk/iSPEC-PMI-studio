/**
 * EPIC-023 — runs module wiring (F-02.1, F-02.2).
 *
 * Services stay framework-free (PC-1): plain classes wired here with factory
 * providers. Defaults are the in-memory stores, matching the platform
 * posture — the API boots and serves without a database; a deployment that
 * wants persistence overrides the store tokens at the composition root
 * (EPIC-014 F-11.2).
 */
import { Module } from '@nestjs/common';
import { ProvisionalApprovalService, InMemoryOverrideStore, type OverrideStore } from './provisional-approval.service.js';
import { InMemoryMarkingStore, ProvisionalService, type MarkingStore } from './provisional.service.js';
import { InMemoryQuestionStore, QuestionRecorderService, type QuestionStore } from './question-recorder.service.js';
import { InMemoryRunStore, RunModeService, type RunStore } from './run-mode.service.js';
import { RunsController } from './runs.controller.js';

export const RUN_STORE = Symbol('RUN_STORE');
export const QUESTION_STORE = Symbol('QUESTION_STORE');
export const MARKING_STORE = Symbol('MARKING_STORE');
export const OVERRIDE_STORE = Symbol('OVERRIDE_STORE');

@Module({
  controllers: [RunsController],
  providers: [
    { provide: RUN_STORE, useFactory: (): RunStore => new InMemoryRunStore() },
    { provide: QUESTION_STORE, useFactory: (): QuestionStore => new InMemoryQuestionStore() },
    { provide: MARKING_STORE, useFactory: (): MarkingStore => new InMemoryMarkingStore() },
    { provide: OVERRIDE_STORE, useFactory: (): OverrideStore => new InMemoryOverrideStore() },
    {
      provide: RunModeService,
      inject: [RUN_STORE],
      useFactory: (runs: RunStore): RunModeService => new RunModeService(runs),
    },
    {
      provide: QuestionRecorderService,
      inject: [RUN_STORE, QUESTION_STORE],
      useFactory: (runs: RunStore, questions: QuestionStore): QuestionRecorderService =>
        new QuestionRecorderService(runs, questions),
    },
    {
      provide: ProvisionalService,
      inject: [MARKING_STORE],
      useFactory: (markings: MarkingStore): ProvisionalService => new ProvisionalService(markings),
    },
    {
      provide: ProvisionalApprovalService,
      inject: [ProvisionalService, OVERRIDE_STORE],
      useFactory: (
        provisional: ProvisionalService,
        overrides: OverrideStore,
      ): ProvisionalApprovalService => new ProvisionalApprovalService(provisional, overrides),
    },
  ],
  exports: [
    RunModeService,
    QuestionRecorderService,
    ProvisionalService,
    ProvisionalApprovalService,
    RUN_STORE,
    QUESTION_STORE,
    MARKING_STORE,
    OVERRIDE_STORE,
  ],
})
export class RunsModule {}
