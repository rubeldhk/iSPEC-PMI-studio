/**
 * T113 — lifecycle orchestration (FR-011, FR-013, FR-014, FR-015, FR-023).
 *
 * The seam between the pure machine and the stored specification.
 * `lifecycle.machine.ts` knows WHICH transitions exist and records who moved
 * one; this knows WHERE the current state lives and writes the new one. Keeping
 * them apart is what lets `T106` pin the transition table against the database
 * CHECK without a store in sight.
 *
 * All six transitions go through ONE path. `BaselineService.archive` performs
 * the same assert-record-set sequence for the archive case alone, and a second
 * route to the same outcome is a second place for the rule to drift —
 * `T648`'s lesson. `BaselineService` keeps what only it does: `editBaselined`,
 * the FR-011a fork that is deliberately *not* a transition.
 *
 * Approval is the one asymmetric case (US6 scenario 3): outstanding findings
 * are surfaced with the result, so a caller cannot approve without having been
 * shown them.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { assertSameWorkspace, type RefusalRecord } from '../../core/workspace.guard.js';
import type { ApprovalService, OutstandingFinding, OutstandingFindingsSource } from './approval.service.js';
import type { LifecycleMachine, TransitionRecord } from './lifecycle.machine.js';
import { diffVersions, type VersionDiff } from './version-diff.service.js';
import type {
  ActingContext,
  SpecLifecycleState,
  SpecificationRecord,
  SpecificationStore,
  SpecificationVersionRecord,
} from './specifications-read.service.js';

/** The contract's six transition endpoints, named as the contract names them. */
export const LIFECYCLE_ACTIONS = [
  'submit-for-review',
  'reject',
  'approve',
  'baseline',
  'mark-implemented',
  'archive',
] as const;

export type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

/** Each action names its DESTINATION; the machine decides whether it is reachable. */
const DESTINATION: Record<LifecycleAction, SpecLifecycleState> = {
  'submit-for-review': 'review',
  reject: 'draft',
  approve: 'approved',
  baseline: 'baselined',
  'mark-implemented': 'implemented',
  archive: 'archived',
};

export interface LifecycleOutcome {
  specification: SpecificationRecord;
  transition: TransitionRecord;
  /** Approval only, and then always present — possibly empty (US6 scenario 3). */
  outstandingFindings?: OutstandingFinding[];
}

export interface SpecificationLifecycleApi {
  move(ctx: ActingContext, id: string, action: LifecycleAction): Promise<LifecycleOutcome>;
  versions(workspaceId: string, id: string): Promise<SpecificationVersionRecord[]>;
  diff(workspaceId: string, id: string, a: number, b: number): Promise<VersionDiff>;
  findings(workspaceId: string, id: string): Promise<OutstandingFinding[]>;
}

export interface LifecycleServiceOptions {
  approvals?: ApprovalService;
  findings?: OutstandingFindingsSource;
  onRefused?: (record: RefusalRecord) => void;
}

const OPAQUE = 'Not found.';

export class SpecificationLifecycleService implements SpecificationLifecycleApi {
  private readonly approvals: ApprovalService | undefined;
  private readonly findingsSource: OutstandingFindingsSource | undefined;
  private readonly onRefused: ((record: RefusalRecord) => void) | undefined;

  constructor(
    private readonly store: SpecificationStore,
    private readonly machine: LifecycleMachine,
    options: LifecycleServiceOptions = {},
  ) {
    this.approvals = options.approvals;
    this.findingsSource = options.findings;
    this.onRefused = options.onRefused;
  }

  /**
   * Move a specification, or refuse naming the permitted set.
   *
   * The order is load → validate-and-record → write. A refused transition
   * therefore writes nothing at all: no state change, and no history row.
   * Refusals are audit events (FR-033), not lifecycle history — a transition
   * table that also held attempts would be a log of what people tried rather
   * than of what happened.
   */
  async move(ctx: ActingContext, id: string, action: LifecycleAction): Promise<LifecycleOutcome> {
    if (!LIFECYCLE_ACTIONS.includes(action)) {
      throw new ValidationFailedError('Unknown lifecycle action.', {
        fields: [{ field: 'action', reason: `one of ${LIFECYCLE_ACTIONS.join(', ')}` }],
      });
    }
    const specification = await this.load(ctx.workspaceId, id);
    const to = DESTINATION[action];

    if (action === 'approve' && this.approvals) {
      const outcome = await this.approvals.approve({
        workspaceId: ctx.workspaceId,
        specificationId: id,
        currentVersionId: specification.currentVersionId ?? '',
        currentState: specification.lifecycleState,
        actorId: ctx.userId,
      });
      return {
        specification: await this.write(ctx, id, to),
        transition: outcome.transition,
        outstandingFindings: outcome.outstandingFindings,
      };
    }

    const transition = await this.machine.transition({
      workspaceId: ctx.workspaceId,
      specificationId: id,
      from: specification.lifecycleState,
      to,
      actorId: ctx.userId,
    });
    return { specification: await this.write(ctx, id, to), transition };
  }

  /** FR-013 — the version history, newest first. */
  async versions(workspaceId: string, id: string): Promise<SpecificationVersionRecord[]> {
    await this.load(workspaceId, id);
    return this.store.listVersions(workspaceId, id);
  }

  /** FR-015 — any two versions of one specification are comparable. */
  async diff(workspaceId: string, id: string, a: number, b: number): Promise<VersionDiff> {
    await this.load(workspaceId, id);
    const versions = await this.store.listVersions(workspaceId, id);
    const from = versions.find((v) => v.versionNumber === a);
    const to = versions.find((v) => v.versionNumber === b);
    if (!from || !to) {
      // Naming which of the two is missing would be more helpful and would
      // also confirm which version numbers exist. They are the caller's own
      // numbers either way, so the refusal names the field, not the answer.
      throw new ValidationFailedError('Those versions cannot be compared.', {
        fields: [{ field: 'version', reason: 'not a version of this specification' }],
      });
    }
    return diffVersions(
      { versionNumber: from.versionNumber, contentRaw: from.contentRaw },
      { versionNumber: to.versionNumber, contentRaw: to.contentRaw },
    );
  }

  /** FR-023 — every finding carries the part of the specification it concerns. */
  async findings(workspaceId: string, id: string): Promise<OutstandingFinding[]> {
    const specification = await this.load(workspaceId, id);
    if (!this.findingsSource || !specification.currentVersionId) return [];
    // Findings belong to the VERSION that was validated: a later version has
    // not been checked, and carrying its predecessor's verdict forward would
    // report a clean specification as clean on evidence that no longer applies.
    return this.findingsSource.outstandingFor(workspaceId, specification.currentVersionId);
  }

  private async write(
    ctx: ActingContext,
    id: string,
    lifecycleState: SpecLifecycleState,
  ): Promise<SpecificationRecord> {
    return this.store.updateSpecification(ctx.workspaceId, id, {
      lifecycleState,
      updatedById: ctx.userId,
    });
  }

  private async load(workspaceId: string, id: string): Promise<SpecificationRecord> {
    const specification = await this.store.findById(id);
    assertSameWorkspace(workspaceId, specification, {
      targetType: 'specification',
      ...(this.onRefused ? { onRefused: this.onRefused } : {}),
    });
    /* c8 ignore next — the guard throws when the record is absent. */
    if (!specification) throw new NotFoundError(OPAQUE);
    return specification;
  }
}
