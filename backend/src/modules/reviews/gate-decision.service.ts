/**
 * T290 — the human decision path (FR-ENH-014/015).
 *
 * Approval over outstanding findings records the approver, the time, and
 * the OVERRIDDEN findings — what a human chose to advance past is part of
 * the record (PP-016). The decision is write-once: the outcome row is
 * append-only, with the single one-time decision fill excepted (the
 * database trigger enforces the same rule raw).
 */
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { AttributedFinding, RoleRun } from './gate-execution.service.js';

const OPAQUE = 'Not found.';

export interface GateOutcomeRecord {
  workspaceId: string;
  specificationId: string;
  gateId: string;
  rolesRun: RoleRun[];
  findings: AttributedFinding[];
  gateFailed: boolean;
  humanDecision?: 'approved' | 'rejected';
  decidedById?: string;
  decidedAt?: Date;
  overriddenFindings?: AttributedFinding[];
}

export interface GateOutcomeStore {
  find(workspaceId: string, id: string): Promise<GateOutcomeRecord | null>;
  fillDecision(
    workspaceId: string,
    id: string,
    decision: Pick<GateOutcomeRecord, 'humanDecision' | 'decidedById' | 'decidedAt' | 'overriddenFindings'>,
  ): Promise<GateOutcomeRecord>;
}

export class GateDecisionService {
  constructor(private readonly store: GateOutcomeStore) {}

  async decide(
    workspaceId: string,
    outcomeId: string,
    input: { decision: 'approved' | 'rejected'; decidedById: string },
    at?: Date,
  ): Promise<GateOutcomeRecord> {
    const outcome = await this.store.find(workspaceId, outcomeId);
    if (!outcome) throw new NotFoundError(OPAQUE);
    if (outcome.humanDecision) {
      throw new ConflictError('This gate outcome is already decided — decisions are recorded once.');
    }
    if (outcome.gateFailed) {
      throw new ValidationFailedError(
        'This gate FAILED — a failed gate is not approvable (FR-ENH-016). Re-run the gate.',
      );
    }
    return this.store.fillDecision(workspaceId, outcomeId, {
      humanDecision: input.decision,
      decidedById: input.decidedById,
      decidedAt: at ?? new Date(),
      // FR-ENH-015 — what the approval stepped past. Rejection overrides nothing.
      overriddenFindings: input.decision === 'approved' ? [...outcome.findings] : [],
    });
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryGateOutcomeStore implements GateOutcomeStore {
  private readonly rows = new Map<string, GateOutcomeRecord & { id: string }>();

  seed(id: string, outcome: GateOutcomeRecord): void {
    this.rows.set(id, { id, ...outcome });
  }

  stateOf(id: string): GateOutcomeRecord | undefined {
    return this.rows.get(id);
  }

  async find(workspaceId: string, id: string): Promise<GateOutcomeRecord | null> {
    const row = this.rows.get(id);
    return row && row.workspaceId === workspaceId ? { ...row } : null;
  }

  async fillDecision(
    workspaceId: string,
    id: string,
    decision: Pick<GateOutcomeRecord, 'humanDecision' | 'decidedById' | 'decidedAt' | 'overriddenFindings'>,
  ): Promise<GateOutcomeRecord> {
    const row = this.rows.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    // Mirrors the trigger: only an undecided row accepts the one-time fill.
    if (row.humanDecision) throw new ConflictError('Already decided.');
    const filled = { ...row, ...decision };
    this.rows.set(id, filled);
    return { ...filled };
  }
}
