/**
 * T028 — append-only audit service.
 *
 * FR-033 / SC-012. Deliberately has NO update or delete method: an audit trail
 * that can be edited is not an audit trail. The database enforces the same rule
 * with a trigger (specs/_shared/schema.sql) — belt and braces is justified here.
 *
 * Framework-free (PC-1).
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'lifecycle_transition'
  | 'engine_invocation'
  | 'access_refused';

export type AuditOutcome = 'success' | 'refused' | 'failed';

export interface AuditRecordInput {
  workspaceId: string;
  /** Null ONLY for an unauthenticated refusal. */
  actorId: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  outcome: AuditOutcome;
  detail?: Record<string, unknown>;
}

/** The narrow slice of persistence audit needs — a transaction can satisfy it. */
export interface AuditWriter {
  create(data: Record<string, unknown>): Promise<void>;
}

/**
 * Keys never persisted to audit detail.
 *
 * Engine output may carry customer requirements; credentials are credentials.
 * Research R-011 and contract rule E9 both forbid logging either.
 */
const REDACTED_KEYS = new Set([
  'secret',
  'password',
  'passwordHash',
  'token',
  'apiKey',
  'credential',
  'authorization',
  'contentRaw',
  'contentParsed',
  'diagnostics',
]);

function safeDetail(detail: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!detail) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (!REDACTED_KEYS.has(k)) out[k] = v;
  }
  return out;
}

export class AuditService {
  constructor(private readonly writer: AuditWriter) {}

  /**
   * Record an action.
   *
   * `tx` is the caller's transaction. Passing it is what makes the guarantee
   * real: the action and its audit entry commit or roll back together, so an
   * action cannot succeed without being recorded.
   */
  async record(input: AuditRecordInput, tx?: AuditWriter): Promise<void> {
    if (input.actorId === null && input.outcome !== 'refused') {
      throw new Error(
        'An actor is required unless the outcome is a refusal (unauthenticated access).',
      );
    }

    const row: Record<string, unknown> = {
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      outcome: input.outcome,
      occurredAt: new Date(),
    };
    if (input.targetId !== undefined) row['targetId'] = input.targetId;
    const detail = safeDetail(input.detail);
    if (detail && Object.keys(detail).length > 0) row['detail'] = detail;

    await (tx ?? this.writer).create(row);
  }
}
