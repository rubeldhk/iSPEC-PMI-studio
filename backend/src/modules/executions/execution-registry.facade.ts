/**
 * T1038 (EPIC-037 Band A) — the semantic surface, as one object.
 *
 * `ExecutionRegistry` is what every connector speaks. This is the in-process
 * binding of it: the same four verbs, backed by the services. A REST or MCP
 * transport would sit **over** this rather than beside it, which is what makes
 * "semantic equivalence across surfaces" checkable — every surface calls the
 * same code, so a difference between them would be a difference in transport
 * rather than in meaning.
 *
 * It adds no behaviour of its own. Anything decided here rather than in a
 * service would be a rule the REST binding had and the MCP binding did not.
 */
import type {
  AppendEventRequest,
  AppendedEvent,
  CompleteExecutionRequest,
  ExecutionIdentityRefs,
  ExecutionRegistry,
  ExecutionSnapshot,
  ProposeTransitionRequest,
  RegisterExecutionRequest,
} from '@pmi/execution-registry-contract';
import type { ExecutionEventService } from './execution-event.service.js';
import type { ExecutionRegistrationService } from './execution-registration.service.js';
import type { StatusProposalService } from './status-proposal.service.js';
import type { ExecutionCommentService, CommentType } from './execution-comment.service.js';
import type { ExecutionProjectionService } from './execution-projection.service.js';

/**
 * EPIC-043 `T1466` — the comment operation `EPIC-037`'s contract names and its
 * facade never carried. The identity is the registry's (derived by the
 * transport), the author is that identity's principal.
 */
export interface CommentRequest {
  readonly executionId: string;
  readonly workspaceId: string;
  readonly identity: ExecutionIdentityRefs;
  readonly body: string;
  readonly commentType?: string;
  readonly idempotencyKey: string;
  readonly parentCommentId?: string;
}

export class ExecutionRegistryFacade implements ExecutionRegistry {
  constructor(
    private readonly registration: ExecutionRegistrationService,
    private readonly events: ExecutionEventService,
    private readonly proposals: StatusProposalService,
    /** EPIC-043 T1466 — optional only for EPIC-037's own fixtures; the module always supplies it. */
    private readonly comments?: ExecutionCommentService,
    /**
     * EPIC-043 T1435 — the projection is rebuilt on read, so a snapshot never
     * reports a lifecycle state the event stream has moved past. Nothing
     * advanced `execution_state` after registration; a read-time rebuild is
     * the "materialised on read" posture PMI-DOC-007 §3 takes for projections.
     */
    private readonly projections?: ExecutionProjectionService,
  ) {}

  /** EPIC-043 T1466 — `pmi.execution.comment` / `POST /v1/executions/:id/comments`. */
  async comment(request: CommentRequest): Promise<{ commentId: string }> {
    if (this.comments === undefined) {
      throw new Error('ExecutionRegistryFacade was composed without ExecutionCommentService; comment() is unavailable.');
    }
    const commentType = (request.commentType ?? 'clarification') as CommentType;
    return this.comments.add({
      workspaceId: request.workspaceId,
      executionId: request.executionId,
      authorId: request.identity.authenticatedPrincipalId,
      authorType: 'connector',
      agentIdentitySnapshotId: request.identity.agentSnapshotId,
      commentType,
      body: request.body,
      idempotencyKey: request.idempotencyKey,
      ...(request.parentCommentId !== undefined ? { parentCommentId: request.parentCommentId } : {}),
    });
  }

  async register(request: RegisterExecutionRequest): Promise<ExecutionSnapshot> {
    return this.registration.register(request);
  }

  async appendEvent(request: AppendEventRequest): Promise<AppendedEvent> {
    return this.events.append({
      workspaceId: request.workspaceId,
      executionId: request.executionId,
      type: request.type,
      payload: { ...request.payload },
      occurredAt: request.occurredAt,
      emittedBy: request.identity.authenticatedPrincipalId,
      idempotencyKey: request.idempotencyKey,
      ...(request.expectedSequence !== undefined
        ? { expectedSequence: request.expectedSequence }
        : {}),
      ...(request.localSequence !== undefined ? { localSequence: request.localSequence } : {}),
    });
  }

  async complete(request: CompleteExecutionRequest): Promise<AppendedEvent> {
    const { sequence } = await this.registration.complete(request);
    const history = await this.events.history(request.workspaceId, request.executionId);
    const written = history.find((e) => e.sequence === sequence);
    // The event the append actually produced, not a reconstruction of it.
    return written ?? { ...history[history.length - 1]! };
  }

  async proposeTransition(request: ProposeTransitionRequest): Promise<AppendedEvent> {
    const { eventType } = await this.proposals.propose(request);
    const history = await this.events.history(request.workspaceId, request.executionId);
    const verdictEvent = [...history].reverse().find((e) => e.type === eventType);
    if (verdictEvent === undefined) {
      throw new Error('The adjudication verdict was not recorded as an event.');
    }
    return verdictEvent;
  }

  async history(workspaceId: string, executionId: string): Promise<readonly AppendedEvent[]> {
    return this.events.history(workspaceId, executionId);
  }

  async snapshot(workspaceId: string, executionId: string): Promise<ExecutionSnapshot | null> {
    if (this.projections !== undefined) {
      try {
        await this.projections.rebuild(workspaceId, executionId);
      } catch {
        // An execution this workspace does not hold: the read below answers null.
      }
    }
    return this.registration.snapshot(workspaceId, executionId);
  }
}
