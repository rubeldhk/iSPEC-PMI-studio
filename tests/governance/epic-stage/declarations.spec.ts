/**
 * T494 — declaration parsing and validation (`DF-1` … `DF-3`).
 * Written to FAIL before T497 exists (Constitution V).
 *
 * `epic-declarations.json` is **the only hand-authored input to the register**,
 * and therefore the only place the register can be lied to. Everything else is
 * derived from the file tree and cannot disagree with it.
 *
 * **`DF-3` is the rule that keeps the file honest.** A posture with no releasing
 * input names nothing, can be released by nobody, and is indistinguishable from
 * having given up: *"a declaration that points at nothing is a stall wearing a
 * label."* So `Held` must name what it awaits, `Blocked` must name the Epic
 * blocking it, and `Superseded` must name its replacement — and those Epic
 * references must exist on disk, or a rename silently turns a declaration into
 * a dangling pointer nobody notices.
 */
import { describe, expect, it } from 'vitest';
import { validateDeclarations } from './declarations';

/** Directories the validator checks references against. */
const ON_DISK = [
  '002-team-review-access-storage',
  '009-spec-lifecycle-versioning',
  '017-enhancement-model',
  '023-unattended-runs-review',
  '026-epic-stage-kanban',
];

function problems(declarations: unknown): string[] {
  return validateDeclarations(declarations, ON_DISK).problems;
}

describe('T494 · the three posture kinds, and only those (FR-ESK-020)', () => {
  it('accepts Held with an awaiting input', () => {
    expect(
      problems({
        epics: {
          '009-spec-lifecycle-versioning': {
            posture: { kind: 'Held', awaiting: 'PMI-DOC-004', reason: 'Awaits business scope.' },
          },
        },
      }),
    ).toEqual([]);
  });

  it('accepts Blocked with a blocking Epic that exists', () => {
    expect(
      problems({
        epics: {
          '023-unattended-runs-review': {
            posture: {
              kind: 'Blocked',
              blockedBy: '002-team-review-access-storage',
              reason: 'Parent design must land first.',
            },
          },
        },
      }),
    ).toEqual([]);
  });

  it('accepts Superseded with a replacement that exists', () => {
    expect(
      problems({
        epics: {
          '009-spec-lifecycle-versioning': {
            posture: {
              kind: 'Superseded',
              replacedBy: '026-epic-stage-kanban',
              reason: 'Replaced by the register.',
            },
          },
        },
      }),
    ).toEqual([]);
  });

  it('rejects a fourth posture kind', () => {
    // "Deferred" was considered and rejected in clarification: an Epic
    // simultaneously postponed and Ready is a contradiction the register would
    // have to explain every time it was read.
    const found = problems({
      epics: { '009-spec-lifecycle-versioning': { posture: { kind: 'Deferred', reason: 'later' } } },
    });
    expect(found.join(' ')).toMatch(/Deferred/);
  });

  it('rejects parent-design used as a posture kind (DF-4)', () => {
    // Kind is not posture. Posture answers "why has this stopped?"; a parent
    // design has not stopped — it finished at a different line.
    const found = problems({
      epics: {
        '002-team-review-access-storage': { posture: { kind: 'parent-design', reason: 'x' } },
      },
    });
    expect(found.join(' ')).toMatch(/parent-design/);
  });
});

describe('T494 · DF-3 · every declaration names its object (FR-ESK-005)', () => {
  it('reports Held with no awaiting input', () => {
    const found = problems({
      epics: { '009-spec-lifecycle-versioning': { posture: { kind: 'Held', reason: 'pending' } } },
    });
    expect(found.join(' ')).toMatch(/awaiting/);
  });

  it('reports Blocked with no blocking Epic', () => {
    const found = problems({
      epics: { '009-spec-lifecycle-versioning': { posture: { kind: 'Blocked', reason: 'x' } } },
    });
    expect(found.join(' ')).toMatch(/blockedBy/);
  });

  it('reports Superseded with no replacement', () => {
    const found = problems({
      epics: { '009-spec-lifecycle-versioning': { posture: { kind: 'Superseded', reason: 'x' } } },
    });
    expect(found.join(' ')).toMatch(/replacedBy/);
  });

  it('reports a posture with no reason', () => {
    const found = problems({
      epics: { '009-spec-lifecycle-versioning': { posture: { kind: 'Held', awaiting: 'X' } } },
    });
    expect(found.join(' ')).toMatch(/reason/);
  });

  it('reports a reference to a directory that does not exist', () => {
    // A rename would otherwise turn a declaration into a dangling pointer that
    // still looks authoritative.
    const found = problems({
      epics: {
        '009-spec-lifecycle-versioning': {
          posture: { kind: 'Blocked', blockedBy: '999-never-existed', reason: 'x' },
        },
      },
    });
    expect(found.join(' ')).toMatch(/999-never-existed/);
  });

  it('reports a declaration for an Epic that does not exist', () => {
    const found = problems({ epics: { '999-phantom': { kind: 'delivery' } } });
    expect(found.join(' ')).toMatch(/999-phantom/);
  });
});

describe('T494 · the file lists exceptions, not Epics (DF-2)', () => {
  it('accepts an empty declarations file', () => {
    // An Epic absent from `epics` is a delivery Epic with no posture, which is
    // the common case. 26 entries repeating the default would be a second
    // registration step, which FR-ESK-008 forbids.
    expect(problems({ epics: {}, waivers: [] })).toEqual([]);
  });

  it('accepts a file with no epics key at all', () => {
    expect(problems({})).toEqual([]);
  });

  it('reports EVERY problem, not the first', () => {
    const found = problems({
      epics: {
        '009-spec-lifecycle-versioning': { posture: { kind: 'Held', reason: 'x' } },
        '017-enhancement-model': { posture: { kind: 'Blocked', reason: 'y' } },
      },
    });
    expect(found.length).toBeGreaterThanOrEqual(2);
  });
});

describe('T494 · keys are directory names, not EPIC labels (DF-1)', () => {
  it('reports an EPIC-### key', () => {
    // "One identity, one spelling." The directory is what exists on disk and
    // what the derivation enumerates; accepting both spellings would mean two
    // ways to declare the same Epic and a silent winner.
    const found = problems({ epics: { 'EPIC-009': { kind: 'delivery' } } });
    expect(found.join(' ')).toMatch(/EPIC-009/);
  });
});
