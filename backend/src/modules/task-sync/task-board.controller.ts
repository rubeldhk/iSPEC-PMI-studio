/**
 * `T1715` (EPIC-046, `contracts/tasks-api.md` §3) — the board's session read.
 *
 * Session cookie, project membership, and the opaque `404` for anything else —
 * the same shape every product read in this platform has. **A connector
 * credential receives `404` here** (`FR-KAN-071`): this route is not behind
 * `ConnectorAuthGuard`, so a bearer token carries no session and the workspace
 * guard refuses it. `tasks.sync` is a write with no read beside it,
 * deliberately, exactly as `artifacts.sync` is.
 *
 * There is **no session write** in this file and no route that edits a file
 * (`FR-KAN-010`). The project directory is authoritative; PMI Studio mirrors it
 * and records what nobody else does — the proposals and their verdicts.
 */
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { EpicService } from '../epics/epic.service.js';
import { TaskBoardService, type BoardView, type Disagreements, type UnboundTaskSyncs } from './task-board.service.js';
import { TaskProgressService, type Progress } from './task-progress.service.js';
import { TaskProposalService, type ProposalOutcome } from './task-proposal.service.js';
import type { TaskStatusValue } from './task-sync.store.js';
import { TASK_STATUSES } from './task-sync.store.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

/** A status from the closed set, or a refusal a client can read. */
function requireStatus(value: unknown, field: string): TaskStatusValue {
  if (typeof value !== 'string' || !(TASK_STATUSES as readonly string[]).includes(value)) {
    throw new ValidationFailedError(`${field} must be one of ${TASK_STATUSES.join(', ')}.`, {
      code: 'invalid_status',
      fields: [{ field, message: `one of ${TASK_STATUSES.join(', ')}` }],
    });
  }
  return value as TaskStatusValue;
}

@Controller()
export class TaskBoardController {
  constructor(
    @Inject(TaskBoardService) private readonly board: TaskBoardService,
    @Inject(TaskProgressService) private readonly progress: TaskProgressService,
    @Inject(TaskProposalService) private readonly proposals: TaskProposalService,
    @Inject(EpicService) private readonly epics: EpicService,
  ) {}

  @Get('epics/:eid/tasks')
  async tasks(@Req() raw: WorkspaceContext | undefined, @Param('eid') eid: string): Promise<BoardView> {
    const auth = requireAuth(raw);
    // `locate` is the Epic's own workspace scope — an Epic of another workspace
    // is absent here exactly as it is on the Epic detail (DEF-044-003).
    const epic = await this.epics.locate(auth.workspaceId, eid);
    await this.epics.deps.gate.requireMember(auth.workspaceId, epic.projectId);
    // `T1789` — resolved once, on the read, so the screen can render read-only
    // instead of offering a control it knows will be refused (`BR-0003`).
    const canMove = await this.epics.deps.gate.mayMove(
      { workspaceId: auth.workspaceId, userId: auth.userId },
      epic.projectId,
    );
    return this.board.board(auth.workspaceId, eid, canMove);
  }

  /**
   * One Epic's progress (`FR-KAN-055`). The same derivation the project route
   * uses — `FR-KAN-056` is held by there being one function, not by two that
   * happen to agree.
   */
  @Get('epics/:eid/tasks/progress')
  async epicProgress(@Req() raw: WorkspaceContext | undefined, @Param('eid') eid: string): Promise<Progress> {
    const auth = requireAuth(raw);
    const epic = await this.epics.locate(auth.workspaceId, eid);
    await this.epics.deps.gate.requireMember(auth.workspaceId, epic.projectId);
    return this.progress.forEpic(auth.workspaceId, eid);
  }

  /**
   * The project's task syncs that found no Epic (`FR-KAN-032`, `T1793`).
   *
   * Beside `EPIC-045`'s `projects/:id/artifacts/unbound`, and for the same
   * reason: the Spec Journey Board groups what nobody could attach, and until
   * now the task half of that group did not exist.
   */
  @Get('projects/:projectId/tasks/unbound')
  async unboundTasks(
    @Req() raw: WorkspaceContext | undefined,
    @Param('projectId') projectId: string,
  ): Promise<UnboundTaskSyncs> {
    const auth = requireAuth(raw);
    await this.epics.deps.gate.requireMember(auth.workspaceId, projectId);
    return this.board.unbound(auth.workspaceId, projectId);
  }

  /** The project's progress over the same rows (`FR-KAN-057`). */
  @Get('projects/:projectId/tasks/progress')
  async projectProgress(@Req() raw: WorkspaceContext | undefined, @Param('projectId') projectId: string): Promise<Progress> {
    const auth = requireAuth(raw);
    await this.epics.deps.gate.requireMember(auth.workspaceId, projectId);
    return this.progress.forProject(auth.workspaceId, projectId);
  }

  /**
   * A manual move (`FR-KAN-011` to `FR-KAN-016`).
   *
   * One round trip: the proposal is recorded, the event appended and the
   * verdict returned. That is not a shortcut — `Q4` ruled that a permitted
   * member's own move applies at once — and the proposal and its verdict are
   * recorded whether it waits or not.
   *
   * A **session** route. A connector may sync and may propose through the
   * execution registry, but never through this one (`FR-KAN-071`).
   */
  @Post('tasks/:taskId/status-proposals')
  @HttpCode(201)
  async propose(
    @Req() raw: WorkspaceContext | undefined,
    @Param('taskId') taskId: string,
    @Body() body: { expectedCurrentStatus?: unknown; requestedStatus?: unknown; reason?: unknown } | undefined,
  ): Promise<ProposalOutcome> {
    const auth = requireAuth(raw);
    // `T1789` — RESOLVED, not assumed. This was `canMove: true` as a literal,
    // so the permission `TaskProposalService` checks was never actually asked:
    // any project member could move any card whatever their grant (`BR-0003`).
    const task = await this.proposals.locateTask(auth.workspaceId, taskId);
    const canMove =
      task === null
        ? false
        : await this.epics.deps.gate.mayMove({ workspaceId: auth.workspaceId, userId: auth.userId }, task.projectId);
    return this.proposals.propose(
      { workspaceId: auth.workspaceId, actorId: auth.userId, actorType: 'user', canMove },
      {
        taskId,
        expectedCurrentStatus: requireStatus(body?.expectedCurrentStatus, 'expectedCurrentStatus'),
        requestedStatus: requireStatus(body?.requestedStatus, 'requestedStatus'),
        // Not defaulted to '': FR-KAN-011 refuses a missing reason, and a
        // default would turn that refusal into a silent empty string.
        reason: typeof body?.reason === 'string' ? body.reason : '',
      },
    );
  }

  /**
   * A second person answers a waiting proposal (`US4` sc. 3, `T1792`).
   *
   * Its own route rather than a field on the proposal POST, because it is a
   * different act by a different person: the first records what someone wants,
   * this records what someone else decided. `approval_required` was terminal
   * until this existed — a project requiring an approver froze its cards.
   */
  @Post('status-proposals/:proposalId/adjudication')
  @HttpCode(201)
  async adjudicate(
    @Req() raw: WorkspaceContext | undefined,
    @Param('proposalId') proposalId: string,
    @Body() body: { approve?: unknown; reason?: unknown } | undefined,
  ): Promise<ProposalOutcome> {
    const auth = requireAuth(raw);
    const located = await this.proposals.locateProposal(auth.workspaceId, proposalId);
    const canMove =
      located === null
        ? false
        : await this.epics.deps.gate.mayMove({ workspaceId: auth.workspaceId, userId: auth.userId }, located.projectId);
    return this.proposals.adjudicatePending(
      { workspaceId: auth.workspaceId, actorId: auth.userId, actorType: 'user', canMove },
      proposalId,
      {
        // Absent is NOT approval. A malformed body must never be read as a yes.
        approve: body?.approve === true,
        ...(typeof body?.reason === 'string' ? { reason: body.reason } : {}),
      },
    );
  }

  /**
   * The Epic's open disagreements (`FR-KAN-024`).
   *
   * Its own route rather than a field on the board, because a reviewer asking
   * *what does this board not know* should not have to fetch every card to
   * find out — and because the board read stays cheap (`SC-KAN-007`).
   */
  @Get('epics/:eid/tasks/disagreements')
  async disagreements(@Req() raw: WorkspaceContext | undefined, @Param('eid') eid: string): Promise<Disagreements> {
    const auth = requireAuth(raw);
    const epic = await this.epics.locate(auth.workspaceId, eid);
    await this.epics.deps.gate.requireMember(auth.workspaceId, epic.projectId);
    return this.board.disagreements(auth.workspaceId, eid);
  }

  /** The task's proposals with their verdicts, newest first. */
  @Get('tasks/:taskId/status-proposals')
  async proposalHistory(@Req() raw: WorkspaceContext | undefined, @Param('taskId') taskId: string): Promise<unknown[]> {
    const auth = requireAuth(raw);
    return this.proposals.forTask(auth.workspaceId, taskId);
  }
}
