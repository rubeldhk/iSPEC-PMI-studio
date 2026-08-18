/**
 * T502 — `DOR-07` … `DOR-12`, the conditions read from the delivery side.
 * Written to FAIL before T508 exists (Constitution V).
 *
 * **`DOR-08` is the one that matters most.** *"Every implementation task pairs
 * with a test or conformance check"* is Constitution V — the principle this
 * repository has broken more times than any other, and always the same way: a
 * task marked complete whose test does not exist. EPIC-003's closure records
 * three tasks marked done with **no test file anywhere in the repository**.
 * Checking it before implementation starts is cheaper than discovering it in a
 * closing report.
 *
 * **`DOR-12` reads the declarations, not the tree** — the one condition on the
 * declared side. All three posture kinds block readiness, so a reader never has
 * to remember which ones do.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { join } from 'node:path';
import { evaluateCondition } from './dor';
import {
  ANALYSIS_WITH_CRITICAL,
  buildEpicTree,
  CLOSED_DEFECT,
  DOR_READY_ANALYSIS,
  DOR_READY_SPEC,
  DOR_READY_TASKS,
  MINIMAL_SPEC,
  OPEN_DEFECT,
  TASKS_UNPAIRED,
  type EpicFixture,
  type FixtureTree,
} from './fixtures';
import type { DeclarationsFile } from './declarations';

let tree: FixtureTree | undefined;

afterEach(() => {
  tree?.cleanup();
  tree = undefined;
});

function check(id: string, fixture: EpicFixture, declarations: DeclarationsFile = {}): boolean {
  tree = buildEpicTree({ '999-fixture': fixture });
  return evaluateCondition(id, {
    epicPath: join(tree.specsDir, '999-fixture'),
    directory: '999-fixture',
    declarations,
  }).passed;
}

const READY: EpicFixture = {
  spec: DOR_READY_SPEC,
  tasks: DOR_READY_TASKS,
  analysis: DOR_READY_ANALYSIS,
  defects: {},
};

describe('DOR-07 · a task list exists', () => {
  it('passes when tasks.md is present', () => {
    expect(check('DOR-07', READY)).toBe(true);
  });

  it('fails when it is absent', () => {
    expect(check('DOR-07', { spec: DOR_READY_SPEC })).toBe(false);
  });
});

describe('DOR-08 · every implementation task pairs with a test or check (Constitution V)', () => {
  it('passes when each implementation task names its test', () => {
    expect(check('DOR-08', READY)).toBe(true);
  });

  it('fails when one implementation task pairs with nothing', () => {
    // The assertion Constitution V exists for, moved earlier in the journey.
    expect(check('DOR-08', { ...READY, tasks: TASKS_UNPAIRED })).toBe(false);
  });

  it('does not demand that a test-writing task name its own test', () => {
    // "Write failing unit tests for X" IS the test. Requiring it to reference
    // another one would make the condition unsatisfiable by construction.
    const testsOnly = ['# Tasks: Fixture', '', '- [X] T001 Write failing unit tests in `a.spec.ts`', ''].join('\n');
    expect(check('DOR-08', { ...READY, tasks: testsOnly })).toBe(true);
  });

  it('accepts a conformance check as the pairing, not only a unit test', () => {
    // This repository produces documents as well as code, and constitution
    // v1.2.0 recognises an executable conformance check as satisfying V.
    const checked = [
      '# Tasks: Fixture',
      '',
      '- [X] T001 Author the steering file in `governance/steering/x.md` (check: T002)',
      '',
    ].join('\n');
    expect(check('DOR-08', { ...READY, tasks: checked })).toBe(true);
  });

  it('fails when there are no tasks at all', () => {
    expect(check('DOR-08', { ...READY, tasks: '# Tasks: Fixture\n' })).toBe(false);
  });
});

describe('DOR-09 · analysis recorded with zero blocking findings', () => {
  it('passes with a record whose findings are non-blocking', () => {
    expect(check('DOR-09', READY)).toBe(true);
  });

  it('fails when no analysis record exists', () => {
    // True for every Epic in this repository today, and correctly so — the
    // recording instruction only landed in T486.
    expect(check('DOR-09', { ...READY, analysis: undefined })).toBe(false);
  });

  it('fails on a CRITICAL finding', () => {
    expect(check('DOR-09', { ...READY, analysis: ANALYSIS_WITH_CRITICAL })).toBe(false);
  });

  it('fails on a HIGH finding', () => {
    const high = DOR_READY_ANALYSIS.replace('| LOW |', '| HIGH |');
    expect(check('DOR-09', { ...READY, analysis: high })).toBe(false);
  });

  it('passes on MEDIUM and LOW findings', () => {
    // Blocking means CRITICAL or HIGH. If every severity blocked, the honest
    // response to a LOW nit would be to stop writing findings down.
    const medium = DOR_READY_ANALYSIS.replace('| LOW |', '| MEDIUM |');
    expect(check('DOR-09', { ...READY, analysis: medium })).toBe(true);
  });
});

describe('DOR-10 · Epic Exit Criteria stated', () => {
  it('passes when the section exists', () => {
    expect(check('DOR-10', READY)).toBe(true);
  });

  it('fails when it does not', () => {
    expect(check('DOR-10', { ...READY, spec: MINIMAL_SPEC })).toBe(false);
  });
});

describe('DOR-11 · defects/ exists with no open records (Constitution VI)', () => {
  it('passes with an empty defects directory', () => {
    // Empty is the goal state, not a missing one.
    expect(check('DOR-11', READY)).toBe(true);
  });

  it('fails when defects/ does not exist', () => {
    // Constitution VI requires the folder. Its absence means no defect could
    // have been recorded, which is not the same as none having occurred.
    expect(check('DOR-11', { ...READY, defects: undefined })).toBe(false);
  });

  it('fails on an open record', () => {
    expect(check('DOR-11', { ...READY, defects: { 'DEF-999-001.md': OPEN_DEFECT } })).toBe(false);
  });

  it('passes when every record is closed', () => {
    expect(check('DOR-11', { ...READY, defects: { 'DEF-999-001.md': CLOSED_DEFECT } })).toBe(true);
  });

  it('passes when a record is closed as deferred with an owner', () => {
    // DEF-004-001's exact resolution. Deferred-with-an-owner is a decision;
    // treating it as open would punish recording the decision.
    const deferred = CLOSED_DEFECT.replace('**Status**: CLOSED', '**Status**: CLOSED — DEFERRED to EPIC-005');
    expect(check('DOR-11', { ...READY, defects: { 'DEF-999-001.md': deferred } })).toBe(true);
  });
});

describe('DOR-12 · no blocking posture declared', () => {
  it('passes when nothing is declared', () => {
    expect(check('DOR-12', READY)).toBe(true);
  });

  it('fails on a Held posture', () => {
    expect(
      check('DOR-12', READY, {
        epics: { '999-fixture': { posture: { kind: 'Held', awaiting: 'X', reason: 'y' } } },
      }),
    ).toBe(false);
  });

  it('fails on Blocked and on Superseded too', () => {
    // All three kinds block. Keeping every kind blocking means a recorded stop
    // always means not Ready, so no reader must remember which are which.
    for (const posture of [
      { kind: 'Blocked', blockedBy: '002-x', reason: 'y' },
      { kind: 'Superseded', replacedBy: '026-x', reason: 'y' },
    ]) {
      expect(check('DOR-12', READY, { epics: { '999-fixture': { posture } } })).toBe(false);
    }
  });
});
