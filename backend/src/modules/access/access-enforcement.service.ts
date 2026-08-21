/**
 * T378 + T816 — the enforcement path: refuse, hide, record (FR-ACC-023,
 * FR-ACC-024, FR-ACC-028a, SC-007, SC-013).
 *
 * Two different shapes of refusal, both deliberate:
 *
 *   - an inaccessible ARTIFACT is ABSENT — hidden from listings, 404 on
 *     direct access, never a locked placeholder (FR-ACC-024): 403 confirms
 *     existence;
 *   - a restricted review QUESTION is shown AS RESTRICTED rather than
 *     silently omitted (FR-ACC-028a / T816): a reviewer must be able to tell
 *     that a question exists they cannot act on, or a session looks complete
 *     when it is not.
 *
 * Every refusal writes an AccessAttemptRecord in the same operation as the
 * refusal — an action cannot be refused without its record (SC-007, SC-013).
 */
import { NotFoundError } from '../../core/errors.js';
import type { ArtifactRef } from './access-grant.service.js';
import type { AccessInheritanceService } from './access-inheritance.service.js';

const OPAQUE = 'Not found.';

export interface AccessAttempt extends ArtifactRef {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  reason: string;
  attemptedAt: Date;
}

export interface AttemptStore {
  record(attempt: Omit<AccessAttempt, 'id'>): Promise<AccessAttempt>;
  listForArtifact(workspaceId: string, artifact: ArtifactRef): Promise<AccessAttempt[]>;
}

export interface RestrictableQuestion {
  questionId: string;
  concerns: ArtifactRef;
}

export interface QuestionVisibility {
  questionId: string;
  restricted: boolean;
}

export class AccessEnforcementService {
  constructor(
    private readonly inheritance: AccessInheritanceService,
    private readonly attempts: AttemptStore,
  ) {}

  /**
   * FR-ACC-024 — collection reads: the ungranted artifact is simply not in
   * the result. Hiding records no attempt; the caller never asked for the
   * specific artifact.
   */
  async filterReadable<T extends ArtifactRef>(
    workspaceId: string,
    userId: string,
    artifacts: T[],
  ): Promise<T[]> {
    const visible: T[] = [];
    for (const artifact of artifacts) {
      if (await this.inheritance.effectivelyReadable(workspaceId, userId, artifact)) {
        visible.push(artifact);
      }
    }
    return visible;
  }

  /**
   * FR-ACC-023 — direct access: refused as ABSENT, and the refusal is
   * recorded with who, what, when and why in the same operation.
   */
  async requireReadable(
    workspaceId: string,
    userId: string,
    artifact: ArtifactRef,
    action = 'read',
    at?: Date,
  ): Promise<void> {
    if (await this.inheritance.effectivelyReadable(workspaceId, userId, artifact)) return;
    await this.refuse(workspaceId, userId, artifact, action, 'No grant covers this artifact.', at);
  }

  async requireEditable(
    workspaceId: string,
    userId: string,
    artifact: ArtifactRef,
    action = 'edit',
    at?: Date,
  ): Promise<void> {
    if (await this.inheritance.effectivelyEditable(workspaceId, userId, artifact)) return;
    await this.refuse(workspaceId, userId, artifact, action, 'No edit grant covers this artifact.', at);
  }

  /**
   * T816 — FR-ACC-028a: review questions are marked, never dropped. Evaluated
   * against CURRENT grants (the caller passes the reviewer, not the run).
   */
  async restrictQuestions(
    workspaceId: string,
    reviewerId: string,
    questions: RestrictableQuestion[],
  ): Promise<QuestionVisibility[]> {
    const result: QuestionVisibility[] = [];
    for (const q of questions) {
      const readable = await this.inheritance.effectivelyReadable(workspaceId, reviewerId, q.concerns);
      result.push({ questionId: q.questionId, restricted: !readable });
    }
    return result;
  }

  async attemptsFor(workspaceId: string, artifact: ArtifactRef): Promise<AccessAttempt[]> {
    return this.attempts.listForArtifact(workspaceId, artifact);
  }

  private async refuse(
    workspaceId: string,
    userId: string,
    artifact: ArtifactRef,
    action: string,
    reason: string,
    at?: Date,
  ): Promise<never> {
    // The record and the refusal are one operation — never one without the other.
    await this.attempts.record({
      workspaceId,
      userId,
      artifactType: artifact.artifactType,
      artifactId: artifact.artifactId,
      action,
      reason,
      attemptedAt: at ?? new Date(),
    });
    throw new NotFoundError(OPAQUE);
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryAttemptStore implements AttemptStore {
  private readonly rows: AccessAttempt[] = [];
  private seq = 0;

  async record(attempt: Omit<AccessAttempt, 'id'>): Promise<AccessAttempt> {
    const row: AccessAttempt = { id: `att_${++this.seq}`, ...attempt };
    this.rows.push(row);
    return { ...row };
  }

  async listForArtifact(workspaceId: string, artifact: ArtifactRef): Promise<AccessAttempt[]> {
    return this.rows
      .filter(
        (a) =>
          a.workspaceId === workspaceId &&
          a.artifactType === artifact.artifactType &&
          a.artifactId === artifact.artifactId,
      )
      .map((a) => ({ ...a }));
  }
}
