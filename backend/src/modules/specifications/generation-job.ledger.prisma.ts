/**
 * `T1329` (EPIC-041) — the generation job ledger on PostgreSQL.
 *
 * `FR-LPW-041`, `R-041-7`. One class, two interfaces, one table. The
 * specifications module composes `JobStore` (what `JobsService.submit` needs:
 * `findLive`, `create`) and `GenerationJobLedger` (what the run path and the
 * read surface need: `findById`, `listForProject`, `updateState`) on a single
 * token, and `InMemoryGenerationJobLedger` satisfied both in memory. This does
 * the same over `generation_jobs` — the rows `PrismaJobStore` writes — so a job
 * the API created is the job the worker claims and the job the screen polls.
 *
 * Framework-free (PC-1). Integration test:
 * `backend/tests/integration/generation-job-ledger.spec.ts` (T1328).
 */
import type { PrismaClient } from '@prisma/client';
import type { EngineFailureReason } from '@pmi/engine-contract';
import { NotFoundError } from '../../core/errors.js';
import type { JobRequest, JobRow, JobStore } from '../jobs/jobs.service.js';
import type { GenerationJobLedger, JobStateUpdate, JobView } from './generate-specification.service.js';

type JobDelegate = PrismaClient['generationJob'];
type GenerationJobRow = Awaited<ReturnType<JobDelegate['findMany']>>[number];

/** States a job can still be joined at. Anything else is finished. */
const LIVE_STATES = ['queued', 'running'] as const;

const toView = (row: GenerationJobRow): JobView => ({
  id: row.id,
  workspaceId: row.workspaceId,
  projectId: row.projectId,
  jobKey: row.jobKey,
  kind: row.kind as JobView['kind'],
  state: row.state as JobView['state'],
  failureReason: (row.failureReason as EngineFailureReason | null) ?? null,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  createdAt: row.createdAt,
  resultRef: row.resultRef,
});

export class PrismaGenerationJobLedger implements JobStore, GenerationJobLedger {
  constructor(private readonly generationJob: JobDelegate) {}

  // ------------------------------------------------------------- JobStore

  async findLive(projectId: string, jobKey: string): Promise<JobRow | null> {
    const row = await this.generationJob.findFirst({
      where: { projectId, jobKey, state: { in: [...LIVE_STATES] } },
    });
    return row === null ? null : { id: row.id, state: row.state, jobKey: row.jobKey };
  }

  async create(data: JobRequest & { jobKey: string }): Promise<JobRow> {
    const row = await this.generationJob.create({
      data: {
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        jobKey: data.jobKey,
        kind: data.kind,
        requestedById: data.requestedById,
        engineName: data.engineName,
        engineVersion: data.engineVersion,
        correlationId: data.correlationId,
        inputRefs: data.inputRefs as never,
      },
    });
    return { id: row.id, state: row.state, jobKey: row.jobKey };
  }

  // ------------------------------------------------- GenerationJobLedger

  async findById(id: string): Promise<JobView | null> {
    const row = await this.generationJob.findUnique({ where: { id } });
    return row === null ? null : toView(row);
  }

  async listForProject(workspaceId: string, projectId: string): Promise<JobView[]> {
    const rows = await this.generationJob.findMany({
      where: { workspaceId, projectId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toView);
  }

  async updateState(id: string, next: JobStateUpdate): Promise<JobView> {
    const existing = await this.generationJob.findUnique({ where: { id } });
    if (existing === null) throw new NotFoundError('Not found.');
    const row = await this.generationJob.update({
      where: { id },
      data: {
        state: next.state,
        ...(next.failureReason !== undefined ? { failureReason: next.failureReason } : {}),
        // Stamped once. A later transition carries no `startedAt`, so the
        // moment the run actually began survives every subsequent write.
        ...(next.startedAt !== undefined && existing.startedAt === null ? { startedAt: next.startedAt } : {}),
        ...(next.endedAt !== undefined ? { endedAt: next.endedAt } : {}),
        ...(next.resultRef !== undefined ? { resultRef: next.resultRef } : {}),
      },
    });
    return toView(row);
  }
}
