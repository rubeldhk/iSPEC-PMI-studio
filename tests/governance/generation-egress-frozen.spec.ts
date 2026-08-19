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

/**
 * The two artifacts that together define the frozen control, with the hash each
 * is frozen AT.
 *
 * **DEF-028-003.** This check previously compared against `main` alone — and
 * neither file exists on `main`, which is at `7980f9f`, predating EPIC-003. The
 * comparison threw, the check took its skip branch, and printed a SKIPPED line
 * on every run on every machine including CI. The skip was written for a shallow
 * clone, a transient condition; the real condition was permanent. So the check
 * added *because* `SC-AGT-005` had no enforcement that could fail still had
 * none, while the suite was green and the criterion was listed as enforced.
 *
 * A hash committed in the repository is what "frozen" actually means: changing
 * the manifest now requires changing the constant below in the same commit,
 * which is a visible, reviewable act rather than a silent drift. It works on any
 * branch, at any clone depth, before and after a merge.
 */
const FROZEN: readonly { path: string; sha256: string }[] = [
  {
    path: 'engine-adapters/speckit/docker/sandbox.json',
    sha256: '389daa738f82bd342654ad8c2fc8fcca75936f9f6ff7663550afc4c293cc40ea',
  },
  {
    path: 'engine-adapters/speckit/tests/unit/sandbox-config.spec.ts',
    sha256: 'f50299cf51fc08be53ec611d9732b26157dfa5a59cb3ab7a10d524990ba5bc34',
  },
];

/**
 * DEF-018-002 — line endings are normalised before hashing.
 *
 * The frozen hashes below are LF-based, because git stores blobs with LF. With
 * no `.gitattributes` and `core.autocrlf=true`, a Windows checkout writes CRLF,
 * so hashing raw bytes made this check depend on how the file happened to land
 * on disk: green in CI, red on the machine it was written on the next time
 * anyone switched branches.
 *
 * Measured when it surfaced: sandbox.json hashed to 70f93ff8 raw and 389daa73
 * LF-normalised, and 389daa73 is the frozen constant.
 *
 * Nothing else is normalised. A comparison that ignored whitespace could not
 * detect a whitespace edit, and this check exists to detect edits.
 */
const sha = (buf: string | Buffer): string =>
  createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');

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
  /**
   * The primary assertion. Always runs, everywhere.
   *
   * If this fails, someone changed a security control this epic promised not to
   * touch. Updating the constant to match is not a fix — it is the change,
   * made visible, and it needs the reasoning that goes with it.
   */
  it.each(FROZEN)('$path matches its frozen hash', ({ path, sha256 }) => {
    expect(
      sha(readFileSync(join(ROOT, path))),
      `${path} was modified. SC-AGT-005 promises this epic did not touch the generation egress ` +
        `control; if the change is intended, update the hash in this file in the SAME commit and ` +
        `record why.`,
    ).toBe(sha256);
  });

  /**
   * A second, additive assertion — genuine evidence when the ref exists.
   *
   * Kept rather than deleted: after this branch merges it becomes live and
   * catches a class the hash cannot, namely a hash and a file updated together
   * without review. But it is no longer the ONLY assertion, so a skip here no
   * longer means nothing ran.
   */
  it.each(FROZEN)('$path is unchanged from main, when main has it', ({ path }) => {
    const baseline = atMain(path);
    if (baseline === null) {
      console.warn(
        `[T549a] SECONDARY CHECK SKIPPED — 'main:${path}' is unavailable ` +
          `(main predates this file). The frozen-hash assertion above DID run and is authoritative.`,
      );
      return;
    }
    expect(sha(readFileSync(join(ROOT, path))), `${path} was modified`).toBe(sha(baseline));
  });

  it('the profile constant matches the manifest it mirrors', () => {
    // The contract package cannot import the adapter (boundary), so the
    // destination is duplicated. This is what stops the two drifting.
    const manifest = JSON.parse(readFileSync(join(ROOT, FROZEN[0]!.path), 'utf8')) as {
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
    const manifest = JSON.parse(readFileSync(join(ROOT, FROZEN[0]!.path), 'utf8')) as {
      network: { egress: { policy: string } };
    };
    expect(manifest.network.egress.policy).toBe('deny-all');
  });
});
