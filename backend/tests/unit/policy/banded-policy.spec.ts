/**
 * `T1198`, `T1199` (EPIC-031, scoped) — the banded policy provider.
 *
 * The assertions that matter are the refusals. A `PolicyProvider` that permits
 * when it is unsure is the exact failure `FR-GEL-062` and `ROOM_PORTS` were
 * written to prevent, and it would be invisible: indistinguishable at every call
 * site from a policy that said yes.
 */
import { describe, expect, it } from 'vitest';
import {
  BandedPolicyProvider,
  type ClassificationRuleSource,
  type GateSatisfactionSource,
} from '../../../src/modules/policy/banded-policy.provider.js';
import type { ClassificationRule } from '../../../src/modules/policy/classification.js';

const HUMAN = { kind: 'human' as const, id: 'u_1' };
const ROBOT = { kind: 'automation' as const, id: 'agent_1' };

const request = (actor: { kind: 'human' | 'automation'; id: string } = HUMAN, toStage = 'Decide') => ({
  object: { workflowType: 'requirement-room', objectId: 'ro_1' },
  toStage,
  actor,
});

const source = (rules: readonly ClassificationRule[] = []): ClassificationRuleSource => ({
  rulesFor: async () => rules,
});

const gates = (answer: boolean | null): GateSatisfactionSource => ({
  satisfiedFor: async () => answer,
});

const RULE = (band: 'low' | 'medium' | 'high'): ClassificationRule => ({
  actionType: 'requirement-room.decide',
  band,
  scopePath: '/org',
  declaredBy: 'steering-doc-1',
});

describe('T1198 · with nothing configured', () => {
  it('refuses automation', async () => {
    // Unclassified ⇒ high ⇒ authorized human. An agent is refused whatever it
    // claims, which is `RULE-03` arriving from the policy side.
    const policy = new BandedPolicyProvider(source());
    const result = await policy.decide(request(ROBOT), { scopePath: '/org/ws' });
    expect(result.permitted).toBe(false);
    expect(result.explanation).toMatch(/most restrictive/i);
    expect(result.explanation).toMatch(/automation/i);
  });

  it('permits an authorized human, and says the band it applied', async () => {
    const policy = new BandedPolicyProvider(source());
    const result = await policy.decide(request(), { scopePath: '/org/ws' });
    expect(result.permitted).toBe(true);
    expect(result.explanation).toMatch(/high band/i);
  });

  it('always returns a decision id, so the outcome can be recorded', async () => {
    // `FR-DPE-014` — every approval records actor, basis, version, decision and
    // time. The id is what the Room stores against it.
    const policy = new BandedPolicyProvider(source());
    const refused = await policy.decide(request(ROBOT), { scopePath: '/org/ws' });
    const permitted = await policy.decide(request(), { scopePath: '/org/ws' });
    expect(refused.decisionId).toMatch(/[0-9a-f-]{36}/);
    expect(permitted.decisionId).not.toBe(refused.decisionId);
  });
});

describe('T1198 · the medium band and unevaluated gates', () => {
  it('permits when the gates are satisfied', async () => {
    const policy = new BandedPolicyProvider(source([RULE('medium')]), gates(true));
    const result = await policy.decide(request(), { scopePath: '/org/ws' });
    expect(result.permitted).toBe(true);
  });

  it('refuses when a gate is unsatisfied', async () => {
    const policy = new BandedPolicyProvider(source([RULE('medium')]), gates(false));
    const result = await policy.decide(request(), { scopePath: '/org/ws' });
    expect(result.permitted).toBe(false);
    expect(result.explanation).toMatch(/unsatisfied/i);
  });

  it('refuses when the gates are UNEVALUATED, and says so distinctly', async () => {
    // `FR-DPE-013` — *"satisfied MUST NOT be reachable by omission"*. The
    // distinct wording matters: a reader must be able to tell "we checked and it
    // failed" from "nobody checked".
    const policy = new BandedPolicyProvider(source([RULE('medium')]), gates(null));
    const result = await policy.decide(request(), { scopePath: '/org/ws' });
    expect(result.permitted).toBe(false);
    expect(result.explanation).toMatch(/unevaluated/i);
  });

  it('refuses when there is no gate source at all', async () => {
    // The absent-provider case, which must behave like unevaluated rather than
    // like satisfied.
    const policy = new BandedPolicyProvider(source([RULE('medium')]));
    const result = await policy.decide(request(), { scopePath: '/org/ws' });
    expect(result.permitted).toBe(false);
  });
});

describe('T1198 · the low band', () => {
  it('permits, including automation', async () => {
    // The control that proves the band actually varies the outcome. Without it,
    // a provider that refused everything would satisfy every refusal above.
    const policy = new BandedPolicyProvider(source([RULE('low')]));
    const result = await policy.decide(request(ROBOT), { scopePath: '/org/ws' });
    expect(result.permitted).toBe(true);
    expect(result.explanation).toMatch(/low band/i);
  });
});

describe('T1198 · self-approval', () => {
  it('refuses an approver approving their own request', async () => {
    // `FR-DPE-015`.
    const policy = new BandedPolicyProvider(source([RULE('low')]));
    const result = await policy.decide(request(), {
      scopePath: '/org/ws',
      requestedBy: 'u_1',
    });
    expect(result.permitted).toBe(false);
    expect(result.explanation).toMatch(/cannot approve it/i);
  });

  it('permits it where policy says so, and SAYS the permission in the explanation', async () => {
    // The second half of `FR-DPE-015`, and the half usually dropped: the
    // permission must appear in the explanation, so a reader sees it was
    // deliberate rather than missed.
    const policy = new BandedPolicyProvider(source([RULE('low')]));
    const result = await policy.decide(request(), {
      scopePath: '/org/ws',
      requestedBy: 'u_1',
      selfApprovalPermitted: true,
    });
    expect(result.permitted).toBe(true);
    expect(result.explanation).toMatch(/explicitly permits self-approval/i);
  });

  it('does not treat a different requester as self-approval', async () => {
    const policy = new BandedPolicyProvider(source([RULE('low')]));
    const result = await policy.decide(request(), {
      scopePath: '/org/ws',
      requestedBy: 'u_someone_else',
    });
    expect(result.permitted).toBe(true);
    expect(result.explanation).not.toMatch(/self-approval/i);
  });
});

describe('T1198 · the irreducible floor reaches the provider', () => {
  it('refuses automation on a baseline however policy is declared', async () => {
    // `FR-DPE-012` — declared `low`, still high, still refused for automation.
    const policy = new BandedPolicyProvider(
      source([
        {
          actionType: 'requirement-room.baseline',
          band: 'low',
          scopePath: '/org/ws',
          declaredBy: 'steering-doc-1',
        },
      ]),
    );
    const result = await policy.decide(request(ROBOT, 'Baseline'), { scopePath: '/org/ws' });
    expect(result.permitted).toBe(false);
    expect(result.explanation).toMatch(/cannot be configured away/i);
  });
});
