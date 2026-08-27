/**
 * T1038 (EPIC-037 Band A) — the REST binding.
 *
 * A **transport over** {@link ExecutionRegistryFacade}, not a second
 * implementation. Every route does exactly one thing: translate HTTP into the
 * semantic contract and back. Anything decided here would be a rule the REST
 * surface had and the MCP surface did not, which is precisely what "semantic
 * equivalence across surfaces" forbids.
 *
 * ## Constitution XI, Tier 1
 *
 * This is the real entry point. Without it the registry would be reachable only
 * from a test, and `T1039` asserts the composed application actually serves it.
 *
 * ## Identity is not taken from the body
 *
 * The request carries **snapshot references**, and the services resolve them
 * against EPIC-028 before anything is written. There is deliberately no route
 * that accepts a principal as a claim — a connector that could assert who it is
 * would make the whole registry decorative.
 *
 * ## What has no route
 *
 * There is no endpoint to apply a transition, approve one, or patch an
 * execution. `FR-EXR-020` forbids a PATCH acting as the audit mechanism, and
 * the absence here is the enforcement: nothing to call.
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
