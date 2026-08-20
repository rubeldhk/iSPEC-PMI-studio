/**
 * T101 — task generation through the engine contract, gated on approval
 * (FR-020, FR-022, FR-029).
 *
 * The gate is EPIC-009's `assertTaskGenerationPermitted` — the rule lives with
 * the lifecycle so it cannot fork. Traceability links are written in the SAME
 * act that creates the tasks (EPIC-011's writer), so the reverse trace exists
 * the moment the task does (SC-003) — never as a later reconciliation.
 *
 * Failure stores NO partial list (FR-027): tasks are created only after the
 * engine result is whole and ok.
 *
 * Framework-free (PC-1). Wired in `tasks.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import type { EngineContext, SpecificationEngine } from '@pmi/engine-contract';
import { NotFoundError } from '../../core/errors.js';
import { assertTaskGenerationPermitted, type SpecLifecycleState } from '../specifications/lifecycle.machine.js';
import type { LinkWriterService } from '../traceability/link-writer.service.js';

export type TaskStatus = 'not_started' | 'in_progress' | 'done';

export interface TaskRecord {
  id: string;
  workspaceId: string;
  specificationId: string;
  description: string;
  status: TaskStatus;
  engineName: string;
  engineVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

/** What generation needs to know about the specification it works from. */
export interface GenerationSourceSpec {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  contentRaw: string;
  lifecycleState: SpecLifecycleState;
}

export interface TaskStore {
  createMany(rows: Omit<TaskRecord, 'createdAt' | 'updatedAt'>[]): Promise<TaskRecord[]>;
  listForSpecification(workspaceId: string, specificationId: string): Promise<TaskRecord[]>;
  /** Unscoped by design — the guard pattern (EPIC-004 F2). */
  findById(id: string): Promise<TaskRecord | null>;
  updateStatus(workspaceId: string, id: string, status: TaskStatus): Promise<TaskRecord>;
  listForSpecifications(workspaceId: string, specificationIds: string[]): Promise<TaskRecord[]>;
  /** Regeneration only (T103): the one sanctioned replacement path. */
  replaceForSpecification(
    workspaceId: string,
    specificationId: string,
    rows: Omit<TaskRecord, 'createdAt' | 'updatedAt'>[],
  ): Promise<TaskRecord[]>;
}

export class GenerateTasksService {
  constructor(
    private readonly store: TaskStore,
    private readonly links: LinkWriterService,
  ) {}

  async generate(
    engine: SpecificationEngine,
    spec: GenerationSourceSpec,
    ctx: EngineContext,
    _requestedById: string,
  ): Promise<TaskRecord[]> {
    // FR-020 / US4 scenario 2 — the lifecycle's own gate, not a local copy.
    assertTaskGenerationPermitted(spec.lifecycleState);

    const result = await engine.generateTasks(
      { projectName: spec.projectId, specificationTitle: spec.title, specificationContent: spec.contentRaw },
      ctx,
    );
    if (!result.ok) {
      // FR-026: the reason survives verbatim; FR-027: nothing was stored.
      throw new Error(`${result.failure.reason}: ${result.failure.message}`);
    }

    const rows = result.value.map((task) => ({
      id: randomUUID(),
      workspaceId: spec.workspaceId,
      specificationId: spec.id,
      description: task.description,
      status: 'not_started' as const,
      // FR-022: the engine that produced them, from the RESULT's descriptor.
      engineName: result.producedBy.name,
      engineVersion: result.producedBy.version,
    }));

    const created = await this.store.createMany(rows);
    // SC-003 in the same act: task → specification, idempotent on retry.
    await this.links.linkTasksToSpecification({
      workspaceId: spec.workspaceId,
      specificationId: spec.id,
      taskIds: created.map((task) => task.id),
    });
    return created;
  }
}

/** In-memory store for tests and database-less runs. */
export class InMemoryTaskStore implements TaskStore {
  private readonly rows = new Map<string, TaskRecord>();

  async createMany(rows: Omit<TaskRecord, 'createdAt' | 'updatedAt'>[]): Promise<TaskRecord[]> {
    const now = new Date();
    return rows.map((row) => {
      const stamped: TaskRecord = { ...row, createdAt: now, updatedAt: now };
      this.rows.set(stamped.id, stamped);
      return stamped;
    });
  }

  async listForSpecification(workspaceId: string, specificationId: string): Promise<TaskRecord[]> {
    return [...this.rows.values()].filter(
      (r) => r.workspaceId === workspaceId && r.specificationId === specificationId,
    );
  }

  async findById(id: string): Promise<TaskRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async updateStatus(workspaceId: string, id: string, status: TaskStatus): Promise<TaskRecord> {
    const row = this.rows.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError('Not found.');
    const updated: TaskRecord = { ...row, status, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async listForSpecifications(workspaceId: string, specificationIds: string[]): Promise<TaskRecord[]> {
    const wanted = new Set(specificationIds);
    return [...this.rows.values()].filter(
      (r) => r.workspaceId === workspaceId && wanted.has(r.specificationId),
    );
  }

  async replaceForSpecification(
    workspaceId: string,
    specificationId: string,
    rows: Omit<TaskRecord, 'createdAt' | 'updatedAt'>[],
  ): Promise<TaskRecord[]> {
    for (const existing of await this.listForSpecification(workspaceId, specificationId)) {
      this.rows.delete(existing.id);
    }
    return this.createMany(rows);
  }
}
