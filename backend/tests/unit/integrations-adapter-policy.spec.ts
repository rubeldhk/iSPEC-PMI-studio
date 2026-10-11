/**
 * `T2211` (EPIC-039, `R-039-7`) — `CapabilityPolicy` over `EPIC-031`'s decision
 * engine.
 *
 * - Configuring an adapter asks `DecisionEngine.decide` once per configuration
 *   version: `actionType: 'integration.adapter.use.<Capability>'`, target
 *   `{ type: 'project-capability-configuration', id }`, `objectVersion:
 *   String(configVersion)`, `requiredGates: []`, the owner as actor and
 *   requester (so `FR-DPE-015` refuses self-approval unless policy says so).
 * - The status is read at every resolution through `resolutionOf` — derived,
 *   never cached: `approved`/`auto-executed` → permitted, `pending` → pending
 *   (`policy-pending`), `refused` → not-permitted (`policy-not-permitted`).
 * - The decision's `Explanation` is embedded verbatim (`BR-0174`).
 * - Fail closed: a decision EPIC-031 cannot find is a fault, and `exception`
 *   (unreachable with no gates) is never read as permitted.
 */
import { describe, expect, it } from 'vitest';
import type { DecisionOutcome, DecisionRequest, Explanation } from '@pmi/decision-contract';
import {
  CAPABILITY_ACTION_PREFIX,
  CONFIGURATION_TARGET_TYPE,
  decisionCapabilityPolicy,
  type PolicyDecisionReader,
} from '../../src/modules/integrations/policy/capability-policy.adapter.js';

const EXPLANATION: Explanation = {
  policyVersion: '3',
  matchedRule: { lineageId: 'risk-classification:org', version: 2 },
  riskClass: 'high',
  authorityApplied: 'human approval by a workspace owner',
};

interface Row {
  readonly outcome: DecisionOutcome;
  readonly explanation: Explanation & { readonly id: string };
}

function engine() {
  const asked: DecisionRequest[] = [];
  const rows = new Map<string, Row>();
  const resolutions = new Map<string, Row>();
  let n = 0;
  return {
    asked,
    rows,
    resolutions,
    decide: async (request: DecisionRequest) => {
      asked.push(request);
      const decisionId = `dec_${++n}`;
      rows.set(decisionId, { outcome: 'pending', explanation: { ...EXPLANATION, id: `exp_${n}` } });
      return { decisionId };
    },
    reader: {
      get: async (_ws: string, id: string) => rows.get(id) ?? null,
      resolutionOf: async (_ws: string, id: string) => resolutions.get(id) ?? null,
    } satisfies PolicyDecisionReader,
  };
}

const REQUEST = { workspaceId: 'ws_1', projectId: 'prj_1', actorId: 'u_owner', capability: 'ReadBuildStatus', configurationId: 'cfg_1', configVersion: 3 };

describe('T2211 · requesting a decision when a project configures an adapter', () => {
  it('asks EPIC-031 once, with the action, target, version and no gates of R-039-7', async () => {
    const e = engine();
    const policy = decisionCapabilityPolicy(e, e.reader);
    const { decisionId } = await policy.requestDecision(REQUEST);
    expect(decisionId).toBe('dec_1');
    expect(e.asked).toHaveLength(1);
    expect(e.asked[0]).toEqual({
      workspaceId: 'ws_1',
      projectId: 'prj_1',
      actionType: 'integration.adapter.use.ReadBuildStatus',
      target: { type: 'project-capability-configuration', id: 'cfg_1' },
      objectVersion: '3',
      actor: { kind: 'human', id: 'u_owner' },
      requestedBy: 'u_owner',
      requiredGates: [],
    });
    expect(CAPABILITY_ACTION_PREFIX).toBe('integration.adapter.use.');
    expect(CONFIGURATION_TARGET_TYPE).toBe('project-capability-configuration');
  });

  it('proposes no class — policy classifies, the Hub never assigns (FR-DPE-003)', async () => {
    const e = engine();
    await decisionCapabilityPolicy(e, e.reader).requestDecision({ ...REQUEST, capability: 'SendNotification' });
    expect(e.asked[0]!.proposedClass).toBeUndefined();
    expect(e.asked[0]!.actionType).toBe('integration.adapter.use.SendNotification');
  });
});

describe('T2211 · reading the status at resolution — derived, never cached', () => {
  it.each([
    ['auto-executed', 'permitted'],
    ['approved', 'permitted'],
    ['pending', 'pending'],
    ['refused', 'not-permitted'],
  ] as const)('a decision that is %s reads %s', async (outcome, status) => {
    const e = engine();
    const policy = decisionCapabilityPolicy(e, e.reader);
    const { decisionId } = await policy.requestDecision(REQUEST);
    e.rows.set(decisionId, { outcome, explanation: { ...EXPLANATION, id: 'exp_x' } });
    expect((await policy.statusOf('ws_1', decisionId)).status).toBe(status);
  });

  it('follows the decision that resolved a pending one, and a later refusal takes effect on the next read', async () => {
    const e = engine();
    const policy = decisionCapabilityPolicy(e, e.reader);
    const { decisionId } = await policy.requestDecision(REQUEST);
    expect((await policy.statusOf('ws_1', decisionId)).status).toBe('pending');
    e.resolutions.set(decisionId, { outcome: 'approved', explanation: { ...EXPLANATION, id: 'exp_ok', authorityApplied: 'approved by u_reviewer' } });
    expect((await policy.statusOf('ws_1', decisionId)).status).toBe('permitted');
    e.resolutions.set(decisionId, { outcome: 'refused', explanation: { ...EXPLANATION, id: 'exp_no', authorityApplied: 'withdrawn' } });
    expect((await policy.statusOf('ws_1', decisionId)).status).toBe('not-permitted');
  });

  it("embeds the deciding row's Explanation verbatim (BR-0174)", async () => {
    const e = engine();
    const policy = decisionCapabilityPolicy(e, e.reader);
    const { decisionId } = await policy.requestDecision(REQUEST);
    const resolving = { ...EXPLANATION, id: 'exp_r', authorityApplied: 'approved by u_reviewer' };
    e.resolutions.set(decisionId, { outcome: 'approved', explanation: resolving });
    expect((await policy.statusOf('ws_1', decisionId)).explanation).toEqual(resolving);
    const pendingOne = await policy.requestDecision({ ...REQUEST, configVersion: 4 });
    expect((await policy.statusOf('ws_1', pendingOne.decisionId)).explanation).toEqual({ ...EXPLANATION, id: 'exp_2' });
  });

  it('fails closed: a decision EPIC-031 cannot find is a fault, never pending', async () => {
    const e = engine();
    await expect(decisionCapabilityPolicy(e, e.reader).statusOf('ws_1', 'dec_lost')).rejects.toThrow(/dec_lost/);
  });

  it('fails closed: an exception outcome is never read as permitted', async () => {
    const e = engine();
    const policy = decisionCapabilityPolicy(e, e.reader);
    const { decisionId } = await policy.requestDecision(REQUEST);
    e.rows.set(decisionId, { outcome: 'exception', explanation: { ...EXPLANATION, id: 'exp_e' } });
    expect((await policy.statusOf('ws_1', decisionId)).status).toBe('not-permitted');
  });
});
