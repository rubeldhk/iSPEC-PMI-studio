/**
 * T348 — approval of a provisional specification shows every provisional item
 * and refuses without explicit acceptance, so ZERO such specifications are
 * approved without an override (FR-RUN-005a, SC-005a).
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { WS, OWNER, harness, startUnattended, ask } from '../review/helpers.js';

const SPEC = { artifactType: 'specification', artifactId: 'spec_1' };

describe('T348 · the override-gated approval path', () => {
  it('refuses approval of a provisional specification without explicit acceptance, showing every item', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q1, q2] = await ask(h, run.id, 2);
    await h.provisional.mark(WS, SPEC, q1!.id);
    await h.provisional.mark(WS, SPEC, q2!.id);

    const attempt = h.approval.approve(WS, {
      approvalRef: 'appr_1',
      artifact: SPEC,
      approverId: OWNER,
    });
    await expect(attempt).rejects.toThrow(ValidationFailedError);
    // EVERY provisional item is shown — the approver decides with eyes open.
    const err = (await attempt.catch((e: unknown) => e)) as ValidationFailedError;
    const details = err.details as { provisionalItems: { questionId: string }[] };
    expect(details.provisionalItems.map((i) => i.questionId).sort()).toEqual([q1!.id, q2!.id].sort());
    // Zero overrides recorded — the refusal recorded nothing (SC-005a).
    expect(await h.overrides.listForApproval(WS, 'appr_1')).toHaveLength(0);
  });

  it('approves with explicit acceptance, recording an override', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    await h.provisional.mark(WS, SPEC, q!.id);

    const result = await h.approval.approve(WS, {
      approvalRef: 'appr_2',
      artifact: SPEC,
      approverId: OWNER,
      acceptProvisionalItems: true,
    });
    expect(result.approved).toBe(true);
    expect(result.override).not.toBeNull();
  });

  it('approves plainly when nothing is provisional — no override needed (FR-RUN-005c)', async () => {
    const h = harness();
    const result = await h.approval.approve(WS, {
      approvalRef: 'appr_3',
      artifact: { artifactType: 'specification', artifactId: 'clean_spec' },
      approverId: OWNER,
    });
    expect(result.approved).toBe(true);
    expect(result.override).toBeNull();
  });

  it('markings cleared by answers no longer gate approval', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const [q] = await ask(h, run.id, 1);
    await h.provisional.mark(WS, SPEC, q!.id);
    await h.provisional.clearForQuestion(WS, q!.id);
    const result = await h.approval.approve(WS, {
      approvalRef: 'appr_4',
      artifact: SPEC,
      approverId: OWNER,
    });
    expect(result.override).toBeNull();
  });
});
