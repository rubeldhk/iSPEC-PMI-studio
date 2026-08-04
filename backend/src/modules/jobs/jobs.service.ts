/**
 * T043 — job creation and idempotency.
 *
 * A duplicate submission JOINS the live job rather than starting a second.
 * Each engine run is a metered AI agent invocation, so a double-submit is a
 * real cost, not just an untidy row (RAID R-02).
 *
 * Framework-free (PC-1). The BullMQ queue is injected as a narrow port so the
 * logic is testable without Valkey.
 */
import { createHash } from 'node:crypto';
import { ValidationFailedError } from '../../core/errors.js';
import { FAILURE_MESSAGES } from '../../core/failure-taxonomy.js';

export type JobKind = 'generate_specification' | 'generate_tasks' | 'validate_specification';

export interface JobRequest {
  workspaceId: string;
  projectId: string;
  kind: JobKind;
  requestedById: string;
  engineName: string;
  engineVersion: string;
  correlationId: string;
  inputRefs: { requirementIds?: string[]; specificationId?: string };
}

export interface JobRow {
  id: string;
  state: string;
  jobKey: string;
}

export interface JobStore {
  findLive(projectId: string, jobKey: string): Promise<JobRow | null>;
  create(data: JobRequest & { jobKey: string }): Promise<JobRow>;
}

/** Optional queue port — jobs are durable in the database either way. */
export interface JobQueue {
  enqueue(jobId: string, correlationId: string): Promise<void>;
}

/**
 * Stable, order-insensitive key.
 *
 * Sorting the selection matters: picking requirements in a different order is
 * the same request, and should not bill a second engine run.
 */
export function computeJobKey(req: JobRequest): string {
  const refs = [...(req.inputRefs.requirementIds ?? [])].sort();
  const material = JSON.stringify({
    projectId: req.projectId,
    kind: req.kind,
    requirementIds: refs,
    specificationId: req.inputRefs.specificationId ?? null,
  });
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

export interface SubmitResult {
  job: JobRow;
  joinedExisting: boolean;
}

export class JobsService {
  constructor(
    private readonly store: JobStore,
    private readonly queue?: JobQueue,
  ) {}

  async submit(req: JobRequest): Promise<SubmitResult> {
    // E7: decided BEFORE anything is created or enqueued.
    if (req.kind === 'generate_specification' && (req.inputRefs.requirementIds ?? []).length === 0) {
      throw new ValidationFailedError(FAILURE_MESSAGES.empty_selection, {
        reason: 'empty_selection',
      });
    }

    const jobKey = computeJobKey(req);

    const live = await this.store.findLive(req.projectId, jobKey);
    if (live) return { job: live, joinedExisting: true };

    const job = await this.store.create({ ...req, jobKey });
    await this.queue?.enqueue(job.id, req.correlationId);
    return { job, joinedExisting: false };
  }
}
