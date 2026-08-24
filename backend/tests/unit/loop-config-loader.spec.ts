/**
 * T937 — the configuration loader refuses, written to fail first.
 * `FR-GEL-003`, `FR-GEL-007`, `FR-GEL-016`.
 *
 * Four refusals, and every one is a **load-time** refusal rather than a runtime
 * check. The difference matters: a configuration that loads and then misbehaves
 * has already declared a governed workflow type, and objects may already be
 * sitting in it. Refusing at load means the bad configuration never governs
 * anything.
 *
 * There is deliberately no `loadOrDefault`, no partial load and no "load with
 * warnings". `FR-GEL-062`'s shape applied to configuration: absent or wrong is a
 * refusal, never a default.
 */
import { describe, expect, it } from 'vitest';
import { loadLoopConfig, LoopConfigError } from '../../src/modules/loop/loop-config.loader.js';

const VALID = {
  schemaVersion: 1,
  workflowType: 'example-workflow',
  stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
  transitions: [
    { from: 'Event', to: 'Analyze', requiredGates: [], trigger: { ruleId: 'r1' } },
    { from: 'Analyze', to: 'Decide', requiredGates: ['g1'], trigger: null },
  ],
  approvedBy: 'u_approver',
  approvalRef: 'commit_abc',
};

const HANDLED = ['Event', 'Analyze', 'Decide', 'Outcome'];

describe('T937 · a conforming configuration loads', () => {
  it('returns a resolved configuration, or every refusal below means nothing', () => {
    const config = loadLoopConfig(VALID, { registeredStages: HANDLED });
    expect(config.workflowType).toBe('example-workflow');
    expect(config.stages).toEqual(['Event', 'Analyze', 'Decide', 'Outcome']);
  });

  it('exposes the omitted stages as data, not as an absence (FR-GEL-008)', () => {
    const config = loadLoopConfig(VALID, { registeredStages: HANDLED });
    expect(config.omittedStages).toEqual(['Context', 'Execute', 'Verify', 'Evidence']);
  });
});

describe('FR-GEL-007 · a stage outside the vocabulary is refused at load', () => {
  it('refuses an unknown stage name', () => {
    const bad = { ...VALID, stages: ['Event', 'Triage', 'Outcome'] };
    expect(() => loadLoopConfig(bad, { registeredStages: HANDLED })).toThrow(LoopConfigError);
    expect(() => loadLoopConfig(bad, { registeredStages: HANDLED })).toThrow(/Triage/);
  });

  it('names the workflow type in the refusal, so the operator knows which file', () => {
    const bad = { ...VALID, stages: ['Triage'] };
    expect(() => loadLoopConfig(bad, { registeredStages: HANDLED })).toThrow(/example-workflow/);
  });
});

describe('FR-GEL-007, R-030-5 · a stage with no registered handler is refused at load', () => {
  it('refuses a configuration naming a stage nothing can run', () => {
    // Every stage is in the vocabulary; `Decide` simply has nothing behind it.
    // Loading anyway would produce a workflow that stops dead at Decide with no
    // explanation — or worse, one where a no-op handler silently advances it,
    // which is an auto-approval wearing a placeholder's name.
    expect(() => loadLoopConfig(VALID, { registeredStages: ['Event', 'Analyze', 'Outcome'] })).toThrow(
      /Decide/,
    );
  });

  it('does not accept an empty registry as "nothing to check"', () => {
    expect(() => loadLoopConfig(VALID, { registeredStages: [] })).toThrow(LoopConfigError);
  });
});

describe('FR-GEL-031, RULE-11 · an automated transition names its rule', () => {
  it('refuses a trigger with no rule id', () => {
    const bad = {
      ...VALID,
      transitions: [{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: {} }],
    };
    expect(() => loadLoopConfig(bad, { registeredStages: HANDLED })).toThrow(/trigger rule/i);
  });

  it('refuses an empty rule id, which is the same fault spelled differently', () => {
    const bad = {
      ...VALID,
      transitions: [{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: { ruleId: '' } }],
    };
    expect(() => loadLoopConfig(bad, { registeredStages: HANDLED })).toThrow(/trigger rule/i);
  });

  it('accepts a null trigger — a human transition is not automation', () => {
    const ok = {
      ...VALID,
      transitions: [{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: null }],
    };
    expect(() => loadLoopConfig(ok, { registeredStages: HANDLED })).not.toThrow();
  });
});

describe('FR-GEL-016, R-030-7 · an unapproved configuration does not load', () => {
  it.each(['approvedBy', 'approvalRef'])('refuses a configuration with no %s', (field) => {
    const bad = { ...VALID, [field]: undefined };
    expect(() => loadLoopConfig(bad, { registeredStages: HANDLED })).toThrow(LoopConfigError);
  });

  it('refuses an empty approval, not only an absent one', () => {
    // "" satisfies a `typeof === 'string'` check and approves nothing.
    expect(() => loadLoopConfig({ ...VALID, approvedBy: '' }, { registeredStages: HANDLED })).toThrow(
      LoopConfigError,
    );
  });
});

describe('FR-GEL-003 · the refusal reports every fault, not the first', () => {
  it('lists all of them, so fixing a configuration is one round and not four', () => {
    const bad = { ...VALID, approvedBy: '', stages: ['Triage'], transitions: [] };
    try {
      loadLoopConfig(bad, { registeredStages: HANDLED });
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(LoopConfigError);
      expect((error as LoopConfigError).violations.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the transitions a configuration declares are the only ones it permits', () => {
  it('resolves a declared transition', () => {
    const config = loadLoopConfig(VALID, { registeredStages: HANDLED });
    expect(config.transitionFor('Analyze', 'Decide')).toEqual({
      from: 'Analyze',
      to: 'Decide',
      requiredGates: ['g1'],
      trigger: null,
    });
  });

  it('returns undefined for a transition the configuration does not declare', () => {
    // Not an exception: the caller decides whether an undeclared transition is a
    // refusal or a 404, and the loader does not pre-empt that.
    const config = loadLoopConfig(VALID, { registeredStages: HANDLED });
    expect(config.transitionFor('Event', 'Outcome')).toBeUndefined();
  });
});
