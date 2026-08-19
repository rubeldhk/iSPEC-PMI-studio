/**
 * T468 — a temporary Epic tree, for tests that must not depend on the real one.
 *
 * Not a `.spec.ts`, so vitest never collects it — the same convention
 * `tests/governance/helpers.ts` already follows.
 *
 * **Why a fixture tree at all.** The derivation in this epic reads the real
 * `specs/` directory, and most checks should. But the *rules* have to be
 * testable against trees this repository does not contain: an Epic with
 * `tasks.md` and no `plan.md`, a checklist with one unchecked item, a directory
 * with no `spec.md`. Asserting those against the live tree would mean either
 * finding an Epic that happens to be shaped that way today — a test that breaks
 * when someone fixes the Epic — or not testing them at all.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** What an Epic directory may contain. Every field is optional by design. */
export interface EpicFixture {
  /** `spec.md` content. Omit for the invalid-Epic case — a directory with no specification. */
  spec?: string;
  plan?: string;
  tasks?: string;
  analysis?: string;
  /** One entry per file in `checklists/`. */
  checklists?: Record<string, string>;
  /** One entry per file in `defects/`. */
  defects?: Record<string, string>;
}

export interface FixtureTree {
  /** Absolute path to the `specs/`-equivalent root. */
  readonly specsDir: string;
  /** Remove the tree. Safe to call twice. */
  cleanup(): void;
}

/**
 * Build a throwaway `specs/`-shaped directory.
 *
 * Keys are Epic directory names (`004-workspace-tenancy-audit`), so a test can
 * exercise the `NNN-` pattern and the `_shared` exclusion with real entries
 * rather than by trusting the regex.
 */
export function buildEpicTree(epics: Record<string, EpicFixture>): FixtureTree {
  const root = mkdtempSync(join(tmpdir(), 'pmi-epic-stage-'));
  const specsDir = join(root, 'specs');
  mkdirSync(specsDir, { recursive: true });

  for (const [name, fixture] of Object.entries(epics)) {
    const dir = join(specsDir, name);
    mkdirSync(dir, { recursive: true });

    if (fixture.spec !== undefined) writeFileSync(join(dir, 'spec.md'), fixture.spec, 'utf8');
    if (fixture.plan !== undefined) writeFileSync(join(dir, 'plan.md'), fixture.plan, 'utf8');
    if (fixture.tasks !== undefined) writeFileSync(join(dir, 'tasks.md'), fixture.tasks, 'utf8');
    if (fixture.analysis !== undefined) {
      writeFileSync(join(dir, 'analysis.md'), fixture.analysis, 'utf8');
    }

    for (const [folder, files] of [
      ['checklists', fixture.checklists],
      ['defects', fixture.defects],
    ] as const) {
      if (!files) continue;
      // An EMPTY record still creates the directory. `DOR-11` distinguishes
      // "defects/ exists and is empty" from "defects/ is absent", so the
      // fixture must be able to express both.
      mkdirSync(join(dir, folder), { recursive: true });
      for (const [file, content] of Object.entries(files)) {
        writeFileSync(join(dir, folder, file), content, 'utf8');
      }
    }
  }

  return {
    specsDir,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

// ------------------------------------------------------------------ content

/** A minimal spec. Enough to be `Specified` and nothing more. */
export const MINIMAL_SPEC = '# Feature Specification: Fixture\n';

/**
 * A spec carrying a dated clarification session that asked nothing.
 *
 * This shape is load-bearing: `FR-ESK-018` exists because a clarify run may
 * legitimately ask no questions, and deriving `Clarified` from the *absence* of
 * `[NEEDS CLARIFICATION]` markers would mark every freshly written spec as
 * clarified before the step ever ran.
 */
export const SPEC_WITH_EMPTY_SESSION = [
  '# Feature Specification: Fixture',
  '',
  '## Clarifications',
  '',
  '### Session 2026-08-18',
  '',
  '- No questions required.',
  '',
].join('\n');

/** A spec whose Clarifications heading carries no session — must NOT be `Clarified`. */
export const SPEC_WITH_EMPTY_CLARIFICATIONS = [
  '# Feature Specification: Fixture',
  '',
  '## Clarifications',
  '',
].join('\n');

export const RESOLVED_CHECKLIST = ['# Checklist', '', '- [X] one', '- [X] two', ''].join('\n');
export const UNRESOLVED_CHECKLIST = ['# Checklist', '', '- [X] one', '- [ ] two', ''].join('\n');

export const MINIMAL_PLAN = '# Implementation Plan: Fixture\n';
export const MINIMAL_TASKS = ['# Tasks: Fixture', '', '- [ ] T001 do a thing', ''].join('\n');
export const MINIMAL_ANALYSIS = [
  '# Analysis: Fixture',
  '',
  '## Session 2026-08-18',
  '',
  'No findings.',
  '',
].join('\n');

// ------------------------------------------------------- DOR evidence (T501, T502)

/** A spec satisfying `DOR-01` through `DOR-04` and `DOR-10`. */
export const DOR_READY_SPEC = [
  '# Feature Specification: Fixture',
  '',
  '## Clarifications',
  '',
  '### Session 2026-08-18',
  '',
  '- No questions required.',
  '',
  '## SRS Traceability *(mandatory — Constitution II)*',
  '',
  '| Source | Section | Covers |',
  '|---|---|---|',
  '| `SRS/PMI-DOC-003.docx` | PP-011 | FR-FIX-001 |',
  '',
  '## Principle Conformance — deltas',
  '',
  '| Principle | Status in this epic |',
  '|---|---|',
  '| PP-011 | ✅ Satisfied here |',
  '',
  '## Epic Exit Criteria',
  '',
  '- [ ] Every implementation task has a passing unit test',
  '',
].join('\n');

/** `DOR-02` fails: an unresolved marker survives in the text. */
export const SPEC_WITH_MARKER = DOR_READY_SPEC.replace(
  '- No questions required.',
  '- [NEEDS CLARIFICATION: who owns the retention window?]',
);

/** `DOR-03` fails: requirements are uncovered and no back-fill owner is named. */
export const SPEC_UNCOVERED_NO_OWNER = DOR_READY_SPEC.replace(
  '| `SRS/PMI-DOC-003.docx` | PP-011 | FR-FIX-001 |',
  '**Requirements not yet covered by SRS**: all of FR-FIX-001 to FR-FIX-009.',
);

/** `DOR-03` passes: uncovered requirements, but an owner is named. */
export const SPEC_UNCOVERED_WITH_OWNER = SPEC_UNCOVERED_NO_OWNER.replace(
  '**Requirements not yet covered by SRS**: all of FR-FIX-001 to FR-FIX-009.',
  '**Requirements not yet covered by SRS**: all of FR-FIX-001 to FR-FIX-009.\n\nBack-fill owner: **project owner**.',
);

/** A plan whose Constitution Check records no FAIL — `DOR-06` passes. */
export const DOR_READY_PLAN = [
  '# Implementation Plan: Fixture',
  '',
  '## Constitution Check',
  '',
  '| # | Gate | Status |',
  '|---|---|---|',
  '| I | Code produced only via Spec Kit commands | PASS |',
  '| V | Every implementation task carries a unit test | PASS |',
  '',
].join('\n');

/** `DOR-06` fails: a gate is recorded as FAIL. */
export const PLAN_WITH_FAILED_GATE = DOR_READY_PLAN.replace(
  '| V | Every implementation task carries a unit test | PASS |',
  '| V | Every implementation task carries a unit test | FAIL — three tasks have no test |',
);

/** `DOR-07` and `DOR-08` pass: every implementation task names its test. */
export const DOR_READY_TASKS = [
  '# Tasks: Fixture',
  '',
  '- [X] T001 [P] Write failing unit tests for the widget in `tests/widget.spec.ts`',
  '- [X] T002 Implement the widget in `src/widget.ts` (unit test: T001)',
  '- [ ] T003 Author the steering file in `governance/steering/x.md` (check: T001)',
  '',
].join('\n');

/** `DOR-08` fails: an implementation task pairs with nothing. */
export const TASKS_UNPAIRED = DOR_READY_TASKS.replace(
  '- [X] T002 Implement the widget in `src/widget.ts` (unit test: T001)',
  '- [X] T002 Implement the widget in `src/widget.ts`',
);

/** `DOR-09` passes: an analysis record with no blocking findings. */
export const DOR_READY_ANALYSIS = [
  '# Analysis: Fixture',
  '',
  '**Epic**: `EPIC-999` · **Session**: 2026-08-18',
  '',
  '## Findings',
  '',
  '| ID | Category | Severity | Summary |',
  '|---|---|---|---|',
  '| F1 | Inconsistency | LOW | a wording nit |',
  '',
].join('\n');

/** `DOR-09` fails: a CRITICAL finding is blocking. */
export const ANALYSIS_WITH_CRITICAL = DOR_READY_ANALYSIS.replace('| LOW |', '| CRITICAL |');

/** `DOR-11` fails: an open defect record. */
export const OPEN_DEFECT = [
  '# DEF-999-001 — something is wrong',
  '',
  '**Epic**: `EPIC-999` | **Raised**: 2026-08-18 | **Status**: OPEN',
  '',
].join('\n');

/** `DOR-11` passes: the record is closed. */
export const CLOSED_DEFECT = OPEN_DEFECT.replace('**Status**: OPEN', '**Status**: CLOSED');
