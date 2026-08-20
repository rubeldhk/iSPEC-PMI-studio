/**
 * T118 — outstanding findings are surfaced before approval proceeds.
 * Written to FAIL before T122 exists (Constitution V).
 *
 * US6 scenario 3 / contract: `POST /specifications/{id}/approve` — "Returns
 * outstanding validation findings before proceeding". Approval is not blocked
 * by findings — the reviewer approves with eyes open — but the findings MUST
 * ride the response, never be discoverable-only.
 */
import { describe, expect, it, vi } from 'vitest';
import { ApprovalService, type OutstandingFindingsSource } from '../../../src/modules/specifications/approval.service.js';
import { InMemoryTransitionRecorder } from '../../../src/modules/specifications/lifecycle.machine.js';
import { InvalidLifecycleTransitionError } from '../../../src/core/errors.js';

const FINDINGS = [
  { location: 'section 3', severity: 'warning' as const, message: 'ambiguous' },
];

function source(findings = FINDINGS): OutstandingFindingsSource {
  return { outstandingFor: vi.fn(async () => findings) };
}

const SPEC = {
  workspaceId: 'ws_a',
  specificationId: 's1',
  currentVersionId: 'sv1',
};

describe('ApprovalService (US6 scenario 3)', () => {
  it('surfaces outstanding findings AND records review → approved', async () => {
    const recorder = new InMemoryTransitionRecorder();
    const svc = new ApprovalService(source(), recorder);
    const out = await svc.approve({ ...SPEC, currentState: 'review', actorId: 'u1' });

    expect(out.outstandingFindings).toEqual(FINDINGS);
    expect(out.transition).toMatchObject({
      fromState: 'review',
      toState: 'approved',
      actorId: 'u1',
    });
    expect(recorder.records).toHaveLength(1);
  });

  it('asks for the findings of the CURRENT version — the one being approved', async () => {
    const findings = source();
    const svc = new ApprovalService(findings, new InMemoryTransitionRecorder());
    await svc.approve({ ...SPEC, currentState: 'review', actorId: 'u1' });
    expect(findings.outstandingFor).toHaveBeenCalledWith('ws_a', 'sv1');
  });

  it('no findings → an empty list, still present in the response', async () => {
    const svc = new ApprovalService(source([]), new InMemoryTransitionRecorder());
    const out = await svc.approve({ ...SPEC, currentState: 'review', actorId: 'u1' });
    expect(out.outstandingFindings).toEqual([]);
  });

  it('approval from any state but review is refused BEFORE findings are fetched', async () => {
    const findings = source();
    const recorder = new InMemoryTransitionRecorder();
    const svc = new ApprovalService(findings, recorder);
    await expect(
      svc.approve({ ...SPEC, currentState: 'draft', actorId: 'u1' }),
    ).rejects.toBeInstanceOf(InvalidLifecycleTransitionError);
    expect(findings.outstandingFor).not.toHaveBeenCalled();
    expect(recorder.records).toHaveLength(0);
  });
});
