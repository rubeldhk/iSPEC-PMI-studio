/**
 * T150d (EPIC-014 F-11.3) — migrations run before the process, and a failed
 * migration stops the stack.
 *
 * `R-014-5`. Prisma's own deployment guidance is explicit that migrations
 * should complete before the app starts, *"otherwise the app may hit errors
 * when it queries a database that doesn't have the expected tables"*.
 * `prisma migrate deploy` only applies migration files — it does not read the
 * schema to fetch models, detect drift, reset the database or need a shadow
 * database — which is what makes it safe to run unattended at start.
 *
 * **The ordering is the requirement, and so is the abort.** An API that starts
 * against an unmigrated database does not fail: it *runs*, and answers `500` to
 * everything. Whoever meets that sees a broken API, not a missing migration,
 * and looks in the wrong place. Keeping the migration out of `main.ts` is what
 * makes the failure land where it belongs.
 *
 * This reads the entrypoint script rather than executing it. Running it would
 * need a database and Docker, which belongs in `T150l`'s quickstart run — a
 * check that needs infrastructure is a check that goes flaky and then gets
 * skipped.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ENTRYPOINT = join(ROOT, 'docker', 'entrypoint.sh');

function script(): string {
  return readFileSync(ENTRYPOINT, 'utf8');
}

/** Index of the first line matching a pattern, or -1. */
function lineOf(text: string, pattern: RegExp): number {
  return text.split(/\r?\n/).findIndex((line) => pattern.test(line) && !line.trim().startsWith('#'));
}

/**
 * The script with its comments stripped — the commands, and only those.
 *
 * A shell script that explains *why it does not seed* contains the word
 * "seed", and the first version of the `does not seed` assertion below fired
 * on that comment. A check that cannot tell an instruction from an explanation
 * punishes the documentation that makes the instruction reviewable, which is
 * exactly backwards.
 */
function commands(): string {
  return script()
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

describe('T150d · the container entrypoint', () => {
  it('exists', () => {
    // Written before `T150j` creates it, so this is RED first.
    expect(
      existsSync(ENTRYPOINT),
      'docker/entrypoint.sh does not exist yet — expected while F-11.3 is being built',
    ).toBe(true);
  });

  it('aborts on any failing command', () => {
    if (!existsSync(ENTRYPOINT)) return;
    // Without this, a failed migration prints an error and the script carries
    // on to start the API — which is precisely the outcome this task exists to
    // prevent, arrived at by omission rather than by decision.
    expect(script(), 'the entrypoint does not `set -e` — a failed step would not stop the start')
      .toMatch(/set\s+-[a-z]*e/);
  });

  it('runs `prisma migrate deploy`', () => {
    if (!existsSync(ENTRYPOINT)) return;
    expect(script(), 'the entrypoint does not run migrations').toMatch(/migrate\s+deploy/);
  });

  it('does NOT use a command that resets or generates instead', () => {
    if (!existsSync(ENTRYPOINT)) return;
    // `migrate dev` prompts, resets on drift and generates artifacts. In a
    // container start that is data loss with a friendly name.
    const text = commands();
    expect(text, 'the entrypoint runs `migrate dev` — it resets on drift').not.toMatch(
      /migrate\s+dev\b/,
    );
    expect(text, 'the entrypoint runs `migrate reset` — that is data loss at start').not.toMatch(
      /migrate\s+reset\b/,
    );
    expect(text, 'the entrypoint runs `db push` — it bypasses the migration history').not.toMatch(
      /db\s+push\b/,
    );
  });

  it('runs the migration BEFORE the API process — the ordering is the point', () => {
    if (!existsSync(ENTRYPOINT)) return;
    const text = script();
    const migrate = lineOf(text, /migrate\s+deploy/);
    const start = lineOf(text, /src\/main\.ts|pnpm.*start|node .*main/);
    expect(migrate, 'no migration step found').toBeGreaterThanOrEqual(0);
    expect(start, 'no API start found').toBeGreaterThanOrEqual(0);
    expect(
      migrate,
      `the migration is on line ${migrate + 1} and the API start on line ${start + 1}. ` +
        'An API that starts against an unmigrated database answers 500 to everything, and ' +
        'looks like a broken API rather than a missing migration.',
    ).toBeLessThan(start);
  });

  it('does not seed — no image invents a credential', () => {
    if (!existsSync(ENTRYPOINT)) return;
    // `R-014-6`. An entrypoint that seeds must carry or generate a password,
    // which destroys the posture `backend/prisma/seed.ts` exists to hold. The
    // seed stays a command a person runs, with the password supplied then.
    expect(
      commands(),
      'the entrypoint runs the seed — it would have to carry a credential to do so',
    ).not.toMatch(/\bseed\b/);
  });
});

describe('T150d · the migration stays OUT of the application bootstrap', () => {
  it('main.ts does not run migrations', () => {
    // The other half of the same requirement. Moving `migrate deploy` into
    // `main.ts` would satisfy every assertion above — the entrypoint would
    // still be ordered correctly — while restoring the exact failure mode:
    // a process that starts, then discovers the schema is wrong.
    const main = readFileSync(join(ROOT, 'backend', 'src', 'main.ts'), 'utf8');
    expect(main, 'main.ts runs migrations — a schema failure becomes a runtime failure').not.toMatch(
      /migrate\s+deploy|migrateDeploy/,
    );
  });
});
