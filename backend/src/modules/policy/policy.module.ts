/**
 * `T1199` (EPIC-031, scoped) — binding the policy provider.
 *
 * The seam `DEF-033-002` found unbound. `ROOM_PORTS` marks `PolicyProvider`
 * `absent: 'refuse'`, and nothing had ever registered one, so every requirement
 * decision refused before it was recorded.
 *
 * ## What "authorized" means in this slice, stated rather than implied
 *
 * `FR-DPE-010` says the high band requires **authorized human approval**. There
 * is no per-action authority model to consult: `EPIC-024`'s grants are
 * `read | edit` on artifacts, and building a workspace-role model was explicitly
 * excluded from this work. So *authorized* here means **an authenticated human
 * acting inside their own workspace** — which `WorkspaceBoundaryService` has
 * already resolved, and which `DecisionService` has already required to be human
 * (`RULE-03`) before policy is consulted.
 *
 * That is a real limitation and it is recorded on the task, not hidden here. It
 * is also not a permissive default: automation is refused, the irreducible floor
 * (`FR-DPE-012`) still applies, an unevaluated gate still refuses
 * (`FR-DPE-013`), and self-approval still refuses unless policy permits it
 * (`FR-DPE-015`).
 *
 * ## The rule source
 *
 * `FR-DPE-005` places classification rules in the `BR-0070` steering system.
 * Reading them from steering is the rest of `EPIC-031`; until then this binds a
 * source that declares **none**, which `FR-DPE-004` turns into the most
 * restrictive band for everything. An empty policy is therefore safe, which is
 * the property that requirement exists to guarantee.
 */
import { Module } from '@nestjs/common';
import {
  BandedPolicyProvider,
  type ClassificationRuleSource,
  type PolicyDecisionRequest,
  type PolicyDecisionResult,
} from './banded-policy.provider.js';
import type { ClassificationRule } from './classification.js';

export const CLASSIFICATION_RULES = Symbol('CLASSIFICATION_RULES');
export const POLICY_PROVIDER = Symbol('POLICY_PROVIDER');

/**
 * No rules declared.
 *
 * Deliberately a real object rather than an absent binding: an absent provider
 * refuses at the seam and tells a user nothing, which is exactly what
 * `DEF-033-002` was raised about. This one classifies — and classifies
 * everything as high, because that is what `FR-DPE-004` says an unmatched action
 * is.
 */
export class NoDeclaredRules implements ClassificationRuleSource {
  async rulesFor(_scopePath: string): Promise<readonly ClassificationRule[]> {
    return [];
  }
}

/**
 * Adapts the banded provider to `EPIC-030`'s one-argument port.
 *
 * The port carries no workspace, so the scope path is derived from the object's
 * own identity. `/org` until steering supplies a real lineage — which keeps
 * every rule an organization-wide declaration for now, and is why
 * `NoDeclaredRules` is the honest source to pair it with.
 */
export class LoopPolicyAdapter {
  constructor(private readonly policy: BandedPolicyProvider) {}

  async decide(request: PolicyDecisionRequest): Promise<PolicyDecisionResult> {
    return this.policy.decide(request, { scopePath: '/org' });
  }
}

@Module({
  providers: [
    { provide: CLASSIFICATION_RULES, useFactory: (): ClassificationRuleSource => new NoDeclaredRules() },
    {
      provide: POLICY_PROVIDER,
      inject: [CLASSIFICATION_RULES],
      useFactory: (rules: ClassificationRuleSource): LoopPolicyAdapter =>
        new LoopPolicyAdapter(new BandedPolicyProvider(rules)),
    },
  ],
  exports: [POLICY_PROVIDER, CLASSIFICATION_RULES],
})
export class PolicyModule {}
