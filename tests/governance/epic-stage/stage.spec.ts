/**
 * T475 — highest-contiguous-stage derivation.
 *
 * ⚠️ **Not red-first** — same note as `evidence.spec.ts`: `deriveStage` was
 * written into `derive.ts` alongside enumeration for `T472`. Every assertion
 * here is verified by mutation instead, recorded under `T475` in `tasks.md`.
 *
 * **The rule.** The stage is the highest stage whose evidence is present
 * *contiguously* from 1. Evidence above a gap does not raise the stage; it is
 * reported separately as an out-of-order finding (`FR-ESK-003`, `FR-ESK-006`).
 *
 *     spec ✓  clarif ✓  checklist ✓  plan ✗  tasks ✓  →  Checklisted
 *                                                        finding: tasks without plan
 *
 * Counting the `tasks.md` would report the Epic as `Tasked` when nobody had
 * planned it. A register that shows progress past a step which never happened is
 * worse than no register: it is still trusted.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { deriveStage } from './derive';
import {
  buildEpicTree,
  MINIMAL_ANALYSIS,
  MINIMAL_PLAN,
  MINIMAL_SPEC,
  MINIMAL_TASKS,
  RESOLVED_CHECKLIST,
  SPEC_WITH_EMPTY_SESSION,
  UNRESOLVED_CHECKLIST,
  type FixtureTree,
} from './fixtures';
import { join } from 'node:path';

let tree: FixtureTree | undefined;

afterEach(() => {
  tree?.cleanup();
  tree = undefined;
});

function stageOf(fixture: FixtureTree, directory: string) {
  return deriveStage(join(fixture.specsDir, directory));
}

describe('T475 · the ladder, one rung at a time', () => {
  it('spec.md alone is Specified, expecting /speckit-clarify', () => {
    tree = buildEpicTree({ '001-a': { spec: MINIMAL_SPEC } });
    const result = stageOf(tree, '001-a');
    expect(result.stage).toBe('Specified');
    expect(result.next).toBe('/speckit-clarify');
  });

  it('a recorded session raises it to Clarified, expecting /speckit-checklist', () => {
    tree = buildEpicTree({ '002-b': { spec: SPEC_WITH_EMPTY_SESSION } });
    const result = stageOf(tree, '002-b');
    expect(result.stage).toBe('Clarified');
    expect(result.next).toBe('/speckit-checklist');
  });

  it('a resolved checklist raises it to Checklisted, expecting /speckit-plan', () => {
    tree = buildEpicTree({
      '003-c': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
      },
    });
    const result = stageOf(tree, '003-c');
    expect(result.stage).toBe('Checklisted');
    expect(result.next).toBe('/speckit-plan');
  });

  it('plan.md raises it to Planned, expecting /speckit-tasks', () => {
    tree = buildEpicTree({
      '004-d': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
      },
    });
    const result = stageOf(tree, '004-d');
    expect(result.stage).toBe('Planned');
    expect(result.next).toBe('/speckit-tasks');
  });

  it('tasks.md raises it to Tasked, expecting /speckit-analyze', () => {
    tree = buildEpicTree({
      '005-e': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
        tasks: MINIMAL_TASKS,
      },
    });
    const result = stageOf(tree, '005-e');
    expect(result.stage).toBe('Tasked');
    expect(result.next).toBe('/speckit-analyze');
  });

  it('analysis.md raises it to Analyzed, expecting DOR evaluation', () => {
    tree = buildEpicTree({
      '006-f': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
        tasks: MINIMAL_TASKS,
        analysis: MINIMAL_ANALYSIS,
      },
    });
    const result = stageOf(tree, '006-f');
    expect(result.stage).toBe('Analyzed');
    expect(result.next).toBe('DOR evaluation');
  });
});

describe('T475 · a gap stops the ladder (FR-ESK-006)', () => {
  it('does NOT count tasks.md when plan.md is absent', () => {
    // The load-bearing test. Every artifact but the plan is present.
    tree = buildEpicTree({
      '007-gap': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        tasks: MINIMAL_TASKS,
        analysis: MINIMAL_ANALYSIS,
      },
    });
    const result = stageOf(tree, '007-gap');
    expect(result.stage).toBe('Checklisted');
    expect(result.next).toBe('/speckit-plan');
  });

  it('reports the skipped-over evidence rather than discarding it', () => {
    // Not counting it is right; not mentioning it would hide a real anomaly —
    // somebody produced tasks without a plan, and a reader needs to know.
    tree = buildEpicTree({
      '008-gap': { spec: MINIMAL_SPEC, tasks: MINIMAL_TASKS },
    });
    const result = stageOf(tree, '008-gap');
    expect(result.stage).toBe('Specified');
    expect(result.outOfOrder.length).toBeGreaterThan(0);
    expect(result.outOfOrder.join(' ')).toMatch(/Tasked/);
  });

  it('an unresolved checklist stops the ladder at Clarified', () => {
    // The checklist EXISTS. It is not resolved, so the stage does not advance —
    // and plan/tasks above it become out-of-order findings rather than progress.
    tree = buildEpicTree({
      '009-open': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': UNRESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
      },
    });
    const result = stageOf(tree, '009-open');
    expect(result.stage).toBe('Clarified');
    expect(result.outOfOrder.join(' ')).toMatch(/Planned/);
  });

  it('reports no stage at all for a directory with no spec.md', () => {
    // Not stage 0, and not `Specified`. An Epic without a specification is a
    // mistake, and giving it a stage would file the mistake as progress.
    tree = buildEpicTree({ '010-none': { plan: MINIMAL_PLAN } });
    expect(stageOf(tree, '010-none').stage).toBeNull();
  });
});

describe('T475 · determinism', () => {
  it('returns the same result for the same tree, every time', () => {
    // The register is compared byte-for-byte against a fresh generation, so any
    // ordering or clock dependence here surfaces as spurious drift failures.
    tree = buildEpicTree({
      '011-same': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
      },
    });
    const first = stageOf(tree, '011-same');
    const second = stageOf(tree, '011-same');
    expect(second).toEqual(first);
  });
});
