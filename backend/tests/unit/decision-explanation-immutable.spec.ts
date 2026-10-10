/**
 * T768 — explanations are stored, never recomputed. `FR-DPE-044`, `FR-DPE-006`,
 * `R-031-8`.
 *
 * A decision retains the policy version and the rule version that produced it.
 * When the policy or the rule changes afterwards, a past decision reads exactly
 * as it was decided — its class and its explanation do not move.
 */
import { describe, expect, it } from 'vitest';
import type { ClassificationRule, ResolvedRuleset } from '@pmi/decision-contract';
import { InMemoryDecisionRepository } from '../../src/modules/decision/decision.repository.js';
import { PLATFORM_DEFAULT_POLICY, type TenantPolicyDocument } from '../../src/modules/decision/policy.loader.js';
import { engine, request } from '../helpers/decision-engine.js';

describe('T768 · FR-DPE-044 — a later change does not rewrite a past explanation', () => {
  it('keeps the class, the rule version and the policy version a decision was taken under', async () => {
    let ruleset: ResolvedRuleset = {
      rules: [{ actionPattern: 'deploy', band: 'low' } as ClassificationRule],
      source: { lineageId: 'lin', version: 1 },
    };
    let current: TenantPolicyDocument = { ...PLATFORM_DEFAULT_POLICY, version: 1, approvedBy: 'owner' };
    const repository = new InMemoryDecisionRepository();
    const { engine: e } = engine({
      repository,
      steering: { rulesetFor: async () => ruleset },
      policies: { current: async () => current },
    });

    const first = await e.decide(request());

    // The rule is tightened and the policy re-issued — after the fact.
    ruleset = { rules: [{ actionPattern: 'deploy', band: 'high' }], source: { lineageId: 'lin', version: 2 } };
    current = { ...current, version: 2 };
    await e.decide(request());

    const stored = await repository.get('ws_dpe', first.decisionId);
    expect(stored).toMatchObject({ effectiveClass: 'low', policyVersion: 1, steeringVersions: { lin: 1 } });
    const { id: _storedId, ...storedExplanation } = stored!.explanation;
    expect(storedExplanation).toEqual(first.explanation);
  });
});
