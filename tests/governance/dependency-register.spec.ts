/**
 * T436c / T436e (EPIC-036) — `TS-001`, asserted instead of trusted.
 *
 * `specs/_shared/dependencies.md` is the third-party dependency register, and
 * `TS-001` requires **a register entry before a dependency enters a
 * `package.json`**. Nothing checked it. The register was maintained by
 * discipline alone, which works exactly until it does not:
 *
 *   - `EPIC-030` `T993d` read "supertest is absent from `backend/package.json`"
 *     as "supertest is absent from the register", and nearly added a second row
 *     (`D-30`) for a library `D-22` had carried since the platform
 *     specification.
 *   - `EPIC-036` did the same thing with React Router. Its plan and
 *     `research.md` `R-036-1` both call it new and name it `D-30`; `D-13` has
 *     carried it at 6.x since the platform specification, declared for routing
 *     nobody built.
 *
 * Twice, in six Epics, on the same question. Both were caught by reading rather
 * than by a check, and reading is not a control. This is the control.
 *
 * **What it does not check.** That a row is *accurate* — the licence column is
 * explicitly "stated as expected, not verified" and this file cannot verify a
 * licence. It checks that every third-party runtime dependency the workspace
 * actually installs is **named somewhere in the register**, which is the half
 * `TS-001` is about and the half that silently rots.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers';

const REGISTER = join(REPO_ROOT, 'specs', '_shared', 'dependencies.md');

/** The packages whose `dependencies` this rule governs. */
const PACKAGES = ['frontend', 'backend', 'worker'] as const;

/**
 * Register rows name **components**, not npm package names, and a component is
 * sometimes several packages. Each alias below points at the row that already
 * covers it, so the mapping is a short declared list rather than a fuzzy match.
 *
 * A package that is NOT here and NOT named in the register fails — which is
 * what makes a genuinely new dependency (React Router 7 was the live case)
 * impossible to install quietly.
 */
const COVERED_BY: Readonly<Record<string, string>> = Object.freeze({
  'react-dom': 'D-12 React',
  '@nestjs/common': 'D-03 NestJS',
  '@nestjs/platform-express': 'D-03 NestJS',
  // NestJS's own required peers. `@nestjs/core` documents both as mandatory,
  // so they arrive with D-03 rather than as choices anyone made.
  'reflect-metadata': 'D-03 NestJS',
  rxjs: 'D-03 NestJS',
});

function register(): string {
  return readFileSync(REGISTER, 'utf8');
}

/** Runtime dependencies only — devDependencies are D-21…D-27's business. */
function runtimeDependencies(pkg: string): string[] {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, pkg, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.keys(manifest.dependencies ?? {}).filter((name) => !name.startsWith('@pmi/'));
}

/**
 * Is this package named in the register?
 *
 * Matched case-insensitively against the whole document, on the npm name and on
 * a de-scoped, de-hyphenated form — `react-router` also matches a row reading
 * "React Router". Deliberately generous: the failure this guards against is a
 * dependency **absent entirely**, and a stricter matcher would fail on the
 * register's own prose style instead.
 */
function namedInRegister(pkg: string, text: string): boolean {
  const lower = text.toLowerCase();
  const bare = pkg.replace(/^@[^/]+\//, '');
  return [pkg, bare, bare.replace(/[-_]/g, ' ')].some((form) => lower.includes(form.toLowerCase()));
}

const ALL = PACKAGES.flatMap((pkg) => runtimeDependencies(pkg).map((name) => ({ pkg, name })));

describe('TS-001 · every runtime dependency is in the register (T436c)', () => {
  it('reads a substantial number of dependencies, or this check proves nothing', () => {
    // Anti-vacuity. A manifest path typo would make every assertion below pass
    // over an empty list, forever, silently.
    expect(ALL.length, 'no runtime dependencies were read at all').toBeGreaterThan(10);
  });

  it('names every third-party runtime dependency', () => {
    const text = register();
    const missing = ALL.filter(
      ({ name }) => !(name in COVERED_BY) && !namedInRegister(name, text),
    ).map(({ pkg, name }) => `${pkg}: ${name}`);

    expect(
      missing,
      `not in specs/_shared/dependencies.md — TS-001 requires the row BEFORE the install:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('would notice a dependency that is absent from the register', () => {
    // The mutation, asserted directly rather than performed by hand. Without
    // it, a matcher that returned true for everything would pass the test
    // above and prove nothing — the shape `T436n` guards for the shell.
    expect(namedInRegister('some-package-nobody-registered', register())).toBe(false);
    expect(namedInRegister('react-router', register())).toBe(true);
  });
});

describe('D-13 · React Router is registered at the version installed (T436e)', () => {
  const frontend = JSON.parse(
    readFileSync(join(REPO_ROOT, 'frontend', 'package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string> };

  it('installs React Router 7.x, which is what D-13 now records', () => {
    // `R-036-1` chose v7 specifically: v7 publishes `react-router` (the v6-era
    // `react-router-dom` is superseded), and declarative mode is the library
    // rather than the framework.
    expect(frontend.dependencies?.['react-router'], 'react-router is not installed').toMatch(
      /^[~^]?7\./,
    );
    expect(register()).toMatch(/\|\s*\*\*D-13\*\*\s*\|\s*\*\*React Router\*\*\s*\|\s*\*\*7\.x\*\*/);
  });

  it('does not install react-router-dom, which v7 supersedes', () => {
    expect(Object.keys(frontend.dependencies ?? {})).not.toContain('react-router-dom');
  });

  it('leaves React pinned at 18.3.1', () => {
    // `R-036-1` claims v7 bridges React 18 to 19 rather than requiring 19. A
    // silent bump to React 19 would falsify that claim without failing
    // anything else in this repository — the whole reason this assertion is
    // here and not in a comment.
    expect(frontend.dependencies?.react).toBe('^18.3.1');
    expect(frontend.dependencies?.['react-dom']).toBe('^18.3.1');
  });
});
