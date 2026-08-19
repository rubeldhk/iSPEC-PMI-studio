/**
 * T682 — a condition an Epic kind cannot satisfy is **not applicable**, not failed.
 * Written to FAIL before T683 exists (Constitution V).
 *
 * **The noise this removes.** `FR-ESK-024` defines a parent design as an Epic
 * that *"deliberately carries no tasks"* and is *"never evaluated for
 * readiness"*. EPIC-002 and EPIC-017 are the two the repository actually has.
 * Yet `DOR-07` ("a task list exists") and `DOR-08` ("every implementation task
 * pairs with a test") were still evaluated against them, and reported
 * `tasks.md is absent` on every run, forever, for a condition those Epics are
 * defined never to meet.
 *
 * Two permanent non-findings are worse than they look. They were the entire
 * reason EPIC-002 and EPIC-017 appeared in the last `DOR-08` sweep — a reader
 * comparing "26 of 28" against "28 of 28" has to know which two are noise, and
 * that knowledge lives nowhere.
 *
 * ## Why "not applicable" and not "passed"
 *
 * Constitution IX's honesty rule: **an unrun check is never reported as
 * passing.** A parent design has not satisfied `DOR-07`; the condition simply
 * does not reach it. Marking it `passed` would be the convenient lie, and the
 * first time someone counted passing conditions it would be a wrong count.
 *
 * So the result carries three states, and `failed` excludes the third.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { join } from 'node:path';
import { evaluateDor } from './dor';
import { loadStageConfig } from './derive';
import {
  buildEpicTree,
  DOR_READY_PLAN,
  DOR_READY_SPEC,
  DOR_READY_TASKS,
  RESOLVED_CHECKLIST,
  type FixtureTree,
} from './fixtures';

let tree: FixtureTree | undefined;

afterEach(() => {
  tree?.cleanup();
  tree = undefined;
});

/** A parent design as the repository actually has them: spec and plan, no tasks. */
function parentDesign() {
  tree = buildEpicTree({
    '999-parent': {
      spec: DOR_READY_SPEC,
      plan: DOR_READY_PLAN,
      checklists: { 'requirements.md': RESOLVED_CHECKLIST },
    },
  });
  return evaluateDor(
    { epicPath: join(tree.specsDir, '999-parent'), directory: '999-parent', declarations: {} },
    'parent-design',
  );
}

function deliveryEpicWithoutTasks() {
  tree = buildEpicTree({
    '999-delivery': {
      spec: DOR_READY_SPEC,
      plan: DOR_READY_PLAN,
      checklists: { 'requirements.md': RESOLVED_CHECKLIST },
    },
  });
  return evaluateDor(
    { epicPath: join(tree.specsDir, '999-delivery'), directory: '999-delivery', declarations: {} },
    'delivery',
  );
}

describe('T682 · a parent design is not judged on tasks it is defined not to have', () => {
  it('reports DOR-07 as not applicable', () => {
    const result = parentDesign();
    const dor07 = result.results.find((r) => r.id === 'DOR-07');
    expect(dor07?.applicable).toBe(false);
  });

  it('reports DOR-08 as not applicable', () => {
    const dor08 = parentDesign().results.find((r) => r.id === 'DOR-08');
    expect(dor08?.applicable).toBe(false);
  });

  it('does NOT count either as a failure', () => {
    // The whole point. Before this, both appeared in `failed` forever.
    const { failed } = parentDesign();
    expect(failed).not.toContain('DOR-07');
    expect(failed).not.toContain('DOR-08');
  });

  it('does NOT report either as passing (Constitution IX)', () => {
    // The convenient lie, refused. A parent design has not SATISFIED DOR-07;
    // the condition does not reach it. Reporting a pass would make any count of
    // passing conditions wrong.
    const result = parentDesign();
    for (const id of ['DOR-07', 'DOR-08']) {
      expect(result.results.find((r) => r.id === id)?.passed, `${id} reported as passing`).toBe(false);
    }
  });

  it('says why, in the detail', () => {
    const dor07 = parentDesign().results.find((r) => r.id === 'DOR-07');
    expect(dor07?.detail).toMatch(/not applicable|parent-design/i);
  });

  it('still evaluates every OTHER condition', () => {
    // A parent design is exempt from two conditions, not from scrutiny. Its
    // specification, traceability, principle position and defects are judged
    // exactly as any Epic's are.
    const result = parentDesign();
    expect(result.results).toHaveLength(12);
    const applicable = result.results.filter((r) => r.applicable !== false);
    expect(applicable).toHaveLength(10);
    expect(applicable.map((r) => r.id)).not.toContain('DOR-07');
  });
});

describe('T682 · a delivery Epic is judged on all twelve', () => {
  it('fails DOR-07 when it has no task list', () => {
    // The load-bearing contrast. The exemption is a property of the KIND, not
    // of the absence of the file — otherwise any Epic could escape by deleting
    // its tasks.md.
    const result = deliveryEpicWithoutTasks();
    expect(result.failed).toContain('DOR-07');
    expect(result.results.find((r) => r.id === 'DOR-07')?.applicable).not.toBe(false);
  });

  it('fails DOR-08 too', () => {
    expect(deliveryEpicWithoutTasks().failed).toContain('DOR-08');
  });

  it('treats every condition as applicable', () => {
    const result = deliveryEpicWithoutTasks();
    expect(result.results.filter((r) => r.applicable === false)).toHaveLength(0);
  });
});

describe('T682 · applicability is configuration, not a literal (FR-ESK-015)', () => {
  it('is declared in epic-stage.config.json', () => {
    // Same reasoning as every other part of the stage model: a rule hard-coded
    // in a check is a rule nobody agreed to. A future Epic kind declares which
    // conditions reach it, without editing this file.
    const config = loadStageConfig();
    const declared = config.dorConditions.filter((c) => c.appliesTo !== undefined);
    expect(declared.map((c) => c.id).sort()).toEqual(['DOR-07', 'DOR-08']);
    for (const condition of declared) {
      expect(condition.appliesTo).toEqual(['delivery']);
    }
  });

  it('defaults to applying everywhere when nothing is declared', () => {
    // Absence is not an exemption. Ten conditions declare nothing and reach
    // every kind, which is what keeps this a narrow carve-out.
    const config = loadStageConfig();
    const silent = config.dorConditions.filter((c) => c.appliesTo === undefined);
    expect(silent).toHaveLength(10);
    const result = parentDesign();
    for (const condition of silent) {
      expect(
        result.results.find((r) => r.id === condition.id)?.applicable,
        `${condition.id} was exempted without declaring it`,
      ).not.toBe(false);
    }
  });
});

describe('T682 · the real repository', () => {
  it('has exactly the two parent designs this carve-out is for', () => {
    // If a third appears, this assertion is where someone finds out — and gets
    // to decide whether the exemption is still right.
    tree = buildEpicTree({ '999-x': { spec: DOR_READY_SPEC, tasks: DOR_READY_TASKS } });
    const config = loadStageConfig();
    expect(config.epicKinds['parent-design']?.evaluatesDor).toBe(false);
    expect(config.epicKinds['delivery']?.evaluatesDor).toBe(true);
  });
});
