/**
 * T549a — the `generation` egress control is unchanged (SC-AGT-005).
 *
 * The epic's own checklist calls this *"the most important criterion and the
 * easiest to skip"*: it is what proves which half of a security boundary this
 * epic did NOT touch. Until the analyse pass of 2026-08-14 it was enforced only
 * by a `git diff` inside a quickstart run.
 *
 * A content hash is the only form of the assertion that works. A modified test
 * would pass just as green and mean nothing, so this compares the manifest and
 * its existing test against `main` rather than re-asserting their contents.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');

/** The two artifacts that together define the frozen control. */
const FROZEN = [
  'engine-adapters/speckit/docker/sandbox.json',
  'engine-adapters/speckit/tests/unit/sandbox-config.spec.ts',
];

const sha = (buf: string | Buffer): string => createHash('sha256').update(buf).digest('hex');

/** Contents at `main`, or null when the ref is unavailable (shallow clone, CI). */
function atMain(path: string): string | null {
  try {
    return execFileSync('git', ['show', `main:${path}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

describe('T549a · the generation egress control is frozen (SC-AGT-005)', () => {
  it.each(FROZEN)('%s is unchanged from main', (path) => {
    const baseline = atMain(path);
    if (baseline === null) {
      // Reported, never silently passed: an unavailable ref means the check
      // did not run, which is not the same as the check succeeding.
      console.warn(`[T549a] SKIPPED — 'main:${path}' is unavailable in this checkout.`);
      return;
    }
    expect(sha(readFileSync(join(ROOT, path))), `${path} was modified`).toBe(sha(baseline));
  });

  it('the profile constant matches the manifest it mirrors', () => {
    // The contract package cannot import the adapter (boundary), so the
    // destination is duplicated. This is what stops the two drifting.
    const manifest = JSON.parse(readFileSync(join(ROOT, FROZEN[0] as string), 'utf8')) as {
      network: { egress: { allow: { host: string }[] } };
    };
    const profiles = readFileSync(
      join(ROOT, 'packages/execution-contract/src/profiles.ts'),
      'utf8',
    );

    const hosts = manifest.network.egress.allow.map((a) => a.host);
    expect(hosts).toHaveLength(1);
    for (const host of hosts) {
      expect(profiles, `GENERATION_EGRESS_PROFILE does not list ${host}`).toContain(host);
    }
  });

  it('the manifest still denies egress by default', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, FROZEN[0] as string), 'utf8')) as {
      network: { egress: { policy: string } };
    };
    expect(manifest.network.egress.policy).toBe('deny-all');
  });
});
