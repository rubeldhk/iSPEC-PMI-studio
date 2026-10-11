/**
 * `T1966`, `T1968` (EPIC-047) — who holds a task, and why.
 *
 * `FR-EXP-050`…`FR-EXP-056`, `R-047-12`. A task may be held by a person or by
 * an Engineering Expert. Assigning to an Expert requires its approved
 * contract's capabilities to cover the task, and — where the task's band
 * exceeds what the workspace lets an Expert take unattended — a human decision
 * through `EPIC-031` before the assignment stands. Every assignment records
 * the rule that permitted it; reassignment supersedes, never rewrites; and
 * **assignment runs nothing** — dispatch is a separate governed act.
 *
 * The task record (`EPIC-046`) carries neither the capabilities it needs nor a
 * risk band, so the assigner states both and both are written into the rule.
 * Assignments live beside the task, never in a second task record.
 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { effectiveVersion } from './approval.js';
import type { Authoring } from './authoring.js';
import { RISK_BANDS, type Assignment, type AssigneeKind, type RiskBand } from './expert.types.js';
import type { ExpertsStore } from './experts.store.js';
import type { ContractApprovals, TaskLookup } from './experts.tokens.js';

export interface AssignInput {
  readonly assigneeKind: AssigneeKind;
  readonly assigneeId: string;
  /** What the task needs, stated by the assigner (the task record carries none). */
  readonly capabilities?: readonly string[];
  readonly riskClass?: RiskBand;
}

export type AssignmentState = 'standing' | 'pending-decision' | 'refused';

export interface AssignmentView extends Omit<Assignment, 'state'> {
  /** Read from the decision where one applies — never cached (`R-047-5`). */
  readonly state: AssignmentState;
  readonly assigneeRetired: boolean;
  readonly needsReassignment: boolean;
}

export interface AssignmentDeps {
  readonly authoring: Authoring;
  /** Read at call time. */
  readonly approvals: ContractApprovals;
  readonly tasks: TaskLookup;
  readonly clock?: () => string;
  readonly ids?: () => string;
}

const rank = (band: RiskBand): number => RISK_BANDS.indexOf(band);

/** The current (unsuperseded) assignment of a task, with its state read now. */
export async function currentAssignment(
  store: ExpertsStore,
  approvals: ContractApprovals,
  workspaceId: string,
  taskId: string,
): Promise<AssignmentView | null> {
  const current = (await store.assignmentsFor(workspaceId, taskId)).find((a) => a.supersededAt === null);
  return current ? view(store, approvals, current) : null;
}

async function view(store: ExpertsStore, approvals: ContractApprovals, a: Assignment): Promise<AssignmentView> {
  let state: AssignmentState = a.state;
  if (a.state === 'pending-decision' && a.decisionId !== null) {
    const resolution = await approvals.resolutionOf(a.workspaceId, a.decisionId);
    // `T2573`, `FR-EXP-054` — only a human's approval makes it stand. One policy
    // let through unattended is not the human decision this gate requires.
    state =
      resolution === 'approved' ? 'standing' : resolution === 'pending' ? 'pending-decision' : 'refused';
  }
  const retired =
    a.assigneeKind === 'expert' && (await store.findExpert(a.workspaceId, a.assigneeId))?.status === 'retired';
  return {
    ...a,
    state,
    assigneeRetired: retired,
    needsReassignment: a.supersededAt === null && (retired || state === 'refused'),
  };
}

export class AssignmentService {
  readonly #clock: () => string;
  readonly #ids: () => string;

  constructor(
    private readonly store: ExpertsStore,
    private readonly deps: AssignmentDeps,
  ) {
    this.#clock = deps.clock ?? (() => new Date().toISOString());
    this.#ids = deps.ids ?? randomUUID;
  }

  async assign(workspaceId: string, actorId: string, taskId: string, input: AssignInput): Promise<AssignmentView> {
    await this.deps.authoring.requireTaskEditor(workspaceId, actorId, taskId);
    if (!(await this.deps.tasks.exists(workspaceId, taskId))) throw new NotFoundError('Not found.');
    const assigneeId = typeof input.assigneeId === 'string' ? input.assigneeId.trim() : '';
    if (assigneeId === '') throw new ValidationFailedError('an assignment names its assignee');

    let rule: string;
    let state: Assignment['state'] = 'standing';
    let decisionId: string | null = null;

    if (input.assigneeKind === 'person') {
      rule = `assigned to a person by ${actorId}`;
    } else if (input.assigneeKind === 'expert') {
      const expert = await this.store.findExpert(workspaceId, assigneeId);
      if (expert === null) throw new ValidationFailedError(`there is no Expert ${assigneeId} in this workspace`);
      if (expert.status === 'retired') {
        throw new ConflictError(`Expert '${expert.key}' is retired and takes no new assignments (FR-EXP-006)`);
      }
      const effective = await effectiveVersion(await this.store.versionsFor(workspaceId, expert.id), this.deps.approvals);
      if (effective === null) {
        throw new ValidationFailedError(`Expert '${expert.key}' has no approved contract version to take work under (FR-EXP-005)`);
      }
      const needed = [...(input.capabilities ?? [])];
      if (needed.length === 0) {
        throw new ValidationFailedError('assigning to an Expert states the capabilities the task needs (FR-EXP-051)');
      }
      const missing = needed.filter((c) => !(effective.contract.capabilities as readonly string[]).includes(c));
      if (missing.length > 0) {
        throw new ValidationFailedError(
          `Expert '${expert.key}' does not have the capability ${missing.join(', ')} this task needs (FR-EXP-051)`,
        );
      }
      const band = input.riskClass ?? 'medium';
      if (!RISK_BANDS.includes(band)) throw new ValidationFailedError(`riskClass must be one of ${RISK_BANDS.join(', ')}`);
      rule =
        `the capabilities [${needed.join(', ')}] are covered by '${expert.key}' contract v${effective.version}; ` +
        `task band ${band}`;

      // `FR-EXP-054` — above the workspace's unattended maximum (or with no
      // policy at all), a human decides before the assignment stands.
      const policy = await this.store.policyFor(workspaceId);
      if (policy === null || rank(band) > rank(policy.maxUnattendedBand)) {
        const submitted = await this.deps.approvals.submit({
          workspaceId,
          actionType: 'task.assign-expert',
          targetType: 'task',
          targetId: taskId,
          objectVersion: 1,
          riskClass: band,
          actorId,
        });
        decisionId = submitted.decisionId;
        state = 'pending-decision';
        rule += policy === null
          ? '; no delegation policy sets an unattended maximum, so a human decides (FR-EXP-054)'
          : `; above the workspace's unattended maximum of ${policy.maxUnattendedBand}, so a human decides (FR-EXP-054)`;
      } else {
        rule += `; within the workspace's unattended maximum of ${policy.maxUnattendedBand}`;
      }
    } else {
      throw new ValidationFailedError('assigneeKind must be person or expert');
    }

    const at = this.#clock();
    // `T2600` — the new assignment is recorded before anything is superseded,
    // and the superseded decisions are withdrawn last, so no failure leaves the
    // task holding nothing.
    const row = await this.store.addAssignment({
      id: this.#ids(),
      workspaceId,
      taskId,
      assigneeKind: input.assigneeKind,
      assigneeId,
      rule,
      state,
      decisionId,
      assignedBy: actorId,
      assignedAt: at,
      supersededAt: null,
      supersededBy: null,
    });
    // `T2605` — read again **after** recording, and supersede every other
    // current assignment recorded before this one (by instant, then id). A
    // concurrent reassignment's row is then superseded by whichever of the two
    // was recorded last, so exactly one stays current; a prior the other
    // request already superseded is done, not an error, and only the request
    // that superseded it withdraws its decision.
    const before = (a: Assignment): boolean =>
      a.assignedAt < row.assignedAt || (a.assignedAt === row.assignedAt && a.id < row.id);
    const superseded: Assignment[] = [];
    for (const other of await this.store.assignmentsFor(workspaceId, taskId)) {
      if (other.id === row.id || other.supersededAt !== null || !before(other)) continue;
      try {
        await this.store.supersedeAssignment(workspaceId, other.id, actorId, at);
        superseded.push(other);
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
      }
    }
    for (const prior of superseded) await this.#withdrawDecisionOf(workspaceId, actorId, prior);
    return view(this.store, this.deps.approvals, row);
  }

  /**
   * `T2577`, `T2600` — a superseded assignment's pending decision leaves the
   * inbox, so no reviewer is asked to approve an assignment that no longer
   * exists. Best effort: the reassignment has already happened, and a decision
   * resolved meanwhile (`EPIC-031` answers 409) is simply nothing to withdraw.
   * A decision left pending by an outage approves a superseded assignment,
   * which nothing reads as standing.
   */
  async #withdrawDecisionOf(workspaceId: string, actorId: string, prior: Assignment): Promise<void> {
    if (prior.state !== 'pending-decision' || prior.decisionId === null) return;
    try {
      if ((await this.deps.approvals.resolutionOf(workspaceId, prior.decisionId)) !== 'pending') return;
      await this.deps.approvals.withdraw({
        workspaceId,
        decisionId: prior.decisionId,
        actorId,
        reason: `the task was reassigned; assignment ${prior.id} is superseded (FR-EXP-055)`,
      });
    } catch {
      // See above: never undo a reassignment that has been recorded.
    }
  }

  /** `FR-EXP-055` — every assignment the task has had, current first. */
  async history(workspaceId: string, actorId: string, taskId: string): Promise<AssignmentView[]> {
    await this.deps.authoring.requireTaskReader(workspaceId, actorId, taskId);
    const rows = await this.store.assignmentsFor(workspaceId, taskId);
    return Promise.all(rows.map((a) => view(this.store, this.deps.approvals, a)));
  }
}
