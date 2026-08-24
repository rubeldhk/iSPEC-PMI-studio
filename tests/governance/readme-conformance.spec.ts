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

  it('does not tell the reader to start a service the compose file does not define', () => {
    const compose = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf8');
    const services = [...compose.matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((m) => m[1]!);
    const named = [...readme.matchAll(/docker compose up[^\n]*/g)].flatMap((m) =>
      m[0].split(/\s+/).slice(4),
    );

    // DEF-014-001 in check form, for the README half only. The quickstart half
    // is EPIC-001's T009 to close — see the header.
    expect(services.length).toBeGreaterThan(0);
    for (const service of named) {
      expect(services, `README starts "${service}", which docker-compose.yml does not define`).toContain(service);
    }
  });
});
