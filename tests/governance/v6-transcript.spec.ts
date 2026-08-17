/**
 * T577 · Check G-28-01 — the `V6` real-run transcript exists and identifies its image.
 *
 * `T646b` is the only task in this programme that starts a real container, and
 * its transcript is the **sole evidence** for `SC-AGT-001`. EPIC-003 shipped 65
 * passing tests and an engine that could not start; its closure report says
 * *"No real container has ever started."* This check is what stops that being
 * true again while a green suite implies otherwise.
 *
 * ## Severity: REPORTS on absence, FAILS on a malformed transcript
 *
 * Deliberate, and it follows the split `governance/README.md` already
 * documents for `G-07` (fails on absence of a review date, reports on
 * staleness). The reasoning is inverted here and lands the same way:
 *
 * - **RAID `R-04` blocks container-in-container in CI.** `T646b` cannot run on
 *   any CI machine, by design. A hard failure on absence would put every other
 *   epic's build red for a task CI is structurally unable to discharge — which
 *   trains people to silence the check rather than run the scenario, costing the
 *   exact signal it exists to give.
 * - **A malformed transcript is a different thing entirely.** If someone commits
 *   one without an image digest, they have produced a document that *looks* like
 *   evidence and cannot answer which image produced the specification. That is a
 *   claim, not a gap, and it fails.
 *
 * **The absence is not thereby forgiven.** `T592` and `T596` read this check's
 * output, and EPIC-028 cannot close with the transcript missing — the epic's
 * exit criteria say so, and the closing report is required to state `T646b`'s
 * outcome plainly (Constitution IX).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const TRANSCRIPT = join(ROOT, 'specs/028-agent-execution-seam/v6-transcript.md');

const present = existsSync(TRANSCRIPT);
const content = present ? readFileSync(TRANSCRIPT, 'utf8') : '';

describe('G-28-01 · the V6 real-run transcript (SC-AGT-001, gates T646b)', () => {
  it('reports whether the run has happened', () => {
    if (!present) {
      // Loud, named, and non-blocking. The task is identified so the message is
      // actionable rather than a reminder that something is missing somewhere.
      console.warn(
        '[G-28-01] REPORTS — specs/028-agent-execution-seam/v6-transcript.md is absent. ' +
          'T646b (the real container run) has NOT been performed. RAID R-04 blocks it in CI, ' +
          'so it must be run by hand on a machine with a Docker daemon and the transcript ' +
          'committed. EPIC-028 cannot close until it is. SC-AGT-001 is UNVERIFIED.',
      );
    }
    // Always passes. The assertion below is the one that can fail.
    expect(true).toBe(true);
  });

  it('names an image digest when it exists', () => {
    if (!present) return;
    // A tag is a moving target. Six months on, `pmi-studio/speckit-engine`
    // cannot tell you which image produced the specification; a digest can.
    expect(
      /\bsha256:[0-9a-f]{64}\b/.test(content),
      'the transcript records no sha256 image digest, so it cannot identify what produced the specification',
    ).toBe(true);
  });

  it('states its outcome explicitly when it exists', () => {
    if (!present) return;
    expect(
      /\*\*Outcome\*\*:\s*(PASSED|FAILED)/.test(content),
      'the transcript does not state PASSED or FAILED, so it reports nothing decidable',
    ).toBe(true);
  });

  it('does not overstate what a container run proves, when it exists', () => {
    if (!present) return;
    // The transcript is the sole evidence for SC-AGT-001. One that lists only
    // passes reads as more evidence than it is.
    expect(
      content.includes('A green CI run is **not** evidence'),
      'the transcript omits the statement that a green CI run is not evidence for T646b',
    ).toBe(true);
  });
});
