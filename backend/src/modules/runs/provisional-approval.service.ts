/**
 * T351 — the override-gated approval path (FR-RUN-005a, FR-RUN-005b,
 * FR-RUN-005c, SC-005a).
 *
 * Approving a specification that still carries provisional markings is
 * warn-and-override, not blocked: the approver is shown EVERY provisional
 * item, and approval is refused without explicit acceptance of all of them.
 * When they accept, the override records who, when, and the specific items —
 * so every override is attributable, and zero provisional specifications are
 * approved without one. A specification with no provisional items approves
 * plainly (FR-RUN-005c — the ordinary approval gate is unchanged).
 */
import { ValidationFailedError } from '../../core/errors.js';
import type { ArtifactRef, ProvisionalService } from './provisional.service.js';

export interface ProvisionalItem extends ArtifactRef {
  questionId: string;
}

export interface OverrideRecord {
  id: string;
  workspaceId: string;
  /** The specification approval this override attaches to. */
  approvalRef: string;
  approverId: string;
  approvedAt: Date;
  itemsAccepted: ProvisionalItem[];
}

export interface OverrideStore {
  /** Append-only — the database trigger enforces the same rule raw. */
  append(record: Omit<OverrideRecord, 'id'>): Promise<OverrideRecord>;
  listForApproval(workspaceId: string, approvalRef: string): Promise<OverrideRecord[]>;
}

export interface ApproveProvisionalInput {
  approvalRef: string;
  artifact: ArtifactRef;
  approverId: string;
  /** Explicit acceptance — absent means the approver has not accepted. */
  acceptProvisionalItems?: boolean;
}

export interface ApprovalResult {
  approved: true;
  /** Null when nothing was provisional — no override was needed. */
  override: OverrideRecord | null;
}

export class ProvisionalApprovalService {
  constructor(
    private readonly provisional: ProvisionalService,
    private readonly overrides: OverrideStore,
  ) {}

  /** The provisional items an approver must see (FR-RUN-005a). */
  async provisionalItems(workspaceId: string, artifact: ArtifactRef): Promise<ProvisionalItem[]> {
    const markings = await this.provisional.markingsFor(workspaceId, artifact);
    return markings
      .filter((m) => m.clearedAt === null)
      .map((m) => ({
        artifactType: m.artifactType,
        artifactId: m.artifactId,
        questionId: m.questionId,
      }));
  }

  async approve(
    workspaceId: string,
    input: ApproveProvisionalInput,
    at?: Date,
  ): Promise<ApprovalResult> {
    const items = await this.provisionalItems(workspaceId, input.artifact);

    // FR-RUN-005c — a specification with nothing provisional approves plainly.
    if (items.length === 0) return { approved: true, override: null };

    // FR-RUN-005a — refused without explicit acceptance, SHOWING every item.
    if (input.acceptProvisionalItems !== true) {
      throw new ValidationFailedError(
        'This specification contains provisional items — approval requires explicitly accepting them.',
        { provisionalItems: items },
      );
    }

    // FR-RUN-005b / SC-005a — approver, time, and the specific items accepted.
    const override = await this.overrides.append({
      workspaceId,
      approvalRef: input.approvalRef,
      approverId: input.approverId,
      approvedAt: at ?? new Date(),
      itemsAccepted: items,
    });
    return { approved: true, override };
  }
}

// ------------------------------------------------------------- in-memory

export class InMemoryOverrideStore implements OverrideStore {
  private readonly rows: OverrideRecord[] = [];
  private seq = 0;

  async append(record: Omit<OverrideRecord, 'id'>): Promise<OverrideRecord> {
    const row: OverrideRecord = { id: `ovr_${++this.seq}`, ...record };
    this.rows.push(row);
    return { ...row };
  }

  async listForApproval(workspaceId: string, approvalRef: string): Promise<OverrideRecord[]> {
    return this.rows
      .filter((r) => r.workspaceId === workspaceId && r.approvalRef === approvalRef)
      .map((r) => ({ ...r }));
  }
}
