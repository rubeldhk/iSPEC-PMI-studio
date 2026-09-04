/**
 * `T1310` (EPIC-041) — the projects-root configuration is declared, mounted and
 * carries no path from anyone's machine.
 *
 * **The executable check Constitution V requires for a configuration output.**
 * `docker-compose.yml` and `.env.example` are where a developer learns what the
 * platform needs to write a directory the user can open. Six variables, one
 * mount (`FR-LPW-005`, `R-041-2`; analysis findings `U2` and `I1` added
 * `PMI_PUBLIC_URL` and `PMI_INITIALISE_WAIT_MS`, which had lived only in prose
 * and in one task respectively).
 *
 * Written to FAIL before `T1311` exists.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers';

const compose = readFileSync(join(REPO_ROOT, 'docker-compose.yml'), 'utf8');
const envExample = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');

/** The six, in the order `plan.md` §Configuration lists them. */
const VARIABLES = [
  'PMI_PROJECTS_ROOT',
  'PMI_PROJECTS_ROOT_HOST',
  'PMI_PUBLIC_URL',
  'PMI_SPECKIT_TAG',
  'PMI_MCP_SERVER_VERSION',
  'PMI_INITIALISE_WAIT_MS',
] as const;

/** The `app:` service block of the compose file, up to the next top-level key. */
function appService(): string {
  const start = compose.indexOf('\n  app:');
  expect(start, 'docker-compose.yml has no app service').toBeGreaterThan(-1);
  const rest = compose.slice(start + 1);
  const next = rest.search(/\n[a-z]/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('T1310 · .env.example declares the six local-workspace variables', () => {
  it.each(VARIABLES)('declares %s', (name) => {
    expect(envExample, `${name} is not declared in .env.example`).toMatch(
      new RegExp(`^${name}=`, 'm'),
    );
  });

  it('gives no variable a value that is a path on somebody\'s machine', () => {
    // A committed example that says C:\Users\alice\projects works for exactly
    // one person and misleads everyone else. Roots are left empty or given a
    // container-side placeholder; the host root is the developer's to fill in.
    for (const line of envExample.split(/\r?\n/)) {
      const m = /^PMI_PROJECTS_ROOT(?:_HOST)?=(.*)$/.exec(line);
      if (!m) continue;
      const value = m[1]!.trim();
      expect(value, `${line} names a machine-specific path`).not.toMatch(/^[A-Za-z]:\\|^\/Users\/|^\/home\//);
    }
  });

  it('defaults the public URL to the compose port, not to a hostname', () => {
    expect(envExample).toMatch(/^PMI_PUBLIC_URL=http:\/\/localhost:\d+/m);
  });

  it('pins the Spec Kit tag with a leading v, as the release tags are spelled', () => {
    expect(envExample).toMatch(/^PMI_SPECKIT_TAG=v\d+\.\d+\.\d+/m);
  });
});

describe('T1310 · docker-compose.yml mounts the projects root into the app service', () => {
  it('binds ${PMI_PROJECTS_ROOT_HOST} to /projects', () => {
    expect(appService()).toMatch(/\$\{PMI_PROJECTS_ROOT_HOST[^}]*\}:\/projects/);
  });

  it('tells the API to write under /projects', () => {
    expect(appService()).toMatch(/PMI_PROJECTS_ROOT:\s*\/projects/);
  });

  it('passes the host root and the public URL through from the environment, never as literals', () => {
    const app = appService();
    expect(app).toMatch(/PMI_PROJECTS_ROOT_HOST:\s*\$\{PMI_PROJECTS_ROOT_HOST/);
    expect(app).toMatch(/PMI_PUBLIC_URL:\s*\$\{PMI_PUBLIC_URL/);
  });
});
