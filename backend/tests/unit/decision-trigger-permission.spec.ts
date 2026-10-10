/**
 * T780a — reactive-trigger permission. `FR-DPE-030`, `BR-0069`.
 *
 * Policy MAY permit governed workflows to react to events, schedules or
 * artifact changes. An automated action is permitted **only** where the policy
 * names it — and it must arrive saying which rule fired it. A workflow reacting
 * without that permission is refused.
 */
import { describe, expect, it } from 'vitest';
import { engine, policy, request, rules } from '../helpers/decision-engine.js';

const low = rules([{ actionPattern: 'docs.publish', band: 'low' }]);
const permitted = policy({ automatedActions: [{ actionPattern: 'docs.*', ruleId: 'RULE-docs-nightly' }] });
const automated = (overrides = {}) =>
  request({
    actionType: 'docs.publish',
    actor: { kind: 'automation', id: 'scheduler' },
    triggeredBy: { ruleId: 'RULE-docs-nightly', eventId: 'evt-42' },
    ...overrides,
  });

describe('T780a · FR-DPE-030 — automation only where policy permits it', () => {
  it('auto-executes an automated action the policy names, fired by the rule it names', async () => {
    const { engine: e } = engine({ steering: low, policies: permitted });
    await expect(e.decide(automated())).resolves.toMatchObject({ outcome: 'auto-executed' });
  });

  it('refuses automation the policy does not name', async () => {
    const { engine: e } = engine({ steering: low });
    const result = await e.decide(automated());
    expect(result.outcome).toBe('refused');
    expect(result.explanation.authorityApplied).toMatch(/FR-DPE-030/);
  });

  it('refuses automation that does not say which rule fired it', async () => {
    const { engine: e } = engine({ steering: low, policies: permitted });
    const result = await e.decide(automated({ triggeredBy: undefined }));
    expect(result.outcome).toBe('refused');
  });

  it('refuses automation fired by a rule other than the one the policy cites', async () => {
    const { engine: e } = engine({ steering: low, policies: permitted });
    const result = await e.decide(automated({ triggeredBy: { ruleId: 'RULE-something-else', eventId: 'e' } }));
    expect(result.outcome).toBe('refused');
  });

  it('holds a permitted automated high-band request for a human — automation may ask, never take', async () => {
    const { engine: e } = engine({
      steering: rules([{ actionPattern: 'docs.publish', band: 'high' }]),
      policies: permitted,
    });
    await expect(e.decide(automated())).resolves.toMatchObject({ outcome: 'pending', effectiveClass: 'high' });
  });
});
