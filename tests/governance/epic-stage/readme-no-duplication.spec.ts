/**
 * T514 · Check `G-26-09` — `specs/README.md` carries narrative, not status.
 * Written to FAIL before T517 exists (Constitution V).
 *
 * **This is the PP-002 defence, and it points the opposite way to `RF-6`.**
 * `RF-6` stops the register restating the README; this stops the README
 * restating the register. Two sources for one fact is the failure mode this
 * whole epic exists to remove, and creating a generated register while leaving
 * the hand-maintained one in place would *double* it rather than fix it.
 *
 * The evidence that this is not theoretical is in this repository's own history:
 * EPIC-018's task count was recorded in three places and disagreed with itself
 * three ways — `plan.md` said 31, `README.md` said 32, `tasks.md` held 34. By
 * the time `T529` came to fix it the numbers had drifted again, to 31 / 37 / 38.
 * **The remediation task went stale before it ran.**
 *
 * ## What the README keeps
 *
 * Narrative, module mapping, build order, conventions, the restructure history —
 * everything a person wrote because they knew something. What it loses is
 * anything a machine can derive: stage, posture, readiness, task counts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers';

const README = readFileSync(join(REPO_ROOT, 'specs/README.md'), 'utf8');

/** Prose only — a fenced build-order diagram is narrative, not status. */
function prose(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '');
}

describe('G-26-09 · specs/README.md carries no derivable status (FR-ESK-009)', () => {
  it('links to the register', () => {
    // Removing the status without pointing anywhere would be a regression: a
    // reader arriving at the index still needs to find where status lives.
    expect(README).toMatch(/epic-stage-register\.md/);
  });

  it('carries no Proceeding/Held groupings', () => {
    // These were section headings that sorted Epics by delivery posture — the
    // register's Posture column, maintained by hand.
    expect(prose(README)).not.toMatch(/^#+.*\b(Proceeding|Held)\b/m);
  });

  it('carries no per-Epic task counts', () => {
    // The specific drift that produced 31 / 32 / 34, then 31 / 37 / 38.
    const rows = prose(README)
      .split('\n')
      .filter((line) => /^\|\s*\[?EPIC-\d{3}/.test(line));
    for (const row of rows) {
      expect(row, `a task count survives in: ${row.slice(0, 90)}`).not.toMatch(
        /\|\s*\*{0,2}\d{1,3}\*{0,2}\s*(?:tasks?)?\s*(?:✅|⏸|🟡)?[^|]*\|/,
      );
    }
  });

  it('carries no totals', () => {
    expect(prose(README)).not.toMatch(/\*\*Total:\s*\d+\s*tasks?\*\*/i);
  });

  it('carries no stage or readiness verdicts', () => {
    const text = prose(README);
    expect(text).not.toMatch(/\bNot ready\b/);
    expect(text).not.toMatch(/\bReady \(waived\)/);
    expect(text).not.toMatch(/\bChecklisted\b/);
  });

  it('KEEPS the narrative that no machine can derive', () => {
    // The point is not to empty the file. Everything below is here because a
    // person knew something, and losing it would make this migration a net loss.
    expect(README).toMatch(/build order/i);
    expect(README).toMatch(/\bM-\d\d\b/);
    expect(README).toMatch(/Conventions/i);
    expect(README).toMatch(/D-15|D-18|D-19/);
  });

  it('keeps the known-limitation note about Spec Kit tooling', () => {
    // Hard-won and still true: check-prerequisites.ps1 reports one feature
    // directory and cannot see `_shared/`. It bit this very session.
    expect(README).toMatch(/AVAILABLE_DOCS|_shared/);
  });
});
