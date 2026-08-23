/**
 * T944a — workflow-type isolation. `FR-GEL-004`, `ADR-0018`.
 *
 * `ADR-0018`'s only decided constraint, and the reason this test exists at all:
 *
 * > *"the Requirement, Change and Defect Rooms remain distinct user-facing
 * > governed rooms with their own rules, states, permissions and decisions,
 * > while reusing a common workflow engine. **A shared engine must not collapse
 * > three governed surfaces into one.**"*
 *
 * That was an assertion in an ADR until `EPIC-030`'s analysis finding `C1`
 * observed nothing tested it. This is the test. It is cited by name from all
 * three Room Epics — `EPIC-034` `T994z`, `EPIC-035` `T998x` — because each of
 * them has an `SC-*-01x` that depends on it holding here.
 *
 * The failure mode it catches is not exotic. One `Map<stage, handler>` shared
 * across types, or a transition path that resolves the configuration by stage
 * rather than by `(workflowType, configVersion)`, and type A's object advances
 * under type B's rules — with every per-type test still green, because each type
 * works fine on its own.
 */
import { describe, expect, it } from 'vitest';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { LoopConfigRegistry } from '../../src/modules/loop/config-registry.js';

const HANDLED = ['Event', 'Context', 'Analyze', 'Decide', 'Execute', 'Verify', 'Evidence', 'Outcome'];

/** Type A: decides, and never executes. */
const TYPE_A = {
  schemaVersion: 1,
  workflowType: 'type-a',
  stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
  transitions: [
    { from: 'Event', to: 'Analyze', requiredGates: [], trigger: null },
    { from: 'Analyze', to: 'Decide', requiredGates: ['gate-a'], trigger: null },
  ],
  approvedBy: 'u', approvalRef: 'c',
};

/** Type B: executes and verifies, and never decides. */
const TYPE_B = {
  schemaVersion: 1,
  workflowType: 'type-b',
  stages: ['Event', 'Execute', 'Verify', 'Outcome'],
  transitions: [
    { from: 'Event', to: 'Execute', requiredGates: [], trigger: null },
    { from: 'Execute', to: 'Verify', requiredGates: ['gate-b'], trigger: null },
  ],
  approvedBy: 'u', approvalRef: 'c',
};

function registry(): LoopConfigRegistry {
  return new LoopConfigRegistry([
    loadLoopConfig(TYPE_A, { registeredStages: HANDLED }),
    loadLoopConfig(TYPE_B, { registeredStages: HANDLED }),
  ]);
}

describe('T944a · each type resolves its own configuration', () => {
  it('returns type A for type A', () => {
    expect(registry().require('type-a').stages).toEqual(['Event', 'Analyze', 'Decide', 'Outcome']);
  });

  it('returns type B for type B', () => {
    expect(registry().require('type-b').stages).toEqual(['Event', 'Execute', 'Verify', 'Outcome']);
  });

  it('refuses an unknown workflow type rather than picking one', () => {
    // The failure a `?? first()` or a `?? default` would produce: an object of
    // an unregistered type quietly governed by whichever configuration loaded
    // first.
    expect(() => registry().require('type-c')).toThrow(/type-c/);
  });
});

describe('FR-GEL-004 · an object of type A is not transitionable under type B stages', () => {
  it('refuses a stage that belongs to the other type', () => {
    const a = registry().require('type-a');
    // `Execute` is a perfectly real stage, registered, handled, and used by
    // type B. It is not in type A's loop, and that is the whole assertion.
    expect(a.stages).not.toContain('Execute');
    expect(a.transitionFor('Event', 'Execute' as never)).toBeUndefined();
  });

  it('refuses the other type\'s gate on its own transition', () => {
    const a = registry().require('type-a');
    const b = registry().require('type-b');
    expect(a.transitionFor('Analyze', 'Decide')?.requiredGates).toEqual(['gate-a']);
    expect(b.transitionFor('Execute', 'Verify')?.requiredGates).toEqual(['gate-b']);
    // Cross-reading them must not resolve.
    expect(a.transitionFor('Execute' as never, 'Verify' as never)).toBeUndefined();
    expect(b.transitionFor('Analyze' as never, 'Decide' as never)).toBeUndefined();
  });

  it('keeps the two configurations as separate objects, not two views of one', () => {
    const r = registry();
    expect(r.require('type-a')).not.toBe(r.require('type-b'));
  });

  it('would notice if the registry collapsed the two — the check checks itself', () => {
    // If `require` ignored its argument and returned one configuration, every
    // assertion above except this one could still pass by coincidence of
    // ordering. This one cannot.
    const r = registry();
    expect(r.require('type-a').workflowType).toBe('type-a');
    expect(r.require('type-b').workflowType).toBe('type-b');
    expect(r.require('type-a').workflowType).not.toBe(r.require('type-b').workflowType);
  });
});

describe('FR-GEL-008 · omission is per type, and visible in both', () => {
  it('reports what each type omits, rather than the union or nothing', () => {
    const r = registry();
    expect(r.require('type-a').omittedStages).toContain('Execute');
    expect(r.require('type-b').omittedStages).toContain('Decide');
    // A Room rendering type A must be able to say "this loop has no Execute
    // stage", which is different from "Execute has not been reached".
    expect(r.require('type-a').omittedStages).not.toContain('Decide');
  });
});
