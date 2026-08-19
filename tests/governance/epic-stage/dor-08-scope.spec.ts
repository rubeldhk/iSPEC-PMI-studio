/**
 * T678 — `DOR-08` applies to application code, and only to it (`DEF-026-001`).
 * Written to FAIL before T679 exists (Constitution V).
 *
 * **Constitution V's actual wording** is *"every task producing or changing
 * **application code**."* `DOR-08` as first written treated every `- [ ] Tnnn`
 * line as such a task, so registering a path in a markdown file, adding a
 * `package.json` script and publishing a closing report all demanded a paired
 * unit test. It reported **12 false positives against EPIC-026 itself**, and the
 * epic had to take a waiver to close.
 *
 * ## The danger in narrowing a gate
 *
 * A condition relaxed to make its author's epic pass is how a gate becomes
 * advice. So the assertions below are written in two halves, and the second
 * matters more than the first:
 *
 * 1. the exemptions are the ones Constitution V actually grants; and
 * 2. **a genuinely unpaired implementation task still fails** — asserted with a
 *    real application path, not a fixture that happens to look like one.
 *
 * If the second half ever stops failing, the narrowing went too far and this
 * file is where that shows up.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { join } from 'node:path';
import { evaluateCondition } from './dor';
import { buildEpicTree, DOR_READY_SPEC, type FixtureTree } from './fixtures';

let tree: FixtureTree | undefined;

afterEach(() => {
  tree?.cleanup();
  tree = undefined;
});

/** Evaluate `DOR-08` against a tasks.md consisting of exactly these lines. */
function dor08(...taskLines: string[]): { passed: boolean; detail: string } {
  tree = buildEpicTree({
    '999-fixture': {
      spec: DOR_READY_SPEC,
      tasks: ['# Tasks: Fixture', '', ...taskLines, ''].join('\n'),
    },
  });
  const result = evaluateCondition('DOR-08', {
    epicPath: join(tree.specsDir, '999-fixture'),
    directory: '999-fixture',
    declarations: {},
  });
  return { passed: result.passed, detail: result.detail };
}

describe('T678 · the gate still bites — a real unpaired implementation task fails', () => {
  it('fails a task that writes application code and names no test', () => {
    // THE assertion. If this ever passes, the narrowing destroyed the condition.
    expect(dor08('- [X] T001 Implement the widget in `backend/src/core/widget.ts`').passed).toBe(false);
  });

  it('fails it across every application-code path', () => {
    // The same list `G-27-09` uses for product source, plus `scripts/`, which
    // `T576`'s own note calls application code: "scripts/ is not on Constitution
    // I's exempt list, so this is application code and V is NON-NEGOTIABLE."
    for (const path of [
      'backend/src/a.ts',
      'worker/src/a.ts',
      'packages/agent-contract/src/a.ts',
      'engine-adapters/speckit/src/a.ts',
      'agent-adapters/claude/src/a.ts',
      'execution-providers/docker/src/a.ts',
      'frontend/src/a.tsx',
      'scripts/a.mjs',
    ]) {
      expect(dor08(`- [X] T001 Implement it in \`${path}\``).passed, `${path} escaped`).toBe(false);
    }
  });

  it('passes the same task once it names a unit test', () => {
    expect(
      dor08('- [X] T001 Implement the widget in `backend/src/core/widget.ts` (unit test: T002)').passed,
    ).toBe(true);
  });

  it('accepts a conformance check as the pairing, not only a unit test', () => {
    // Constitution v1.2.0 recognises an executable conformance check as
    // satisfying V for an epic that produces documents as well as code.
    expect(
      dor08('- [X] T001 Implement the rule in `scripts/build-register.mjs` (check: T002)').passed,
    ).toBe(true);
  });

  it('reports how many are unpaired, not merely that something is', () => {
    const result = dor08(
      '- [X] T001 Implement a in `backend/src/a.ts`',
      '- [X] T002 Implement b in `worker/src/b.ts`',
    );
    expect(result.detail).toMatch(/2 /);
  });
});

describe('T678 · what Constitution V does not reach', () => {
  it('exempts a task that only edits a governance document', () => {
    // T466's shape: registering a path in `repository-layout.md`. No code is
    // produced; the verification is EPIC-018's existing `G-05d`.
    expect(
      dor08('- [X] T001 Register the directory in `governance/repository-layout.md`').passed,
    ).toBe(true);
  });

  it('exempts a task that only adds configuration', () => {
    // T467's shape: a `package.json` script. Config is not application code, and
    // this one is exercised every time the register is rebuilt.
    expect(dor08('- [X] T001 Add the `register:update` script to `package.json`').passed).toBe(true);
  });

  it('exempts a task that only writes a specification or a report', () => {
    expect(
      dor08('- [X] T001 Publish the closing report in `specs/026-epic-stage-kanban/closure.md`').passed,
    ).toBe(true);
  });

  it('exempts a Phase Z closure task that names no file at all', () => {
    // T531–T535's shape. A closure task's evidence is `closure.md`, and
    // requiring it to name a unit test made Phase Z unsatisfiable for every
    // epic in the programme — including the four already closed.
    expect(dor08('- [X] T001 Run `/speckit-converge`; complete any remaining unbuilt work').passed).toBe(
      true,
    );
  });

  it('exempts the checks and their support code, which ARE the verification', () => {
    // `tests/**` is not application code: nothing in it ships. A check does not
    // need a check, and a fixture builder's correctness is demonstrated by the
    // nine suites that import it — if it built the wrong tree they would fail.
    //
    // Constitution I's rule that `tests/governance/**` is not exempt concerns the
    // COMMAND GATE — how the file may be authored — not Constitution V.
    expect(dor08('- [X] T001 Create the fixture builder in `tests/governance/epic-stage/fixtures.ts`').passed).toBe(
      true,
    );
    expect(dor08('- [X] T001 Implement rendering in `tests/governance/epic-stage/render.ts`').passed).toBe(
      true,
    );
  });

  it('still exempts a task that IS the test', () => {
    // Unchanged from before the narrowing: requiring a test-writing task to
    // reference another test makes the condition unsatisfiable by construction.
    expect(
      dor08('- [X] T001 Write failing unit tests for the widget in `backend/tests/widget.spec.ts`').passed,
    ).toBe(true);
  });
});

describe('T678 · the narrowing is a rule, not a list of excuses', () => {
  it('does not exempt an application file merely because the line mentions a document', () => {
    // The obvious way to slip through: name a `.md` alongside the code. The
    // condition must look at what the task WRITES, not at every path it cites.
    expect(
      dor08('- [X] T001 Implement it in `backend/src/a.ts` per `specs/_shared/data-model.md`').passed,
    ).toBe(false);
  });

  it('does not exempt an application file because a sibling task is paired', () => {
    expect(
      dor08(
        '- [X] T001 Implement a in `backend/src/a.ts` (unit test: T003)',
        '- [X] T002 Implement b in `backend/src/b.ts`',
      ).passed,
    ).toBe(false);
  });

  it('still fails an epic whose tasks.md lists nothing at all', () => {
    expect(dor08().passed).toBe(false);
  });
});

describe('T678 · pairing is recognised however this repository writes it', () => {
  // Found by running the narrowed condition across all 28 Epics: it still
  // reported 22 failures, and the first three inspected were every one a
  // detector fault rather than a Constitution V gap. A check that cries wolf on
  // correct work is not a weaker version of a good check — it is a check people
  // learn to ignore.

  it('accepts the plural "unit tests:"', () => {
    // EPIC-006 T054's actual wording. The original regex matched `unit test`
    // followed by a colon, so the plural slipped straight past it.
    expect(
      dor08('- [ ] T001 Implement the projects service in `backend/src/modules/projects/a.ts` (unit tests: T002, T003)').passed,
    ).toBe(true);
  });

  it('accepts the plural "checks:"', () => {
    expect(
      dor08('- [ ] T001 Implement it in `backend/src/a.ts` (checks: T002, T003)').passed,
    ).toBe(true);
  });

  it('exempts a task whose own artifact is a test', () => {
    // EPIC-004 T052's actual wording: "Integration test asserting ... in
    // `backend/tests/integration/workspace-isolation.spec.ts`". The task IS the
    // test; the file it names is a `.spec.ts`. Only "write failing ..." was
    // recognised before, and this repository does not always write it that way.
    expect(
      dor08('- [X] T052 [P] [US1] Integration test asserting isolation, in `backend/tests/integration/workspace-isolation.spec.ts`').passed,
    ).toBe(true);
  });

  it('exempts a task producing only files under a tests/ directory', () => {
    expect(
      dor08('- [X] T001 Add the conformance suite in `packages/agent-contract/tests/conformance/suite.ts`').passed,
    ).toBe(true);
  });

  it('accepts a pairing declared by the sibling test task', () => {
    // EPIC-004 T674's actual shape: the implementation names no test, and the
    // test task names the implementation. The pairing exists; it is written the
    // other way round, and a check that only reads one direction reports a gap
    // that is not there.
    expect(
      dor08(
        '- [X] T674 Provide AuditService from AuditModule in `backend/src/modules/audit/audit.module.ts`',
        '- [X] T674a [P] Write failing unit tests for the module wiring in `backend/tests/unit/audit/audit.module.spec.ts` (Constitution V; covers T674)',
      ).passed,
    ).toBe(true);
  });

  it('does NOT accept a sibling that covers a different task', () => {
    // The narrowing must not become "any test anywhere excuses any task".
    expect(
      dor08(
        '- [X] T001 Implement a in `backend/src/a.ts`',
        '- [X] T002a Write failing unit tests in `backend/tests/b.spec.ts` (covers T999)',
      ).passed,
    ).toBe(false);
  });
});

describe('T678 · the pairing may be written in any of the forms this repository uses', () => {
  // Chasing formats one at a time is how a detector accumulates epicycles. The
  // rule is simply: the line names a verification keyword followed by a real
  // task reference. Requiring the `Tnnn` is what keeps it precise — the word
  // "check" in prose does not satisfy it.

  it('accepts a pairing after an em dash rather than in parentheses', () => {
    // EPIC-001 T657's actual wording.
    expect(
      dor08('- [X] T657 Wire logging into `backend/src/main.ts` per PP-010 (partial) — unit test: T658').passed,
    ).toBe(true);
  });

  it('accepts "conformance: Tnnn"', () => {
    // EPIC-028 T563's actual wording: a conformance suite is the verification.
    expect(
      dor08('- [X] T563 [US1] Implement `FixtureAgent` in `agent-adapters/fixture/src/fixture.agent.ts` (conformance: T556)').passed,
    ).toBe(true);
  });

  it('accepts an integration test as the pairing', () => {
    expect(
      dor08('- [X] T001 Implement it in `backend/src/a.ts` (integration test: T002)').passed,
    ).toBe(true);
  });

  it('does NOT accept the word check without a task reference', () => {
    // "check the output carefully" is prose, not a pairing. Requiring `Tnnn`
    // is the whole difference between a reference and a reassurance.
    expect(
      dor08('- [X] T001 Implement it in `backend/src/a.ts` and check the output carefully').passed,
    ).toBe(false);
  });
});

describe('T681 · a test named by PATH is a pairing (DEF-026-004)', () => {
  // Running the narrowed condition across all 28 Epics reported eight unpaired
  // tasks. Every one already had a real test. Three of them name that test in
  // the task line itself — as a file path rather than a task id:
  //
  //   … ; unit test: `execution-providers/docker/tests/unit/egress-network-preflight.spec.ts`
  //
  // The `Tnnn` requirement exists to reject prose. A `.spec.ts` path is not
  // prose; it is a STRONGER reference than an id, because it names the artifact
  // instead of a number someone must look up.

  it('accepts a test named by path', () => {
    expect(
      dor08(
        '- [X] T670 Preflight the egress network in `execution-providers/docker/src/index.ts` (unit test: `execution-providers/docker/tests/unit/egress-network-preflight.spec.ts`)',
      ).passed,
    ).toBe(true);
  });

  it('accepts several tests named by path', () => {
    // EPIC-028 T668's actual shape: two implementations, two named tests.
    expect(
      dor08(
        '- [X] T668 Make the socket resolution platform-aware in `execution-providers/docker/src/index.ts` and add a CLI entry point in `scripts/v6-real-run.mjs` (unit tests: `execution-providers/docker/tests/unit/socket-resolution.spec.ts`, `scripts/tests/v6-entry-point.spec.mjs`)',
      ).passed,
    ).toBe(true);
  });

  it('accepts a conformance spec named by path', () => {
    // EPIC-028 T587: a mutation-testing task that names the suite it turns red.
    expect(
      dor08(
        '- [X] T587 Mutation-test the suite — break one assertion in `agent-adapters/fixture/src/fixture.agent.ts`, confirm `agent-adapters/fixture/tests/conformance.spec.ts` turns red',
      ).passed,
    ).toBe(true);
  });

  it('still rejects a path that is not a test', () => {
    // The narrowing must not become "naming any second file excuses the task".
    expect(
      dor08('- [X] T001 Implement a in `backend/src/a.ts` alongside `backend/src/b.ts`').passed,
    ).toBe(false);
  });

  it('still rejects prose', () => {
    expect(
      dor08('- [X] T001 Implement it in `backend/src/a.ts` and check the output carefully').passed,
    ).toBe(false);
  });
});
