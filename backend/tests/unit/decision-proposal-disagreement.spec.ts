/**
 * T773 — disagreement is visible, not reconciled. `FR-DPE-003`.
 *
 * When an Engineering Expert's proposal differs from the policy class, the
 * explanation says so. Silently dropping the proposal would hide exactly the
 * signal a reviewer most wants: *the model thought this was safer than policy
 * does*.
 */
import { describe, expect, it } from 'vitest';
import { engine, request, rules } from '../helpers/decision-engine.js';

describe('T773 · a proposal that differs from policy is shown', () => {
  it('names both classes when they differ', async () => {
    const { engine: e } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'medium' }]) });
    const result = await e.decide(request({ proposedClass: 'low', requiredGates: [] }));
    expect(result.explanation.proposalDisagreement).toMatch(/proposed low.*policy classifies medium/);
  });

  it('says nothing when they agree, or when there was no proposal', async () => {
    const { engine: e } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }]) });
    expect((await e.decide(request({ proposedClass: 'low' }))).explanation.proposalDisagreement).toBeUndefined();
    expect((await e.decide(request())).explanation.proposalDisagreement).toBeUndefined();
  });
});
