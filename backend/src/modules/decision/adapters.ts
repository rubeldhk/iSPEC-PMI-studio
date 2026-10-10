/**
 * `EPIC-031` — two ports bound to what the platform already has.
 *
 * - `AuditSink` → `EPIC-004`'s `AuditService`. Its action vocabulary is fixed,
 *   so a decision is recorded as a `create` of a `policy_decision`, with the
 *   decision's own outcome in `detail`; a refused decision, and a refused
 *   approval or closure attempt (`FR-DPE-017`), is audited as `refused`. Nothing is added to `EPIC-004`'s vocabulary.
 * - `PolicySource` → the workspace's latest issued `TenantPolicy`, **validated
 *   again on every read** by `loadPolicy`, so a row that would not load today
 *   refuses rather than governs. With none issued, the platform default.
 */
import type { AuditSink, DecisionAuditEntry } from '@pmi/decision-contract';
import type { AuditRecordInput } from '../audit/audit.service.js';
import type { DecisionRepository } from './decision.repository.js';
import { PLATFORM_DEFAULT_POLICY, loadPolicy, type PolicySource, type TenantPolicyDocument } from './policy.loader.js';

/** The slice of `AuditService` the adapter calls. */
export interface AuditRecorder {
  record(input: AuditRecordInput): Promise<void>;
}

export class AuditServiceSink implements AuditSink {
  constructor(private readonly audit: AuditRecorder) {}

  async record(entry: DecisionAuditEntry): Promise<void> {
    await this.audit.record({
      workspaceId: entry.workspaceId,
      actorId: entry.actor,
      action: 'create',
      targetType: 'policy_decision',
      targetId: entry.decisionId,
      outcome: ['refused', 'approval-refused', 'closure-refused'].includes(entry.outcome) ? 'refused' : 'success',
      detail: { actionType: entry.actionType, decisionOutcome: entry.outcome },
    });
  }
}

export class RepositoryPolicySource implements PolicySource {
  constructor(private readonly repository: DecisionRepository) {}

  async current(workspaceId: string): Promise<TenantPolicyDocument> {
    const issued = await this.repository.latestPolicy(workspaceId);
    if (issued === null) return PLATFORM_DEFAULT_POLICY;
    const loaded = loadPolicy(issued);
    if (!loaded.ok) {
      throw new Error(`policy v${issued.version} for this workspace no longer loads — ${loaded.message}`);
    }
    return loaded.policy;
  }
}
