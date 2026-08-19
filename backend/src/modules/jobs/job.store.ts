/**
 * T651 — persistence for generation jobs.
 *
 * Written against a NARROW delegate rather than importing `@prisma/client`
 * directly, following the `T463` precedent: the shape here is Prisma's own, so
 * it drops onto `PrismaClient.generationJob` unchanged, and the service stays
 * unit-testable without a database.
 *
 * Framework-free (PC-1) — no Nest, no decorators. Wired in `jobs.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import type { JobRequest, JobRow, JobStore } from './jobs.service.js';

/** States a job can still be joined at. Anything else is finished. */
const LIVE_STATES = ['queued', 'running'] as const;

/** The subset of a Prisma delegate this store uses. Nothing more is required. */
export interface GenerationJobDelegate {
  findFirst(args: {
    where: { projectId: string; jobKey: string; state: { in: string[] } };
  }): Promise<{ id: string; state: string; jobKey: string } | null>;

  create(args: {
    data: Record<string, unknown>;
  }): Promise<{ id: string; state: string; jobKey: string }>;
}

export class PrismaJobStore implements JobStore {
  constructor(private readonly generationJob: GenerationJobDelegate) {}

  /**
   * A duplicate submission joins the LIVE job, never a finished one.
   *
   * Scoping to queued/running matters: re-running a generation that already
   * failed is a legitimate retry, and joining the old failure instead would
   * make the failure permanent.
   */
  async findLive(projectId: string, jobKey: string): Promise<JobRow | null> {
    return this.generationJob.findFirst({
      where: { projectId, jobKey, state: { in: [...LIVE_STATES] } },
    });
  }

  async create(data: JobRequest & { jobKey: string }): Promise<JobRow> {
    return this.generationJob.create({
      data: {
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        jobKey: data.jobKey,
        kind: data.kind,
        requestedById: data.requestedById,
        engineName: data.engineName,
        engineVersion: data.engineVersion,
        correlationId: data.correlationId,
        inputRefs: data.inputRefs,
      },
    });
  }
}

/**
 * An in-memory store, for deployments and tests without a database.
 *
 * Explicit rather than implicit, for the same reason `NullEngineRegistrationStore`
 * is: "no store was supplied" and "this deployment deliberately has no database"
 * are different states, and only one of them is a configuration mistake.
 */
export class NullJobStore implements JobStore {
  readonly created: (JobRequest & { jobKey: string; id: string })[] = [];

  async findLive(projectId: string, jobKey: string): Promise<JobRow | null> {
    const row = this.created.find((j) => j.projectId === projectId && j.jobKey === jobKey);
    return row ? { id: row.id, state: 'queued', jobKey: row.jobKey } : null;
  }

  async create(data: JobRequest & { jobKey: string }): Promise<JobRow> {
    const row = { ...data, id: randomUUID() };
    this.created.push(row);
    return { id: row.id, state: 'queued', jobKey: row.jobKey };
  }
}
