/**
 * T739 — the classifier, written to fail first. `FR-DPE-001`, `FR-DPE-002`,
 * `FR-DPE-004`, `FR-DPE-012`.
 *
 * - Action + target → band, from the steering-resolved ruleset.
 * - **An unclassified action takes the most restrictive band** (`FR-DPE-004`).
 * - **The floor wins** (`FR-DPE-012`, Cedar's forbid-overrides-permit,
 *   `R-031-2`): an irreducibly-high action is high whatever a rule says, and
 *   the explanation cites the constraint.
 * - The requester is **not an input** (`FR-DPE-002`): `classifyAction` takes no
 *   actor, so who asks cannot change the answer.
 */
import { describe, expect, it } from 'vitest';
import type { ResolvedRuleset } from '@pmi/decision-contract';
import { IRREDUCIBLY_HIGH, classifyAction } from '../../src/modules/decision/classifier.js';

const source = { lineageId: 'lin-1', version: 3 };
const ruleset = (rules: ResolvedRuleset['rules']): ResolvedRuleset => ({ rules, source });
const action = (actionType: string, targetType = 'service') => ({ actionType, target: { type: targetType, id: 'x' } });

describe('T739 · FR-DPE-001 — action and target determine the band', () => {
  it('classifies by an exact action pattern and cites the rule', () => {
    const c = classifyAction(action('deploy'), ruleset([{ actionPattern: 'deploy', band: 'medium' }]));
    expect(c).toMatchObject({ band: 'medium', matchedRule: { actionPattern: 'deploy', band: 'medium' }, source });
  });

  it('matches a trailing wildcard on a dotted prefix, and nothing that merely shares letters', () => {
    const rules = ruleset([{ actionPattern: 'docs.*', band: 'low' }]);
    expect(classifyAction(action('docs.publish'), rules).band).toBe('low');
    expect(classifyAction(action('docs.publish.draft'), rules).band).toBe('low');
    expect(classifyAction(action('docsets.publish'), rules).band).toBe('high');
  });

  it('prefers the most specific rule: exact over wildcard, longer wildcard over shorter', () => {
    const rules = ruleset([
      { actionPattern: 'docs.*', band: 'low' },
      { actionPattern: 'docs.legal.*', band: 'medium' },
      { actionPattern: 'docs.legal.sign', band: 'high' },
    ]);
    expect(classifyAction(action('docs.readme'), rules).band).toBe('low');
    expect(classifyAction(action('docs.legal.edit'), rules).band).toBe('medium');
    expect(classifyAction(action('docs.legal.sign'), rules).band).toBe('high');
  });

  it('applies a target-limited rule only to that target, and prefers it to a general one', () => {
    const rules = ruleset([
      { actionPattern: 'deploy', band: 'medium' },
      { actionPattern: 'deploy', targetType: 'sandbox', band: 'low' },
    ]);
    expect(classifyAction(action('deploy', 'sandbox'), rules).band).toBe('low');
    expect(classifyAction(action('deploy', 'production'), rules).band).toBe('medium');
  });
});

describe('T739 · FR-DPE-004 — no rule, most restrictive band', () => {
  it('classifies an action no rule matches as high, and says so', () => {
    const c = classifyAction(action('mystery'), ruleset([{ actionPattern: 'deploy', band: 'low' }]));
    expect(c).toMatchObject({ band: 'high', matchedRule: null });
    expect(c.reason).toMatch(/FR-DPE-004/);
  });

  it('classifies everything as high when no ruleset applies at all', () => {
    expect(classifyAction(action('deploy'), { rules: [], source: null })).toMatchObject({ band: 'high', source: null });
  });
});

describe('T739 · FR-DPE-012 — the floor overrides any rule', () => {
  it.each(IRREDUCIBLY_HIGH)('keeps %s high under a rule saying low, and cites the constraint', (actionType) => {
    const c = classifyAction(action(actionType), ruleset([{ actionPattern: actionType, band: 'low' }]));
    expect(c.band).toBe('high');
    expect(c.constraintCited).toMatch(/FR-DPE-012/);
  });

  it('names at least the three actions FR-DPE-012 lists', () => {
    expect(IRREDUCIBLY_HIGH).toEqual(
      expect.arrayContaining(['release.promote', 'loop.configuration.change', 'requirement-room.baseline']),
    );
  });
});

describe('T739 · FR-DPE-002 — the requester is not an input', () => {
  it('takes no actor', () => {
    // @ts-expect-error — classifyAction has no place to put a requester.
    classifyAction(action('deploy'), ruleset([]), { kind: 'human', id: 'admin' });
    expect(classifyAction.length).toBe(2);
  });
});
