/**
 * `T405p`, `T1174` (EPIC-033) — the Tier 2 transcript is machine evidence, not a
 * tick.
 *
 * The standard `T884` holds the manual accessibility record to and `T900b` holds
 * EPIC-029's reachability transcript to, applied to
 * `specs/033-requirement-room/tier2-transcript.md`: a file saying only "passed"
 * MUST fail. Hand-writing it is a constitution violation (`G-28-02`, enforced
 * against `T709`'s first attempt).
 *
 * ## Why this file exists at all
 *
 * quickstart Scenario 13 requires a transcript *"passing its conformance
 * check"*, and until `T1174` there was no such check for this Epic — so the
 * artifact would have been unverified prose asserting its own truthfulness.
 * Writing the check alongside the transcript is uncomfortable, and the
 * discomfort is the point: what it asserts is what the transcript may not
 * omit, so a later run that quietly drops the measurements fails.
 *
 * ## What it deliberately does NOT assert
 *
 * That the run **passed**. `SC-RQR-008` has two halves and this Epic's run
 * discharged one of them; a check demanding a green verdict would have made the
 * honest outcome unrecordable, which is how a transcript becomes a formality.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../..');
const TRANSCRIPT = join(ROOT, 'specs/033-requirement-room/tier2-transcript.md');

const text = existsSync(TRANSCRIPT) ? readFileSync(TRANSCRIPT, 'utf8') : '';

describe('T1174 · the Tier 2 transcript exists and is evidence', () => {
  it('exists', () => {
    expect(existsSync(TRANSCRIPT), `${TRANSCRIPT} is missing`).toBe(true);
  });

  it('is a transcript, not a tick', () => {
    // The `T884` rule. Length is a crude proxy and it is the right one here:
    // the failure mode is a file that says "Scenario 13: passed".
    expect(text.length).toBeGreaterThan(2000);
    expect(text.split('\n').length).toBeGreaterThan(60);
  });

  it('names the run: an ISO date, the build under test, and the URL driven', () => {
    // Parsed rather than pattern-matched. Stronger — it proves the stamp is a
    // real instant, not merely date-shaped — and it avoids `T864a`, which
    // forbids a hand-written identifier shape and cannot tell one from a date.
    const stamps = (text.match(/\S+T\S+Z/g) ?? []).filter((s) => Number.isFinite(Date.parse(s)));
    expect(stamps.length, 'no parseable ISO run timestamp').toBeGreaterThan(0);
    // The build, because `T928` found EPIC-029's transcript green for two days
    // against a build it no longer described. A transcript that does not say
    // what it drove cannot be shown to be current.
    expect(text, 'no build identified').toMatch(/commit|image|build/i);
    expect(text, 'no URL driven').toMatch(/https?:\/\/[\w.:-]+/);
  });

  it('carries machine-recorded timestamps, not one date at the top', () => {
    // Several, at different times: a single date is a heading, a sequence is a
    // run. `T900b`'s reasoning, and the cheapest thing to fabricate is one date.
    const stamps = text.match(/\d\d:\d\d:\d\d/g) ?? [];
    expect(new Set(stamps).size, 'fewer than four distinct clock times').toBeGreaterThanOrEqual(4);
  });

  it('carries measured values a hand would not invent', () => {
    // A measured focus ring in `rgb()` with a sub-pixel width is the shape of
    // something read from `getComputedStyle`, not typed from memory.
    expect(text, 'no measured focus ring').toMatch(/rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/);
    expect(text, 'no measured outline width').toMatch(/\d+(\.\d+)?px/);
    // A real identifier from the run, not `<room-id>`.
    expect(text, 'no run-generated identifier').toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/);
  });

  it('walks the journey rather than summarising it', () => {
    for (const step of [/sign[- ]?in/i, /intake/i, /requirement-room/i, /region/i]) {
      expect(text, `the transcript never mentions ${String(step)}`).toMatch(step);
    }
    // Six regions named, because "all six regions rendered" is a claim and the
    // list is the evidence.
    for (const region of [
      'objectState',
      'loopProgress',
      'aiAnalysis',
      'decision',
      'evidence',
      'activityTimeline',
    ]) {
      expect(text, `region ${region} is not named`).toContain(region);
    }
  });

  it('states what the keyboard evidence does NOT cover', () => {
    // The assertion that keeps this honest. `SC-RQR-008` has two halves, and a
    // transcript that reported only the half it could drive would read as a
    // full discharge. Whatever a future run concludes, it must say which.
    expect(text, 'no statement of keyboard scope').toMatch(
      /not (proved|driven|evidenced)|does not (prove|cover)|structurally evidenced/i,
    );
    expect(text, 'no verdict on SC-RQR-008').toMatch(/SC-RQR-008/);
  });

  it('distinguishes what was keyboard-driven from what was clicked', () => {
    // The specific dishonesty this guards against: describing a pointer-driven
    // run as a keyboard transcript. Both words must appear, so the reader can
    // see the line was drawn.
    expect(text).toMatch(/\bTab\b/);
    expect(text, 'never says what was activated by pointer').toMatch(/click|pointer/i);
  });

  it('records findings, or says plainly that there were none', () => {
    // Tier 2 exists to surface what tests miss. A transcript with no findings
    // section has not been asked the question.
    expect(text, 'no findings section').toMatch(/##\s*Findings|no findings/i);
  });
});
