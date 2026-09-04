/**
 * `T1465` (EPIC-043, analysis `C1`) — `ExecutionRegistryFacade.comment()`:
 * `EPIC-037` built the comment service and never put it on the facade or a
 * route. The connector principal is the author; a comment is permitted after a
 * terminal lifecycle event (the service decides); an empty body is refused by
 * the service and passes through.
 */
import { describe, expect, it, vi } from 'vitest';
import { ExecutionRegistryFacade } from '../../../src/modules/executions/execution-registry.facade.js';

const IDENTITY = {
  authenticatedPrincipalId: 'pr_1',
  agentSnapshotId: 'snap_1',
  connectorRegistrationId: 'reg_1',
  sponsorUserId: 'u_owner',
  delegationId: 'del_1',
  delegationIdentityVersion: 1,
};

function facade(add = vi.fn(async () => ({ commentId: 'c_1' }))) {
  const comments = { add } as never;
  return { facade: new ExecutionRegistryFacade({} as never, {} as never, {} as never, comments), add };
}

describe('T1465 · facade.comment', () => {
  it('adds through ExecutionCommentService with the connector principal as author and its snapshot', async () => {
    const { facade: f, add } = facade();
    const result = await f.comment({ executionId: 'exec_1', workspaceId: 'ws_a', identity: IDENTITY, body: 'done', idempotencyKey: 'k_1' });
    expect(result).toEqual({ commentId: 'c_1' });
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_a',
        executionId: 'exec_1',
        authorId: 'pr_1',
        authorType: 'connector',
        agentIdentitySnapshotId: 'snap_1',
        commentType: 'clarification',
        body: 'done',
        idempotencyKey: 'k_1',
      }),
    );
  });

  it('passes the comment type and the parent through, and the service\'s refusals back', async () => {
    const add = vi.fn(async (input: { body: string }) => {
      if (input.body === '') throw new Error('A comment needs a body.');
      return { commentId: 'c_2' };
    });
    const { facade: f } = facade(add);
    await f.comment({ executionId: 'exec_1', workspaceId: 'ws_a', identity: IDENTITY, body: 'x', commentType: 'review', idempotencyKey: 'k', parentCommentId: 'c_1' });
    expect(add).toHaveBeenLastCalledWith(expect.objectContaining({ commentType: 'review', parentCommentId: 'c_1' }));
    await expect(f.comment({ executionId: 'exec_1', workspaceId: 'ws_a', identity: IDENTITY, body: '', idempotencyKey: 'k' })).rejects.toThrow(/needs a body/);
  });

  it('names its absence when composed without the comment service', async () => {
    const f = new ExecutionRegistryFacade({} as never, {} as never, {} as never);
    await expect(f.comment({ executionId: 'e', workspaceId: 'w', identity: IDENTITY, body: 'b', idempotencyKey: 'k' })).rejects.toThrow(/ExecutionCommentService/);
  });
});
