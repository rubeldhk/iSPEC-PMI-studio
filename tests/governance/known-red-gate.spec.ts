/**
 * The known-red gate is declared in ONE place, and every consumer agrees with
 * it (2026-10-01).
 *
 * `governance/known-red.json` lists the checks that fail on purpose. Four
 * things must agree with that list or the gate rots in a way nobody sees:
 *
 *   1. the **files** it names must exist — a renamed spec leaves an entry
 *      gating nothing;
 *   2. the **README** table must name every gated check, because a check
 *      excluded from CI and absent from the table is an invisible exemption;
 *   3. the **gated scripts** must exclude exactly those files, or the step
 *      still stops on them;
 *   4. **`ci.yml`** must run the gated scripts rather than the full ones, and
 *      must run the gate itself — otherwise the exclusion silently drops two
 *      checks and nothing asserts they are still red.
 *
 * Why a check rather than care: this is four files that must say the same thing
 * about the same two rows, which is the drift shape `G-04` was written for and
 * the one `layout.spec.ts` guards for `governance/README.md`. Nothing here
 * re-states the gate's own logic — `scripts/tests/known-red.spec.mjs` owns
 * that. This file only asserts that the declaration and its consumers match.
 *
 * **It is deliberately one-directional on the README.** Every gated check must
 * appear in the table; the table may carry rows that are not gated, because
 * `scale.spec.ts` is exactly that — load-sensitive rather than owed, and it
 * stays in the failing path.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { read, REPO_ROOT } from './helpers.js';

interface KnownRedCheck {
  readonly id: string;
  readonly file: string;
  readonly project: string;
  readonly gatedScript: string;
  readonly evidence: string;
  readonly owes: string;
  readonly why?: string;
}

const MANIFEST = 'governance/known-red.json';

function checks(): KnownRedCheck[] {
  const parsed = JSON.parse(read(MANIFEST)) as { checks?: KnownRedCheck[] };
  return parsed.checks ?? [];
}

const CHECKS = checks();
const README = read('README.md');
const CI = read('.github/workflows/ci.yml');
const SCRIPTS = (JSON.parse(read('package.json')) as { scripts?: Record<string, string> }).scripts ?? {};

/** Every vitest project name the workspace declares. */
function declaredProjects(): string[] {
  return [...read('vitest.workspace.ts').matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]!);
}

/** The `## Known-red checks` section of the README, table and prose. */
function knownRedSection(): string {
  const after = README.split(/^## Known-red checks$/m)[1];
  return after?.split(/^## (?!#)/m)[0] ?? '';
}

describe('the known-red manifest is substantive and internally sound', () => {
  it('lists at least one check — an empty gate is a gate to delete', () => {
    // Anti-vacuity. With no entries every assertion below passes over nothing,
    // and `ci.yml` would be running a gate that asserts the absence of a list.
    expect(CHECKS.length, `${MANIFEST} lists no checks`).toBeGreaterThanOrEqual(1);
  });

  it.each(CHECKS.map((c) => [c.id, c] as const))('%s names a spec file that exists', (id, check) => {
    expect(
      existsSync(join(REPO_ROOT, check.file)),
      `${id} gates ${check.file}, which does not exist — a renamed spec leaves the entry gating nothing`,
    ).toBe(true);
  });

  it.each(CHECKS.map((c) => [c.id, c] as const))('%s names a declared vitest project', (id, check) => {
    expect(declaredProjects(), `${id} names project "${check.project}"`).toContain(check.project);
  });

  it.each(CHECKS.map((c) => [c.id, c] as const))('%s says what work it waits on', (id, check) => {
    // The obligation has to be legible from the manifest alone: the CI log
    // prints it, and a reader deciding whether to retire an entry needs it.
    expect(check.owes.length, `${id} says nothing about what it owes`).toBeGreaterThan(20);
    expect(check.evidence.length, `${id} names no evidence path`).toBeGreaterThan(0);
  });
});

describe('every gated check is documented in the README known-red table', () => {
  it('the section exists and is more than a heading', () => {
    expect(knownRedSection().length, 'README has no Known-red checks section').toBeGreaterThan(200);
  });

  it.each(CHECKS.map((c) => [c.id, c] as const))('%s appears in the table', (id, check) => {
    const section = knownRedSection();
    expect(section, `README's known-red table does not name ${id}`).toContain(id);
    expect(
      section,
      `README's known-red table names ${id} without its spec file, so a reader cannot find it`,
    ).toContain(check.file);
  });
});

describe('the gated scripts exclude exactly the checks the manifest names', () => {
  it.each(CHECKS.map((c) => [c.id, c] as const))('%s has a gated script that excludes it', (id, check) => {
    const command = SCRIPTS[check.gatedScript];
    expect(command, `package.json declares no "${check.gatedScript}" script for ${id}`).toBeDefined();
    expect(command, `${check.gatedScript} does not run project ${check.project}`).toContain(
      `--project ${check.project}`,
    );
    const basename = check.file.split('/').pop()!;
    expect(command, `${check.gatedScript} does not exclude ${basename}`).toContain(basename);
    expect(command, `${check.gatedScript} does not exclude anything`).toContain('--exclude');
  });

  it('the ungated scripts survive, so the full suite is still runnable by hand', () => {
    // The gate is a CI arrangement, not a change to what the suites are. A
    // developer and a release check must still be able to run everything.
    expect(SCRIPTS['test:arch'], 'test:arch is gone').toBeDefined();
    expect(SCRIPTS['test:arch']).not.toContain('--exclude');
    expect(SCRIPTS['test:governance'], 'test:governance is gone').toBeDefined();
    expect(SCRIPTS['test:governance']).not.toContain('--exclude');
  });

  it('no script is gated without a manifest entry to justify it', () => {
    const justified = new Set(CHECKS.map((c) => c.gatedScript));
    const gated = Object.keys(SCRIPTS).filter((name) => name.endsWith(':gated'));
    for (const name of gated) {
      expect(justified, `package.json gates "${name}" but no manifest entry names it`).toContain(name);
    }
  });
});

describe('ci.yml runs the gated scripts and the gate itself', () => {
  it.each(CHECKS.map((c) => [c.id, c] as const))('runs the gated script for %s', (id, check) => {
    expect(CI, `ci.yml does not run ${check.gatedScript}, so the step still stops on ${id}`).toContain(
      check.gatedScript,
    );
  });

  it('does not also run the ungated suites, which would reinstate the stop', () => {
    // `pnpm test:arch` and `pnpm test:governance` include the gated files. If a
    // step still invoked one, the exclusion above would achieve nothing.
    for (const script of ['test:arch', 'test:governance']) {
      const ungated = new RegExp(`pnpm ${script.replace(/:/g, '\\:')}\\s*$`, 'm');
      expect(ungated.test(CI), `ci.yml still runs the ungated pnpm ${script}`).toBe(false);
    }
  });

  it('runs the gate, so the two checks are still asserted to be red', () => {
    // Without this step the exclusion is a silent exemption: nothing would
    // notice the day the evidence landed or the day the spec was deleted.
    expect(CI, 'ci.yml never runs the known-red gate').toContain('test:known-red');
    expect(SCRIPTS['test:known-red'], 'package.json declares no test:known-red').toBeDefined();
  });

  it('the gate runs after the steps it unblocked, so a real failure is reported first', () => {
    // The point of the gate is that Contract, Integration and Governance now
    // run. If the gate came first, a day when it legitimately fails would once
    // again stop the pipeline before they did.
    const gate = CI.indexOf('test:known-red');
    for (const script of ['test:contract', 'test:integration', 'test:governance:gated']) {
      expect(CI.indexOf(script), `${script} is not in ci.yml`).toBeGreaterThan(-1);
      expect(gate, `the gate runs before ${script}`).toBeGreaterThan(CI.indexOf(script));
    }
  });
});
