/**
 * T961 — every automated transition cites a visible rule. `FR-GEL-030`,
 * `SC-GEL-004`, `RULE-11`.
 *
 * *"RULE-11 forbids invisible automation."*
 *
 * The rule is enforced in **three** places and this file asserts the first,
 * which is the only one that stops a bad configuration from ever governing
 * anything:
 *
 *   1. **at load** — a configuration declaring a rule-less automated transition
 *      is refused, so the workflow type never exists (here);
 *   2. **at the service** — an automated actor arriving without a trigger is
 *      refused and the refusal is recorded (`T949`);
 *   3. **at the database** — a `CHECK` constraint, because a caller can go
 *      around the service (`T993q`).
 *
 * Three is not redundancy. Each catches a different population: a wrong file, a
 * wrong call, a wrong writer.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES } from '@pmi/loop-contract';
import { LoopConfigError, loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';

const HANDLED = [...LOOP_STAGES];

const base = (transitions: unknown[]) => ({
  schemaVersion: 1,
  workflowType: 'trigger-type',
  stages: ['Event', 'Analyze', 'Outcome'],
  transitions,
  approvedBy: 'u', approvalRef: 'c',
});

describe('T961 · a named rule loads', () => {
  it('accepts an automated transition that cites its rule', () => {
    const config = loadLoopConfig(
      base([{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: { ruleId: 'r_nightly' } }]),
      { registeredStages: HANDLED },
    );
    expect(config.transitionFor('Event', 'Analyze')?.trigger).toEqual({ ruleId: 'r_nightly' });
  });

  it('keeps the rule id reachable, so a Room can render WHY it moved', () => {
    // FR-GEL-030's point is not that a rule exists — it is that the rule is
    // visible from the transition, which is what makes an automated advance
    // explainable to the person looking at the Room.
    const config = loadLoopConfig(
      base([{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: { ruleId: 'r_nightly' } }]),
      { registeredStages: HANDLED },
    );
    expect(config.transitionFor('Event', 'Analyze')?.trigger?.ruleId).toBe('r_nightly');
  });

  it('accepts a human transition with no trigger at all', () => {
    expect(() =>
      loadLoopConfig(base([{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: null }]), {
        registeredStages: HANDLED,
      }),
    ).not.toThrow();
  });
});

describe('SC-GEL-004 · a rule-less automated transition never loads', () => {
  it.each([
    ['an empty trigger object', {}],
    ['a trigger with an empty rule id', { ruleId: '' }],
    ['a trigger whose rule id is not a string', { ruleId: 42 }],
    ['a trigger carrying only a description', { description: 'nightly sweep' }],
  ])('refuses %s', (_label, trigger) => {
    expect(() =>
      loadLoopConfig(base([{ from: 'Event', to: 'Analyze', requiredGates: [], trigger }]), {
        registeredStages: HANDLED,
      }),
    ).toThrow(LoopConfigError);
  });

  it('says what is wrong in terms of the rule, not of the schema', () => {
    // "trigger.ruleId: expected string" tells an operator the shape. "an
    // automated transition must name its trigger rule" tells them the rule they
    // broke, which is the one they can act on.
    try {
      loadLoopConfig(base([{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: {} }]), {
        registeredStages: HANDLED,
      });
      throw new Error('expected a refusal');
    } catch (error) {
      expect((error as LoopConfigError).violations.join(' ')).toMatch(
        /automated transition must name its trigger rule/,
      );
    }
  });

  it('refuses the whole file, not just the offending transition', () => {
    // A partial load would leave a workflow type running with one transition
    // quietly missing — an object reaching Analyze by a route nobody declared,
    // or not reaching it at all with no explanation.
    expect(() =>
      loadLoopConfig(
        base([
          { from: 'Event', to: 'Analyze', requiredGates: [], trigger: null },
          { from: 'Analyze', to: 'Outcome', requiredGates: [], trigger: {} },
        ]),
        { registeredStages: HANDLED },
      ),
    ).toThrow(LoopConfigError);
  });
});

describe('the shipped workflow files obey it', () => {
  it('example-workflow.json names the rule on its automated transition', async () => {
    // Not a synthetic case: the file this Epic ships is the one a reader copies.
    const { readWorkflowConfigs } = await import('../../src/modules/loop/workflow-files.js');
    const configs = readWorkflowConfigs(HANDLED);
    expect(configs.length).toBeGreaterThan(0);
    for (const config of configs) {
      for (const transition of config.transitions) {
        if (transition.trigger) expect(transition.trigger.ruleId.length).toBeGreaterThan(0);
      }
    }
  });
});
