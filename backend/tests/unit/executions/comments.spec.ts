/**
 * T1049 (EPIC-037 Band A) — the comment thread.
 *
 * A recording stub stands in for the database, so what is asserted is the
 * service's own behaviour: what it writes, and that a correction is a new row
 * rather than an edit. The table's refusal to be edited is proven separately
 * against a real PostgreSQL.
 */
import { describe, expect, it } from 'vitest';
import { RegistryRefusedError } from '@pmi/execution-registry-contract';
import {
  COMMENT_TYPES,
  ExecutionCommentService,
  type CommentDb,
} from '../../../src/modules/executions/execution-comment.service.js';
import type { ExecutionEventService } from '../../../src/modules/executions/execution-event.service.js';

const WS = 'ws_a';
const EXEC = 'exec_1';

function harness() {
  const writes: string[] = [];
  const appended: string[] = [];
  const rows: Record<string, unknown>[] = [
    { id: 'cm1', executionId: EXEC, authorId: 'p_agent', authorType: 'agent', commentType: 'completion', body: 'done' },
  ];
  const db: CommentDb = {
    $queryRawUnsafe: async () => rows as never,
    $executeRawUnsafe: async (query) => {
      writes.push(query.includes('INSERT') ? 'INSERT' : query.split(' ')[0]!);
      return 1;
    },
  };
  const events = {
    append: async (input: { type: string }) => {
      appended.push(input.type);
      return { sequence: appended.length };
    },
  } as unknown as ExecutionEventService;
  return { service: new ExecutionCommentService(db, events), writes, appended };
}

describe('T1049 · a comment is written and announced as an event', () => {
  it('inserts the row and appends `comment-added`', async () => {
    const { service, writes, appended } = harness();
    const { commentId } = await service.add({
      workspaceId: WS,
      executionId: EXEC,
      authorId: 'p_agent',
      authorType: 'agent',
      commentType: 'completion',
      body: 'Generated.',
      idempotencyKey: 'k1',
    });
    expect(commentId).toMatch(/[0-9a-f-]{36}/);
    expect(writes).toEqual(['INSERT']);
    expect(appended).toEqual(['comment-added']);
  });

  it('refuses an empty body — a comment that records nothing', async () => {
    const { service } = harness();
    await expect(
      service.add({
        workspaceId: WS,
        executionId: EXEC,
        authorId: 'p_agent',
        authorType: 'agent',
        commentType: 'review',
        body: '   ',
        idempotencyKey: 'k2',
      }),
    ).rejects.toThrow(RegistryRefusedError);
  });

  it('names five comment types, completion among them', () => {
    expect(COMMENT_TYPES).toContain('completion');
    expect(COMMENT_TYPES).toHaveLength(5);
  });
});

describe('T1049 · a correction appends, it never edits', () => {
  it('writes a NEW row and appends `comment-redacted`', async () => {
    const { service, writes, appended } = harness();
    const { redactionId } = await service.redact({
      workspaceId: WS,
      executionId: EXEC,
      commentId: 'cm1',
      redactedBy: 'u_admin',
      reason: 'contained a token',
      idempotencyKey: 'k3',
    });
    expect(redactionId).not.toBe('cm1');
    // INSERT, never UPDATE. Overwriting the body would make a redacted thread
    // indistinguishable from one that was always shorter.
    expect(writes).toEqual(['INSERT']);
    expect(writes).not.toContain('UPDATE');
    expect(appended).toEqual(['comment-redacted']);
  });

  it('refuses to redact a comment that does not exist', async () => {
    const { service } = harness();
    const empty = new ExecutionCommentService(
      { $queryRawUnsafe: async () => [] as never, $executeRawUnsafe: async () => 1 },
      { append: async () => ({ sequence: 1 }) } as unknown as ExecutionEventService,
    );
    void service;
    await expect(
      empty.redact({
        workspaceId: WS,
        executionId: EXEC,
        commentId: 'missing',
        redactedBy: 'u_admin',
        reason: 'x',
        idempotencyKey: 'k4',
      }),
    ).rejects.toThrow(RegistryRefusedError);
  });
});
