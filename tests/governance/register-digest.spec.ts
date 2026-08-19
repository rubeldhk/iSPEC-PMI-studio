/**
 * T603 / T605 · Check `G-27-11` — the projection provably reflects its source.
 *
 * This is the one property every other `G-27-*` check depends on, and the
 * contract says why it matters most:
 *
 * > *"This is the check most likely to catch a real mistake, because
 * > regenerating is the step people skip."*
 *
 * A stale projection makes every check below it test a **fiction** while staying
 * green — which is strictly worse than having no check, because it manufactures
 * confidence. Same for a hand-edited one: `register.json` is generated, and a
 * human who edits it directly has changed what CI reads without changing what
 * anyone reviews.
 *
 * Two assertions, deliberately distinct:
 *
 *   - **T603** — each `generated_from` digest matches its source file. Catches a
 *     register edited after the last build.
 *   - **T605** — regenerating from scratch reproduces the committed projection
 *     byte for byte. Catches a projection edited directly, which a digest alone
 *     cannot see: someone who edits both the JSON and re-runs the hash would
 *     still be caught here, because the generator output would differ.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers';
import { buildRegister } from '../../scripts/build-register.mjs';

const REGISTER_DIR = join(REPO_ROOT, 'specs/027-ai-native-amendment/register');
const PROJECTION = join(REGISTER_DIR, 'register.json');

/**
 * DEF-027-004 — line endings are normalised before hashing.
 *
 * This repository has no `.gitattributes` and `core.autocrlf=true` on Windows,
 * so the working copy holds CRLF while a Linux CI checkout holds LF. Hashing raw
 * bytes made every digest platform-dependent: all nine matched locally and none
 * matched in CI, which `G-27-11` correctly reported as nine files "changed since
 * the last build" that nobody had touched.
 *
 * Line endings are decided by git and the checkout platform, not by anything a
 * person wrote — the same reasoning EPIC-026's `RF-7` records. Nothing else is
 * normalised: a digest that ignored whitespace could not detect a whitespace
 * edit, which is a real edit.
 */
const sha256 = (text: string): string =>
  createHash('sha256')
    .update(text.replace(/\r\n/g, '\n'))
    .digest('hex');

const present = existsSync(PROJECTION);
const committed = present
  ? (JSON.parse(readFileSync(PROJECTION, 'utf8')) as {
      generated_from: Record<string, string>;
      [key: string]: unknown;
    })
  : null;

describe('G-27-11 · every generated_from digest matches its source (T603)', () => {
  it('the projection exists', () => {
    expect(present, 'register.json is missing — run `pnpm register:build`').toBe(true);
  });

  it('records a digest for every register file', () => {
    if (!committed) return;
    expect(Object.keys(committed.generated_from).length).toBeGreaterThan(0);
  });

  it('each digest matches the file it claims to summarise', () => {
    if (!committed) return;
    const stale: string[] = [];
    for (const [file, digest] of Object.entries(committed.generated_from)) {
      const path = join(REGISTER_DIR, file);
      if (!existsSync(path)) {
        stale.push(`${file} is referenced by the projection and does not exist`);
        continue;
      }
      if (sha256(readFileSync(path, 'utf8')) !== digest) {
        stale.push(`${file} changed since the last build`);
      }
    }
    expect(
      stale,
      'the projection is STALE. Every G-27-* check below reads it, so they are currently ' +
        'testing a fiction. Run `pnpm register:build` and commit the result.',
    ).toEqual([]);
  });
});

describe('G-27-11 · a hand-edited projection is detected (T605)', () => {
  it('regenerating reproduces the committed projection exactly', () => {
    if (!committed) return;
    // Regenerate in memory and compare. A digest check alone cannot catch
    // someone who edits register.json and recomputes the hashes; this can,
    // because the generator's own output would no longer match.
    const regenerated = buildRegister();
    const normalise = (value: unknown): string => JSON.stringify(value, null, 2);

    expect(
      normalise(regenerated),
      'register.json does not match what the generator produces from the markdown. ' +
        'Either it was hand-edited — it is generated, never authored — or the register ' +
        'changed without a rebuild.',
    ).toBe(normalise(committed));
  });

  it('the projection carries no key the generator does not produce', () => {
    if (!committed) return;
    const generatedKeys = Object.keys(buildRegister()).sort();
    expect(Object.keys(committed).sort()).toEqual(generatedKeys);
  });
});
