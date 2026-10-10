/**
 * T778 — exceptions. `FR-DPE-013`, data-model §4.
 *
 * An exception is an authorized, recorded, **expiring** departure from one
 * required gate: authorizer, reason and expiry all required, granted by a
 * human. An expired exception is not a pass — *an expiry is a fact, not a grace
 * period*. And an exception covers the gate it names and no other.
 */
import { describe, expect, it } from 'vitest';
import { engine, gates, request, rules } from '../helpers/decision-engine.js';

const medium = rules([{ actionPattern: 'deploy', band: 'medium' }]);
const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 1_000);

async function refusedOnGate() {
  const harness = engine({ steering: medium, gates: gates({ g1: 'refused', g2: 'satisfied' }) });
  const refused = await harness.engine.decide(request({ requiredGates: ['g1', 'g2'] }));
  return { ...harness, refused };
}

const grant = (decisionId: string, overrides: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_dpe',
  decisionId,
  gateId: 'g1',
  authorizedBy: { kind: 'human' as const, id: 'u_lead' },
  reason: 'hotfix; test suite known flaky on this runner',
  expiresAt: future,
  ...overrides,
});

describe('T778 · an exception lets work proceed — recorded, and named as an exception', () => {
  it('resolves the refused decision as proceed-under-exception', async () => {
    const { engine: e, refused } = await refusedOnGate();
    const result = await e.recordException(grant(refused.decisionId));
    expect(result.outcome).toBe('exception');
    expect(result.gateOutcomes).toEqual(
      expect.arrayContaining([expect.objectContaining({ gateId: 'g1', result: 'exception' })]),
    );
  });

  it('records the exception with authorizer, reason and expiry', async () => {
    const { engine: e, repository, refused } = await refusedOnGate();
    await e.recordException(grant(refused.decisionId));
    expect(await repository.exceptionsFor('ws_dpe', refused.decisionId)).toEqual([
      expect.objectContaining({ gateId: 'g1', authorizedBy: 'u_lead', reason: expect.stringMatching(/hotfix/), expiresAt: future }),
    ]);
  });
});

describe('T778 · what an exception is not', () => {
  it.each([
    ['no reason', { reason: '  ' }, /reason/],
    ['no expiry', { expiresAt: undefined }, /expir/],
    ['an expiry already passed', { expiresAt: past }, /expir/],
    ['an automated authorizer', { authorizedBy: { kind: 'automation', id: 'bot' } }, /human/],
    ['a gate the decision did not require', { gateId: 'g-unrelated' }, /not a required gate/],
  ])('refuses an exception with %s', async (_label, overrides, message) => {
    const { engine: e, refused } = await refusedOnGate();
    await expect(e.recordException(grant(refused.decisionId, overrides))).rejects.toThrow(message);
  });

  it('covers only the gate it names — a second failing gate still refuses', async () => {
    const harness = engine({ steering: medium, gates: gates({ g1: 'refused', g2: 'refused' }) });
    const refused = await harness.engine.decide(request({ requiredGates: ['g1', 'g2'] }));
    const result = await harness.engine.recordException(grant(refused.decisionId));
    expect(result.outcome).toBe('refused');
  });
});
