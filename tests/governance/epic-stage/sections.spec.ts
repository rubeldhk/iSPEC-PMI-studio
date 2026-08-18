/**
 * T479 — the Findings and Active-waivers sections (`RF-4`, `RF-5`).
 * Written to FAIL before T484 exists (Constitution V).
 *
 * **Both sections are omitted entirely when empty.** An empty table is noise in
 * every diff until the day something breaks — and a reader who has scrolled past
 * `## Findings` fifty times will scroll past the fifty-first without reading it.
 * Absence is the signal.
 *
 * **A finding never changes a Stage or a Readiness** (`RF-4`). Reaching a stage
 * and passing a gate are different claims, and folding one into the other is how
 * a register starts arguing with itself: an Epic would read `Clarified` because
 * of a finding about `tasks.md`, and the reader could not tell which fact caused
 * which.
 *
 * **A waiver is visible in the register or it does not exist** (`RF-5`). Burying
 * an exception in a config file nobody reads is exactly how a gate gets quietly
 * skipped, which is the failure the waiver mechanism was designed to prevent
 * rather than cause.
 */
import { describe, expect, it } from 'vitest';
import { renderRegister, type Finding, type StageRow, type Waiver } from './render';

const ROW: StageRow = {
  epic: 'EPIC-014',
  directory: '014-devops-release',
  title: 'DevOps & Release',
  kind: 'delivery',
  stage: 'Clarified',
  posture: null,
  readiness: 'Not ready',
  next: '/speckit-checklist',
};

const FINDING: Finding = {
  epic: 'EPIC-014',
  finding: '`tasks.md` present without `plan.md` — stage held at Clarified',
  severity: 'report',
};

const WAIVER: Waiver = {
  epic: 'EPIC-014',
  condition: 'DOR-09',
  owner: 'tech-lead',
  expires: '2026-09-30',
  reason: 'analysis blocked on the CI rebuild',
};

describe('T479 · RF-4 · Findings', () => {
  it('is omitted entirely when there are none', () => {
    const text = renderRegister([ROW], [], []);
    expect(text).not.toContain('## Findings');
  });

  it('appears with its header and columns when there is one', () => {
    const text = renderRegister([ROW], [FINDING], []);
    expect(text).toContain('## Findings');
    expect(text).toContain('| Epic | Finding | Severity |');
    expect(text).toContain('`tasks.md` present without `plan.md`');
  });

  it('carries a severity of report or fail, matching FR-ESK-016', () => {
    const text = renderRegister([ROW], [FINDING, { ...FINDING, severity: 'fail' }], []);
    expect(text).toMatch(/\| report \|/);
    expect(text).toMatch(/\| fail \|/);
  });

  it('does NOT change the Stage or Readiness of the Epic it names', () => {
    // The load-bearing assertion of RF-4. The row must be byte-identical with
    // and without the finding.
    const withoutFinding = renderRegister([ROW], [], []);
    const withFinding = renderRegister([ROW], [FINDING], []);
    const rowOf = (text: string) =>
      text.split('\n').find((line) => line.startsWith('| [EPIC-014]'));
    expect(rowOf(withFinding)).toBe(rowOf(withoutFinding));
  });

  it('keeps one finding per line', () => {
    const text = renderRegister([ROW], [FINDING, { ...FINDING, epic: 'EPIC-020' }], []);
    const lines = text.split('\n').filter((line) => line.includes('stage held at Clarified'));
    expect(lines).toHaveLength(2);
  });
});

describe('T479 · RF-5 · Active waivers', () => {
  it('is omitted entirely when there are none', () => {
    expect(renderRegister([ROW], [], [])).not.toContain('## Active waivers');
  });

  it('lists condition, owner, expiry and reason for each waiver', () => {
    // Every field is named because a waiver missing any of them grants nothing
    // (data-model §5) — and a reader must be able to see that from the register
    // rather than by opening a config file.
    const text = renderRegister([ROW], [], [WAIVER]);
    expect(text).toContain('## Active waivers');
    expect(text).toContain('| Epic | Condition | Owner | Expires | Reason |');
    expect(text).toContain('DOR-09');
    expect(text).toContain('tech-lead');
    expect(text).toContain('2026-09-30');
    expect(text).toContain('analysis blocked on the CI rebuild');
  });

  it('shows an expiry date even though RF-2 forbids generated dates', () => {
    // Not a contradiction, and worth stating: RF-2 forbids dates DERIVED FROM
    // THE CLOCK, because they change on every run. A waiver's expiry is input —
    // it changes only when a person changes it, so it produces no spurious diff.
    const text = renderRegister([ROW], [], [WAIVER]);
    expect(text).toContain('2026-09-30');
  });

  it('renders deterministically for identical input', () => {
    expect(renderRegister([ROW], [FINDING], [WAIVER])).toBe(
      renderRegister([ROW], [FINDING], [WAIVER]),
    );
  });
});

describe('T479 · the two sections together', () => {
  it('orders the register as table, then findings, then waivers', () => {
    const text = renderRegister([ROW], [FINDING], [WAIVER]);
    const table = text.indexOf('| Epic | Title | Kind |');
    const findings = text.indexOf('## Findings');
    const waivers = text.indexOf('## Active waivers');
    expect(table).toBeGreaterThan(-1);
    expect(findings).toBeGreaterThan(table);
    expect(waivers).toBeGreaterThan(findings);
  });

  it('ends with exactly one trailing newline', () => {
    // A generated file whose trailing whitespace varies fails an exact-text
    // drift comparison (RF-7) for a reason no reader would ever guess.
    const text = renderRegister([ROW], [FINDING], [WAIVER]);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });
});
