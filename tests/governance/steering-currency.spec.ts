/**
 * T433 · Check G-07 — steering review currency.
 *
 * Satisfies SC-RGP-009 / FR-RGP-016. Every other check in this epic verifies a steering
 * file's *form*. This one is the only signal on its *accuracy*: a file that says "we use X"
 * a year after the team moved to Y passes every other check and actively misleads, because
 * agent sessions load it as context.
 *
 * Severity, per the 2026-08-05 split:
 *   - a MISSING or malformed `last_reviewed` FAILS — that is a form defect.
 *   - a STALE `last_reviewed` REPORTS and does not fail. A blocking staleness check would
 *     halt unrelated work across every held epic because a document turned 91 days old.
 *
 * The interval is read from governance/governance.config.json, not hard-coded: it is
 * configuration, not a principle.
 */
import { describe, it, expect } from 'vitest';
import { readConfig, steeringFiles } from './helpers';

const config = readConfig();
const files = steeringFiles();

/** Fixed reference point so the check is deterministic; advanced when the register is reviewed. */
const REVIEW_HORIZON = new Date('2026-08-07T00:00:00Z');

describe('G-07 · review currency (FR-RGP-016)', () => {
  it.each(files.map((file) => [file.subject, file] as const))(
    '%s records a well-formed last_reviewed date',
    (_subject, file) => {
      const value = file.front.last_reviewed;
      expect(value, `${file.relativePath} records no last_reviewed date`).toBeTruthy();
      expect(value, `${file.relativePath} last_reviewed must be an ISO date (YYYY-MM-DD)`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      expect(Number.isNaN(Date.parse(value ?? ''))).toBe(false);
    },
  );

  it('reports files past the review interval without failing the build', () => {
    const interval = config.steeringReviewIntervalDays;
    const stale = files
      .map((file) => {
        const days = Math.floor(
          (REVIEW_HORIZON.getTime() - Date.parse(file.front.last_reviewed ?? '')) / 86_400_000,
        );
        return { path: file.relativePath, days };
      })
      .filter((entry) => entry.days > interval);

    if (stale.length > 0) {
      console.warn(
        `\n[G-07] ${stale.length} steering file(s) past the ${interval}-day review interval — ` +
          `reported, not a failure:\n` +
          stale.map((entry) => `  - ${entry.path} (${entry.days} days)`).join('\n'),
      );
    }

    // Deliberately unconditional: this check reports. See FR-RGP-016.
    expect(stale.length).toBeGreaterThanOrEqual(0);
  });

  it('documents the interval as configuration in the steering index', () => {
    expect(config.steeringReviewIntervalDays).toBe(90);
  });
});
