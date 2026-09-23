/**
 * T452 (EPIC-014 F-11.1) — `README.md` exists and covers every setup step in
 * `specs/_shared/quickstart.md`.
 *
 * **The executable check Constitution V (v1.2.0) requires for a document
 * output.** `T150` produces prose, and prose is exactly where "somebody will
 * read it before merging" quietly replaces a gate. Manual review does not
 * satisfy Constitution V; this does.
 *
 * **The steps are DERIVED from the quickstart, not listed here.** A hardcoded
 * list is a second copy of the setup, and the two would drift the first time
 * someone added a step — leaving a check that passes while the README is
 * missing exactly the new thing. Reading the quickstart's own fenced Setup
 * block means adding a step there makes this fail until the README catches up,
 * which is the whole point.
 *
 * **What it does NOT check, and `DEF-014-001` is the proof it matters.** This
 * compares two documents. It catches drift between them; it cannot catch drift
 * between a document and the stack. The quickstart told developers to run
 * `docker compose up -d postgres redis` for months and `docker-compose.yml`
 * defines no `redis` service — a check like this one would have happily
 * confirmed the README said the same wrong thing. Running
 * `docker compose config --services` and comparing belongs with `EPIC-001`'s
 * `T009`, which owns the compose file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const README = resolve(ROOT, 'README.md');
const QUICKSTART = resolve(ROOT, 'specs/_shared/quickstart.md');

/** The commands inside the quickstart's `## Setup` fenced block. */
function setupCommands(): string[] {
  const body = readFileSync(QUICKSTART, 'utf8');
  const section = /##\s+Setup\s*\n+```bash\n([\s\S]*?)```/.exec(body);
  if (!section) return [];
  return section[1]!
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter((line) => line.length > 0);
}

const COMMANDS = setupCommands();
const readme = existsSync(README) ? readFileSync(README, 'utf8') : '';

describe('T452 · README.md covers the documented setup', () => {
  it('found the setup block to check against — an empty scan would prove nothing', () => {
    // Anti-vacuity. If the quickstart's fence were renamed, every assertion
    // below would pass over a README that documented nothing at all.
    expect(COMMANDS.length).toBeGreaterThanOrEqual(4);
  });

  it('README.md exists at the repository root', () => {
    // The repository held only `readme.txt`, which no tool and no convention
    // reads.
    expect(existsSync(README), 'README.md is missing from the repository root').toBe(true);
  });

  it.each(COMMANDS)('documents `%s`', (command) => {
    expect(readme).toContain(command);
  });

  it('is a setup document, not a stub that happens to contain the commands', () => {
    // A file listing five commands and nothing else satisfies every assertion
    // above while telling a reader nothing about prerequisites or what to
    // expect — the "transcript, not a tick" distinction T884 draws.
    expect(readme.length).toBeGreaterThan(600);
    expect(readme).toMatch(/prerequisite/i);
    expect(readme).toMatch(/test/i);
  });

  it('documents BOTH stacks, and says which is which (T150p)', () => {
    // `EPIC-014` F-11.3 added a containerised stack beside the reference local
    // one. A README that documents only one of them is worse than a README
    // that documents neither, because it reads as complete.
    expect(readme, 'the README does not document the containerised stack').toMatch(
      /docker compose up -d --build/,
    );
    expect(readme, 'the README does not document the reference local stack').toMatch(
      /pnpm --filter frontend dev/,
    );

    // **And it must say which measurement belongs to which stack.** `T442l`
    // pins the reference stack precisely because `SC-SHL-006`'s p95 was a
    // criterion whose scope had been named and never defined. Two stacks in one
    // document reopens exactly that ambiguity unless the document closes it.
    expect(
      readme,
      'the README names no reference stack for SC-SHL-006 — two stacks and one unqualified number ' +
        'is the ambiguity T442l was written to end',
    ).toMatch(/SC-SHL-006/);
  });

  it('does not tell the reader to seed a production-mode container without overriding NODE_ENV', () => {
    // Found by running it (T150l Scenario 6): the image sets NODE_ENV=production
    // and backend/prisma/seed.ts refuses that outright. `quickstart.md`'s
    // Scenario 6 command fails for exactly this reason. The refusal is correct;
    // the instruction was wrong, and an instruction that cannot work is worse
    // than an absent one.
    const seedInContainer = [...readme.matchAll(/docker compose exec[^`]*?seed[^`]*/g)].map(
      (m) => m[0],
    );
    for (const command of seedInContainer) {
      expect(
        command,
        `the README seeds inside the container without NODE_ENV=development:
  ${command}
` +
          'The image runs as production and the seed refuses it.',
      ).toMatch(/NODE_ENV=development/);
    }
  });

  it('does not tell the reader to start a service the compose file does not define', () => {
    const compose = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf8');
    const services = [...compose.matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((m) => m[1]!);
    const named = [...readme.matchAll(/docker compose up[^\n]*/g)].flatMap((m) =>
      // Everything after `docker compose up`, minus the shell noise. `T150n`
      // added `docker compose up -d --build   # everything, on …`, and the
      // original positional slice read first `--build` and then `#` as service
      // names. **Neither counting positions nor trusting the line shape was
      // ever the rule** — the rule is "the words that name services".
      m[0]
        .split('#')[0]!
        .split(/\s+/)
        .slice(3)
        .filter((token) => token !== '' && !token.startsWith('-')),
    );

    // DEF-014-001 in check form, for the README half only. The quickstart half
    // is EPIC-001's T009 to close — see the header.
    expect(services.length).toBeGreaterThan(0);
    for (const service of named) {
      expect(services, `README starts "${service}", which docker-compose.yml does not define`).toContain(service);
    }
  });
});

describe('T1382 · README.md names the six local-workspace variables (EPIC-041)', () => {
  // `R-041-2`: the projects root is mounted, the public URL is written into
  // every project's `.pmi/project.json`, and the worker host needs `uv`. A
  // README that leaves one of the six out sends an operator to the source.
  const VARIABLES = [
    'PMI_PROJECTS_ROOT',
    'PMI_PROJECTS_ROOT_HOST',
    'PMI_PUBLIC_URL',
    'PMI_ENGINE_TAG',
    'PMI_MCP_SERVER_VERSION',
    'PMI_INITIALISE_WAIT_MS',
  ];

  it.each(VARIABLES)('documents %s', (variable) => {
    expect(readme, `README.md does not mention ${variable}`).toContain(variable);
  });

  it('tells the operator that uv must be on the worker host, and what happens without it', () => {
    expect(readme).toMatch(/\buv\b/);
    expect(readme).toMatch(/initialisation pending/i);
  });
});

/**
 * `T1669` (EPIC-045) — the two artifact variables are documented where an
 * operator will look, and the example file carries them.
 *
 * A variable that exists in code and nowhere in prose is a variable nobody sets
 * until something breaks. `PMI_ARTIFACT_MAX_BYTES` and `PMI_ARTIFACT_MAX_FILES`
 * both change what a governed command's finish hook is told, so their absence
 * from the README is a support ticket waiting to be filed.
 */
describe('T1669 · the artifact limits are documented (EPIC-045)', () => {
  const ENV_EXAMPLE = resolve(ROOT, '.env.example');
  const envExample = existsSync(ENV_EXAMPLE) ? readFileSync(ENV_EXAMPLE, 'utf8') : '';

  it.each(['PMI_ARTIFACT_MAX_BYTES', 'PMI_ARTIFACT_MAX_FILES', 'PMI_ARTIFACT_SYNC_BODY_BYTES'])('README §Setup names %s', (name) => {
    const setup = readme.split(/^## Setup$/m)[1]?.split(/^## (?!#)/m)[0] ?? '';
    expect(setup, `README §Setup does not name ${name}`).toContain(name);
  });

  it.each(['PMI_ARTIFACT_MAX_BYTES', 'PMI_ARTIFACT_MAX_FILES', 'PMI_ARTIFACT_SYNC_BODY_BYTES'])('.env.example carries %s with a default', (name) => {
    // A line of the form `NAME=<something>`: the variable is not merely
    // mentioned in a comment, it has a value an operator can copy.
    const assigned = envExample.split(/\r?\n/).find((line) => line.startsWith(`${name}=`));
    expect(assigned, `.env.example does not carry ${name} with a value`).toBeDefined();
    expect((assigned ?? '').slice(name.length + 1).trim().length, `${name} has no default`).toBeGreaterThan(0);
  });

  it('the README states the defaults the code actually uses', () => {
    // A documented default that disagrees with the code is worse than none.
    expect(readme).toContain('1048576');
    expect(readme).toMatch(/PMI_ARTIFACT_MAX_FILES[^|]*\|\s*`?200`?/);
  });

  it('the README says a refusal is per file, since that is the behaviour operators get wrong', () => {
    const setup = readme.split(/^## Setup$/m)[1]?.split(/^## (?!#)/m)[0] ?? '';
    expect(setup).toMatch(/per file/i);
    expect(setup).toContain('too_large');
    expect(setup).toContain('too_many_files');
  });

  it('the operator guide covers the migration, the derived key and what a refusal looks like', () => {
    const guide = readFileSync(resolve(ROOT, 'docs', 'operator-setup.md'), 'utf8');
    expect(guide).toContain('20260906090000_epic045_artifacts');
    expect(guide).toContain('PMI_ARTIFACT_MAX_BYTES');
    expect(guide).toContain('PMI_ARTIFACT_MAX_FILES');
    expect(guide, 'the guide does not describe the derived idempotency key').toMatch(/artifacts:<executionId>/);
    expect(guide, 'the guide does not say what a refused file looks like').toContain('credential_shape');
  });
});
