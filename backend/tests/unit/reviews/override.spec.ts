/**
 * T289 — approval over outstanding findings records the approver AND the
 * overridden findings (FR-ENH-015). Written to FAIL before T290 exists.
 */
import { describe, expect, it } from 'vitest';
import {
  GateDecisionService,
  InMemoryGateOutcomeStore,
} from '../../../src/modules/reviews/gate-decision.service.js';

const WS = 'ws_a';

const FINDING = {
  roleId: 'security-reviewer',
  location: 'section:auth',
  severity: 'error' as const,
  message: 'Plaintext password.',
};

function build(outcome: {
  gateFailed?: boolean;
  findings?: (typeof FINDING)[];
}): { service: GateDecisionService; store: InMemoryGateOutcomeStore } {
  const store = new InMemoryGateOutcomeStore();
  store.seed('go1', {
    workspaceId: WS,
    specificationId: 's1',
    gateId: 'g1',
    rolesRun: [{ roleId: 'security-reviewer', status: 'completed' }],
    findings: outcome.findings ?? [],
    gateFailed: outcome.gateFailed ?? false,
  });
  return { store, service: new GateDecisionService(store) };
}

describe('T289 · the human decision path (FR-ENH-014/015)', () => {
  it('approval over outstanding findings records approver, time, and the OVERRIDDEN findings', async () => {
    const { service, store } = build({ findings: [FINDING] });
    const at = new Date('2026-08-20T15:00:00Z');
    const decided = await service.decide(WS, 'go1', { decision: 'approved', decidedById: 'u_lead' }, at);

    expect(decided.humanDecision).toBe('approved');
    expect(decided.decidedById).toBe('u_lead');
    expect(decided.decidedAt).toEqual(at);
    expect(decided.overriddenFindings).toEqual([FINDING]);

    const stored = store.stateOf('go1');
    expect(stored?.overriddenFindings).toEqual([FINDING]);
  });

  it('approval with NO findings overrides nothing — an empty list, not a fabricated one', async () => {
    const { service } = build({ findings: [] });
    const decided = await service.decide(WS, 'go1', { decision: 'approved', decidedById: 'u_lead' });
    expect(decided.overriddenFindings).toEqual([]);
  });

  it('rejection records the decision without overriding findings', async () => {
    const { service } = build({ findings: [FINDING] });
    const decided = await service.decide(WS, 'go1', { decision: 'rejected', decidedById: 'u_lead' });
    expect(decided.humanDecision).toBe('rejected');
    expect(decided.overriddenFindings).toEqual([]);
  });

  it('the decision is write-once — a second decision is refused, the record never rewritten', async () => {
    const { service } = build({ findings: [FINDING] });
    await service.decide(WS, 'go1', { decision: 'approved', decidedById: 'u_lead' });
    await expect(
      service.decide(WS, 'go1', { decision: 'rejected', decidedById: 'u_other' }),
    ).rejects.toThrow(/decided|once/i);
  });

  it('deciding a FAILED gate is refused — failure is not approvable (E-R3)', async () => {
    const { service } = build({ gateFailed: true });
    await expect(
      service.decide(WS, 'go1', { decision: 'approved', decidedById: 'u_lead' }),
    ).rejects.toThrow(/failed/i);
  });

  it('cross-workspace decision is an opaque refusal', async () => {
    const { service } = build({});
    await expect(
      service.decide('ws_b', 'go1', { decision: 'approved', decidedById: 'u9' }),
    ).rejects.toThrow();
  });
});
