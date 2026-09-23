/**
 * `T999u` (EPIC-035 Phase Z) — the Tier 2 transcript conforms.
 *
 * Constitution XI Tier 2, and the quickstart's own wording: *"hand-written
 * evidence is a constitution violation of the first order."*
 *
 * ## This file currently fails, and that is what it is for
 *
 * `specs/035-defect-room/tier2-transcript.md` **does not exist**. `T999t` has
 * not been run, and could not be by an agent: the journey is keyboard-only
 * against a running application, and two of its seven steps refuse in this
 * deployment because `RepairTaskPort` and `TestExecution` are unbound.
 *
 * The failure **is** the record. `T884`'s accessibility check has stood red for
 * the same reason since `EPIC-029`, and it is the reason anybody knows that
 * record is owed. A check that passed while its artifact was missing would make
 * the obligation invisible, which is the outcome this whole Epic argues
 * against — `FR-DFR-021`'s absence recorded, one layer up.
 *
 * ## What a check can and cannot establish
 *
 * Nothing here can prove a file was produced by a run rather than typed. What
 * it can do is make typing one **as much work as running it, and easier to get
 * wrong** — distinct ordered timestamps for every step, generated-looking ids,
 * and all seven stages present. `EPIC-034`'s `T995p` states the same limit, and
 * it is stated rather than implied here too.
 *
 * ## Seven steps, read from the task
 *
 * `T999t` names them: report → triage → reproduce → failing test → repair tasks
 * → verify → close. A transcript covering five would be exactly the artifact
 * that hides the two that cannot presently run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const TRANSCRIPT = resolve(here, '..', '..', '..', 'specs', '035-defect-room', 'tier2-transcript.md');

/**
 * The seven steps, in order. Named here because the task names them; if the
 * journey changes, this list and `T999t` must be edited together and a reader
 * comparing them will see it.
 */
const STEPS = [
  'report',
  'triage',
  'reproduce',
  'failing test',
  'repair tasks',
  'verify',
  'close',
] as const;

const read = (): string => readFileSync(TRANSCRIPT, 'utf8');

/** ISO instants inside table rows only — the header's run stamp is not a step. */
function stepInstants(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .flatMap((line) => [...line.matchAll(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g)].map((m) => m[0]));
}

describe('T999u · the Tier 2 transcript exists', () => {
  it('specs/035-defect-room/tier2-transcript.md is committed', () => {
    // Currently RED, deliberately. See the header: `T999t` needs a person, and
    // two of its seven steps cannot complete while `RepairTaskPort` and
    // `TestExecution` are unbound. Nothing has been written in its place.
    expect(
      existsSync(TRANSCRIPT),
      'no Tier 2 transcript — T999t is outstanding and must not be satisfied by an authored file',
    ).toBe(true);
  });
});

describe('T999u · and when it exists, it conforms', () => {
  it.skipIf(!existsSync(TRANSCRIPT))('names the run it came from', () => {
    expect(read()).toMatch(/\*\*Run\*\*:/);
  });

  it.skipIf(!existsSync(TRANSCRIPT))('covers all seven steps', () => {
    // Five of seven is the artifact that would hide the two that refuse.
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
    // The part that makes fabrication as much work as the walk: seven ordered
    // millisecond-resolution instants, none repeated.
    const instants = stepInstants(read());
    expect(instants.length).toBeGreaterThanOrEqual(STEPS.length);
    expect(new Set(instants).size).toBe(instants.length);

    const times = instants.map((value) => Date.parse(value));
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]! >= times[i - 1]!, `step ${i + 1} precedes step ${i}`).toBe(true);
    }
  });

  it.skipIf(!existsSync(TRANSCRIPT))('and ids that look generated rather than typed', () => {
    // At least one identifier of a shape a person would not invent by hand.
    expect(read()).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe('T999u · the checks can fire', () => {
  it('the ordering check rejects an out-of-order pair', () => {
    // Controls, so this file is not vacuous once the transcript lands. Without
    // them the assertions above could all be broken and nobody would know until
    // a transcript arrived — at which point they would pass it silently.
    const times = [Date.parse('2026-08-31T10:00:01.000Z'), Date.parse('2026-08-31T10:00:00.000Z')];
    expect(times[1]! >= times[0]!).toBe(false);
  });

  it('the distinctness check rejects a repeated instant', () => {
    const instants = ['2026-08-31T10:00:00.000Z', '2026-08-31T10:00:00.000Z'];
    expect(new Set(instants).size).toBe(1);
  });

  it('and the step scan finds instants in table rows only', () => {
    const sample = [
      '**Run**: 2026-08-31T09:59:59.000Z',
      '| report | ok | 2026-08-31T10:00:00.000Z |',
    ].join('\n');
    expect(stepInstants(sample)).toEqual(['2026-08-31T10:00:00.000Z']);
  });
});
