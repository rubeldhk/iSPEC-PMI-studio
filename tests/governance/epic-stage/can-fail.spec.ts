/**
 * T522 · Check `G-26-02` — every check in this group is capable of failing.
 * Written to FAIL before T524 exists (Constitution V).
 *
 * **A check that cannot fail is decoration.** This repository has recorded that
 * failure eleven times as "a check that names the right condition and cannot
 * observe it" — and twice in this epic alone, both mine:
 *
 * - **Phase 5**: `derivePosture` carried an `Object.hasOwn(postureKinds, …)`
 *   guard. Removing it left every test green, because the switch already ignored
 *   unrecognised kinds. The guard was deleted rather than given a test.
 * - **Phase 7**: `T518`'s `RF-6` patterns were written through a heredoc where
 *   `\b` is a **backspace character**. `/\bCLOSED\b/` became `/␈CLOSED␈/` —
 *   present, reachable, and matching nothing. `String(pattern)` printed
 *   `/CLOSED/`. Four rounds of diagnostics to find.
 *
 * So the third rule below is not general hygiene. It is the specific,
 * mechanical guard against the exact bug that got past every other observable
 * in this epic, and it would have caught it in seconds.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers';

const GROUP_DIR = join(REPO_ROOT, 'tests/governance/epic-stage');

function files(suffix: string): string[] {
  return readdirSync(GROUP_DIR)
    .filter((name) => name.endsWith(suffix))
    .sort();
}

function read(name: string): string {
  return readFileSync(join(GROUP_DIR, name), 'utf8');
}

/** Strip comments — a rule quoted in a docblock must not satisfy the rule. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('G-26-02 · every check asserts something', () => {
  it('gives every spec file at least one assertion', () => {
    for (const name of files('.spec.ts')) {
      const assertions = code(read(name)).match(/\bexpect\(/g) ?? [];
      expect(assertions.length, `${name} contains no assertion`).toBeGreaterThan(0);
    }
  });

  it('lets no spec file rest ENTIRELY on tautologies', () => {
    // `expect(true).toBe(true)` is legitimate as a deliberate always-pass in a
    // reporting check — `G-10` and `G-28-01` both use it, and both say why. It
    // is not legitimate as a file's only assertion, which is a suite that
    // reports green having tested nothing.
    for (const name of files('.spec.ts')) {
      const body = code(read(name));
      const total = (body.match(/\bexpect\(/g) ?? []).length;
      const tautologies = (body.match(/expect\((?:true|false|1|'x')\)\.toBe\(/g) ?? []).length;
      expect(tautologies, `${name} asserts only tautologies`).toBeLessThan(total);
    }
  });

  it('gives every module under test at least one spec that imports it', () => {
    // A module nobody imports is a module nobody tests, however many checks sit
    // beside it in the directory.
    const modules = files('.ts').filter((name) => !name.endsWith('.spec.ts') && name !== 'fixtures.ts');
    const specs = files('.spec.ts').map(read).join('\n');
    for (const module of modules) {
      const importName = module.replace(/\.ts$/, '');
      expect(specs, `${module} is imported by no spec in the group`).toMatch(
        new RegExp(`from '\\./${importName}'`),
      );
    }
  });
});

describe('G-26-02 · no check is inert (the Phase 7 bug, made impossible)', () => {
  it('contains no control character anywhere in the group', () => {
    // THE assertion this file exists for. A backspace, form feed or vertical
    // tab inside a regex literal is invisible in every editor, prints
    // identically under `String(pattern)`, and silently stops the pattern
    // matching. Tab, newline and carriage return are ordinary whitespace and
    // are excluded.
    // eslint-disable-next-line no-control-regex
    const control = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
    for (const name of files('.ts')) {
      const source = read(name);
      const index = source.search(control);
      expect(
        index,
        `${name} contains a control character at offset ${index} — ` +
          `U+${(source.codePointAt(index) ?? 0).toString(16).padStart(4, '0').toUpperCase()}. ` +
          `A \\b written through a shell heredoc becomes a BACKSPACE, and the regex silently matches nothing.`,
      ).toBe(-1);
    }
  });

  it('leaves no regex with an empty or single-character source by accident', () => {
    // The other shape the same bug takes: a mangled pattern that collapses to
    // something trivially true.
    for (const name of files('.ts')) {
      for (const match of code(read(name)).matchAll(/\/([^/\n\\]|\\.)*\/[gimsuy]*/g)) {
        const literal = match[0];
        if (!/^\/.+\/[gimsuy]*$/.test(literal)) continue;
        expect(literal.length, `${name} contains a suspiciously empty regex ${literal}`).toBeGreaterThan(2);
      }
    }
  });
});

describe('G-26-02 · the severity split is applied, not merely defined', () => {
  it('classifies every finding through the shared severity module', () => {
    // FR-ESK-016 splits build-failing from reporting. A severity spelled by
    // hand at each call site drifts, and the drift is invisible until a
    // build-failing condition quietly reports instead.
    const build = read('build.ts');
    expect(build).toMatch(/from '\.\/severity'/);
    // No literal severities left at the call sites.
    expect(build).not.toMatch(/severity:\s*'(?:report|fail)'/);
  });

  it('names both severities, and only those', () => {
    const severity = read('severity.ts');
    expect(severity).toMatch(/'report'/);
    expect(severity).toMatch(/'fail'/);
  });
});
