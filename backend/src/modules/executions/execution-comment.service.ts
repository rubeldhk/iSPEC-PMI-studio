/**
 * T1050, T1052 (EPIC-037 Band A) — the append-only comment thread.
 *
 * ## A correction is a new comment
 *
 * The table refuses `UPDATE`, so "editing" a comment is not a thing that can
 * happen. A correction is a **new row** pointing at its predecessor through
 * `supersedesCommentId`, and both survive. The history is the pair, not the
 * latest value — which is the same rule the adjudication records follow.
 *
 * ## A redaction hides the body without destroying the chain
 *
 * `R-037-9`. Redaction writes a **new** comment row carrying
 * `redactionState = 'redacted'` and a `comment-redacted` event. The original
 * row is untouched: its `integrityHash` still chains, so the thread remains
 * verifiable, and an auditor can still see that something was said and by whom
 * even when they may not see what.
 *
 * Overwriting the body in place would have been simpler and would have broken
 * exactly that — a redacted thread would become indistinguishable from a thread
 * that was always shorter.
 *
 * ## Comments continue after the execution ends
 *
 * `comment-added` is a **content** event, so class-aware terminality permits it
 * after a terminal lifecycle event. A completed run can still be asked about.
 */
import { createHash, randomUUID } from 'node:crypto';
import { RegistryRefusedError } from '@pmi/execution-registry-contract';
import type { ExecutionEventService } from './execution-event.service.js';

export const COMMENT_TYPES = Object.freeze([
  'completion',
  'clarification',
  'review',
  'decision',
  'system',
  // EPIC-044 DEF-044-002: the type EPIC-042's hooks record a decomposition decision under
  // (EPIC-042 data-model §8); admitted here and by the CHECK in migration
  // 20260905130000_epic044_decision_comment_type.
  'decomposition-decision',
] as const);
export type CommentType = (typeof COMMENT_TYPES)[number];

export interface CommentDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface CommentRow {
  id: string;
  executionId: string;
  authorId: string;
  authorType: string;
  commentType: string;
  body: string;
  parentCommentId: string | null;
  supersedesCommentId: string | null;
  redactionState: string;
  redactedBy: string | null;
  redactionReason: string | null;
  integrityHash: string;
  createdAt: Date | string;
}

export interface AddCommentInput {
  workspaceId: string;
  executionId: string;
  authorId: string;
  authorType: 'human' | 'agent' | 'service' | 'connector';
  agentIdentitySnapshotId?: string;
  commentType: CommentType;
  body: string;
  parentCommentId?: string;
  mentions?: readonly string[];
  evidenceRefs?: readonly string[];
  actionRequired?: boolean;
  decisionRequired?: boolean;
  supersedesCommentId?: string;
  idempotencyKey: string;
}

function hashComment(input: { executionId: string; authorId: string; body: string; createdAt: string }): string {
  return createHash('sha256')
    .update(JSON.stringify([input.executionId, input.authorId, input.body, input.createdAt]))
    .digest('hex');
}

export class ExecutionCommentService {
  constructor(
    private readonly db: CommentDb,
    private readonly events: ExecutionEventService,
  ) {}

  async add(input: AddCommentInput): Promise<{ commentId: string; sequence: number }> {
    if (input.body.trim() === '') {
      throw new RegistryRefusedError(
        'completion_comment_required',
        'A comment with no body records nothing.',
      );
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    await this.db.$executeRawUnsafe(
      `INSERT INTO "execution_comments"
         ("id","workspaceId","executionId","authorId","authorType","agentIdentitySnapshotId",
          "commentType","body","parentCommentId","mentions","evidenceRefs",
          "actionRequired","decisionRequired","supersedesCommentId","integrityHash")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      id,
      input.workspaceId,
      input.executionId,
      input.authorId,
      input.authorType,
      input.agentIdentitySnapshotId ?? null,
      input.commentType,
      input.body,
      input.parentCommentId ?? null,
      [...(input.mentions ?? [])],
      [...(input.evidenceRefs ?? [])],
      input.actionRequired ?? false,
      input.decisionRequired ?? false,
      input.supersedesCommentId ?? null,
      hashComment({ executionId: input.executionId, authorId: input.authorId, body: input.body, createdAt }),
    );

    const appended = await this.events.append({
      workspaceId: input.workspaceId,
      executionId: input.executionId,
      type: 'comment-added',
      payload: { commentId: id, commentType: input.commentType },
      occurredAt: createdAt,
      emittedBy: input.authorId,
      idempotencyKey: input.idempotencyKey,
    });
    return { commentId: id, sequence: appended.sequence };
  }

  /**
   * Redact a comment by **appending** a redacted successor.
   *
   * The original is never touched — the table would refuse anyway, and this
   * makes the intent explicit rather than relying on the trigger to catch a
   * mistake.
   */
  async redact(input: {
    workspaceId: string;
    executionId: string;
    commentId: string;
    redactedBy: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<{ redactionId: string; sequence: number }> {
    const original = await this.db.$queryRawUnsafe<CommentRow[]>(
      `SELECT * FROM "execution_comments" WHERE "id" = $1 AND "workspaceId" = $2`,
      input.commentId,
      input.workspaceId,
    );
    if (original.length === 0) {
      throw new RegistryRefusedError('identity_not_resolvable', 'No such comment.');
    }
    const source = original[0]!;
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    await this.db.$executeRawUnsafe(
      `INSERT INTO "execution_comments"
         ("id","workspaceId","executionId","authorId","authorType","commentType","body",
          "supersedesCommentId","integrityHash","redactionState","redactedBy","redactedAt","redactionReason")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'redacted',$10, now(), $11)`,
      id,
      input.workspaceId,
      input.executionId,
      source.authorId,
      source.authorType,
      source.commentType,
      '[redacted]',
      input.commentId,
      hashComment({ executionId: input.executionId, authorId: source.authorId, body: '[redacted]', createdAt }),
      input.redactedBy,
      input.reason,
    );

    const appended = await this.events.append({
      workspaceId: input.workspaceId,
      executionId: input.executionId,
      type: 'comment-redacted',
      payload: { commentId: input.commentId, redactionId: id, reason: input.reason },
      occurredAt: createdAt,
      emittedBy: input.redactedBy,
      idempotencyKey: input.idempotencyKey,
    });
    return { redactionId: id, sequence: appended.sequence };
  }

  async thread(workspaceId: string, executionId: string): Promise<readonly CommentRow[]> {
    return this.db.$queryRawUnsafe<CommentRow[]>(
      `SELECT * FROM "execution_comments"
        WHERE "workspaceId" = $1 AND "executionId" = $2 ORDER BY "createdAt"`,
      workspaceId,
      executionId,
    );
  }
}
