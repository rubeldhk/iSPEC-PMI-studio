/**
 * T537 — the test harness is not lying.
 *
 * `pnpm test:unit` names Vitest projects one by one, and the EPIC-003 closure
 * report records exactly what that hides:
 *
 *   "an empty Vitest project passes silently when sibling projects have tests"
 *
 * Two projects collected nothing, the run stayed green, and three tasks were
 * marked `[X]` with **no test file anywhere in the repository**. EPIC-028 adds
 * three more projects; without this check it would repeat threefold.
 *
 * Part (b) asserts the new packages declare the name and contract dependency
 * their scaffolds promise, which is the conformance check `T542`–`T544` pair
 * with (Constitution V covers configuration outputs).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');

const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
const workspace = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
const vitestConfig = readFileSync(join(ROOT, 'vitest.workspace.ts'), 'utf8');

/** Project names the `test:unit` script runs. */
const unitProjects = [...rootPkg.scripts['test:unit']!.matchAll(/--project\s+(\S+)/g)].map(
  (m) => m[1] as string,
);

function hasTestFile(dir: string): boolean {
  if (!existsSync(dir)) return false;
  const walk = (d: string): boolean =>
    readdirSync(d).some((entry) => {
      const p = join(d, entry);
      if (entry === 'node_modules') return false;
      return statSync(p).isDirectory() ? walk(p) : /\.spec\.(ts|mjs)$/.test(entry);
    });
  return walk(dir);
}

/** project name → the directory whose tests it collects. */
const PROJECT_DIRS: Record<string, string> = {
  'backend-unit': 'backend/tests/unit',
  'worker-unit': 'worker/tests/unit',
  'engine-contract': 'packages/engine-contract/tests',
  // EPIC-001 T661 — added when observability moved out of `backend/` so both
  // long-running processes could install it (DEF-001-001). This check failed on
  // the way in, which is the check doing its job.
  observability: 'packages/observability/tests',
  'fixture-adapter': 'engine-adapters/fixture/tests',
  'speckit-adapter': 'engine-adapters/speckit/tests',
  'execution-contract': 'packages/execution-contract/tests',
  'agent-contract': 'packages/agent-contract/tests',
  'agent-adapters': 'agent-adapters',
  // EPIC-028 T539 — registered only once T646a gave it tests. `T537` correctly
  // fails on a project that collects nothing, and registering it earlier would
  // have meant silencing the check that exists to catch exactly that.
  'execution-providers': 'execution-providers',
  // EPIC-028 T576a — the manual runner's logic. `scripts/` is application code
  // under Constitution I, so Constitution V applies to it like anything else.
  scripts: 'scripts/tests',
  // EPIC-005 T056a — the first component tests, registered the day the
  // PMI-DOC-004 hold discharged and the frontend stopped being a scaffold.
  frontend: 'frontend/tests/unit',
};

describe('T537 · every project named by test:unit actually collects tests', () => {
  it('names at least the five original projects', () => {
    expect(unitProjects.length).toBeGreaterThanOrEqual(5);
  });

  it('knows where each named project collects from', () => {
    const unknown = unitProjects.filter((p) => !(p in PROJECT_DIRS));
    expect(unknown, 'a project was added to test:unit without being mapped here').toEqual([]);
  });

  it('every named project has at least one test file', () => {
    // The precise hole: an empty project reports success, and the aggregate
    // script stays green while a whole package goes unverified.
    const empty = unitProjects.filter((p) => !hasTestFile(join(ROOT, PROJECT_DIRS[p] as string)));
    expect(empty, 'these projects collect nothing and would pass silently').toEqual([]);
  });

  it('every named project is declared in vitest.workspace.ts', () => {
    const undeclared = unitProjects.filter((p) => !vitestConfig.includes(`'${p}'`));
    expect(undeclared, 'named in test:unit but not defined as a Vitest project').toEqual([]);
  });
});

describe('T537 · the new packages are scaffolded as their tasks promise', () => {
  const EXPECTED: { dir: string; name: string; contract?: string }[] = [
    { dir: 'packages/execution-contract', name: '@pmi/execution-contract' },
    { dir: 'packages/agent-contract', name: '@pmi/agent-contract', contract: '@pmi/execution-contract' },
    { dir: 'agent-adapters/fixture', name: '@pmi/agent-adapter-fixture', contract: '@pmi/agent-contract' },
    { dir: 'agent-adapters/claude', name: '@pmi/agent-adapter-claude', contract: '@pmi/agent-contract' },
    { dir: 'execution-providers/docker', name: '@pmi/execution-provider-docker', contract: '@pmi/execution-contract' },
  ];

  it('declares the two new workspace globs', () => {
    expect(workspace).toMatch(/agent-adapters\/\*/);
    expect(workspace).toMatch(/execution-providers\/\*/);
  });

  it.each(EXPECTED)('$dir declares $name', ({ dir, name, contract }) => {
    const pkgPath = join(ROOT, dir, 'package.json');
    expect(existsSync(pkgPath), `${dir}/package.json is missing`).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      name: string;
      dependencies?: Record<string, string>;
    };
    expect(pkg.name).toBe(name);

    if (contract) {
      // A scaffold that does not depend on its contract is a package that can
      // drift from the interface it is supposed to implement.
      expect(pkg.dependencies?.[contract], `${dir} does not depend on ${contract}`).toBe(
        'workspace:*',
      );
    }
  });

  it.each(EXPECTED)('$dir has a tsconfig', ({ dir }) => {
    expect(existsSync(join(ROOT, dir, 'tsconfig.json'))).toBe(true);
  });
});
