/**
 * T524 — the severity split (`FR-ESK-016`).
 *
 * **Caught by `G-26-02`, not by me.** `severity.ts` was written and shipped with
 * no spec importing it, and the "every module under test has a spec" assertion
 * failed on the very run that introduced it. That is the check doing exactly
 * what it was written for, one phase after being written.
 *
 * ## What the split is for
 *
 * A check that blocks unrelated work for a condition people cannot immediately
 * fix trains them to silence it — `governance/README.md`'s own reasoning, and
 * the standard `G-07` and `G-28-01` already follow.
 *
 * Applied here: **25 of 28 Epics currently read `stalled`.** If that failed the
 * build, every build in this repository would be red for a state the register
 * exists to *display*, and the honest response within a week would be to delete
 * the check.
 */
import { describe, expect, it } from 'vitest';
import { hasBlocking, SEVERITY_BY_KIND, severityOf, type FindingKind } from './severity';

describe('T524 · what stops a build', () => {
  it('fails on an expired waiver', () => {
    // An exception someone is still relying on past its agreed end. `DF-6` is
    // explicit, and it is the only finding kind in this epic that blocks.
    expect(severityOf('expiredWaiver')).toBe('fail');
  });

  it('is the ONLY kind that fails', () => {
    // Stated as a property rather than by listing the others, so adding a
    // blocking kind is a deliberate act that changes this assertion.
    const failing = Object.entries(SEVERITY_BY_KIND)
      .filter(([, severity]) => severity === 'fail')
      .map(([kind]) => kind);
    expect(failing).toEqual(['expiredWaiver']);
  });
});

describe('T524 · what reports without stopping a build', () => {
  it('reports a stalled Epic rather than failing', () => {
    // 25 of 28 Epics today. Blocking here would put every build red for a
    // state the register exists to show.
    expect(severityOf('outOfOrderArtifact')).toBe('report');
  });

  it('reports a malformed declaration or waiver', () => {
    // A governance gap, not a false claim. The malformed waiver already grants
    // no cover, so the Epic is `Not ready` on its own merits.
    expect(severityOf('malformedDeclaration')).toBe('report');
    expect(severityOf('malformedWaiver')).toBe('report');
  });

  it('reports an invalid Epic directory', () => {
    expect(severityOf('invalidEpicDirectory')).toBe('report');
  });
});

describe('T524 · the table is exhaustive by construction', () => {
  it('assigns every kind exactly one of the two severities', () => {
    for (const [kind, severity] of Object.entries(SEVERITY_BY_KIND)) {
      expect(['report', 'fail'], `${kind} has severity "${severity}"`).toContain(severity);
    }
  });

  it('derives its kind union from the table, so a new kind must be classified', () => {
    // `FindingKind = keyof typeof SEVERITY_BY_KIND`. A kind added to the table
    // gains a severity by construction; a kind raised without being in the
    // table does not type-check. The type is checked by
    // `pnpm typecheck:governance`; this asserts the runtime half.
    const kinds = Object.keys(SEVERITY_BY_KIND) as FindingKind[];
    expect(kinds.length).toBeGreaterThan(0);
    for (const kind of kinds) expect(severityOf(kind)).toBeTruthy();
  });
});

describe('T524 · hasBlocking', () => {
  it('is false when everything merely reports', () => {
    expect(hasBlocking([{ severity: 'report' }, { severity: 'report' }])).toBe(false);
  });

  it('is true when anything fails', () => {
    expect(hasBlocking([{ severity: 'report' }, { severity: 'fail' }])).toBe(true);
  });

  it('is false for no findings at all', () => {
    // The common case, and the one a careless `.some()` inversion breaks.
    expect(hasBlocking([])).toBe(false);
  });
});
