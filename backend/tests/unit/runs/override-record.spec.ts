/**
 * T349 — the override records approver, time, and the SPECIFIC items
 * accepted, making every override attributable (FR-RUN-005b, SC-005a).
 */
import { describe, expect, it } from 'vitest';
import { WS, OWNER, harness, startUnattended, ask } from '../review/helpers.js';

const SPEC = { artifactType: 'specification', artifactId: 'spec_1' };

describe('T349 · the override record', () => {
  it('records approver, time, and the specific items accepted', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q1, q2] = await ask(h, run.id, 2);
    await h.provisional.mark(WS, SPEC, q1!.id);
    await h.provisional.mark(WS, SPEC, q2!.id);

    const when = new Date('2026-08-21T10:00:00Z');
    const { override } = await h.approval.approve(
      WS,
      { approvalRef: 'appr_1', artifact: SPEC, approverId: OWNER, acceptProvisionalItems: true },
      when,
    );

    expect(override!.approverId).toBe(OWNER);
    expect(override!.approvedAt).toEqual(when);
    expect(override!.itemsAccepted.map((i) => i.questionId).sort()).toEqual([q1!.id, q2!.id].sort());
    expect(override!.approvalRef).toBe('appr_1');
  });

  it('every override is retrievable by its approval — the record is permanent', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    await h.provisional.mark(WS, SPEC, q!.id);
    await h.approval.approve(WS, {
      approvalRef: 'appr_2',
      artifact: SPEC,
      approverId: OWNER,
      acceptProvisionalItems: true,
    });
    const stored = await h.overrides.listForApproval(WS, 'appr_2');
    expect(stored).toHaveLength(1);
    expect(stored[0]!.approverId).toBe(OWNER);
    expect(stored[0]!.itemsAccepted).toHaveLength(1);
  });

  it('accepts only what was provisional at approval time — the item set is exact', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q1, q2] = await ask(h, run.id, 2);
    await h.provisional.mark(WS, SPEC, q1!.id);
    await h.provisional.mark(WS, SPEC, q2!.id);
    // q1 answered before approval — its marking cleared, so it is NOT accepted.
    await h.provisional.clearForQuestion(WS, q1!.id);

    const { override } = await h.approval.approve(WS, {
      approvalRef: 'appr_3',
      artifact: SPEC,
      approverId: OWNER,
      acceptProvisionalItems: true,
    });
    expect(override!.itemsAccepted.map((i) => i.questionId)).toEqual([q2!.id]);
  });
});
