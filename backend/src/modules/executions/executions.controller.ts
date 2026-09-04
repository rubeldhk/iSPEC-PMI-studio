/**
 * T1038 (EPIC-037 Band A) — the REST binding. **MOUNTED** by EPIC-043 `T1419`
 * (`R-043-10`, `contracts/mounted-registry-api.md`), behind `ConnectorAuthGuard`
 * on every route.
 *
 * ## What changed since this file was unmounted
 *
 * `DEF-037-001` found two faults: a `:workspaceId` path segment nobody verified,
 * and an `identity` in the body that every field of was a caller's assertion.
 * Both are gone by construction:
 *
 * - the workspace and the project are the credential's (`req.connector`, put
 *   there by the guard); the path carries neither;
 * - `identity` is derived from the credential's snapshot, registration and
 *   delegation (`connector-identity.ts`) and a body that carries one is refused
 *   by field name (`identity_not_accepted`);
 * - `surface` is derived from the transport (`local-cli`, or `mcp-client` when
 *   the `pmi-studio` server says so with `x-pmi-surface`) and `assurance` from
 *   the surface (`EPIC-041`); a body that carries either is refused;
 * - the contract version is negotiated on every request, never best-guessed.
 *
 * `backend/tests/architecture/executions-mounted.spec.ts` fails the moment a
 * handler loses the guard or names an unregistered scope, and boots the real
 * application to prove every route answers an absent credential with the one
 * refusal.
 *
 * ## What has no route, and never should
 *
 * There is no endpoint to apply a transition, approve one, or patch an
 * execution. `FR-EXR-020` forbids a PATCH acting as the audit mechanism, and
 * the absence is the enforcement: nothing to call.
 */
import { Body, Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  PMI_SURFACE_HEADER,
  type AppendEventRequest,
  type AppendedEvent,
  type CompleteExecutionRequest,
  type ExecutionIdentityRefs,
  type ExecutionSnapshot,
  type ExecutionSurface,
  type ProposeTransitionRequest,
  type RegisterExecutionRequest,
} from '@pmi/execution-registry-contract';
import {
  IdentityNotAcceptedError,
  InvalidConnectorCredentialError,
  NotAvailableUntilError,
  NotFoundError,
  SurfaceNotAcceptedError,
  UnsupportedContractVersionError,
} from '../../core/errors.js';
import { ConnectorAuthGuard, type ConnectorRequestContext } from '../connector/connector-auth.guard.js';
import { ConnectorScope } from '../connector/connector-scope.js';
import { ExecutionRegistryFacade } from './execution-registry.facade.js';
import { scrubDetail } from './sanitisation.js';

/** What a guarded request carries; the guard puts `connector` there. */
export interface GuardedRequest {
  headers: Record<string, string | string[] | undefined>;
  connector?: ConnectorRequestContext | undefined;
}

/** `identityFromConnector` bound to the composition root's lookups (executions.module). */
export interface ConnectorIdentityResolver {
  forRequest(ctx: ConnectorRequestContext): Promise<ExecutionIdentityRefs>;
}

/** Which project an execution belongs to — for the read routes' non-disclosure rule (`FR-PIC-032`). */
export interface ExecutionOwnership {
  projectIdOf(workspaceId: string, executionId: string): Promise<string | null>;
}

export const CONNECTOR_IDENTITY_RESOLVER = Symbol('CONNECTOR_IDENTITY_RESOLVER');
export const EXECUTION_OWNERSHIP = Symbol('EXECUTION_OWNERSHIP');

/** `AuditService.record`, by shape (`FR-PIC-036`). */
export interface ConnectorAuditPort {
  record(input: { workspaceId: string; actorId: string | null; action: 'create' | 'update'; targetType: string; targetId?: string; outcome: 'success' | 'refused' | 'failed'; detail?: Record<string, unknown> }): Promise<void>;
}
export const CONNECTOR_AUDIT = Symbol('CONNECTOR_AUDIT');

/** The subset of Express's response this controller sets. */
interface StatusSetter {
  status(code: number): unknown;
}

/** Fields the platform derives; a body carrying one is refused by name. */
const IDENTITY_FIELDS = ['identity', 'workspaceId', 'projectId'] as const;
const TRANSPORT_FIELDS = ['surface', 'assurance'] as const;

function header(req: GuardedRequest, name: string): string | null {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === undefined || value === '' ? null : value;
}

@Controller('executions')
@UseGuards(ConnectorAuthGuard)
export class ExecutionsController {
  constructor(
    @Inject(ExecutionRegistryFacade) private readonly registry: ExecutionRegistryFacade,
    @Inject(CONNECTOR_IDENTITY_RESOLVER) private readonly identity: ConnectorIdentityResolver,
    @Inject(EXECUTION_OWNERSHIP) private readonly ownership: ExecutionOwnership,
    @Inject(CONNECTOR_AUDIT) private readonly audit: ConnectorAuditPort | null = null,
  ) {}

  /** `FR-PIC-036` — every accepted call names the principal, the project, the operation and the outcome. */
  private async audited<T>(ctx: ConnectorRequestContext, operation: string, executionId: string | null, work: () => Promise<T>): Promise<T> {
    const result = await work();
    const targetId = executionId ?? (result as { executionId?: string } | null)?.executionId;
    await this.audit?.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.principal.principalId,
      action: 'create',
      targetType: 'execution',
      ...(targetId ? { targetId } : {}),
      outcome: 'success',
      detail: scrubDetail({ kind: 'connector', operation, projectId: ctx.projectId, credentialId: ctx.credentialId, outcome: 'success' }),
    });
    return result;
  }

  @Post()
  @ConnectorScope('execution.register')
  async register(@Req() req: GuardedRequest, @Body() body: Record<string, unknown>): Promise<ExecutionSnapshot> {
    const ctx = this.connector(req);
    this.negotiate(req);
    this.refuseAsserted(body);
    const surface = this.surfaceOf(req);
    const identity = await this.identity.forRequest(ctx);
    return this.audited(ctx, 'execution.register', null, () => this.registry.register({
      ...(body as unknown as Omit<RegisterExecutionRequest, 'workspaceId' | 'projectId' | 'identity' | 'surface'>),
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      identity,
      surface,
    }));
  }

  @Post(':id/events')
  @ConnectorScope('execution.append')
  async append(@Req() req: GuardedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>): Promise<AppendedEvent> {
    const ctx = this.connector(req);
    this.negotiate(req);
    this.refuseAsserted(body);
    await this.requireOwn(ctx, id);
    const identity = await this.identity.forRequest(ctx);
    // The path wins over the body: a body that could name a different execution
    // than the URL would let one request write into another's stream.
    return this.audited(ctx, 'execution.append', id, () => this.registry.appendEvent({
      ...(body as unknown as Omit<AppendEventRequest, 'executionId' | 'workspaceId' | 'identity'>),
      executionId: id,
      workspaceId: ctx.workspaceId,
      identity,
    }));
  }

  @Post(':id/completion')
  @ConnectorScope('execution.complete')
  async complete(@Req() req: GuardedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>): Promise<AppendedEvent> {
    const ctx = this.connector(req);
    this.negotiate(req);
    this.refuseAsserted(body);
    await this.requireOwn(ctx, id);
    const identity = await this.identity.forRequest(ctx);
    return this.audited(ctx, 'execution.complete', id, () => this.registry.complete({
      ...(body as unknown as Omit<CompleteExecutionRequest, 'executionId' | 'workspaceId' | 'identity'>),
      executionId: id,
      workspaceId: ctx.workspaceId,
      identity,
    }));
  }

  /** New in EPIC-043 (`T1466`): `EPIC-037` built the comment service and no route. */
  @Post(':id/comments')
  @ConnectorScope('execution.comment')
  async comment(@Req() req: GuardedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>): Promise<{ commentId: string }> {
    const ctx = this.connector(req);
    this.negotiate(req);
    this.refuseAsserted(body);
    await this.requireOwn(ctx, id);
    const identity = await this.identity.forRequest(ctx);
    return this.audited(ctx, 'execution.comment', id, () => this.registry.comment({
      executionId: id,
      workspaceId: ctx.workspaceId,
      identity,
      body: String(body['body'] ?? ''),
      commentType: (body['commentType'] as string | undefined) ?? 'note',
      idempotencyKey: String(body['idempotencyKey'] ?? ''),
      ...(typeof body['parentCommentId'] === 'string' ? { parentCommentId: body['parentCommentId'] } : {}),
    }));
  }

  /** `202`: the platform has accepted the proposal, not applied the transition. */
  @Post(':id/proposals')
  @ConnectorScope('execution.propose')
  async propose(
    @Req() req: GuardedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: StatusSetter,
  ): Promise<AppendedEvent> {
    const ctx = this.connector(req);
    this.negotiate(req);
    this.refuseAsserted(body);
    await this.requireOwn(ctx, id);
    const identity = await this.identity.forRequest(ctx);
    const event = await this.audited(ctx, 'execution.propose', id, () => this.registry.proposeTransition({
      ...(body as unknown as Omit<ProposeTransitionRequest, 'executionId' | 'workspaceId' | 'identity'>),
      executionId: id,
      workspaceId: ctx.workspaceId,
      identity,
    }));
    res.status(202);
    return event;
  }

  @Get(':id/history')
  @ConnectorScope('execution.read')
  async history(@Req() req: GuardedRequest, @Param('id') id: string): Promise<readonly AppendedEvent[]> {
    const ctx = this.connector(req);
    this.negotiate(req);
    await this.requireOwn(ctx, id);
    return this.registry.history(ctx.workspaceId, id);
  }

  @Get(':id')
  @ConnectorScope('execution.read')
  async snapshot(@Req() req: GuardedRequest, @Param('id') id: string): Promise<ExecutionSnapshot> {
    const ctx = this.connector(req);
    this.negotiate(req);
    await this.requireOwn(ctx, id);
    const snapshot = await this.registry.snapshot(ctx.workspaceId, id);
    if (snapshot === null) throw new NotFoundError('Not found.');
    return snapshot;
  }

  /**
   * Reserved (`FR-PIC-034`): `EPIC-037`'s provisional intake is unbuilt. The
   * route exists, is guarded, and says so — a client can tell *not yet* from
   * *never*.
   */
  @Post('sync')
  @ConnectorScope('execution.sync')
  async sync(@Req() req: GuardedRequest, @Body() _body: Record<string, unknown>): Promise<never> {
    this.connector(req);
    this.negotiate(req);
    throw new NotAvailableUntilError('EPIC-037', 'Reconciliation of provisional executions');
  }

  // ------------------------------------------------------------------ rules

  private connector(req: GuardedRequest): ConnectorRequestContext {
    if (!req.connector) throw new InvalidConnectorCredentialError();
    return req.connector;
  }

  /** `R-043-6`: negotiated, never best-guessed. */
  private negotiate(req: GuardedRequest): void {
    const received = header(req, CONTRACT_VERSION_HEADER);
    if (received !== CONTRACT_VERSION) throw new UnsupportedContractVersionError(CONTRACT_VERSION, received);
  }

  /** `R-043-4`: the transport says which local surface; the body never does. */
  private surfaceOf(req: GuardedRequest): ExecutionSurface {
    const declared = header(req, PMI_SURFACE_HEADER);
    if (declared === null) return 'local-cli';
    if (declared === 'mcp-client') return 'mcp-client';
    throw new SurfaceNotAcceptedError(PMI_SURFACE_HEADER);
  }

  /** `FR-PIC-024`, `FR-PIC-025`: what the platform derives, a body may not assert. */
  private refuseAsserted(body: Record<string, unknown>): void {
    for (const field of IDENTITY_FIELDS) if (field in body) throw new IdentityNotAcceptedError(field);
    for (const field of TRANSPORT_FIELDS) if (field in body) throw new SurfaceNotAcceptedError(field);
  }

  /** `FR-PIC-032`: an execution of another project is absent, not forbidden. */
  private async requireOwn(ctx: ConnectorRequestContext, executionId: string): Promise<void> {
    const projectId = await this.ownership.projectIdOf(ctx.workspaceId, executionId);
    if (projectId !== ctx.projectId) throw new NotFoundError('Not found.');
  }
}
