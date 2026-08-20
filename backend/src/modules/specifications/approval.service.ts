/**
 * T122 — the approval path surfaces outstanding findings (US6 scenario 3).
 *
 * Approval is not BLOCKED by findings — the reviewer approves with eyes open —
 * but the findings MUST ride the approval response, never be
 * discoverable-only. Order matters: the transition is validated FIRST, so an
 * illegal approval is refused before any findings are fetched.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import {
  assertTransition,
  type SpecLifecycleState,
  type TransitionRecord,
  type TransitionRecorder,
} from './lifecycle.machine.js';

export interface OutstandingFinding {
  location: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface OutstandingFindingsSource {
  outstandingFor(workspaceId: string, specificationVersionId: string): Promise<OutstandingFinding[]>;
}

export interface ApproveInput {
  workspaceId: string;
  specificationId: string;
  currentVersionId: string;
  currentState: SpecLifecycleState;
  actorId: string;
}

export interface ApprovalOutcome {
  transition: TransitionRecord;
  /** Shown before proceeding (US6/3) — always present, possibly empty. */
  outstandingFindings: OutstandingFinding[];
}

export interface ApprovalOptions {
  now?: () => Date;
}

export class ApprovalService {
  private readonly now: () => Date;

  constructor(
    private readonly findings: OutstandingFindingsSource,
    private readonly recorder: TransitionRecorder,
    options: ApprovalOptions = {},
  ) {
    this.now = options.now ?? ((): Date => new Date());
  }

  async approve(input: ApproveInput): Promise<ApprovalOutcome> {
    // Refuse an illegal approval before touching anything else.
    assertTransition(input.currentState, 'approved');

    const outstandingFindings = await this.findings.outstandingFor(
      input.workspaceId,
      input.currentVersionId,
    );

    const transition: TransitionRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      specificationId: input.specificationId,
      fromState: input.currentState,
      toState: 'approved',
      actorId: input.actorId,
      occurredAt: this.now(),
    };
    await this.recorder.append(transition);

    return { transition, outstandingFindings };
  }
}
