/**
 * T764 — the explanation. `FR-DPE-040`, `FR-DPE-041`, `SC-DPE-002`.
 *
 * Every decision — **allowed as well as blocked** — names the policy version,
 * the matched rule, the risk class and the authority applied. *An unexplainable
 * allow is a defect, not a warning.* `T783`'s mutation proof targets this file.
 */
import { describe, expect, it } from 'vitest';
import { engine, gates, request, rules } from '../helpers/decision-engine.js';

const cases = [
  ['an auto-executed low action', rules([{ actionPattern: 'deploy', band: 'low' }]), {}, 'auto-executed'],
  ['an approved medium action', rules([{ actionPattern: 'deploy', band: 'medium' }]), { requiredGates: ['g1'] }, 'approved'],
  ['a pending high action', rules([]), {}, 'pending'],
  ['a refused medium action', rules([{ actionPattern: 'deploy', band: 'medium' }]), { requiredGates: ['g-missing'] }, 'refused'],
] as const;

describe('T764 · FR-DPE-040 — allowed and blocked alike explain themselves', () => {
  it.each(cases)('explains %s', async (_label, steering, overrides, outcome) => {
    const { engine: e } = engine({ steering, gates: gates({ g1: 'satisfied' }) });
    const result = await e.decide(request(overrides));
    expect(result.outcome).toBe(outcome);
    expect(result.explanation.policyVersion).toBe('2');
    expect(result.explanation.riskClass).toBe(result.effectiveClass);
    expect(result.explanation.authorityApplied.trim().length).toBeGreaterThan(0);
    expect('matchedRule' in result.explanation).toBe(true);
  });
});

describe('T764 · FR-DPE-041 — the matched rule is named, or its absence is', () => {
  it('names the steering lineage and version of the rule that matched', async () => {
    const { engine: e } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }]) });
    const result = await e.decide(request());
    expect(result.explanation.matchedRule).toEqual({ lineageId: 'lin-risk', version: 4 });
  });

  it('states null — not omits — when no rule matched, and cites FR-DPE-004', async () => {
    const { engine: e } = engine({ steering: rules([]) });
    const result = await e.decide(request());
    expect(result.explanation.matchedRule).toBeNull();
    expect(result.explanation.authorityApplied).toMatch(/FR-DPE-004/);
  });

  it('cites the constraint when the floor decided it', async () => {
    const { engine: e } = engine({ steering: rules([{ actionPattern: 'release.promote', band: 'low' }]) });
    const result = await e.decide(request({ actionType: 'release.promote' }));
    expect(result.explanation.constraintCited).toMatch(/FR-DPE-012/);
  });
});
