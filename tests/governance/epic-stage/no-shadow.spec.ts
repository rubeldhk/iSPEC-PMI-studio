/**
 * T490 · Check `G-26-08` — nothing derivable may be declared (`DF-7`).
 * Written to FAIL before T493 exists (Constitution V).
 *
 * **The one door left open, and the bolt on it.**
 *
 * `epic-declarations.json` is the *only* hand-authored input to the register,
 * and therefore the only place the register can be lied to. Everything else is
 * derived from the file tree and cannot disagree with it.
 *
 * Without this rule the declarations file becomes a hand-maintained shadow
 * register — the exact artifact this epic exists to abolish, reintroduced
 * through the single door that had to stay open. Someone adds `"stage":
 * "Ready"` to unblock themselves once, and from that moment the repository has
 * two answers to "what stage is this Epic at" and no way to tell which is real.
 *
 * **At any depth.** A `stage` key nested three levels inside a posture object is
 * the same lie in a quieter voice, so the scan is recursive rather than a check
 * of top-level keys.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../helpers';
import { DERIVED_KEYS, findDerivedKeys } from './no-shadow';

const DECLARATIONS_PATH = join(REPO_ROOT, 'governance/epic-declarations.json');

describe('G-26-08 · derivable keys are rejected (DF-7, FR-ESK-003)', () => {
  it('names stage, readiness and next as derivable', () => {
    expect([...DERIVED_KEYS].sort()).toEqual(['next', 'readiness', 'stage']);
  });

  it('accepts a declarations file that declares only intent', () => {
    const legitimate = {
      epics: {
        '002-team-review-access-storage': {
          kind: 'parent-design',
          children: ['023-unattended-runs-review'],
          reason: 'Holds requirements for module-aligned children (ruling D-19).',
        },
        '009-spec-lifecycle-versioning': {
          posture: { kind: 'Held', awaiting: 'PMI-DOC-004', reason: 'Awaits business scope.' },
        },
      },
      waivers: [],
    };
    expect(findDerivedKeys(legitimate)).toEqual([]);
  });

  it('rejects a stage declared at the top level of an Epic entry', () => {
    const shadow = { epics: { '004-workspace-tenancy-audit': { stage: 'Ready' } } };
    const found = findDerivedKeys(shadow);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/stage/);
  });

  it('rejects a readiness verdict', () => {
    const shadow = { epics: { '004-workspace-tenancy-audit': { readiness: 'Ready' } } };
    expect(findDerivedKeys(shadow).join(' ')).toMatch(/readiness/);
  });

  it('rejects a next command', () => {
    const shadow = { epics: { '004-workspace-tenancy-audit': { next: '/speckit-implement' } } };
    expect(findDerivedKeys(shadow).join(' ')).toMatch(/next/);
  });

  it('rejects a derivable key NESTED at any depth', () => {
    // The quiet version. A top-level-only scan would pass this file, and the
    // shadow register would grow from inside a posture object.
    const shadow = {
      epics: {
        '009-spec-lifecycle-versioning': {
          posture: { kind: 'Held', awaiting: 'PMI-DOC-004', stage: 'Tasked' },
        },
      },
    };
    const found = findDerivedKeys(shadow);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/posture/);
    expect(found[0]).toMatch(/stage/);
  });

  it('rejects a derivable key inside an array element', () => {
    const shadow = {
      waivers: [{ epic: '014-devops-release', condition: 'DOR-09', readiness: 'Ready' }],
    };
    expect(findDerivedKeys(shadow).join(' ')).toMatch(/readiness/);
  });

  it('reports EVERY offending key, not the first', () => {
    // Same reasoning as FR-ESK-013 for the DOR: one pass should tell a reader
    // everything outstanding, or they fix one and rerun to find the next.
    const shadow = {
      epics: {
        a: { stage: 'Ready' },
        b: { readiness: 'Ready' },
        c: { posture: { next: '/speckit-plan' } },
      },
    };
    expect(findDerivedKeys(shadow)).toHaveLength(3);
  });

  it('reports the PATH to each offending key, not just its name', () => {
    // "a stage key exists somewhere" is not actionable in a file of 26 entries.
    const shadow = { epics: { '004-workspace-tenancy-audit': { stage: 'Ready' } } };
    expect(findDerivedKeys(shadow)[0]).toContain('004-workspace-tenancy-audit');
  });

  it('is not fooled by a key that merely contains a derivable word', () => {
    // `nextReviewOwner` is not a next command, and rejecting it would push
    // authors toward worse names to satisfy a checker.
    const legitimate = { epics: { a: { nextReviewOwner: 'tech-lead', stagedBy: 'someone' } } };
    expect(findDerivedKeys(legitimate)).toEqual([]);
  });
});

describe('G-26-08 · the declarations file in this repository', () => {
  it('declares no derivable value', () => {
    // Vacuous until T500 authors the file, and it says so out loud rather than
    // reporting a silent green.
    if (!existsSync(DECLARATIONS_PATH)) {
      console.info(
        '[G-26-08] governance/epic-declarations.json does not exist yet (authored by T500, Phase 5). ' +
          'The rules above are proven against fixtures; the corpus pass has nothing to read.',
      );
      return;
    }
    const parsed = JSON.parse(readFileSync(DECLARATIONS_PATH, 'utf8')) as unknown;
    const found = findDerivedKeys(parsed);
    expect(found, `derivable keys declared: ${found.join(', ')}`).toEqual([]);
  });
});
