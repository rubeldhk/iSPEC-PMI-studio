/**
 * T796a — a decision is retrievable **from the object** it concerns.
 * `FR-DPE-024`, `US3/AC5`.
 *
 * The Inbox drops a decided item (`FR-DPE-022`); what it must not drop is the
 * decision. Until this, a decision could be read back only by its own id —
 * which a caller holding the object does not have. So: every decision taken on
 * an object, oldest first, each with its stored explanation and the decision
 * that resolved it, scoped to the reader's workspace.
 */
import { describe, expect, it } from 'vitest';
import { DecisionService } from '../../src/modules/decision/decision.service.js';
import { engine, policy, request, rules, WS } from '../helpers/decision-engine.js';

const human = (id: string) => ({ kind: 'human' as const, id });

async function scene() {
  const harness = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }]) });
  const service = new DecisionService(harness.engine, harness.repository, policy());
  const pending = await harness.engine.decide(
    request({ actionType: 'release.promote', requestedBy: 'u_alice', actor: human('u_alice') }),
  );
  const approval = await harness.engine.approve({ workspaceId: WS, decisionId: pending.decisionId, approver: human('u_bob') });
  const auto = await harness.engine.decide(request({ actionType: 'deploy', requestedBy: 'u_alice', actor: human('u_alice') }));
  const elsewhere = await harness.engine.decide(request({ target: { type: 'service', id: 'svc-2' } }));
  const otherWorkspace = await harness.engine.decide(request({ workspaceId: 'ws_other' }));
  return { service, pending, approval, auto, elsewhere, otherWorkspace };
}

describe('T796a · FR-DPE-024 — the decision stays retrievable from the object', () => {
  it('returns every decision on the object, oldest first, with its stored explanation', async () => {
    const { service, pending, approval, auto } = await scene();
    const { decisions } = await service.forObject({ workspaceId: WS, userId: 'u_carol' }, 'service', 'svc-1');
    expect(decisions.map((d) => d.decisionId)).toEqual([pending.decisionId, approval.decisionId, auto.decisionId]);
    expect(decisions[0]).toMatchObject({
      actionType: 'release.promote',
      outcome: 'pending',
      effectiveClass: 'high',
      objectVersion: '7',
      resolvedBy: approval.decisionId,
      explanation: expect.objectContaining({ riskClass: 'high' }),
    });
    expect(decisions[1]).toMatchObject({ outcome: 'approved', resolves: pending.decisionId, resolvedBy: null });
  });

  it('does not return another object’s decisions, or another workspace’s', async () => {
    const { service, elsewhere, otherWorkspace } = await scene();
    const ids = (await service.forObject({ workspaceId: WS, userId: 'u_carol' }, 'service', 'svc-1')).decisions.map(
      (d) => d.decisionId,
    );
    expect(ids).not.toContain(elsewhere.decisionId);
    expect(ids).not.toContain(otherWorkspace.decisionId);
  });

  it('answers an object nobody has decided on with an empty list, not a 404', async () => {
    const { service } = await scene();
    expect(await service.forObject({ workspaceId: WS, userId: 'u_carol' }, 'service', 'never')).toEqual({ decisions: [] });
  });
});
