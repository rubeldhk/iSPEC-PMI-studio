/**
 * T473 — the seven per-stage evidence predicates.
 *
 * ⚠️ **Not red-first, and recorded as such.** `derive.ts` was created for
 * `T472` (enumeration) and I put the evidence predicates in the same file in the
 * same edit, so these tests were written against existing code. Constitution V
 * asks for a test that fails before its implementation; what it is protecting
 * against is a test that *cannot* fail. Each assertion below is therefore
 * verified by **mutation** — the predicate is broken and the named test goes
 * red — which is the stronger property and is recorded in `tasks.md` under
 * `T473`. The ordering was my slip, not a licence to skip the proof.
 *
 * Two predicates carry the reasoning worth reading:
 *
 * **`Clarified` is derived from a recorded session, not from clean text**
 * (`FR-ESK-018`). Deriving it from the absence of `[NEEDS CLARIFICATION]`
 * markers would mark every freshly written spec as clarified before the step
 * ever ran. A session that asked nothing still counts: the artifact records that
 * the step RAN, not that it found something (`FR-ESK-017`).
 *
 * **`Checklisted` requires zero unchecked items**, across every checklist file —
 * not the presence of a checklist. A checklist with one open box is a checklist
 * in progress, and the stage after it is `/speckit-plan`.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { checklistsResolved, evidenceFor, hasClarificationSession } from './derive';
import {
  buildEpicTree,
  MINIMAL_ANALYSIS,
  MINIMAL_PLAN,
  MINIMAL_SPEC,
  MINIMAL_TASKS,
  RESOLVED_CHECKLIST,
  SPEC_WITH_EMPTY_CLARIFICATIONS,
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

function epicPath(fixture: FixtureTree, directory: string): string {
  return join(fixture.specsDir, directory);
}

describe('T473 · Clarified (FR-ESK-018)', () => {
  it('accepts a dated session that asked no questions', () => {
    // The clarification that changes nothing still happened, and an Epic must
    // be able to leave `Specified` after one.
    expect(hasClarificationSession(SPEC_WITH_EMPTY_SESSION)).toBe(true);
  });

  it('rejects a Clarifications heading with no session under it', () => {
    expect(hasClarificationSession(SPEC_WITH_EMPTY_CLARIFICATIONS)).toBe(false);
  });

  it('rejects a spec that merely lacks clarification markers', () => {
    // The assertion that keeps every new spec out of `Clarified`. A clean spec
    // is not a clarified spec; it is an unclarified one that asked nothing yet.
    expect(hasClarificationSession(MINIMAL_SPEC)).toBe(false);
  });

  it('requires the session to carry an ISO date', () => {
    const undated = '# Spec\n\n## Clarifications\n\n### Session\n\n- something\n';
    expect(hasClarificationSession(undated)).toBe(false);
  });

  it('is not satisfied by the words appearing in prose', () => {
    // A spec that discusses clarification sessions is not a clarified spec.
    const prose = '# Spec\n\nWe will hold a ## Clarifications ### Session 2026-08-18 later.\n';
    expect(hasClarificationSession(prose)).toBe(false);
  });
});

describe('T473 · Checklisted', () => {
  it('requires at least one checklist file', () => {
    tree = buildEpicTree({ '001-none': { spec: MINIMAL_SPEC } });
    expect(checklistsResolved(epicPath(tree, '001-none'))).toBe(false);
  });

  it('is false when any item anywhere is unchecked', () => {
    tree = buildEpicTree({
      '001-partial': {
        spec: MINIMAL_SPEC,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST, 'ux.md': UNRESOLVED_CHECKLIST },
      },
    });
    // One open box in the second file. A stage that ignored it would report the
    // Epic as ready to plan while a checklist was still being worked.
    expect(checklistsResolved(epicPath(tree, '001-partial'))).toBe(false);
  });

  it('is true when every item in every file is checked', () => {
    tree = buildEpicTree({
      '001-done': {
        spec: MINIMAL_SPEC,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST, 'ux.md': RESOLVED_CHECKLIST },
      },
    });
    expect(checklistsResolved(epicPath(tree, '001-done'))).toBe(true);
  });

  it('is false for an empty checklists/ directory', () => {
    // "The directory exists" is not "the checklist is resolved". Vacuous truth
    // here would advance an Epic for creating a folder.
    tree = buildEpicTree({ '001-empty': { spec: MINIMAL_SPEC, checklists: {} } });
    expect(checklistsResolved(epicPath(tree, '001-empty'))).toBe(false);
  });
});

describe('T473 · the full predicate set', () => {
  it('reports every artifact stage for a complete Epic', () => {
    tree = buildEpicTree({
      '004-complete': {
        spec: SPEC_WITH_EMPTY_SESSION,
        checklists: { 'requirements.md': RESOLVED_CHECKLIST },
        plan: MINIMAL_PLAN,
        tasks: MINIMAL_TASKS,
        analysis: MINIMAL_ANALYSIS,
      },
    });
    expect(evidenceFor(epicPath(tree, '004-complete'))).toEqual({
      Specified: true,
      Clarified: true,
      Checklisted: true,
      Planned: true,
      Tasked: true,
      Analyzed: true,
      // Never an artifact — stage 7 is the DOR verdict, layered on top.
      Ready: false,
    });
  });

  it('reports nothing for an empty directory', () => {
    tree = buildEpicTree({ '009-empty': {} });
    const evidence = evidenceFor(epicPath(tree, '009-empty'));
    expect(Object.values(evidence).every((value) => value === false)).toBe(true);
  });

  it('reads each artifact independently, so a gap is visible', () => {
    // tasks.md WITHOUT plan.md — the out-of-order case T475 builds on.
    tree = buildEpicTree({
      '010-gap': { spec: MINIMAL_SPEC, tasks: MINIMAL_TASKS },
    });
    const evidence = evidenceFor(epicPath(tree, '010-gap'));
    expect(evidence['Specified']).toBe(true);
    expect(evidence['Planned']).toBe(false);
    expect(evidence['Tasked']).toBe(true);
  });
});
