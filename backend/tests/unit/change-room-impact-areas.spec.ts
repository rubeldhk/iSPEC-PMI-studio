/**
 * `T996j`, `T996k` (EPIC-034) — all eight `BR-0044` areas, always present.
 *
 * `FR-CHR-030`, `SC-CHR-002`. An area missing from the view reads, to a person
 * scanning it, exactly like an area that was checked and found clean.
 *
 * ## Why this file reads `spec.md`
 *
 * `DEF-034-001`. `IMPACT_AREAS` named `security` as its eighth member, which
 * `BR-0044` never lists, and the class it displaced — known operational effects
 * — was absent entirely. Two guards existed and neither fired:
 *
 * The `Record<ImpactAreaName, ImpactArea>` type made a seven-area view a
 * compile error, and did exactly that. A completeness guarantee over a
 * vocabulary cannot validate the vocabulary.
 *
 * `T406f` restated all eight as literals rather than importing the constant —
 * the textbook remedy — and restated them wrong, because the test and the
 * constant were written minutes apart from one misreading. **A second
 * recollection is not a second source.**
 *
 * So the expectation here is derived from `FR-CHR-030`'s own sentence, read out
 * of the specification. It is the only version of this check an author's
 * mistaken belief cannot travel into.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ImpactComposer, type ImpactPort, type TraversalPort } from '../../src/modules/change-room/impact.composer.js';
import { IMPACT_AREAS, type ImpactAreaName } from '../../src/modules/change-room/impact.types.js';

const here = dirname(fileURLToPath(import.meta.url));
const SPEC = readFileSync(
  resolve(here, '..', '..', '..', 'specs', '034-change-room', 'spec.md'),
  'utf8',
);

/** `FR-CHR-030`'s sentence, as committed. */
const FR_CHR_030 = SPEC.split('\n').find((line) => line.includes('**FR-CHR-030**')) ?? '';

/**
 * The word each area name stands for in that sentence.
 *
 * `release` is "release scope" and `operations` is "operational effects", both
 * shortened. The mapping is the only judgement this file makes, and it is
 * visible rather than buried in a regex.
 */
const SPOKEN: Readonly<Record<ImpactAreaName, string>> = {
  requirements: 'requirements',
  specifications: 'specifications',
  architecture: 'architecture',
  tasks: 'tasks',
  code: 'code',
  tests: 'tests',
  release: 'release scope',
  operations: 'operational effects',
};

const port = (entries: [ImpactAreaName, { count: number; detail: string }][]): ImpactPort => ({
  async impactFor() {
    return new Map(entries);
  },
});

const traversal: TraversalPort = { async reachableFrom() { return ['a_1', 'a_2']; } };

const input = {
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  changedArtifactId: 'art_1',
  traversalDepth: 25,
  now: new Date('2026-08-30T10:00:00Z'),
  id: 'iv_1',
};

describe('T996j · the vocabulary comes from FR-CHR-030, not from memory', () => {
  it('finds the requirement in spec.md', () => {
    // Anti-vacuity. Every assertion below is satisfied trivially if the line is
    // empty, so the line has to be found before it can be trusted.
    expect(FR_CHR_030).toContain('impact view');
    expect(FR_CHR_030.length).toBeGreaterThan(120);
  });

  it('every area name the code declares is spoken for in the requirement', () => {
    for (const area of IMPACT_AREAS) {
      expect(
        FR_CHR_030.toLowerCase().includes(SPOKEN[area]),
        `FR-CHR-030 does not mention "${SPOKEN[area]}" — the vocabulary drifted from the spec`,
      ).toBe(true);
    }
  });

  it('and there are exactly eight of them', () => {
    expect(IMPACT_AREAS).toHaveLength(8);
    expect(Object.keys(SPOKEN)).toHaveLength(8);
  });

  it('does NOT name security', () => {
    // The specific error, asserted specifically. `security` is a `FR-CHR-041`
    // trade-off dimension and never a `BR-0044` impact class; the two lists
    // were written in one sitting and one borrowed from the other.
    expect(FR_CHR_030.toLowerCase()).not.toContain('security');
    expect([...IMPACT_AREAS]).not.toContain('security');
  });

  it('the mapping check can fail', () => {
    // Without this the loop above would pass against a sentence that mentioned
    // nothing at all, and against a `SPOKEN` entry that happened to be empty.
    expect('an impact view across requirements and code'.includes('operational effects')).toBe(
      false,
    );
  });
});

describe('T996j · all eight are present in every view', () => {
  it('when the source reports one area', async () => {
    const view = await new ImpactComposer(
      port([['tests', { count: 12, detail: '12 suites' }]]),
      traversal,
    ).compose(input);
    expect(Object.keys(view.areas).sort()).toEqual([...IMPACT_AREAS].sort());
  });

  it('when the source reports none', async () => {
    const view = await new ImpactComposer(port([]), traversal).compose(input);
    expect(Object.keys(view.areas)).toHaveLength(8);
  });

  it('when the source cannot be reached at all', async () => {
    // `FR-CHR-032`. Degrading must not shrink the view — an area dropped while
    // degraded is the exact case `SC-CHR-002` measures.
    const broken: ImpactPort = {
      async impactFor() {
        throw new Error('graph unreachable');
      },
    };
    const view = await new ImpactComposer(broken, traversal).compose(input);
    expect(Object.keys(view.areas)).toHaveLength(8);
    expect(Object.values(view.areas).every((a) => a.state === 'unknown')).toBe(true);
  });

  it('each area names itself, so a mislabelled row cannot pass as another', async () => {
    const view = await new ImpactComposer(port([]), traversal).compose(input);
    for (const area of IMPACT_AREAS) {
      expect(view.areas[area].area).toBe(area);
    }
  });

  it('operational effects is one of them, and reachable by name', async () => {
    // The class `DEF-034-001` displaced. Asserted by name rather than by count,
    // because a count of eight was true throughout the defect.
    const view = await new ImpactComposer(
      port([['operations', { count: 3, detail: '3 runbooks reference this behaviour' }]]),
      traversal,
    ).compose(input);
    expect(view.areas.operations.state).toBe('impacted');
    expect(view.areas.operations.itemCount).toBe(3);
  });
});

describe('T996j · zero and null stay different facts', () => {
  it('an unreported area is not-impacted, counted zero', async () => {
    // Somebody looked and found nothing.
    const view = await new ImpactComposer(port([]), traversal).compose(input);
    expect(view.areas.release.state).toBe('not-impacted');
    expect(view.areas.release.itemCount).toBe(0);
  });

  it('an area nobody could reach is unknown, counted null', async () => {
    const broken: ImpactPort = {
      async impactFor() {
        throw new Error('graph unreachable');
      },
    };
    const view = await new ImpactComposer(broken, traversal).compose(input);
    expect(view.areas.release.state).toBe('unknown');
    expect(view.areas.release.itemCount).toBeNull();
  });
});
