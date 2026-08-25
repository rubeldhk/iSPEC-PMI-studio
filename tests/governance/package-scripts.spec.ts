/**
 * T150b (EPIC-014 F-11.3) — every `package.json` script's entry point resolves.
 *
 * **This check exists because the documented developer entry point did not
 * start.** `pnpm --filter @pmi/backend dev` was
 * `tsx --env-file-if-exists=../.env watch src/main.ts`. `tsx` treats the first
 * non-flag argument as the file to run, so it tried to load
 * `…/backend/watch` and died with `ERR_MODULE_NOT_FOUND`. Found during
 * `EPIC-036`'s UAT on 2026-08-24, when the API had to be started with `start`
 * instead — losing hot reload for the rest of that session.
 *
 * Nobody noticed for as long as it took somebody to actually run it. A script
 * is a non-code output in exactly the sense Constitution V means: it is
 * configuration that looks obviously correct and is only tested by use.
 *
 * ## Its fail-first evidence is the ORDERING, not a mutation
 *
 * `T150a`'s credential rule and the SPA fallback are proved by injecting a
 * fault and watching the check go red. This one does not need an injected
 * fault, because **it was written against a real one**: this file is committed
 * before `T150f` fixes the script, so its first run is red on the actual
 * defect. That is `T200c`'s standard reached by the shorter route, and it is
 * recorded in `plan.md`'s Gate V table so nobody later mistakes the absence of
 * a mutation for an absence of evidence.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The workspaces whose scripts this check reads. */
const PACKAGES = ['backend', 'frontend', 'worker', 'packages/room-contract'] as const;

interface Script {
  readonly pkg: string;
  readonly name: string;
  readonly command: string;
}

function scriptsOf(pkg: string): Script[] {
  const manifest = join(ROOT, pkg, 'package.json');
  if (!existsSync(manifest)) return [];
  const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return Object.entries(parsed.scripts ?? {}).map(([name, command]) => ({ pkg, name, command }));
}

const ALL_SCRIPTS: Script[] = PACKAGES.flatMap(scriptsOf);

/** Runners whose first non-flag argument is the file they execute. */
const FILE_RUNNERS = new Set(['tsx', 'node', 'ts-node']);

/**
 * The file a script tells its runner to execute, or `null` when the script
 * does not name one.
 *
 * The parse is the point: it reads the command **the way the runner reads it**
 * — first non-flag token after the runner is the file — rather than the way a
 * human skims it. `tsx --env-file-if-exists=../.env watch src/main.ts` looks
 * fine to a person and means `watch` to `tsx`.
 */
export function entryPointOf(command: string): { runner: string; file: string } | null {
  const tokens = command.trim().split(/\s+/);
  const runnerIndex = tokens.findIndex((t) => FILE_RUNNERS.has(t));
  if (runnerIndex === -1) return null;
  const runner = tokens[runnerIndex]!;
  const args = tokens.slice(runnerIndex + 1);

  // `watch` is a tsx SUBCOMMAND, and **only when it comes first**. After a flag
  // it is just the next non-flag token, which means tsx reads it as the file to
  // run. That single positional rule IS the defect: `tsx --flag watch main.ts`
  // looks fine to a person and means "run the file ./watch" to tsx.
  //
  // An earlier draft of this parser skipped `watch` wherever it appeared, which
  // made the broken command resolve to `src/main.ts` and the check pass over
  // the very fault it was written for. Caught by the mutation below.
  const start = runner === 'tsx' && args[0] === 'watch' ? 1 : 0;

  for (const token of args.slice(start)) {
    if (token.startsWith('-')) continue;
    return { runner, file: token };
  }
  return null;
}

describe('T150b · every declared script entry point resolves', () => {
  it('reads a substantial number of scripts, or this check proves nothing', () => {
    // Anti-vacuity. A glob that matched no manifest would report every script
    // healthy forever — the failure mode that let the broken `dev` script sit
    // undetected in the first place.
    expect(ALL_SCRIPTS.length, 'no package scripts were read').toBeGreaterThan(5);
    expect(
      ALL_SCRIPTS.filter((s) => entryPointOf(s.command) !== null).length,
      'no script named a file to run — the parser found nothing to check',
    ).toBeGreaterThan(1);
  });

  it.each(
    ALL_SCRIPTS.filter((s) => entryPointOf(s.command) !== null).map(
      (s) => [`${s.pkg}:${s.name}`, s] as const,
    ),
  )('%s runs a file that exists', (label, script) => {
    const entry = entryPointOf(script.command)!;
    const resolved = join(ROOT, script.pkg, entry.file);
    expect(
      existsSync(resolved),
      `${label} runs \`${script.command}\`, which tells ${entry.runner} to execute ` +
        `"${entry.file}" — and ${script.pkg}/${entry.file} does not exist.\n` +
        'A flag placed before `watch` makes tsx read `watch` as the filename.',
    ).toBe(true);
  });
});

describe('T150b · MUTATION — the parser must read commands the way a runner does', () => {
  it('sees the real defect: a flag before the tsx subcommand', () => {
    // The exact command that shipped, and what tsx made of it.
    expect(entryPointOf('tsx --env-file-if-exists=../.env watch src/main.ts')).toEqual({
      runner: 'tsx',
      file: 'watch',
    });
  });

  it('and reads the corrected form correctly', () => {
    expect(entryPointOf('tsx watch --env-file-if-exists=../.env src/main.ts')).toEqual({
      runner: 'tsx',
      file: 'src/main.ts',
    });
    expect(entryPointOf('tsx --env-file-if-exists=../.env src/main.ts')).toEqual({
      runner: 'tsx',
      file: 'src/main.ts',
    });
  });

  it('ignores scripts that name no file', () => {
    expect(entryPointOf('tsc --noEmit')).toBeNull();
    expect(entryPointOf('vite')).toBeNull();
    expect(entryPointOf('vitest run --project frontend')).toBeNull();
  });
});
