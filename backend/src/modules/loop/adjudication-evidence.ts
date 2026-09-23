/**
 * T1096 (EPIC-030 C2A closure) — serialisation between a verdict and its row.
 *
 * One place, used by **both** the Prisma adapter and every test double, so the
 * round-trip under test is the round-trip that runs. Two separate mappings
 * would let the doubles agree with the tests and disagree with the database,
 * which is the shape of a green suite over a broken system.
 *
 * ## Why deserialisation validates
 *
 * The verdict type is a closed discriminated union: `applied` requires a
 * transition id, `refused` requires a stage and a reason code, and a non-applied
 * verdict may not carry a transition id at all. A row is just columns, and any
 * column can be null. {@link verdictFromRow} is where those columns become a
 * type again, so it is the only place that can reintroduce a combination the
 * union forbids — and it refuses instead.
 *
 * The database enforces the same invariants with CHECK constraints
 * (`20260825120000_epic030_adjudication_refusal`). Both, deliberately: the
 * constraint stops a bad row being written by anything, and this stops a bad row
 * already present from becoming an impossible object.
 */
import {
  isRefusalReasonCode,
  REFUSAL_STAGE_OF,
  type AdjudicationVerdict,
  type ReconciliationCause,
} from '@pmi/loop-contract';
import type { AdjudicationEvidenceInput } from './adjudicator.service.js';

/** The persisted shape — one field per `adjudication_records` column. */
export interface AdjudicationEvidenceRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly proposalId: string;
  readonly executionId: string;
  readonly specificationId: string;
  readonly idempotencyKey: string;
  readonly expectedStatus: string;
  readonly requestedStatus: string;
  readonly verdict: string;
  readonly reason: string;
  readonly proposerId: string;
  readonly proposerType: string;
  readonly proposerSnapshotId: string;
  readonly approverId?: string | null;
  readonly approverSnapshotId?: string | null;
  readonly appliedTransitionId?: string | null;
  readonly refusalStage?: string | null;
  readonly refusalReasonCode?: string | null;
  readonly requiredApproverRole?: string | null;
  readonly observedStatus?: string | null;
  readonly reconciliationCause?: string | null;
  readonly reconciliationDetail?: string | null;
  readonly correlationId: string;
  readonly causationId: string;
  readonly decidedAt: Date | string;
}

/** Columns to write, derived from a verdict the adjudicator just decided. */
export function rowFromEvidence(
  input: AdjudicationEvidenceInput,
  id: string,
): AdjudicationEvidenceRow {
  const p = input.proposal;
  return {
    id,
    workspaceId: p.workspaceId,
    proposalId: p.proposalId,
    executionId: p.executionId,
    specificationId: p.specificationId,
    idempotencyKey: p.idempotencyKey,
    expectedStatus: p.expectedCurrentStatus,
    requestedStatus: p.requestedStatus,
    verdict: input.verdict,
    reason: input.reason,
    proposerId: p.proposerId,
    proposerType: p.proposerType,
    proposerSnapshotId: p.proposerIdentitySnapshotId,
    appliedTransitionId: input.appliedTransitionId ?? null,
    refusalStage: input.refusalStage ?? null,
    refusalReasonCode: input.refusalReasonCode ?? null,
    requiredApproverRole: input.requiredApproverRole ?? null,
    observedStatus: input.observedStatus ?? null,
    reconciliationCause: input.reconciliationCause ?? null,
    reconciliationDetail: input.reconciliationDetail ?? null,
    correlationId: p.correlationId,
    causationId: p.causationId,
    decidedAt: p.proposedAt,
  };
}

export class MalformedAdjudicationRow extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedAdjudicationRow';
  }
}

function iso(at: Date | string): string {
  return at instanceof Date ? at.toISOString() : at;
}

function required(row: AdjudicationEvidenceRow, field: string, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new MalformedAdjudicationRow(
      `Row ${row.id} has verdict "${row.verdict}" but no ${field}. ` +
        'The verdict type requires it, so this row cannot become a verdict.',
    );
  }
  return value;
}

/** Rehydrate a row into the closed union, refusing anything the union forbids. */
export function verdictFromRow(row: AdjudicationEvidenceRow): AdjudicationVerdict {
  const base = {
    proposalId: row.proposalId,
    reason: row.reason,
    decidedAt: iso(row.decidedAt),
    adjudicationRecordId: row.id,
  };

  // A transition id on anything other than `applied` is the exact combination
  // the union was introduced to make unconstructible. Refuse it here too.
  if (row.verdict !== 'applied' && row.appliedTransitionId) {
    throw new MalformedAdjudicationRow(
      `Row ${row.id} has verdict "${row.verdict}" and an appliedTransitionId. ` +
        'Only `applied` may carry one.',
    );
  }

  switch (row.verdict) {
    case 'validated':
      return { ...base, verdict: 'validated' };

    case 'applied':
      return {
        ...base,
        verdict: 'applied',
        appliedTransitionId: required(row, 'appliedTransitionId', row.appliedTransitionId),
      };

    case 'approval_required':
      return {
        ...base,
        verdict: 'approval_required',
        requiredApproverRole: required(row, 'requiredApproverRole', row.requiredApproverRole),
      };

    case 'refused': {
      const code = required(row, 'refusalReasonCode', row.refusalReasonCode);
      if (!isRefusalReasonCode(code)) {
        throw new MalformedAdjudicationRow(
          `Row ${row.id} carries refusalReasonCode "${code}", which is not in the vocabulary.`,
        );
      }
      // The stage is derived, never trusted from the row: a stored stage that
      // disagreed with its code would put event selection back to guessing.
      return {
        ...base,
        verdict: 'refused',
        refusalStage: REFUSAL_STAGE_OF[code],
        refusalReasonCode: code,
      };
    }

    case 'inconsistent':
      return {
        ...base,
        verdict: 'inconsistent',
        mismatch: {
          expectedStatus: row.expectedStatus,
          observedStatus: required(row, 'observedStatus', row.observedStatus),
        },
      };

    case 'reconciliation_required':
      return {
        ...base,
        verdict: 'reconciliation_required',
        reconciliation: {
          cause: required(row, 'reconciliationCause', row.reconciliationCause) as ReconciliationCause,
          detail: row.reconciliationDetail ?? row.reason,
        },
      };

    default:
      throw new MalformedAdjudicationRow(
        `Row ${row.id} carries verdict "${row.verdict}", which is not one of the six.`,
      );
  }
}
