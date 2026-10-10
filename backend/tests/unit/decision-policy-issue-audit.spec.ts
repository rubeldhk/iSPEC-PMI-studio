/**
 * T796b — an attempt to issue a tenant policy is visible, refused or not.
 * `FR-DPE-012`, spec edge case *"A tenant sets every action to low risk — the
 * high band is unreachable, and the attempt itself is visible"*.
 *
 * The load-time fence already refuses the policy. What it did not do was leave
 * a trace: a refused `POST /decision-policies` threw and recorded nothing, so a
 * tenant probing the fence was indistinguishable from one that never tried. The
 * issued policies are their own version history; the refused ones have no row
 * there to occupy, so they go to `EPIC-004`'s audit log beside the decisions.
 */
import { describe, expect, it } from 'vitest';
import type { AuditRecordInput } from '../../src/modules/audit/audit.service.js';
import { ValidationFailedError } from '../../src/core/errors.js';
import { DecisionService } from '../../src/modules/decision/decision.service.js';
import { RepositoryPolicySource } from '../../src/modules/decision/adapters.js';
import { engine, WS } from '../helpers/decision-engine.js';

class RecordingAuditService {
  readonly entries: AuditRecordInput[] = [];
  async record(input: AuditRecordInput): Promise<void> {
    this.entries.push(input);
  }
}

function scene() {
  const harness = engine();
  const audit = new RecordingAuditService();
  const service = new DecisionService(harness.engine, harness.repository, new RepositoryPolicySource(harness.repository), audit);
  return { service, audit, repository: harness.repository };
}

const principal = { workspaceId: WS, userId: 'u_owner' };
const everythingLow = {
  bandTreatment: { low: 'auto-execute', medium: 'auto-execute', high: 'auto-execute' },
  selfApprovalAllowed: [],
  automatedActions: [],
};

describe('T796b · a refused policy attempt leaves a record', () => {
  it('refuses a policy that sets every band to auto-execute, and audits the attempt naming the fence', async () => {
    const { service, audit, repository } = scene();
    await expect(service.issuePolicy(principal, everythingLow)).rejects.toBeInstanceOf(ValidationFailedError);
    expect(await repository.latestPolicy(WS)).toBeNull();
    expect(audit.entries).toEqual([
      expect.objectContaining({
        workspaceId: WS,
        actorId: 'u_owner',
        action: 'create',
        targetType: 'tenant_policy',
        targetId: 'v1',
        outcome: 'refused',
        detail: expect.objectContaining({ reason: 'lowers-high-band' }),
      }),
    ]);
  });

  it('audits an issued policy too, so the log reads both halves of the history', async () => {
    const { service, audit } = scene();
    await service.issuePolicy(principal, {
      bandTreatment: { low: 'auto-execute', medium: 'gates-required', high: 'human-approval' },
      selfApprovalAllowed: [],
      automatedActions: [],
    });
    expect(audit.entries).toEqual([
      expect.objectContaining({ targetType: 'tenant_policy', targetId: 'v1', outcome: 'success', actorId: 'u_owner' }),
    ]);
  });
});
