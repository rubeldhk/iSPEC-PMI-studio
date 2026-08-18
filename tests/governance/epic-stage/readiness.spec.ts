/**
 * T504 / T506 — readiness resolution, and `Ready (waived)` (`FR-ESK-014`, `FR-ESK-023`).
 * Written to FAIL before T510 and T512 exist (Constitution V).
 *
 * ```text
 * all conditions pass                                  →  Ready
 * failures, all covered by valid waivers               →  Ready (waived)
 * any failure uncovered, or any waiver expired/invalid →  Not ready
 * ```
 *
 * **There is no combination producing an unqualified `Ready` while a waiver is
 * active.** That is what stops waivers becoming a second, weaker DOR: an Epic
 * that took an exception says so, permanently, in the column a reader looks at
 * first. If `Ready (waived)` and `Ready` were interchangeable, taking an
 * exception would cost nothing and the gate would decay into advice.
 *
 * ## The determinism tension, and how it resolves
 *
 * Readiness depends on whether a waiver has expired, and expiry depends on the
 * date — while `RF-2` forbids clock-derived content in the register. Both hold
 * because **an expired waiver fails the build** (`DF-6`): the register cannot
 * legitimately sit in a state where the clock has flipped a row, since the day
 * that happens is the day CI goes red and demands a human decision. `today` is
 * injected rather than read from the clock, so every test here is fixed in time.
 */
import { describe, expect, it } from 'vitest';
import { resolveReadiness, type WaiverDeclaration } from './dor';
import type { EpicKind } from './declarations';

const TODAY = '2026-08-18';
const ON_DISK = ['014-devops-release'];

const WAIVER: WaiverDeclaration = {
  epic: '014-devops-release',
  condition: 'DOR-09',
  owner: 'tech-lead',
  reason: 'Analysis blocked on the CI rebuild.',
  expires: '2026-09-30',
};

function resolve(
  failures: string[],
  waivers: WaiverDeclaration[] = [],
  kind: EpicKind = 'delivery',
) {
  return resolveReadiness({
    directory: '014-devops-release',
    kind,
    failures,
    waivers,
    today: TODAY,
    epicsOnDisk: ON_DISK,
  });
}

describe('T504 · Ready requires everything to pass', () => {
  it('reads Ready when no condition fails and no waiver is active', () => {
    expect(resolve([]).readiness).toBe('Ready');
  });

  it('reads Not ready with a single uncovered failure', () => {
    expect(resolve(['DOR-05']).readiness).toBe('Not ready');
  });

  it('reads Not ready when SOME failures are covered and one is not', () => {
    // The partial case, and the one an eager implementation gets wrong.
    expect(resolve(['DOR-09', 'DOR-05'], [WAIVER]).readiness).toBe('Not ready');
  });

  it('names every uncovered failure, so one pass tells a reader everything', () => {
    const result = resolve(['DOR-05', 'DOR-08'], []);
    expect(result.uncovered).toEqual(['DOR-05', 'DOR-08']);
  });
});

describe('T506 · Ready (waived) is a distinct value (FR-ESK-023)', () => {
  it('reads Ready (waived) when every failure is covered', () => {
    expect(resolve(['DOR-09'], [WAIVER]).readiness).toBe('Ready (waived)');
  });

  it('NEVER reads plain Ready while a waiver is active', () => {
    // Even with nothing failing. An Epic carrying a waiver says so.
    expect(resolve([], [WAIVER]).readiness).not.toBe('Ready');
  });

  it('reads Not ready when the covering waiver has expired', () => {
    expect(resolve(['DOR-09'], [{ ...WAIVER, expires: '2026-08-01' }]).readiness).toBe('Not ready');
  });

  it('reads Not ready when the covering waiver is invalid', () => {
    // An owner outside the three roles grants nothing — the exception was never
    // authorised by anyone who could authorise it.
    expect(resolve(['DOR-09'], [{ ...WAIVER, owner: 'me' }]).readiness).toBe('Not ready');
  });

  it('fails the build on an expired waiver, and reports rather than fails on an invalid one', () => {
    // DF-6 is explicit that expiry FAILS THE BUILD. An invalid waiver is a
    // recording error; an expired one is an exception someone is still relying
    // on past its agreed end, which is the more dangerous of the two.
    expect(resolve(['DOR-09'], [{ ...WAIVER, expires: '2026-08-01' }]).blocking.length).toBeGreaterThan(0);
    expect(resolve(['DOR-09'], [{ ...WAIVER, owner: 'me' }]).blocking).toEqual([]);
  });

  it('covers only the condition it names', () => {
    // A waiver on DOR-09 does nothing for DOR-05. "Waiving a gate is a decision
    // nobody can review."
    expect(resolve(['DOR-05'], [WAIVER]).readiness).toBe('Not ready');
    expect(resolve(['DOR-05'], [WAIVER]).uncovered).toEqual(['DOR-05']);
  });

  it('ignores a waiver belonging to a different Epic', () => {
    expect(resolve(['DOR-09'], [{ ...WAIVER, epic: '999-other' }]).readiness).toBe('Not ready');
  });
});

describe('T504 · a parent design is never evaluated (FR-ESK-024)', () => {
  it('reads n/a regardless of failing conditions', () => {
    // The DOR requires a task list. Evaluating an Epic defined not to have one
    // reports a permanent failure that means nothing and trains readers to
    // ignore the column.
    expect(resolve(['DOR-07', 'DOR-08'], [], 'parent-design').readiness).toBe('n/a');
  });

  it('reports no uncovered failures for a parent design', () => {
    expect(resolve(['DOR-07'], [], 'parent-design').uncovered).toEqual([]);
  });
});

describe('T504 · a blocking posture defeats completeness', () => {
  it('is expressed through DOR-12 rather than a separate rule', () => {
    // Held/Blocked/Superseded arrive as a DOR-12 failure, so a held Epic with
    // everything else done still reads Not ready — one mechanism, not two.
    expect(resolve(['DOR-12']).readiness).toBe('Not ready');
  });

  it('can itself be waived, and then says so', () => {
    // Deliberately permitted: a posture waiver is an owned, expiring, visible
    // decision to proceed anyway. That it reads `Ready (waived)` rather than
    // `Ready` is the entire safeguard.
    const postureWaiver = { ...WAIVER, condition: 'DOR-12' };
    expect(resolve(['DOR-12'], [postureWaiver]).readiness).toBe('Ready (waived)');
  });
});
