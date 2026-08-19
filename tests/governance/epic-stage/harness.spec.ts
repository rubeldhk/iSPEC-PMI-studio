/**
 * T521 · Check `G-26-11` — the group runs where it says it runs, and needs nothing.
 * Written to FAIL before T525 exists (Constitution V).
 *
 * **`SC-ESK-009`: the register and DOR are verified by executable checks in CI.**
 * A check group nobody runs is a document with semicolons. Two things make that
 * true rather than intended:
 *
 * 1. **It is collected by the existing `governance` project** — no new script,
 *    no separate command someone must remember. `pnpm test:governance` runs it
 *    because the glob already covers it, and `pnpm typecheck:governance` type-
 *    checks it for the same reason.
 * 2. **It needs nothing to run.** No database, no server, no daemon, no fixture
 *    beyond a temporary directory. EPIC-004's `T453` waited nine days for a
 *    container runtime and EPIC-028's `T646b` eleven; a governance check that
 *    acquired a dependency like that would be skipped in exactly the situations
 *    where it mattered.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers';

const GROUP_DIR = join(REPO_ROOT, 'tests/governance/epic-stage');

/**
 * This file is excluded from its own scans.
 *
 * It has to spell `@testcontainers`, `writeFileSync` and the rest in order to
 * forbid them, and a scanner that matched itself would report the rule as a
 * breach of the rule. Named explicitly rather than filtered by a clever pattern
 * — an exclusion nobody can see is how a scan quietly stops covering things.
 */
const SELF = 'harness.spec.ts';

function groupFiles(suffix: string): string[] {
  return readdirSync(GROUP_DIR)
    .filter((name) => name.endsWith(suffix) && name !== SELF)
    .sort();
}

function readGroup(name: string): string {
  return readFileSync(join(GROUP_DIR, name), 'utf8');
}

describe('G-26-11 · the group is collected by the existing governance project', () => {
  it('is covered by the governance Vitest project glob', () => {
    const workspace = readFileSync(join(REPO_ROOT, 'vitest.workspace.ts'), 'utf8');
    // A separate project would mean a separate command, and `pnpm test:unit`
    // names its projects one by one — the exact mechanism EPIC-003's closure
    // records as hiding two empty projects while the run stayed green.
    expect(workspace).toMatch(/tests\/governance\/\*\*\/\*\.spec\.ts/);
  });

  it('is covered by the governance tsconfig', () => {
    const tsconfig = JSON.parse(
      readFileSync(join(REPO_ROOT, 'tests/governance/tsconfig.json'), 'utf8'),
    ) as { include?: string[] };
    // `**/*.ts` reaches into subdirectories, so `epic-stage/` is type-checked
    // without listing it. Asserted rather than assumed: a narrowed glob would
    // silently stop type-checking the derivation and the DOR.
    expect(tsconfig.include).toContain('**/*.ts');
  });

  it('actually contains the checks it claims to', () => {
    // Guards against the glob being right and the directory empty — which is
    // how two Vitest projects passed with no test files at all (EPIC-003).
    const specs = groupFiles('.spec.ts');
    expect(specs.length).toBeGreaterThan(10);
  });
});

describe('G-26-11 · the group needs nothing to run', () => {
  const FORBIDDEN = [
    { pattern: /from ['"]pg['"]/, what: 'a PostgreSQL client' },
    { pattern: /@testcontainers/, what: 'Testcontainers' },
    { pattern: /@nestjs/, what: 'a Nest application' },
    { pattern: /supertest/, what: 'an HTTP server' },
    { pattern: /dockerode|docker_engine/, what: 'a Docker daemon' },
    { pattern: /@prisma|PrismaClient/, what: 'Prisma' },
  ];

  it('imports no database, server, container or framework', () => {
    for (const name of groupFiles('.ts')) {
      const source = readGroup(name);
      for (const { pattern, what } of FORBIDDEN) {
        expect(pattern.test(source), `${name} requires ${what} — governance checks must not`).toBe(
          false,
        );
      }
    }
  });

  it('confines its only filesystem writes to a temporary directory', () => {
    // `fixtures.ts` is the one module that writes, and it writes to `tmpdir()`.
    // A check that wrote into the repository would mutate the tree it is
    // measuring — and the register is generated from that tree.
    const writers = groupFiles('.ts').filter((name) => /writeFileSync|mkdirSync/.test(readGroup(name)));
    for (const name of writers) {
      const source = readGroup(name);
      const permitted = name === 'fixtures.ts' || name === 'register.spec.ts';
      expect(
        permitted,
        `${name} writes to the filesystem; only fixtures.ts (tmpdir) and register.spec.ts (UPDATE_REGISTER) may`,
      ).toBe(true);
      if (name === 'fixtures.ts') expect(source).toMatch(/tmpdir\(\)/);
    }
  });

  it('cleans up every fixture tree it creates', () => {
    // A suite leaving temporary directories behind is a suite that fills a disk
    // on a machine nobody is watching.
    for (const name of groupFiles('.spec.ts')) {
      const source = readGroup(name);
      if (!/buildEpicTree\(/.test(source)) continue;
      expect(source, `${name} builds a fixture tree and never cleans it up`).toMatch(
        /cleanup\(\)/,
      );
    }
  });

  it('reads the clock in one place only, and injects it everywhere else', () => {
    // Waiver expiry needs a date; RF-2 forbids clock-derived register content.
    // The reconciliation is that `today` is injected, defaulting to the clock
    // at exactly one outermost edge.
    const clockUsers = groupFiles('.ts').filter((name) => /new Date\(\)/.test(readGroup(name)));
    expect(clockUsers, `the clock is read in ${clockUsers.join(', ')}`).toEqual(['build.ts']);
  });
});
