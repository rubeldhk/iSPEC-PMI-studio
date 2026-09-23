/**
 * `T1327` (EPIC-041) — the four run-side stores on PostgreSQL.
 *
 * `FR-LPW-041`, `R-041-7`. `runs.module.ts` bound every store to its in-memory
 * sibling unconditionally, so an unattended run, the questions it recorded, the
 * artifacts it marked provisional and the approvals that accepted them all
 * vanished on restart (PMI-DOC-004B §2.1). Each class here is selected by the
 * module when `DATABASE_URL` is set; the in-memory classes remain for the
 * database-less posture unit suites run under.
 *
 * Framework-free (PC-1). `PrismaOverrideStore` exposes append and list only —
 * the database trigger refuses the rest, and so does the interface.
 *
 * Integration test: `backend/tests/integration/run-stores.spec.ts` (T1326).
 */
import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../core/errors.js';
import type { ArtifactRef } from '../access/access-grant.service.js';
import type { OverrideRecord, OverrideStore, ProvisionalItem } from './provisional-approval.service.js';
import type { MarkingStore, ProvisionalMarkingRecord } from './provisional.service.js';
import type { QuestionStore, RecordedQuestionRecord } from './question-recorder.service.js';
import type { RunMode, RunRecord, RunState, RunStopRange, RunStore } from './run-mode.service.js';

// ------------------------------------------------------------------- runs

type RunDelegate = PrismaClient['run'];
type RunRow = Awaited<ReturnType<RunDelegate['findMany']>>[number];

const toRun = (row: RunRow): RunRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
  projectId: row.projectId,
  mode: row.mode as RunMode,
  stopRange: row.stopRange as RunStopRange,
  state: row.state as RunState,
  accessSnapshot: row.accessSnapshot ?? null,
  initiatedById: row.initiatedById,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  outcomeReason: row.outcomeReason,
});

export class PrismaRunStore implements RunStore {
  constructor(private readonly run: RunDelegate) {}

  async create(run: Omit<RunRecord, 'id'>): Promise<RunRecord> {
    const row = await this.run.create({
      data: {
        workspaceId: run.workspaceId,
        projectId: run.projectId,
        mode: run.mode,
        stopRange: run.stopRange,
        state: run.state,
        accessSnapshot: (run.accessSnapshot ?? undefined) as never,
        initiatedById: run.initiatedById,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        outcomeReason: run.outcomeReason,
      },
    });
    return toRun(row);
  }

  async find(workspaceId: string, id: string): Promise<RunRecord | null> {
    const row = await this.run.findFirst({ where: { id, workspaceId } });
    return row === null ? null : toRun(row);
  }

  async listForProject(workspaceId: string, projectId: string): Promise<RunRecord[]> {
    const rows = await this.run.findMany({ where: { workspaceId, projectId }, orderBy: { startedAt: 'desc' } });
    return rows.map(toRun);
  }

  async update(workspaceId: string, id: string, patch: Partial<RunRecord>): Promise<RunRecord> {
    const { id: _id, workspaceId: _ws, accessSnapshot, ...rest } = patch;
    const result = await this.run.updateMany({
      where: { id, workspaceId },
      data: { ...rest, ...(accessSnapshot !== undefined ? { accessSnapshot: accessSnapshot as never } : {}) },
    });
    if (result.count === 0) throw new NotFoundError('Not found.');
    const row = await this.run.findFirst({ where: { id, workspaceId } });
    if (row === null) throw new NotFoundError('Not found.');
    return toRun(row);
  }
}

// -------------------------------------------------------------- questions

type QuestionDelegate = PrismaClient['recordedQuestion'];
type QuestionRow = Awaited<ReturnType<QuestionDelegate['findMany']>>[number];

const toQuestion = (row: QuestionRow): RecordedQuestionRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
  runId: row.runId,
  context: row.context,
  optionsConsidered: (row.optionsConsidered as string[] | null) ?? [],
  suggestedAnswer: row.suggestedAnswer,
  provisionalAnswerApplied: row.provisionalAnswerApplied,
  restricted: row.restricted,
  createdAt: row.createdAt,
});

export class PrismaQuestionStore implements QuestionStore {
  constructor(private readonly question: QuestionDelegate) {}

  async create(question: Omit<RecordedQuestionRecord, 'id'>): Promise<RecordedQuestionRecord> {
    const row = await this.question.create({
      data: {
        workspaceId: question.workspaceId,
        runId: question.runId,
        context: question.context,
        optionsConsidered: question.optionsConsidered,
        suggestedAnswer: question.suggestedAnswer,
        provisionalAnswerApplied: question.provisionalAnswerApplied,
        restricted: question.restricted,
        createdAt: question.createdAt,
      },
    });
    return toQuestion(row);
  }

  async find(workspaceId: string, id: string): Promise<RecordedQuestionRecord | null> {
    const row = await this.question.findFirst({ where: { id, workspaceId } });
    return row === null ? null : toQuestion(row);
  }

  async listForRun(workspaceId: string, runId: string): Promise<RecordedQuestionRecord[]> {
    const rows = await this.question.findMany({ where: { workspaceId, runId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toQuestion);
  }
}

// --------------------------------------------------------------- markings

type MarkingDelegate = PrismaClient['provisionalMarking'];
type MarkingRow = Awaited<ReturnType<MarkingDelegate['findMany']>>[number];

const toMarking = (row: MarkingRow): ProvisionalMarkingRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
  artifactType: row.artifactType as ProvisionalMarkingRecord['artifactType'],
  artifactId: row.artifactId,
  questionId: row.questionId,
  clearedAt: row.clearedAt,
  createdAt: row.createdAt,
});

export class PrismaMarkingStore implements MarkingStore {
  constructor(private readonly marking: MarkingDelegate) {}

  async create(marking: Omit<ProvisionalMarkingRecord, 'id'>): Promise<ProvisionalMarkingRecord> {
    const row = await this.marking.create({
      data: {
        workspaceId: marking.workspaceId,
        artifactType: marking.artifactType,
        artifactId: marking.artifactId,
        questionId: marking.questionId,
        clearedAt: marking.clearedAt,
        createdAt: marking.createdAt,
      },
    });
    return toMarking(row);
  }

  async listForArtifact(workspaceId: string, artifact: ArtifactRef): Promise<ProvisionalMarkingRecord[]> {
    const rows = await this.marking.findMany({
      where: { workspaceId, artifactType: artifact.artifactType, artifactId: artifact.artifactId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMarking);
  }

  async listForQuestion(workspaceId: string, questionId: string): Promise<ProvisionalMarkingRecord[]> {
    const rows = await this.marking.findMany({ where: { workspaceId, questionId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toMarking);
  }

  async clear(workspaceId: string, markingId: string, at: Date): Promise<ProvisionalMarkingRecord> {
    const result = await this.marking.updateMany({ where: { id: markingId, workspaceId }, data: { clearedAt: at } });
    if (result.count === 0) throw new NotFoundError('Not found.');
    const row = await this.marking.findFirst({ where: { id: markingId, workspaceId } });
    if (row === null) throw new NotFoundError('Not found.');
    return toMarking(row);
  }
}

// -------------------------------------------------------------- overrides

type OverrideDelegate = PrismaClient['provisionalApprovalOverride'];
type OverrideRow = Awaited<ReturnType<OverrideDelegate['findMany']>>[number];

const toOverride = (row: OverrideRow): OverrideRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
  approvalRef: row.approvalRef,
  approverId: row.approverId,
  approvedAt: row.approvedAt,
  itemsAccepted: (row.itemsAccepted as ProvisionalItem[] | null) ?? [],
});

/** Append and list. Nothing else exists here, and the trigger agrees. */
export class PrismaOverrideStore implements OverrideStore {
  constructor(private readonly override: OverrideDelegate) {}

  async append(record: Omit<OverrideRecord, 'id'>): Promise<OverrideRecord> {
    const row = await this.override.create({
      data: {
        workspaceId: record.workspaceId,
        approvalRef: record.approvalRef,
        approverId: record.approverId,
        approvedAt: record.approvedAt,
        itemsAccepted: record.itemsAccepted as never,
      },
    });
    return toOverride(row);
  }

  async listForApproval(workspaceId: string, approvalRef: string): Promise<OverrideRecord[]> {
    const rows = await this.override.findMany({ where: { workspaceId, approvalRef }, orderBy: { approvedAt: 'asc' } });
    return rows.map(toOverride);
  }
}
