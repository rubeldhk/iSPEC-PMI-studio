/**
 * T656 — the API bootstrap installs observability.
 *
 * Convergence found `logger.ts`, `correlation.ts` and `metrics.ts` fully built,
 * fully tested, and referenced by NOTHING outside their own specs — while
 * `spec.md` claims *"PP-010 Observability by Default · ✅ Satisfied here for the
 * whole platform."* At runtime nothing emitted a log, a metric, or a correlation
 * identifier.
 *
 * These assertions are about INSTALLATION, and only into THIS process. The
 * bundle's behaviour is asserted once, in
 * `packages/observability/tests/unit/bootstrap.spec.ts`.
 *
 * **This file used to carry both**, and that is how DEF-001-001 survived: a file
 * named for the bootstrap, full of passing bundle assertions, whose two
 * installation checks both read `backend/src/main.ts`. It looked like coverage
 * of observability. It was coverage of one process. The worker's counterpart is
 * `worker/tests/unit/observability-installation.spec.ts` (T660) — if a third
 * process is ever added, it needs a third file, not another `describe` here.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Comments are stripped before asserting.
 *
 * These checks previously read raw source, so a file that merely *mentioned*
 * `buildObservability` in a comment would have passed while installing nothing.
 * Mirrors `worker/tests/unit/observability-installation.spec.ts` (T660).
 */
function code(path: string): string {
  return readFileSync(resolve(here, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const apiMain = code('../../../src/main.ts');

describe('T656 · the API bootstrap installs observability', () => {
  it('main.ts builds the observability bundle', () => {
    // The whole finding: without this the three modules are dead code.
    //
    // The CALL, not the import. Mutation-tested during T661: `/buildObservability/`
    // alone is satisfied by the `import { buildObservability }` statement, so
    // deleting the install left this check green — an assertion that matches the
    // DECLARATION of a capability rather than its USE.
    expect(apiMain).toMatch(/buildObservability\s*\(/);
  });

  it('main.ts emits a startup record, so a running API proves it is wired', () => {
    expect(apiMain).toMatch(/loggerFor\s*\(/);
    expect(apiMain).toMatch(/api\.started/);
  });

  it('main.ts takes observability from the shared package, not a local copy', () => {
    // T661/DEF-001-001: a second implementation is how the redaction rules in
    // FORBIDDEN_KEYS come to disagree between the two processes.
    expect(apiMain).toMatch(/@pmi\/observability/);
  });
});
