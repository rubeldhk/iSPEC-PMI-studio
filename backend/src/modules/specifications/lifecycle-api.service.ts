/**
 * T113 + T123 — the lifecycle, version, and validation API surface behind the
 * controller (FR-011, FR-013, FR-015, FR-023).
 *
 * Composes what the wave built: `assertTransition`/`permittedFrom` and the
 * recorder (T099/T111), the approval ordering (T122 — refuse the illegal
 * transition BEFORE fetching findings), and `diffVersions` (T112) — against
 * EPIC-008's `SpecificationStore`, whose `updateSpecification` deliberately
 * excludes `lifecycleState`: state moves ONLY through here, which is what
 * their PATCH comment promised.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */
import { NotFoundError } from '../../core/errors.js';
import { assertSameWorkspace } from '../../core/workspace.guard.js';
import { ApprovalService, type OutstandingFinding } from './approval.service.js';
import {
  assertTransition,
  LifecycleMachine,
  type SpecLifecycleState,
  type TransitionRecorder,
} from './lifecycle.machine.js';
import { diffVersions, type VersionDiff } from './version-diff.service.js';
import type { FindingSink, StoredFinding } from './validate-specification.service.js';
import type {
  SpecificationRecord,
  SpecificationStore,
  SpecificationVersionRecord,
} from './specifications-read.service.js';

export interface LifecycleActingContext {
  workspaceId: string;
  userId: string;
}

/** The read side of the finding store (T120's rows, FR-023). */
export interface FindingsReadPort {
  listFor(workspaceId: string, specificationId: string): Promise<StoredFinding[]>;
  outstandingFor(workspaceId: string, specificationVersionId: string): Promise<OutstandingFinding[]>;
}

/** Job submission for validate — wired over `JobsService` at the module. */
export interface ValidationSubmissionPort {
  submitFor(
    ctx: LifecycleActingContext,
    specification: SpecificationRecord,
  ): Promise<ValidationJobBody>;
}

export interface ValidationJobBody {
  id: string;
  kind: string;
  state: string;
  failureReason: string | null;
  startedAt: Date | null;
  resultRef: string | null;
}

/** The default until the module wires the jobs service. Refuses; never fakes a job. */
export class UnconfiguredValidationSubmission implements ValidationSubmissionPort {
  async submitFor(): Promise<ValidationJobBody> {
    throw new Error(
      'Validation job submission is not configured. Provide VALIDATION_SUBMISSION at the module; ' +
        'refusing to pretend a validation was queued.',
    );
  }
}

export interface ApproveOutcome {
  specification: SpecificationRecord;
  /** Shown before proceeding (US6 scenario 3) — always present. */
  outstandingFindings: OutstandingFinding[];
}

export interface SpecificationLifecycleApi {
  transition(
    ctx: LifecycleActingContext,
    id: string,
    to: SpecLifecycleState,
  ): Promise<SpecificationRecord>;
  approve(ctx: LifecycleActingContext, id: string): Promise<ApproveOutcome>;
  archive(ctx: LifecycleActingContext, id: string): Promise<SpecificationRecord>;
  versions(workspaceId: string, id: string): Promise<SpecificationVersionRecord[]>;
  diff(workspaceId: string, id: string, a: number, b: number): Promise<VersionDiff>;
  findings(workspaceId: string, id: string): Promise<StoredFinding[]>;
  submitValidation(ctx: LifecycleActingContext, id: string): Promise<ValidationJobBody>;
}

const OPAQUE = 'Not found.';

export class SpecificationLifecycleService implements SpecificationLifecycleApi {
  private readonly machine: LifecycleMachine;
  private readonly approval: ApprovalService;

  constructor(
    private readonly store: SpecificationStore,
    private readonly recorder: TransitionRecorder,
    private readonly findingStore: FindingsReadPort,
    private readonly validation: ValidationSubmissionPort = new UnconfiguredValidationSubmission(),
  ) {
    this.machine = new LifecycleMachine(recorder);
    // T122's ordering guarantee, reused rather than re-implemented: the
    // illegal transition is refused before any findings are fetched.
    this.approval = new ApprovalService(
      { outstandingFor: (ws, versionId) => findingStore.outstandingFor(ws, versionId) },
      recorder,
    );
  }

  /** Guarded fetch: absence and cross-workspace are one identical outcome. */
  private async load(workspaceId: string, id: string): Promise<SpecificationRecord> {
    const specification = await this.store.findById(id);
    assertSameWorkspace(workspaceId, specification, { targetType: 'specification' });
    return specification as SpecificationRecord;
  }

  async transition(
    ctx: LifecycleActingContext,
    id: string,
    to: SpecLifecycleState,
  ): Promise<SpecificationRecord> {
    const specification = await this.load(ctx.workspaceId, id);
    // Validates against the permitted set, then records actor + time (T111).
    await this.machine.transition({
      workspaceId: ctx.workspaceId,
      specificationId: id,
      from: specification.lifecycleState as SpecLifecycleState,
      to,
      actorId: ctx.userId,
    });
    return this.store.setLifecycleState(ctx.workspaceId, id, to, ctx.userId);
  }

  async approve(ctx: LifecycleActingContext, id: string): Promise<ApproveOutcome> {
    const specification = await this.load(ctx.workspaceId, id);
    const outcome = await this.approval.approve({
      workspaceId: ctx.workspaceId,
      specificationId: id,
      currentVersionId: specification.currentVersionId ?? '',
      currentState: specification.lifecycleState as SpecLifecycleState,
      actorId: ctx.userId,
    });
    const updated = await this.store.setLifecycleState(ctx.workspaceId, id, 'approved', ctx.userId);
    return { specification: updated, outstandingFindings: outcome.outstandingFindings };
  }

  /** FR-011b: from approved, baselined, or implemented — the guard names the set. */
  async archive(ctx: LifecycleActingContext, id: string): Promise<SpecificationRecord> {
    return this.transition(ctx, id, 'archived');
  }

  async versions(workspaceId: string, id: string): Promise<SpecificationVersionRecord[]> {
    await this.load(workspaceId, id);
    return this.store.listVersions(workspaceId, id);
  }

  /** FR-015: any two versions of the same specification are comparable. */
  async diff(workspaceId: string, id: string, a: number, b: number): Promise<VersionDiff> {
    const all = await this.versions(workspaceId, id);
    const from = all.find((v) => v.versionNumber === a);
    const to = all.find((v) => v.versionNumber === b);
    if (!from || !to) throw new NotFoundError(OPAQUE);
    return diffVersions(
      { versionNumber: from.versionNumber, contentRaw: from.contentRaw },
      { versionNumber: to.versionNumber, contentRaw: to.contentRaw },
    );
  }

  async findings(workspaceId: string, id: string): Promise<StoredFinding[]> {
    await this.load(workspaceId, id);
    return this.findingStore.listFor(workspaceId, id);
  }

  /** Always asynchronous (R-001): returns the job, never a result. */
  async submitValidation(ctx: LifecycleActingContext, id: string): Promise<ValidationJobBody> {
    const specification = await this.load(ctx.workspaceId, id);
    return this.validation.submitFor(ctx, specification);
  }

  /** Ensure the transition helper stays reachable for tests of the guard alone. */
  static assertTransition = assertTransition;
}

/**
 * The finding store: T121's sink and T123's read side in one in-memory
 * implementation, matching the platform's store posture. Append-only.
 */
export class InMemoryFindingStore implements FindingSink, FindingsReadPort {
  private readonly rows: StoredFinding[] = [];

  async appendAll(findings: StoredFinding[]): Promise<void> {
    this.rows.push(...findings.map((f) => Object.freeze({ ...f }) as StoredFinding));
  }

  async listFor(workspaceId: string, specificationId: string): Promise<StoredFinding[]> {
    return this.rows.filter(
      (f) => f.workspaceId === workspaceId && f.specificationId === specificationId,
    );
  }

  async outstandingFor(
    workspaceId: string,
    specificationVersionId: string,
  ): Promise<OutstandingFinding[]> {
    return this.rows
      .filter(
        (f) => f.workspaceId === workspaceId && f.specificationVersionId === specificationVersionId,
      )
      .map((f) => ({ location: f.location, severity: f.severity, message: f.message }));
  }
}
