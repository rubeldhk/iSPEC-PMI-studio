/**
 * T495 — the parent-design Epic kind (`FR-ESK-024`, `DF-4`).
 * Written to FAIL before T498 exists (Constitution V).
 *
 * **The problem this solves, in the spec's own words:** *"a parent design is
 * confused with a stalled Epic — the two look identical on disk."* EPIC-002 and
 * EPIC-017 have a spec and a plan and no `tasks.md`, exactly like an Epic that
 * ran out of steam. Nothing in the tree distinguishes "deliberately carries no
 * tasks" from "nobody wrote the tasks", because the distinction is intent, and
 * intent is declared.
 *
 * Three consequences, each tested below:
 *
 * - a parent design **completes at `Planned`** rather than stalling short of
 *   `Ready`;
 * - it is **never evaluated for readiness** — a permanent, meaningless failure
 *   otherwise, since the DOR requires a task list it is not meant to have;
 * - it **must name its children**, or it is a container declaring nothing.
 *
 * And `DF-4`: kind is not posture. The two combine freely — a parent design may
 * also be `Held`, which is exactly EPIC-017's situation.
 */
import { describe, expect, it } from 'vitest';
import { epicKindOf, evaluatesDor, terminalStageFor, validateDeclarations } from './declarations';

const ON_DISK = [
  '002-team-review-access-storage',
  '017-enhancement-model',
  '019-steering-engine',
  '023-unattended-runs-review',
];

const PARENT = {
  epics: {
    '002-team-review-access-storage': {
      kind: 'parent-design',
      children: ['023-unattended-runs-review'],
      reason: 'Holds requirements for module-aligned children (ruling D-19).',
    },
  },
};

describe('T495 · a parent design finishes at a different line (FR-ESK-024)', () => {
  it('is recognised as parent-design', () => {
    expect(epicKindOf('002-team-review-access-storage', PARENT)).toBe('parent-design');
  });

  it('defaults to delivery when nothing is declared', () => {
    // Absence is never a decision. No declaration means the common case.
    expect(epicKindOf('019-steering-engine', PARENT)).toBe('delivery');
    expect(epicKindOf('019-steering-engine', {})).toBe('delivery');
  });

  it('has a terminal stage of Planned, not Ready', () => {
    expect(terminalStageFor('parent-design')).toBe('Planned');
    expect(terminalStageFor('delivery')).toBe('Ready');
  });

  it('is NOT evaluated for readiness', () => {
    // The DOR requires a task list. Evaluating a parent design would report a
    // permanent failure for the absence of something it is defined not to have.
    expect(evaluatesDor('parent-design')).toBe(false);
    expect(evaluatesDor('delivery')).toBe(true);
  });
});

describe('T495 · a parent design must name its children (DF-3)', () => {
  it('is accepted with a non-empty children list', () => {
    expect(validateDeclarations(PARENT, ON_DISK).problems).toEqual([]);
  });

  it('is reported when children is absent', () => {
    const found = validateDeclarations(
      { epics: { '002-team-review-access-storage': { kind: 'parent-design', reason: 'x' } } },
      ON_DISK,
    ).problems;
    expect(found.join(' ')).toMatch(/children/);
  });

  it('is reported when children is empty', () => {
    // A container declaring no contents is not a container.
    const found = validateDeclarations(
      {
        epics: {
          '002-team-review-access-storage': { kind: 'parent-design', children: [], reason: 'x' },
        },
      },
      ON_DISK,
    ).problems;
    expect(found.join(' ')).toMatch(/children/);
  });

  it('is reported when a child does not exist on disk', () => {
    const found = validateDeclarations(
      {
        epics: {
          '002-team-review-access-storage': {
            kind: 'parent-design',
            children: ['999-imaginary'],
            reason: 'x',
          },
        },
      },
      ON_DISK,
    ).problems;
    expect(found.join(' ')).toMatch(/999-imaginary/);
  });

  it('is reported when a parent design has no reason', () => {
    const found = validateDeclarations(
      {
        epics: {
          '002-team-review-access-storage': {
            kind: 'parent-design',
            children: ['023-unattended-runs-review'],
          },
        },
      },
      ON_DISK,
    ).problems;
    expect(found.join(' ')).toMatch(/reason/);
  });
});

describe('T495 · contradictions are reported, not resolved', () => {
  it('reports a parent design that holds a tasks.md', () => {
    // Either the declaration is wrong or the tasks belong to a child. The
    // register does not guess which — it says so and lets a person decide.
    const found = validateDeclarations(PARENT, ON_DISK, {
      '002-team-review-access-storage': { hasTasks: true },
    }).problems;
    expect(found.join(' ')).toMatch(/tasks\.md/);
  });

  it('does not report a delivery Epic that holds a tasks.md', () => {
    const found = validateDeclarations({}, ON_DISK, {
      '019-steering-engine': { hasTasks: true },
    }).problems;
    expect(found).toEqual([]);
  });
});

describe('T495 · DF-4 · kind and posture combine freely', () => {
  it('accepts a parent design that is ALSO Held', () => {
    // EPIC-017's exact situation: a design container awaiting an input. Two
    // orthogonal facts, not a conflict.
    const found = validateDeclarations(
      {
        epics: {
          '017-enhancement-model': {
            kind: 'parent-design',
            children: ['019-steering-engine'],
            reason: 'Shared design for four delivery children (ruling D-18).',
            posture: { kind: 'Held', awaiting: 'PMI-DOC-004', reason: 'Awaits business scope.' },
          },
        },
      },
      ON_DISK,
    ).problems;
    expect(found).toEqual([]);
  });
});
