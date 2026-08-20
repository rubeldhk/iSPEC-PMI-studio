/**
 * T080 — specification generation orchestration (F-04.3).
 *
 * Two halves of one capability, deliberately in one service:
 *
 *   `submit()` — the API side. Turns a selection into a JOB and answers
 *                immediately. Generation is always asynchronous: it is an AI
 *                agent run, not a function call (research R-001).
 *
 *   `run()`    — the worker side. Invokes the engine THROUGH THE CONTRACT,
 *                validates what comes back, and commits.
 *
 * They are one service because they are one capability, and PC-1 requires it to
 * be callable without HTTP: the worker calls `run()` directly and never speaks
 * to the API over a socket.
 *
 * The centre of gravity is the commit. Specification, version, traceability
 * links and the job's terminal state go through ONE store call, so `SC-002`
 * ("zero orphaned specifications") is a property of the write path rather than
 * something a cleanup job repairs afterwards.
 *
 * On any non-success outcome NOTHING but the terminal state is written
 * (FR-027, SC-006), and the reason is always specific (FR-026, SC-005).
 *
 * `backend/` never names a concrete engine (FR-017, ADR-0001) — the resolver
 * hands one over behind `SpecificationEngine`.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import { newCorrelationId } from '@pmi/observability';
import type {
  EngineFailureReason,
  RequirementPriority,
  RequirementType,
  SpecificationEngine,
} from '@pmi/engine-contract';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { FAILURE_MESSAGES } from '../../core/failure-taxonomy.js';
import { runWithLimits } from '../jobs/job-runner.service.js';
import { applyTransition, InvalidJobTransitionError, type JobState } from '../jobs/job-state.machine.js';
import type { JobRequest, JobRow, JobStore, SubmitResult } from '../jobs/jobs.service.js';
import { assertStamped, stampEngineProvenance } from './engine-stamp.js';
import { parseEngineOutput } from './output-parser.js';
import type {
  ActingContext,
  GenerationCommit,
  SpecificationRecord,
  SpecificationStore,
  SpecificationTraceLink,
} from './specifications-read.service.js';

// ------------------------------------------------------------------- inputs

export interface RequirementSelection {
  id: string;
  reference: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
}

/**
 * One generation run.
 *
 * Named `GenerationOrder` rather than the obvious alternative: this file is a
 * service, and PC-1's architecture test reads that word, bare, as a transport
 * type creeping into business logic. The naming rule is cheap; the boundary it
 * protects is not.
 */
export interface GenerationOrder {
  jobId: string;
  workspaceId: string;
  projectId: string;
  requestedById: string;
  correlationId: string;
  projectName: string;
  requirements: RequirementSelection[];
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface GenerationOutcome {
  state: 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
  failureReason?: EngineFailureReason;
  specification?: SpecificationRecord;
}

/** Just enough of `EngineResolverService` to resolve an engine for a project. */
export interface EngineResolverPort {
  resolveForProject(projectId: string): Promise<SpecificationEngine>;
}

// -------------------------------------------------------------- the job view

export interface JobView {
  id: string;
  workspaceId: string;
  projectId: string;
  jobKey: string;
  kind: 'generate_specification' | 'generate_tasks' | 'validate_specification';
  state: JobState;
  failureReason: EngineFailureReason | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  /** The artifact a succeeded job produced, once there is one. */
  resultRef: string | null;
}

export interface JobStateUpdate {
  state: JobState;
  failureReason?: EngineFailureReason;
  endedAt?: Date;
  resultRef?: string;
}

/**
 * The read-and-cancel half of the job surface.
 *
 * Deliberately a SEPARATE port from EPIC-001's `JobStore` rather than a
 * widening of it: `JobStore` is the submission path, already built and already
 * tested, and adding required members to it would break every implementation
 * that satisfies it today for the sake of a read this epic introduces.
 */
export interface GenerationJobLedger {
  findById(id: string): Promise<JobView | null>;
  listForProject(workspaceId: string, projectId: string): Promise<JobView[]>;
  updateState(id: string, next: JobStateUpdate): Promise<JobView>;
}

/** Just enough of `JobsService`: creation, idempotency, enqueue. */
export interface JobSubmitPort {
  submit(order: JobRequest): Promise<SubmitResult>;
}

export interface GenerationJobApi {
  submit(
    ctx: ActingContext,
    projectId: string,
    requirementIds: string[],
  ): Promise<{ job: JobView; joinedExisting: boolean }>;
  job(workspaceId: string, id: string): Promise<JobView>;
  cancel(workspaceId: string, id: string): Promise<JobView>;
  jobsForProject(workspaceId: string, projectId: string): Promise<JobView[]>;
}

// ----------------------------------------------------------------- the rules

/**
 * Contract rule E7: decided BEFORE the engine is touched, so an obviously
 * invalid request never becomes a billed run (RAID R-02).
 */
const MAX_REQUIREMENTS_DEFAULT = 500;

export interface GenerateSpecificationOptions {
  jobs?: JobSubmitPort;
  ledger?: GenerationJobLedger;
  maxRequirements?: number;
  now?: () => Date;
  newCorrelationId?: () => string;
}

const OPAQUE = 'Not found.';

/** Which terminal state a given reason produces. Never `succeeded` — a reason exists. */
function stateFor(reason: EngineFailureReason): 'failed' | 'cancelled' | 'timed_out' {
  if (reason === 'cancelled') return 'cancelled';
  if (reason === 'timeout') return 'timed_out';
  return 'failed';
}

export class GenerateSpecificationService implements GenerationJobApi {
  private readonly jobs: JobSubmitPort | undefined;
  private readonly ledger: GenerationJobLedger | undefined;
  private readonly maxRequirements: number;
  private readonly now: () => Date;
  private readonly correlate: () => string;

  constructor(
    private readonly engines: EngineResolverPort,
    private readonly store: SpecificationStore,
    options: GenerateSpecificationOptions = {},
  ) {
    this.jobs = options.jobs;
    this.ledger = options.ledger;
    this.maxRequirements = options.maxRequirements ?? MAX_REQUIREMENTS_DEFAULT;
    this.now = options.now ?? ((): Date => new Date());
    this.correlate = options.newCorrelationId ?? newCorrelationId;
  }

  // ------------------------------------------------------------ the API side

  /**
   * Accept a selection and answer with a job.
   *
   * The empty-selection refusal comes FIRST — before the engine is resolved —
   * so a deployment with no engine still answers "select at least one
   * requirement" rather than a deployment fault the caller cannot act on.
   */
  async submit(
    ctx: ActingContext,
    projectId: string,
    requirementIds: string[],
  ): Promise<{ job: JobView; joinedExisting: boolean }> {
    if (!this.jobs || !this.ledger) {
      throw new Error('No job layer is configured for specification generation.');
    }
    const selection = [...new Set(requirementIds ?? [])];
    if (selection.length === 0) {
      throw new ValidationFailedError(FAILURE_MESSAGES.empty_selection, {
        reason: 'empty_selection',
      });
    }
    if (selection.length > this.maxRequirements) {
      throw new ValidationFailedError(FAILURE_MESSAGES.input_too_large, {
        reason: 'input_too_large',
        limit: this.maxRequirements,
      });
    }

    // FR-022 is decided here, not at the end: the job records WHICH engine it
    // will be run by, so a later registry change cannot rewrite history.
    const { descriptor } = await this.engines.resolveForProject(projectId);
    const submitted = await this.jobs.submit({
      workspaceId: ctx.workspaceId,
      projectId,
      kind: 'generate_specification',
      requestedById: ctx.userId,
      engineName: descriptor.name,
      engineVersion: descriptor.version,
      // PC-3: generated once, at the API edge, then carried — never regenerated.
      correlationId: this.correlate(),
      inputRefs: { requirementIds: selection },
    });

    const job = await this.ledger.findById(submitted.job.id);
    /* c8 ignore next — the row was just created through the same ledger. */
    if (!job) throw new NotFoundError(OPAQUE);
    return { job, joinedExisting: submitted.joinedExisting };
  }

  async job(workspaceId: string, id: string): Promise<JobView> {
    return this.loadJob(workspaceId, id);
  }

  /** FR-024 — a cancellation request. A finished job is a conflict, not a no-op. */
  async cancel(workspaceId: string, id: string): Promise<JobView> {
    const job = await this.loadJob(workspaceId, id);
    let transition;
    try {
      transition = applyTransition(job.state, 'cancelled', 'cancelled');
    } catch (error) {
      if (error instanceof InvalidJobTransitionError) throw new ConflictError(error.message);
      /* c8 ignore next 2 — applyTransition throws nothing else for this pair. */
      throw error;
    }
    return this.ledger!.updateState(id, {
      state: transition.state,
      failureReason: 'cancelled',
      ...(transition.endedAt ? { endedAt: transition.endedAt } : {}),
    });
  }

  async jobsForProject(workspaceId: string, projectId: string): Promise<JobView[]> {
    if (!this.ledger) return [];
    return this.ledger.listForProject(workspaceId, projectId);
  }

  private async loadJob(workspaceId: string, id: string): Promise<JobView> {
    const job = this.ledger ? await this.ledger.findById(id) : null;
    // FR-002 / SC-004: absence and another tenant's row are the same answer.
    if (!job || job.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    return job;
  }

  // --------------------------------------------------------- the worker side

  /**
   * Run one generation to a terminal state.
   *
   * Every early return goes through `terminal()`, which writes the state and
   * NOTHING else. There is no branch in this method that stores an artifact
   * alongside a failure, which is what makes SC-006 readable rather than
   * merely tested.
   */
  async run(order: GenerationOrder): Promise<GenerationOutcome> {
    // E7 — pre-flight, before an engine is resolved or touched.
    if (order.requirements.length === 0) return this.terminal(order, 'empty_selection');
    if (order.requirements.length > this.maxRequirements) {
      return this.terminal(order, 'input_too_large');
    }
    if (order.signal?.aborted) return this.terminal(order, 'cancelled');

    let engine: SpecificationEngine;
    try {
      engine = await this.engines.resolveForProject(order.projectId);
    } catch {
      // A selection naming an unregistered engine, or a deployment with none.
      // Distinct from `engine_error`: nothing ran.
      return this.terminal(order, 'engine_unavailable');
    }

    const outcome = await runWithLimits(
      (signal) =>
        engine.generateSpecification(
          {
            projectName: order.projectName,
            requirements: order.requirements.map((r) => ({
              reference: r.reference,
              description: r.description,
              type: r.type,
              priority: r.priority,
            })),
          },
          {
            signal,
            timeoutMs: order.timeoutMs,
            // PC-3: the correlation id crosses INTO the engine and its sandbox.
            correlationId: order.correlationId,
          },
        ),
      order.signal ? { timeoutMs: order.timeoutMs, signal: order.signal } : { timeoutMs: order.timeoutMs },
    );

    if (outcome.outcome !== 'succeeded') return this.terminal(order, outcome.reason);
    if (!outcome.value.ok) return this.terminal(order, outcome.value.failure.reason);

    // The run finished. Whether what came back IS a specification is a separate
    // question, and this is where it is asked (T079).
    const parsed = parseEngineOutput(outcome.value.value);
    if (!parsed.ok) return this.terminal(order, parsed.reason);

    // FR-022 — refuse rather than default. An artifact whose engine cannot be
    // identified is not storable, and inventing a name would attribute it to an
    // engine that never ran it.
    const at = this.now();
    let provenance;
    try {
      provenance = stampEngineProvenance(outcome.value.producedBy, at);
      assertStamped(provenance);
    } catch {
      return this.terminal(order, 'engine_error');
    }

    const specificationId = randomUUID();
    const versionId = randomUUID();
    const commit: GenerationCommit = {
      specification: {
        id: specificationId,
        workspaceId: order.workspaceId,
        projectId: order.projectId,
        title: parsed.value.title,
        lifecycleState: 'draft',
        currentVersionId: versionId,
        engineName: provenance.engineName,
        engineVersion: provenance.engineVersion,
        generatedAt: provenance.generatedAt,
        isOutOfDate: false,
        createdById: order.requestedById,
        updatedById: order.requestedById,
      },
      version: {
        id: versionId,
        workspaceId: order.workspaceId,
        specificationId,
        versionNumber: 1,
        contentRaw: parsed.value.contentRaw,
        contentParsed: parsed.value.contentParsed,
        lifecycleStateAtCreation: 'draft',
        authoredById: order.requestedById,
      },
      links: linksFor(order.workspaceId, specificationId, order.requirements),
      job: { id: order.jobId, state: 'succeeded' },
    };

    try {
      const specification = await this.store.commitGeneration(commit);
      return { state: 'succeeded', specification };
    } catch {
      // The commit is all-or-nothing, so nothing survives this. The job is
      // reported as failed rather than as a success the platform cannot show.
      //
      // `engine_error` is the closest member of a CLOSED taxonomy that has no
      // persistence reason — recorded as defect DEF-008-001 and deferred to
      // EPIC-003, which owns `@pmi/engine-contract`.
      return this.terminal(order, 'engine_error');
    }
  }

  /** Write ONLY the terminal state. No artifact, ever (FR-027, SC-006). */
  private async terminal(
    order: GenerationOrder,
    reason: EngineFailureReason,
  ): Promise<GenerationOutcome> {
    const state = stateFor(reason);
    await this.store.recordJobOutcome({ jobId: order.jobId, state, failureReason: reason });
    return { state, failureReason: reason };
  }
}

/** FR-029 — one link per selected requirement, deduplicated, one direction. */
export function linksFor(
  workspaceId: string,
  specificationId: string,
  requirements: RequirementSelection[],
): SpecificationTraceLink[] {
  const seen = new Set<string>();
  const links: SpecificationTraceLink[] = [];
  for (const requirement of requirements) {
    if (seen.has(requirement.id)) continue;
    seen.add(requirement.id);
    links.push({
      workspaceId,
      sourceType: 'specification',
      sourceId: specificationId,
      targetType: 'requirement',
      targetId: requirement.id,
      relationship: 'generated_from',
    });
  }
  return links;
}

// --------------------------------------------------------------- the ledger

/**
 * An in-memory generation-job ledger, for tests and database-less runs.
 *
 * It implements BOTH `JobStore` (EPIC-001's submission path) and
 * `GenerationJobLedger` (this epic's read surface), so one instance backs
 * `JobsService` and the job API without either duplicating the other's
 * idempotency rules.
 *
 * In a composed deployment both ports address the same `generation_jobs` table,
 * supplied at the composition root (EPIC-014 F-11.2).
 */
export class InMemoryGenerationJobLedger implements JobStore, GenerationJobLedger {
  private readonly rows = new Map<string, JobView>();
  private seq = 0;

  async findLive(projectId: string, jobKey: string): Promise<JobRow | null> {
    // Only queued/running may be joined: re-running a generation that already
    // failed is a legitimate retry, and joining the old failure would make the
    // failure permanent.
    for (const row of this.rows.values()) {
      if (
        row.projectId === projectId &&
        row.jobKey === jobKey &&
        (row.state === 'queued' || row.state === 'running')
      ) {
        return { id: row.id, state: row.state, jobKey: row.jobKey };
      }
    }
    return null;
  }

  async create(data: JobRequest & { jobKey: string }): Promise<JobRow> {
    this.seq += 1;
    const row: JobView = {
      id: `job_${this.seq}`,
      workspaceId: data.workspaceId,
      projectId: data.projectId,
      jobKey: data.jobKey,
      kind: data.kind,
      state: 'queued',
      failureReason: null,
      startedAt: null,
      endedAt: null,
      createdAt: new Date(Date.now() + this.seq),
      resultRef: null,
    };
    this.rows.set(row.id, row);
    return { id: row.id, state: row.state, jobKey: row.jobKey };
  }

  async findById(id: string): Promise<JobView | null> {
    return this.rows.get(id) ?? null;
  }

  async listForProject(workspaceId: string, projectId: string): Promise<JobView[]> {
    return [...this.rows.values()]
      .filter((j) => j.workspaceId === workspaceId && j.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateState(id: string, next: JobStateUpdate): Promise<JobView> {
    const row = this.rows.get(id);
    if (!row) throw new NotFoundError(OPAQUE);
    const updated: JobView = {
      ...row,
      state: next.state,
      failureReason: next.failureReason ?? row.failureReason,
      endedAt: next.endedAt ?? row.endedAt,
      resultRef: next.resultRef ?? row.resultRef,
    };
    this.rows.set(id, updated);
    return updated;
  }
}
