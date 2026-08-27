/**
 * T1038 (EPIC-037 Band A) — the REST binding. **NOT MOUNTED. Do not mount it.**
 *
 * ## Read this before adding it to `controllers`
 *
 * This file was mounted in `ExecutionsModule` during C3C and taken back out at
 * C3C closure, because HTTP evidence contradicted the claim its own header used
 * to make. Booting the composed `AppModule` and issuing real requests showed:
 *
 * - `GET /v1/executions/:workspaceId/:id/history` → **200, with a real
 *   workspace's event stream**, to a caller holding no session. `workspaceId`
 *   came from the URL and was passed straight through; nothing checked that the
 *   caller belonged to it.
 * - `POST /v1/executions` → the body supplied `identity.authenticatedPrincipalId`.
 *   The services resolve the *snapshot* authoritatively and check the two agree,
 *   but both arrive from the same request. That is a consistency check between
 *   body fields, not authentication of a caller.
 *
 * The old header claimed "identity is not taken from the body". That was wrong:
 * `ExecutionIdentityRefs` **is** the body, and every field in it was a caller
 * assertion. The claim is recorded here because the mistake is instructive —
 * resolving a reference authoritatively feels like authentication and is not.
 *
 * ## What would make it safe
 *
 * A transport that authenticates a **non-human** principal and mints the trusted
 * context server-side, so `authenticatedPrincipalId` is derived from the
 * credential rather than read from JSON. The only boundary this application has
 * is `SessionContextMiddleware`, which resolves a *human* session cookie; using
 * it here would mean representing an agent as a User, which EPIC-028 forbids.
 * Connector authentication is EPIC-039 transport work.
 *
 * Until then the registry is reached through {@link ExecutionRegistryFacade}
 * in-process, which is what the fixture connector and `T1039` drive.
 *
 * ## What has no route, and never should
 *
 * There is no endpoint to apply a transition, approve one, or patch an
 * execution. `FR-EXR-020` forbids a PATCH acting as the audit mechanism, and
 * the absence is the enforcement: nothing to call.
 */
import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import type {
  AppendEventRequest,
  AppendedEvent,
  CompleteExecutionRequest,
  ExecutionSnapshot,
  ProposeTransitionRequest,
  RegisterExecutionRequest,
} from '@pmi/execution-registry-contract';
import { ExecutionRegistryFacade } from './execution-registry.facade.js';
import { NotFoundError } from '../../core/errors.js';

@Controller('executions')
export class ExecutionsController {
  constructor(
    @Inject(ExecutionRegistryFacade) private readonly registry: ExecutionRegistryFacade,
  ) {}

  @Post()
  async register(@Body() body: RegisterExecutionRequest): Promise<ExecutionSnapshot> {
    return this.registry.register(body);
  }

  @Post(':id/events')
  async append(
    @Param('id') id: string,
    @Body() body: Omit<AppendEventRequest, 'executionId'>,
  ): Promise<AppendedEvent> {
    // The path wins over the body. A body that could name a different execution
    // than the URL would let one request write into another's stream.
    return this.registry.appendEvent({ ...body, executionId: id });
  }

  @Post(':id/completion')
  async complete(
    @Param('id') id: string,
    @Body() body: Omit<CompleteExecutionRequest, 'executionId'>,
  ): Promise<AppendedEvent> {
    return this.registry.complete({ ...body, executionId: id });
  }

  @Post(':id/proposals')
  async propose(
    @Param('id') id: string,
    @Body() body: Omit<ProposeTransitionRequest, 'executionId'>,
  ): Promise<AppendedEvent> {
    return this.registry.proposeTransition({ ...body, executionId: id });
  }

  @Get(':workspaceId/:id/history')
  async history(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ): Promise<readonly AppendedEvent[]> {
    return this.registry.history(workspaceId, id);
  }

  @Get(':workspaceId/:id')
  async snapshot(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ): Promise<ExecutionSnapshot> {
    const snapshot = await this.registry.snapshot(workspaceId, id);
    if (snapshot === null) {
      // Absent rather than forbidden, matching `FR-ACC-024`'s posture: a
      // caller learns nothing about whether an execution they cannot see
      // exists.
      throw new NotFoundError('Not found.');
    }
    return snapshot;
  }
}
