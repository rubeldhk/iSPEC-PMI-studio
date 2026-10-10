/**
 * T780c — rule citation, written to fail first. `FR-DPE-031`, `RULE-11`.
 *
 * *"Every automated action MUST be explainable from a visible rule or policy. A
 * rule that cannot be cited MUST NOT be loadable."* The same fence shape as
 * `FR-DPE-012`, applied to automation: refused at load, naming the action.
 */
import { describe, expect, it } from 'vitest';
import { PLATFORM_DEFAULT_POLICY, loadPolicy } from '../../src/modules/decision/policy.loader.js';

const base = { ...PLATFORM_DEFAULT_POLICY, version: 1, approvedBy: 'owner' };

describe('T780c · FR-DPE-031 — an automated action must cite its rule', () => {
  it('loads an automated action that cites a rule', () => {
    expect(loadPolicy({ ...base, automatedActions: [{ actionPattern: 'docs.publish', ruleId: 'RULE-docs-1' }] })).toMatchObject({
      ok: true,
    });
  });

  it.each([
    ['no rule id', { actionPattern: 'docs.publish' }],
    ['an empty rule id', { actionPattern: 'docs.publish', ruleId: '  ' }],
  ])('refuses an automated action with %s, naming the action', (_label, entry) => {
    const loaded = loadPolicy({ ...base, automatedActions: [entry] });
    expect(loaded).toMatchObject({ ok: false, reason: 'uncited-automation' });
    if (!loaded.ok) expect(loaded.message).toMatch(/docs\.publish/);
  });
});
