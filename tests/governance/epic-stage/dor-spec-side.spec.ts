/**
 * T501 — `DOR-01` … `DOR-06`, the conditions read from the specification side.
 * Written to FAIL before T507 exists (Constitution V).
 *
 * **`FR-ESK-011`: every condition is mechanically checkable.** A condition
 * requiring human judgement is *rejected from the set*, not softened into it —
 * because a gate with one subjective condition is a gate somebody argues with,
 * and the argument is always won by whoever wants to start.
 *
 * That constraint is why these read badly as prose and well as predicates.
 * `DOR-03` does not ask "is the traceability good"; it asks "does the table have
 * rows, and where requirements are uncovered, is a back-fill owner named". The
 * second question has an answer.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { join } from 'node:path';
import { evaluateCondition } from './dor';
import {
  buildEpicTree,
  DOR_READY_PLAN,
  DOR_READY_SPEC,
  MINIMAL_SPEC,
  PLAN_WITH_FAILED_GATE,
  RESOLVED_CHECKLIST,
  SPEC_COVERAGE_DECLARED_NONE,
  SPEC_UNCOVERED_NO_OWNER,
  SPEC_UNCOVERED_WITH_OWNER,
  SPEC_WITH_MARKER,
  UNRESOLVED_CHECKLIST,
  type EpicFixture,
  type FixtureTree,
} from './fixtures';

let tree: FixtureTree | undefined;

afterEach(() => {
  tree?.cleanup();
  tree = undefined;
});

/** Evaluate one condition against a one-Epic fixture tree. */
function check(id: string, fixture: EpicFixture): boolean {
  tree = buildEpicTree({ '999-fixture': fixture });
  return evaluateCondition(id, {
    epicPath: join(tree.specsDir, '999-fixture'),
    directory: '999-fixture',
    declarations: {},
  }).passed;
}

const READY: EpicFixture = {
  spec: DOR_READY_SPEC,
  plan: DOR_READY_PLAN,
  checklists: { 'requirements.md': RESOLVED_CHECKLIST },
};

describe('DOR-01 · a specification exists', () => {
  it('passes when spec.md is present', () => {
    expect(check('DOR-01', READY)).toBe(true);
  });

  it('fails when it is absent', () => {
    expect(check('DOR-01', { plan: DOR_READY_PLAN })).toBe(false);
  });
});

describe('DOR-02 · no unresolved clarification markers', () => {
  it('passes on a spec with none', () => {
    expect(check('DOR-02', READY)).toBe(true);
  });

  it('fails when a marker survives', () => {
    expect(check('DOR-02', { ...READY, spec: SPEC_WITH_MARKER })).toBe(false);
  });

  it('ignores a marker inside inline code', () => {
    // The data-model says "outside inline code" for a reason: this repository's
    // own templates and governance documents quote the marker while explaining
    // it. Flagging a document for describing the convention would make the
    // condition unusable in exactly the documents that define it.
    const quoted = DOR_READY_SPEC.replace(
      '- No questions required.',
      'Resolve every `[NEEDS CLARIFICATION]` marker before planning.',
    );
    expect(check('DOR-02', { ...READY, spec: quoted })).toBe(true);
  });
});

describe('DOR-03 · SRS traceability populated, uncovered requirements owned', () => {
  it('passes with a populated table', () => {
    expect(check('DOR-03', READY)).toBe(true);
  });

  it('fails with no traceability section at all', () => {
    expect(check('DOR-03', { ...READY, spec: MINIMAL_SPEC })).toBe(false);
  });

  it('fails when requirements are uncovered and nobody owns the back-fill', () => {
    // Constitution II's escape hatch, closed. "Not yet covered" is legitimate —
    // EPIC-018 and EPIC-026 are both owner-originated — but only with a name
    // against it, or the gap has no route back.
    expect(check('DOR-03', { ...READY, spec: SPEC_UNCOVERED_NO_OWNER })).toBe(false);
  });

  it('passes when uncovered requirements name a back-fill owner', () => {
    expect(check('DOR-03', { ...READY, spec: SPEC_UNCOVERED_WITH_OWNER })).toBe(true);
  });

  it('passes when the coverage question is answered "none" (DEF-026-006)', () => {
    // The branch that had no fixture, and so had no opinion. The two cases above
    // both contain a real gap, which means both agree with an implementation
    // that merely matched the field LABEL — only this case separates them.
    //
    // It refused EPIC-017, EPIC-027 and EPIC-028 for answering honestly, while
    // an Epic that simply omitted the sentence passed. The cheapest way to
    // satisfy the condition was to delete the evidence.
    expect(check('DOR-03', { ...READY, spec: SPEC_COVERAGE_DECLARED_NONE })).toBe(true);
  });

  it('still refuses an Epic that declares a gap, so "none" is not a skeleton key', () => {
    // The narrowing must not become a way through. Asserted beside the fix
    // because loosening a gate and repairing one look identical in a diff.
    const listed = SPEC_COVERAGE_DECLARED_NONE.replace(
      '**Requirements not yet covered by SRS**: none.',
      '**Requirements not yet covered by SRS**: FR-FIX-002, FR-FIX-003.',
    );
    expect(check('DOR-03', { ...READY, spec: listed })).toBe(false);
  });
});

describe('DOR-04 · principle conformance position recorded', () => {
  it('passes when the section exists', () => {
    expect(check('DOR-04', READY)).toBe(true);
  });

  it('fails when it does not', () => {
    // Decision D-6 requires each Epic to record where it differs. Silence is
    // not "no deltas"; it is nobody having looked.
    expect(check('DOR-04', { ...READY, spec: MINIMAL_SPEC })).toBe(false);
  });
});

describe('DOR-05 · requirements checklist present and fully resolved', () => {
  it('passes when every item is checked', () => {
    expect(check('DOR-05', READY)).toBe(true);
  });

  it('fails when a checklist is absent', () => {
    expect(check('DOR-05', { spec: DOR_READY_SPEC, plan: DOR_READY_PLAN })).toBe(false);
  });

  it('fails when one item anywhere is unchecked', () => {
    expect(
      check('DOR-05', {
        ...READY,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST, 'ux.md': UNRESOLVED_CHECKLIST },
      }),
    ).toBe(false);
  });
});

describe('DOR-06 · plan exists and its Constitution Check records no FAIL', () => {
  it('passes when every gate passed', () => {
    expect(check('DOR-06', READY)).toBe(true);
  });

  it('fails when plan.md is absent', () => {
    expect(check('DOR-06', { spec: DOR_READY_SPEC })).toBe(false);
  });

  it('fails when any gate is recorded as FAIL', () => {
    expect(check('DOR-06', { ...READY, plan: PLAN_WITH_FAILED_GATE })).toBe(false);
  });

  it('tolerates a QUALIFIED gate', () => {
    // EPIC-026's own plan carries a qualified Gate VIII. The constitution
    // distinguishes a recorded deviation from a failure, and a condition that
    // conflated them would block every Epic honest enough to write one down.
    const qualified = DOR_READY_PLAN.replace('| PASS |', '| ⚠️ QUALIFIED — recorded, not waved |');
    expect(check('DOR-06', { ...READY, plan: qualified })).toBe(true);
  });
});
