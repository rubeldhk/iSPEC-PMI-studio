/**
 * `T1294` (EPIC-038 Phase N) — the Tier 2 transcript conforms.
 *
 * Constitution XI Tier 2. `T1301` owes a run-generated transcript of the
 * assemble → inspect → follow-an-exclusion journey, keyboard-only against a
 * running application.
 *
 * ## This file currently fails, and that is what it is for
 *
 * `specs/038-engineering-context/tier2-transcript.md` **does not exist**, and
 * cannot be produced by anyone yet: `EmbeddingPort` has no owner anywhere in
 * the programme (`R-038-1`), so `POST /context/packages` answers `503` and the
 * journey's first step refuses. Typing a transcript is the fabrication this
 * check exists to test for.
 *
 * The failure **is** the record that `T1301` — and with it `SC-CTX-006` — is
 * owed. It is registered in `governance/known-red.json`, so the gate fails the
 * build the day it passes and the check returns to the gating suite.
 *
 * ## What a check can and cannot establish
 *
 * Nothing here proves a file came from a run rather than a keyboard. It makes
 * typing one as much work as running it, and easier to get wrong — ordered
 * millisecond instants per step, generated-looking ids, every step present.
 * `T999u` states the same limit.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const TRANSCRIPT = resolve(here, '..', '..', '..', 'specs', '038-engineering-context', 'tier2-transcript.md');

/** The journey's steps, as `T1301` names them. */
const STEPS = ['assemble', 'inspect', 'follow an exclusion'] as const;

const read = (): string => readFileSync(TRANSCRIPT, 'utf8');

/** ISO instants inside table rows only — the header's run stamp is not a step. */
function stepInstants(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .flatMap((line) => [...line.matchAll(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g)].map((m) => m[0]));
}

describe('T1294 · the Tier 2 transcript exists', () => {
  it('specs/038-engineering-context/tier2-transcript.md is committed', () => {
    // Currently RED, deliberately: assembly refuses with 503 while no embedding
    // provider exists, so the journey cannot run. Nothing is written in its place.
    expect(
      existsSync(TRANSCRIPT),
      'no Tier 2 transcript — T1301 is outstanding and must not be satisfied by an authored file',
    ).toBe(true);
  });
});

describe('T1294 · and when it exists, it conforms', () => {
  it.skipIf(!existsSync(TRANSCRIPT))('names the run it came from', () => {
    expect(read()).toMatch(/\*\*Run\*\*:/);
  });

  it.skipIf(!existsSync(TRANSCRIPT))('covers every step of the journey', () => {
    const text = read().toLowerCase();
    for (const step of STEPS) {
      expect(text.includes(step), `the transcript does not cover ${step}`).toBe(true);
    }
  });

  it.skipIf(!existsSync(TRANSCRIPT))('records keyboard-only navigation with focus visible', () => {
    const text = read();
    expect(text).toMatch(/keyboard/i);
    expect(text).toMatch(/focus/i);
  });

  it.skipIf(!existsSync(TRANSCRIPT))('carries a distinct instant per step, in order', () => {
    const instants = stepInstants(read());
    expect(instants.length).toBeGreaterThanOrEqual(STEPS.length);
    expect(new Set(instants).size).toBe(instants.length);
    const times = instants.map((value) => Date.parse(value));
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]! >= times[i - 1]!, `step ${i + 1} precedes step ${i}`).toBe(true);
    }
  });

  it.skipIf(!existsSync(TRANSCRIPT))('and ids that look generated rather than typed', () => {
    expect(read()).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe('T1294 · the checks can fire', () => {
  it('the ordering check rejects an out-of-order pair', () => {
    const times = [Date.parse('2026-10-08T10:00:01.000Z'), Date.parse('2026-10-08T10:00:00.000Z')];
    expect(times[1]! >= times[0]!).toBe(false);
  });

  it('and the step scan finds instants in table rows only', () => {
    const sample = ['**Run**: 2026-10-08T09:59:59.000Z', '| assemble | 201 | 2026-10-08T10:00:00.000Z |'].join('\n');
    expect(stepInstants(sample)).toEqual(['2026-10-08T10:00:00.000Z']);
  });
});
