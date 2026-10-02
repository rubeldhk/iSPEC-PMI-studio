/**
 * `T1740` (EPIC-046, `FR-KAN-011` to `FR-KAN-018`, `R-046-5`, `R-046-6`) — a
 * manual move is a **proposal**, never a file edit.
 *
 * ## How `FR-KAN-013` is satisfied, stated plainly
 *
 * The requirement says a proposal must be adjudicated *through the existing
 * adjudication contract*. `EPIC-030`'s `AdjudicationProposal` is hard-typed to a
 * `specificationId` and a `SpecificationStatus`; a task move is neither, and
 * assembling an adjudicator over that Epic's deliberately unexported ports is
 * the bypass `FR-GEL-073` forbids. So *contract* is read as its **rules and
 * verdict vocabulary** — imported here — and not as its TypeScript interface.
 * The requester ruled on that reading on 2026-09-06 (`F1`); widening
 * `AdjudicationProposal` to a generic target stays `EPIC-030`'s follow-up.
 *
 * The rules that are reproduced, not reinvented:
 *
 *   - the **verdict names** are `EPIC-030`'s, so a reader of one Epic's
 *     adjudication can read the other's;
 *   - the proposal row is the immutable **request** with no verdict column, and
 *     the verdict is an event plus a projection (`R-037-5`);
 *   - `expectedCurrentStatus` gives optimistic concurrency, so a stale move is
 *     `inconsistent` rather than a silent overwrite (`FR-KAN-016`);
 *   - the proposer's identity is frozen at proposal time;
 *   - an **agent never approves its own** proposal (Constitution XII.6).
 *
 * ## Immediate is not unaudited
 *
 * `Q4`. A permitted member's own move applies at once, because XII.6 forbids
 * *AI* self-approval and does not require a second human for every card — a
 * board where "I have started this" needs a colleague is a board nobody uses.
 * The proposal, its required reason and its verdict are recorded either way.
 * Only the waiting differs, and a project policy can still ask for it.
 *
 * ## What this file must never do
 *
 * Write a file. `FR-KAN-010`: the project directory is authoritative, and a move
 * here is a proposal about the record. `T1743` proves the Epic's directory is
 * byte-identical after a full board session including a move.
 */
import { randomUUID } from 'node:crypto';
import { refusalEventFor } from '@pmi/loop-contract';
import type { AdjudicationVerdictName } from '@pmi/loop-contract';
import { foldProposalState, type ProposalVerdictEvent } from './proposal-state.js';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { SyncedTaskRecord, TaskStatusValue, TaskSyncStore } from './task-sync.store.js';

/** Who is moving the card. `user` is a person; `agent` may propose, never approve. */
export type ActorType = 'user' | 'agent' | 'service';

export interface ProposalContext {
  readonly workspaceId: string;
  readonly actorId: string;
  readonly actorType: ActorType;
  /** The project's move permission, resolved by the caller (`BR-0003`). */
  readonly canMove: boolean;
}

export interface MoveRequest {
  readonly taskId: string;
  readonly expectedCurrentStatus: TaskStatusValue;
  readonly requestedStatus: TaskStatusValue;
  readonly reason: string;
}

/**
 * `T1782` — the verdict, as an event, in `EPIC-037`'s own vocabulary.
 *
 * `data-model.md` §5 forbids a verdict column: a mutable verdict field becomes
 * the audit authority the first time somebody reads it instead of the event
 * stream. §8 then requires the proposal state to be **folded** from the
 * proposal's events — which needs the verdict to be one.
 *
 * `FR-KAN-012` is untouched by this: `status-transition-proposed` still records
 * the request and never a verdict. This is the second event, and the mapping is
 * `EPIC-037`'s `eventForVerdict`, restated here rather than imported so this
 * module keeps depending on nothing in the executions module.
 */
export const VERDICT_EVENTS: Readonly<Record<AdjudicationVerdictName, string>> = Object.freeze({
  validated: 'validation-passed',
  applied: 'transition-applied',
  approval_required: 'approval-requested',
  inconsistent: 'transition-inconsistent',
  reconciliation_required: 'transition-reconciliation-requested',
  // Every refusal this Epic can produce is decided at VALIDATION time — a
  // principal without the move permission, an agent approving its own proposal,
  // a task with no file behind it — all before any transition is attempted. The
  // string is `refusalEventFor`'s, not one written here.
  refused: refusalEventFor('validation'),
});

export interface ProposalEventPort {
  append(input: {
    workspaceId: string;
    executionId: string;
    type: string;
    payload: Record<string, unknown>;
    occurredAt: string;
    /** Who emitted it — the registry records the principal, not just the fact. */
    emittedBy: string;
    idempotencyKey: string;
  }): Promise<{ eventId: string }>;
}

export interface ProposalAuditPort {
  record(row: {
    workspaceId: string;
    actorId: string | null;
    action: 'create' | 'update';
    targetType: string;
    targetId: string;
    outcome: 'success';
    detail: Record<string, unknown>;
  }): Promise<void>;
}

/** Whether the project asks for a second person (`projects.taskMoveRequiresApproval`). */
export interface MovePolicyPort {
  requiresApproval(workspaceId: string, taskId: string): Promise<boolean>;
}

/**
 * One proposal's recorded verdicts (`T1792`).
 *
 * The proposal row carries no verdict — `data-model.md` §5 forbids the column —
 * so *is this one still waiting* is a question about its events. Optional,
 * because `propose` does not need it; `adjudicatePending` does, and says so by
 * refusing to guess when it is absent.
 */
export interface ProposalVerdictSource {
  forProposal(workspaceId: string, proposalId: string): Promise<readonly ProposalVerdictEvent[]>;
}

export interface TaskProposalDeps {
  readonly store: TaskSyncStore;
  readonly events: ProposalEventPort;
  readonly audit: ProposalAuditPort;
  readonly policy: MovePolicyPort;
  readonly verdicts?: ProposalVerdictSource | undefined;
}

/** What a second person decided (`US4` sc. 3). */
export interface ApprovalDecision {
  readonly approve: boolean;
  /** Why, when declining. Recorded and given back to the proposer. */
  readonly reason?: string | undefined;
}

export interface ProposalOutcome {
  readonly proposalId: string;
  readonly verdict: AdjudicationVerdictName;
  /** Supplementary evidence for a person. **Never parsed** to select behaviour. */
  readonly reason: string;
  readonly decidedAt: string;
}

/**
 * The key a resubmitted identical move collapses onto (`F2`).
 *
 * It includes `expectedCurrentStatus`, so a genuine second move — made after the
 * first applied, and therefore expecting a different status — gets its own row
 * rather than being swallowed as a duplicate.
 */
function deriveProposalKey(actorId: string, move: MoveRequest): string {
  return `task-proposal:${move.taskId}:${actorId}:${move.expectedCurrentStatus}:${move.requestedStatus}`;
}

export class TaskProposalService {
  constructor(private readonly deps: TaskProposalDeps) {}

  async propose(ctx: ProposalContext, move: MoveRequest): Promise<ProposalOutcome> {
    // FR-KAN-011: refused BEFORE a proposal exists. A move with no reason is not
    // a weak proposal, it is not a proposal.
    if (move.reason.trim().length === 0) {
      throw new ValidationFailedError('A reason is required to move a task.', {
        code: 'reason_required',
        fields: [{ field: 'reason', message: 'a non-empty reason' }],
      });
    }

    const task = await this.deps.store.findTask(move.taskId);
    if (task === null || task.workspaceId !== ctx.workspaceId) {
      throw new ValidationFailedError('Task not found.', { code: 'task_not_found', fields: [{ field: 'taskId', message: 'a task of this workspace' }] });
    }

    const key = deriveProposalKey(ctx.actorId, move);
    const { row, replayed } = await this.deps.store.recordProposal({
      workspaceId: ctx.workspaceId,
      taskId: move.taskId,
      expectedCurrentStatus: move.expectedCurrentStatus,
      requestedStatus: move.requestedStatus,
      reason: move.reason.trim(),
      proposerId: ctx.actorId,
      proposerType: ctx.actorType,
      executionId: task.lastParsedExecutionId,
      eventId: null,
      idempotencyKey: key,
    });

    if (replayed) {
      // The same click twice. The original verdict stands; re-adjudicating would
      // make the second answer authoritative for a decision already recorded.
      return this.adjudicate(ctx, task, move, row.id, { record: false });
    }

    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: 'create',
      targetType: 'task_status_proposal',
      targetId: row.id,
      outcome: 'success',
      detail: {
        taskId: move.taskId,
        from: move.expectedCurrentStatus,
        to: move.requestedStatus,
        // Always true by the refusal above — recorded as a fact read off the
        // request rather than a constant, so the row says what it means.
        reasonPresent: move.reason.trim().length > 0,
        proposerType: ctx.actorType,
      },
    });

    // FR-KAN-012: the event records the REQUEST and never a verdict.
    if (task.lastParsedExecutionId !== null) {
      await this.deps.events.append({
        workspaceId: ctx.workspaceId,
        executionId: task.lastParsedExecutionId,
        type: 'status-transition-proposed',
        payload: { taskId: move.taskId, taskKey: task.taskKey, from: move.expectedCurrentStatus, to: move.requestedStatus, proposalId: row.id },
        occurredAt: new Date().toISOString(),
        emittedBy: ctx.actorId,
        idempotencyKey: key,
      });
    }

    return this.adjudicate(ctx, task, move, row.id, { record: true });
  }

  /**
   * The verdict. Ordered so the most specific refusal wins: a move nobody may
   * make should not be reported as a stale one.
   */
  private async adjudicate(
    ctx: ProposalContext,
    task: SyncedTaskRecord,
    move: MoveRequest,
    proposalId: string,
    opts: { record: boolean },
  ): Promise<ProposalOutcome> {
    const decidedAt = new Date().toISOString();
    const settle = async (verdict: AdjudicationVerdictName, reason: string): Promise<ProposalOutcome> => {
      if (opts.record) {
        await this.deps.audit.record({
          workspaceId: ctx.workspaceId,
          actorId: ctx.actorId,
          action: 'update',
          targetType: 'task_status_proposal',
          targetId: proposalId,
          outcome: 'success',
          detail: { verdict, immediate: verdict === 'applied', taskId: move.taskId },
        });
        // The verdict as an event, so a projection can find it (`T1782`).
        // Before this, the verdict existed only in one HTTP response: the board
        // could not show a proposal awaiting approval however hard it tried,
        // and a person who closed the dialog never saw it again.
        if (task.lastParsedExecutionId !== null) {
          await this.deps.events.append({
            workspaceId: ctx.workspaceId,
            executionId: task.lastParsedExecutionId,
            type: VERDICT_EVENTS[verdict],
            payload: { proposalId, taskId: move.taskId, taskKey: task.taskKey, verdict },
            occurredAt: decidedAt,
            emittedBy: ctx.actorId,
            // Keyed by the proposal AND the verdict: a replayed adjudication of
            // the same proposal writes the same event once, and a genuinely
            // different verdict later is a different fact with its own row.
            idempotencyKey: `task-verdict:${proposalId}:${verdict}`,
          });
        }
      }
      return { proposalId, verdict, reason, decidedAt };
    };

    // FR-KAN-017: a task with no file behind it keeps EPIC-012's direct update.
    // Gating it would stop a working path to protect nothing.
    if (task.taskKey === null || task.sourceDigest === null) {
      return settle('refused', 'This task was not parsed from a tasks.md, so it is not proposal-gated; use the task list instead.');
    }
    if (!ctx.canMove) {
      return settle('refused', 'This principal may not move tasks in this project.');
    }
    // Constitution XII.6. An agent may PROPOSE — the row above is written — but
    // its own proposal is never the thing that applies.
    if (ctx.actorType === 'agent') {
      return settle('refused', 'An agent may propose a status transition but may never approve its own; a person must adjudicate it.');
    }
    // FR-KAN-016. Optimistic concurrency: without the expected status, a stale
    // proposal is indistinguishable from a fresh one.
    if (task.status !== move.expectedCurrentStatus) {
      return settle('inconsistent', `The task had moved to ${task.status} before this proposal was adjudicated.`);
    }
    if (await this.deps.policy.requiresApproval(ctx.workspaceId, move.taskId)) {
      return settle('approval_required', 'This project requires a second person to approve a task move.');
    }

    await this.deps.store.applyStatus(ctx.workspaceId, move.taskId, {
      status: move.requestedStatus,
      statusSource: 'proposal',
      at: new Date(decidedAt),
      by: ctx.actorId,
    });
    // The move itself (data-model.md §11), distinct from the verdict below. Two
    // rows because they are two facts: what was decided, and what changed. A
    // verdict that applied nothing writes only the first.
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: 'update',
      targetType: 'task',
      targetId: move.taskId,
      outcome: 'success',
      detail: {
        taskKey: task.taskKey,
        from: move.expectedCurrentStatus,
        to: move.requestedStatus,
        source: 'proposal',
        causeId: proposalId,
      },
    });
    return settle('applied', 'Applied for a member holding the move permission; the proposal and this verdict are the record.');
  }

  /**
   * A second person answers a proposal that is waiting (`US4` sc. 3, `T1792`).
   *
   * Before this, `approval_required` was terminal: a project that required an
   * approver did not gate a move, it froze the card. Everything around the
   * waiting state existed and the thing that ends it did not.
   *
   * A second verdict is a full adjudication, not a rubber stamp. The order is
   * the same as `adjudicate`'s and for the same reason — the most specific
   * refusal wins, so a move nobody may make is never reported as a stale one.
   */
  async adjudicatePending(
    ctx: ProposalContext,
    proposalId: string,
    decision: ApprovalDecision,
  ): Promise<ProposalOutcome> {
    const proposal = await this.deps.store.findProposal(proposalId);
    if (proposal === null || proposal.workspaceId !== ctx.workspaceId) {
      // Absence, not "forbidden": nothing about another workspace is disclosed.
      throw new NotFoundError('status proposal', proposalId);
    }

    const decidedAt = new Date().toISOString();
    const settle = async (verdict: AdjudicationVerdictName, reason: string): Promise<ProposalOutcome> => {
      await this.deps.audit.record({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        action: 'update',
        targetType: 'task_status_proposal',
        targetId: proposalId,
        outcome: 'success',
        // `approver` is what distinguishes this row from the first verdict's:
        // the proposal alone cannot say who answered it.
        detail: { verdict, immediate: false, approver: ctx.actorId, taskId: proposal.taskId },
      });
      if (proposal.executionId !== null) {
        await this.deps.events.append({
          workspaceId: ctx.workspaceId,
          executionId: proposal.executionId,
          type: VERDICT_EVENTS[verdict],
          payload: { proposalId, taskId: proposal.taskId, verdict, approver: ctx.actorId },
          occurredAt: decidedAt,
          emittedBy: ctx.actorId,
          idempotencyKey: `task-approval:${proposalId}:${verdict}`,
        });
      }
      return { proposalId, verdict, reason, decidedAt };
    };

    // Still waiting? Folded from its events, never read off a column.
    const events = (await this.deps.verdicts?.forProposal(ctx.workspaceId, proposalId)) ?? [];
    const outstanding = foldProposalState([proposal], events).get(proposal.taskId);
    if (outstanding?.proposalId !== proposalId || outstanding.verdict !== 'approval_required') {
      // Includes the no-verdict case: a proposal nobody adjudicated is not
      // waiting on a second person, it is waiting on a first.
      return settle('inconsistent', 'This proposal is not awaiting approval; its verdict is already recorded.');
    }

    // The whole content of *requires an approver* is that the proposer is not
    // it. Allowing it would make the policy a no-op that looks like a control.
    if (ctx.actorId === proposal.proposerId) {
      return settle('refused', 'A second person must approve this move; you cannot approve your own proposal.');
    }
    // Constitution XII.6, on the approving side.
    if (ctx.actorType === 'agent') {
      return settle('refused', 'An agent may never approve a status transition; a person must adjudicate it.');
    }
    // Approving a move is making one.
    if (!ctx.canMove) {
      return settle('refused', 'This principal may not move tasks in this project.');
    }

    const task = await this.deps.store.findTask(proposal.taskId);
    if (task === null || task.workspaceId !== ctx.workspaceId) {
      throw new NotFoundError('task', proposal.taskId);
    }
    // `FR-KAN-016`: the approver must not apply a decision about a card that
    // has since moved.
    if (task.status !== proposal.expectedCurrentStatus) {
      return settle('inconsistent', `The task had moved to ${task.status} before this proposal was approved.`);
    }

    if (!decision.approve) {
      const why = decision.reason?.trim();
      return settle('refused', why ? `Declined by a second person: ${why}` : 'Declined by a second person.');
    }

    await this.deps.store.applyStatus(ctx.workspaceId, proposal.taskId, {
      status: proposal.requestedStatus,
      statusSource: 'proposal',
      at: new Date(decidedAt),
      // The PROPOSER, not the approver: the move is the proposal's, and the
      // approver's part is recorded on the verdict beside it.
      by: proposal.proposerId,
    });
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: 'update',
      targetType: 'task',
      targetId: proposal.taskId,
      outcome: 'success',
      detail: {
        taskKey: task.taskKey,
        from: proposal.expectedCurrentStatus,
        to: proposal.requestedStatus,
        source: 'proposal',
        causeId: proposalId,
        approver: ctx.actorId,
      },
    });
    return settle('applied', 'Applied by a second person holding the move permission.');
  }

  /**
   * A proposal's Epic and project, for the caller resolving a permission before
   * adjudicating it (`T1792`). A read, not a decision.
   */
  async locateProposal(workspaceId: string, proposalId: string): Promise<{ epicId: string; projectId: string } | null> {
    const proposal = await this.deps.store.findProposal(proposalId);
    if (proposal === null || proposal.workspaceId !== workspaceId) return null;
    return this.locateTask(workspaceId, proposal.taskId);
  }

  /**
   * The task's Epic and project, for the caller that must resolve a permission
   * before proposing (`T1789`). A read, not a decision: the service does not
   * know what the caller will do with the answer.
   */
  async locateTask(workspaceId: string, taskId: string): Promise<{ epicId: string; projectId: string } | null> {
    const task = await this.deps.store.findTask(taskId);
    if (task === null || task.workspaceId !== workspaceId || task.epicId === null) return null;
    const projectId = await this.deps.store.projectForEpic(workspaceId, task.epicId);
    return projectId === null ? null : { epicId: task.epicId, projectId };
  }

  /** The task's proposals, newest first, for the card and the audit trail. */
  async forTask(workspaceId: string, taskId: string): Promise<unknown[]> {
    return this.deps.store.proposalsForTask(workspaceId, taskId);
  }
}

/** Exposed so a caller can key a retry the same way the service does. */
export { deriveProposalKey };

/** Unused, but kept honest: a proposal id is a uuid, allocated by the store. */
export function newProposalId(): string {
  return randomUUID();
}
