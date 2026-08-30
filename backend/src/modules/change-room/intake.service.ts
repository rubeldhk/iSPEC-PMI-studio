/**
 * `T996b`, `T996d`, `T996f`, `T996h` (EPIC-034) — where `RULE-02` leads.
 *
 * The Requirement Room refuses an in-place edit of a baselined requirement and
 * offers a Change Request instead (`FR-RQR-051`, `InPlaceEditRefusedError`).
 * **This is the destination of that refusal.** Until it existed, the refusal
 * named a remedy nobody could take, which is a refusal with nowhere to go.
 *
 * ## Three rules that look like validation and are not
 *
 * **A change is always AGAINST a baseline** (`FR-CHR-010`). Without a target
 * version there is nothing for the change to be a change *to*, and the delta it
 * eventually produces would freeze nothing. Refused at intake rather than
 * discovered at approval.
 *
 * **Urgency is recorded and never read** (`FR-CHR-021`, `ADR-0025` constraint
 * 2). It is stored so a reviewer can see what was claimed; nothing in this
 * service branches on it. A gate skipped because something was urgent resolves
 * to a recorded exception or a violation — never to a pass — and the way to
 * guarantee that is for the gate code never to see the field.
 *
 * **A withdrawn request is retained** (`FR-CHR-023`), with its analysis. That
 * somebody questioned a baseline and then thought better of it is part of how
 * the baseline earned its standing.
 */
import { randomUUID } from 'node:crypto';
import { ValidationFailedError, NotFoundError } from '../../core/errors.js';
import type { ChangeRequestRow, ChangeRoomStore, OpenQuestion } from './change-room.store.js';

/**
 * `T996f` — what `EPIC-033`'s refusal hands over.
 *
 * Imported rather than restated. A local copy of this shape would compile
 * forever after the real one changed, and the first symptom would be a change
 * request raised against a baseline nobody refused. The dependency is
 * type-only: no Requirement Room code runs here.
 */
export type { ChangeRequestAffordance } from '../requirement-room/baseline.service.js';
import type { ChangeRequestAffordance } from '../requirement-room/baseline.service.js';

export interface RaiseChangeInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly roomObjectId: string;
  readonly targetBaselineId: string;
  readonly targetBaselineVersion: number;
  readonly requestedOutcome: string;
  readonly reason: string;
  readonly requester: string;
  readonly urgency?: string;
  readonly questions?: readonly string[];
  readonly origin?: 'direct' | 'defect-transfer';
  readonly originDefectRef?: string;
}

/** Urgency values a requester may claim. None of them changes what happens. */
export const URGENCY_LEVELS = Object.freeze(['normal', 'high', 'critical'] as const);

export class ChangeIntakeService {
  constructor(private readonly store: ChangeRoomStore) {}

  /**
   * `FR-CHR-010`, `FR-CHR-020` — record a proposed modification.
   *
   * Every refusal below happens before anything is written, so a rejected
   * request cannot leave a half-formed change behind.
   */
  async raise(input: RaiseChangeInput): Promise<ChangeRequestRow> {
    // `FR-CHR-010`. The first check, because the rest of the record is
    // meaningless without it.
    if (!input.targetBaselineId || !Number.isInteger(input.targetBaselineVersion)) {
      throw new ValidationFailedError(
        'a change is always against a baseline: targetBaselineId and targetBaselineVersion are required (FR-CHR-010)',
      );
    }
    for (const field of ['requestedOutcome', 'reason', 'requester'] as const) {
      if ((input[field] ?? '').trim() === '') {
        throw new ValidationFailedError(`a change request requires: ${field} (BR-0043)`);
      }
    }

    const urgency = input.urgency ?? 'normal';
    if (!URGENCY_LEVELS.includes(urgency as (typeof URGENCY_LEVELS)[number])) {
      throw new ValidationFailedError(
        `urgency must be one of: ${URGENCY_LEVELS.join(', ')} — and none of them skips a gate (FR-CHR-021)`,
      );
    }

    const origin = input.origin ?? 'direct';
    if (origin === 'defect-transfer' && !input.originDefectRef) {
      // A transfer that forgot where it came from loses its provenance
      // silently, which is worse than refusing the transfer.
      throw new ValidationFailedError(
        'a defect-transfer names the defect it came from (FR-CHR-012)',
      );
    }

    return this.store.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      roomObjectId: input.roomObjectId,
      targetBaselineId: input.targetBaselineId,
      targetBaselineVersion: input.targetBaselineVersion,
      requestedOutcome: input.requestedOutcome.trim(),
      reason: input.reason.trim(),
      requester: input.requester,
      urgency,
      openQuestions: (input.questions ?? []).map((question) => ({
        id: randomUUID(),
        question,
        answer: null,
        answeredBy: null,
      })),
      origin,
      originDefectRef: input.originDefectRef ?? null,
      state: 'open',
      rebasedFrom: null,
      createdAt: new Date(),
    });
  }

  /**
   * `T996f` — the handoff `EPIC-033`'s refusal points at.
   *
   * Takes the affordance that Room produced and turns it into a request against
   * the same baseline. The version travels from the affordance rather than being
   * looked up again: the refusal named a specific baseline, and a change raised
   * against a different one would answer a question nobody asked.
   */
  async fromRefusedEdit(
    affordance: ChangeRequestAffordance,
    context: {
      workspaceId: string;
      projectId: string;
      roomObjectId: string;
      requester: string;
      reason: string;
      requestedOutcome: string;
      urgency?: string;
    },
  ): Promise<ChangeRequestRow> {
    if (affordance.remedy !== 'change-request') {
      throw new ValidationFailedError('that refusal does not offer a change request');
    }
    return this.raise({
      ...context,
      targetBaselineId: affordance.baselineId,
      targetBaselineVersion: affordance.baselineVersion,
    });
  }

  /** `FR-CHR-022` — the whole set, answerable in place. */
  async answer(
    workspaceId: string,
    id: string,
    questionId: string,
    answer: string,
    answeredBy: string,
  ): Promise<ChangeRequestRow> {
    const request = await this.require(workspaceId, id);
    if (answer.trim() === '') {
      throw new ValidationFailedError('an answer requires: answer');
    }
    const found = request.openQuestions.find((q) => q.id === questionId);
    if (!found) throw new NotFoundError('Not found.');

    const questions: OpenQuestion[] = request.openQuestions.map((q) =>
      q.id === questionId ? { ...q, answer: answer.trim(), answeredBy } : q,
    );
    return this.store.setQuestions(workspaceId, id, questions);
  }

  /**
   * `FR-CHR-023` — withdrawn, and retained.
   *
   * A state change rather than a delete, and the questions and their answers
   * survive it untouched.
   */
  async withdraw(workspaceId: string, id: string): Promise<ChangeRequestRow> {
    const request = await this.require(workspaceId, id);
    if (request.state !== 'open') {
      throw new ValidationFailedError(
        `only an open change request can be withdrawn; this one is ${request.state}`,
      );
    }
    return this.store.setState(workspaceId, id, 'withdrawn');
  }

  /**
   * `FR-CHR-011`, `SC-CHR-001`, `RULE-02` — what is in flight against a baseline.
   *
   * The gate reads this: an implementation-changing request must be visible as
   * traceable change control, not applied around it.
   */
  async openAgainst(workspaceId: string, targetBaselineId: string): Promise<ChangeRequestRow[]> {
    const all = await this.store.listForBaseline(workspaceId, targetBaselineId);
    return all.filter((row) => row.state === 'open');
  }

  private async require(workspaceId: string, id: string): Promise<ChangeRequestRow> {
    const request = await this.store.findById(workspaceId, id);
    // Absent rather than forbidden — a caller learns nothing about a request it
    // may not see.
    if (!request) throw new NotFoundError('Not found.');
    return request;
  }
}
