/**
 * T743 — the high-band fence, under enumeration of every tenant-reachable
 * setting. `SC-DPE-001`, `FR-DPE-012`, `ADR-0025` constraint 1.
 *
 * *"Zero tenant-reachable policy configurations move a high-risk action out of
 * human approval — verified by enumerating the configuration surface, not by
 * inspecting defaults."*
 *
 * A tenant reaches four things: the treatment of each band, the action classes
 * where self-approval is permitted, the automated actions it allows, and the
 * classification rules in its steering. Every combination below is built, put
 * through `loadPolicy` exactly as `POST /decision-policies` does, and — where it
 * loads — used to decide every irreducibly-high action as a human and as
 * automation. The assertion: **none is ever taken without a human approving
 * it**. Configurations the loader refuses are counted, because a refusal at load
 * is the fence working.
 *
 * `T782`'s mutation proof targets this file.
 */
import { describe, expect, it } from 'vitest';
import type { ClassificationRule } from '@pmi/decision-contract';
import { IRREDUCIBLY_HIGH } from '../../src/modules/decision/classifier.js';
import { TREATMENTS, loadPolicy, type TenantPolicyDocument } from '../../src/modules/decision/policy.loader.js';
import { engine, request, rules } from '../helpers/decision-engine.js';

const TAKEN = new Set(['auto-executed', 'approved', 'exception']);

function* configurations() {
  for (const low of TREATMENTS)
    for (const medium of TREATMENTS)
      for (const high of TREATMENTS)
        for (const selfApprovalAllowed of [[], ['*'], ['release.*', 'loop.*', 'requirement-room.*'], IRREDUCIBLY_HIGH])
          for (const automatedActions of [
            [],
            [{ actionPattern: 'docs.publish', ruleId: 'R-docs' }],
            ...IRREDUCIBLY_HIGH.map((a) => [{ actionPattern: a, ruleId: 'R-x' }]),
            [{ actionPattern: 'release.*', ruleId: 'R-x' }],
          ])
            for (const lowering of [null, 'low', 'medium'] as const)
              yield {
                policy: { version: 1, approvedBy: 'owner', bandTreatment: { low, medium, high }, selfApprovalAllowed, automatedActions },
                steering: lowering === null ? [] : IRREDUCIBLY_HIGH.map((a): ClassificationRule => ({ actionPattern: a, band: lowering })),
              };
}

describe('T743 · SC-DPE-001 — no tenant-reachable configuration takes a high-band action without a human', () => {
  it('enumerates the configuration surface, and the fence holds in every loadable configuration', async () => {
    let enumerated = 0;
    let refusedAtLoad = 0;
    let exercised = 0;
    const breaches: string[] = [];

    for (const { policy, steering } of configurations()) {
      enumerated += 1;
      const loaded = loadPolicy(policy);
      if (!loaded.ok) {
        refusedAtLoad += 1;
        continue;
      }
      const loadedPolicy: TenantPolicyDocument = loaded.policy;
      for (const actionType of IRREDUCIBLY_HIGH) {
        for (const actor of [
          { kind: 'human' as const, id: 'u_req' },
          { kind: 'automation' as const, id: 'bot' },
        ]) {
          const { engine: e } = engine({ steering: rules(steering), policies: { current: async () => loadedPolicy } });
          const result = await e.decide(
            request({ actionType, actor, requestedBy: actor.id, triggeredBy: { ruleId: 'R-x', eventId: 'e' } }),
          );
          exercised += 1;
          if (TAKEN.has(result.outcome) || result.effectiveClass !== 'high') {
            breaches.push(`${actionType} by ${actor.kind} → ${result.outcome}/${result.effectiveClass} under ${JSON.stringify(policy)}`);
          }
        }
      }
    }

    // Anti-vacuity: the surface was actually walked, and both halves of the fence were exercised.
    expect(enumerated).toBeGreaterThan(1000);
    expect(refusedAtLoad).toBeGreaterThan(0);
    expect(exercised).toBeGreaterThan(100);
    expect(breaches.slice(0, 5)).toEqual([]);
  }, 120_000);
});
