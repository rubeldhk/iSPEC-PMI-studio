/**
 * `T996n`, `T996o` (EPIC-034) — the architecture panel, and the check that has
 * not run.
 *
 * `FR-CHR-033`: governed architecture decisions touched by a change are
 * surfaced. `FR-CHR-034`: where `BR-0073`'s violation check is unowned (`U-17`),
 * the view **states that it has not run** rather than implying it passed.
 *
 * ## Constitution IX, applied to a screen
 *
 * *"A check that has never been seen to fail is a check nobody has tested"* has
 * a sibling: a check that has never run must not be reported as passed. On a
 * screen the difference is one blank panel. A reviewer looking at an
 * architecture section with no warnings in it concludes there are no warnings —
 * that is what an empty warnings list means everywhere else they have ever
 * looked.
 *
 * So `violationCheck.status` is the literal type `'not-run'` and **nothing
 * else**. There is no `'passed'` to assign. `FR-CHR-034` is not a rule someone
 * has to remember at the call site; it is the only value the field can hold,
 * for as long as `BR-0073` stays unowned. Adding `'passed'` later is a
 * deliberate edit to this type by whoever implements the check, which is
 * exactly who should be making it.
 *
 * The same discipline `REPLAN_STATES` uses in having no `executed`.
 */
import { describe, expect, it } from 'vitest';
import {
  ImpactComposer,
  type ArchitectureDecisionPort,
  type ImpactPort,
  type TraversalPort,
} from '../../src/modules/change-room/impact.composer.js';

const port: ImpactPort = {
  async impactFor() {
    return new Map([['architecture', { count: 2, detail: '2 decisions downstream' }] as const]);
  },
};

const traversal: TraversalPort = {
  async reachableFrom() {
    return ['spec_1'];
  },
};

const DECISIONS = [
  { id: 'adr_1', reference: 'ADR-0025', title: 'Governed loop adjudication', status: 'accepted' },
  { id: 'adr_2', reference: 'ADR-0031', title: 'Room stage vocabulary', status: 'proposed' },
] as const;

const decisions = (rows: readonly (typeof DECISIONS)[number][]): ArchitectureDecisionPort => ({
  async decisionsTouchedBy() {
    return rows;
  },
});

const input = {
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  changedArtifactId: 'art_1',
  traversalDepth: 25,
  now: new Date('2026-08-30T10:00:00Z'),
  id: 'iv_1',
};

describe('T996n · touched decisions are surfaced', () => {
  it('names each one', async () => {
    const view = await new ImpactComposer(port, traversal, decisions(DECISIONS)).compose(input);
    expect(view.architecture.decisions?.map((d) => d.reference)).toEqual(['ADR-0025', 'ADR-0031']);
  });

  it('carries enough to identify one without a second lookup', async () => {
    // A reference alone makes a reviewer go and find the decision. The title
    // and status are what let them judge whether it matters here.
    const view = await new ImpactComposer(port, traversal, decisions(DECISIONS)).compose(input);
    const first = view.architecture.decisions?.[0];
    expect(first?.title).toBe('Governed loop adjudication');
    expect(first?.status).toBe('accepted');
  });

  it('an empty list means none were touched, and says so', async () => {
    // `[]` is a real answer: somebody looked. It must not read the same as
    // `null`.
    const view = await new ImpactComposer(port, traversal, decisions([])).compose(input);
    expect(view.architecture.decisions).toEqual([]);
    expect(view.architecture.detail).toMatch(/none/i);
  });
});

describe('T996n · and when nobody could tell, it is null', () => {
  it('a source that throws yields null, not an empty list', async () => {
    // The `itemCount: number | null` discipline, applied to a list. `[]` would
    // report "no architecture decisions are affected" on the authority of a
    // source that failed to answer.
    const broken: ArchitectureDecisionPort = {
      async decisionsTouchedBy() {
        throw new Error('the decision register is offline');
      },
    };
    const view = await new ImpactComposer(port, traversal, broken).compose(input);
    expect(view.architecture.decisions).toBeNull();
    expect(view.architecture.detail).toContain('the decision register is offline');
  });

  it('an unbound source yields null too, and says it is unbound', async () => {
    // `FR-GEL-062` — a default that permits is invisible. The absence of a
    // decision source is a fact about this deployment, and it belongs on the
    // screen rather than in a shrug.
    const view = await new ImpactComposer(port, traversal).compose(input);
    expect(view.architecture.decisions).toBeNull();
    expect(view.architecture.detail).toMatch(/no architecture decision source/i);
  });
});

describe('T996n · FR-CHR-034 — the violation check has not run', () => {
  it('says so, on every view', async () => {
    const view = await new ImpactComposer(port, traversal, decisions(DECISIONS)).compose(input);
    expect(view.architecture.violationCheck.status).toBe('not-run');
  });

  it('says so even when decisions were found', async () => {
    // The most dangerous case: a populated panel is the one a reviewer reads as
    // complete.
    const view = await new ImpactComposer(port, traversal, decisions(DECISIONS)).compose(input);
    expect(view.architecture.decisions).toHaveLength(2);
    expect(view.architecture.violationCheck.status).toBe('not-run');
  });

  it('says so even when none were found', async () => {
    // And the quietest case: an empty panel with no stated caveat reads as
    // "checked, nothing wrong".
    const view = await new ImpactComposer(port, traversal, decisions([])).compose(input);
    expect(view.architecture.violationCheck.status).toBe('not-run');
  });

  it('names BR-0073 and U-17, so the gap is traceable rather than vague', async () => {
    const view = await new ImpactComposer(port, traversal, decisions(DECISIONS)).compose(input);
    expect(view.architecture.violationCheck.because).toContain('BR-0073');
    expect(view.architecture.violationCheck.because).toContain('U-17');
  });

  it('the reason is a sentence, not a marker', async () => {
    // Someone reading the screen has to understand it without opening the spec.
    const view = await new ImpactComposer(port, traversal, decisions(DECISIONS)).compose(input);
    expect(view.architecture.violationCheck.because.length).toBeGreaterThan(40);
  });
});

describe('T996n · there is no way to report it passed', () => {
  it('the source offers no passing status anywhere', async () => {
    // The structural half, and the one that holds. `FR-CHR-034` is enforced by
    // `'not-run'` being the only inhabitant of the type — a later `'passed'` is
    // a deliberate edit by whoever implements `BR-0073`, not an accident at a
    // call site.
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(here, '..', '..', 'src', 'modules', 'change-room', 'impact.composer.ts'),
      'utf8',
    );

    expect(/status:\s*'passed'/.test(source)).toBe(false);
    expect(/'not-run'\s*\|/.test(source), 'the status type has a second inhabitant').toBe(false);
  });

  it('the matcher can fire', () => {
    // Anti-tautology for both absence assertions above.
    expect(/status:\s*'passed'/.test("      status: 'passed',")).toBe(true);
    expect(/'not-run'\s*\|/.test("  readonly status: 'not-run' | 'passed';")).toBe(true);
  });
});
