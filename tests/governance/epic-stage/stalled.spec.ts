/**
 * T496 — stalled is derived, never declared (`FR-ESK-006`).
 * Written to FAIL before T499 exists (Constitution V).
 *
 * **Absence of a posture is never read as a decision.** An Epic that stopped
 * because somebody decided it should and an Epic that stopped because nobody
 * picked it up look identical on disk. The first is governance; the second is
 * drift. Presenting the second as the first is the single most misleading thing
 * this register could do — it would convert neglect into apparent intent and
 * remove any reason to look again.
 *
 * So `stalled` is **derived** — a machine's observation that an Epic is short of
 * its terminal stage with nothing declared — and it is deliberately *not* one of
 * the three posture kinds. `stalled` can never be written into
 * `epic-declarations.json`, because "we have decided this is drifting" is not a
 * decision anyone makes.
 *
 * ## What "stopped" means, mechanically
 *
 * The register carries no timestamps (`RF-2`), so it cannot know whether an Epic
 * moved last week. `stopped` is therefore **structural**: short of its terminal
 * stage — `Ready` for a delivery Epic, `Planned` for a parent design.
 */
import { describe, expect, it } from 'vitest';
import { derivePosture } from './declarations';

describe('T496 · a declared stop reads as the decision it is', () => {
  it('renders Held with its awaiting input', () => {
    expect(
      derivePosture({
        directory: '009-spec-lifecycle-versioning',
        stage: 'Tasked',
        kind: 'delivery',
        declaration: {
          posture: { kind: 'Held', awaiting: 'PMI-DOC-004', reason: 'Awaits business scope.' },
        },
      }),
    ).toBe('Held — awaiting `PMI-DOC-004`');
  });

  it('renders Blocked with the Epic blocking it', () => {
    expect(
      derivePosture({
        directory: '023-unattended-runs-review',
        stage: 'Planned',
        kind: 'delivery',
        declaration: {
          posture: { kind: 'Blocked', blockedBy: '002-team-review-access-storage', reason: 'x' },
        },
      }),
    ).toBe('Blocked — by `002-team-review-access-storage`');
  });

  it('renders Superseded with its replacement', () => {
    expect(
      derivePosture({
        directory: '009-spec-lifecycle-versioning',
        stage: 'Tasked',
        kind: 'delivery',
        declaration: {
          posture: { kind: 'Superseded', replacedBy: '026-epic-stage-kanban', reason: 'x' },
        },
      }),
    ).toBe('Superseded — by `026-epic-stage-kanban`');
  });
});

describe('T496 · an undeclared stop reads as stalled, never as held', () => {
  it('reads stalled when short of the terminal stage with nothing declared', () => {
    // The assertion FR-ESK-006 exists for.
    expect(
      derivePosture({
        directory: '014-devops-release',
        stage: 'Specified',
        kind: 'delivery',
        declaration: undefined,
      }),
    ).toBe('stalled');
  });

  it('NEVER reads Held for an undeclared Epic', () => {
    const posture = derivePosture({
      directory: '014-devops-release',
      stage: 'Specified',
      kind: 'delivery',
      declaration: undefined,
    });
    expect(posture).not.toMatch(/Held/);
    expect(posture).not.toMatch(/Blocked/);
    expect(posture).not.toMatch(/Superseded/);
  });

  it('reads stalled for an Epic with no stage at all', () => {
    // A directory with no spec.md has not deliberately stopped; it is broken.
    // Reporting it as a decision would be the same lie one stage lower.
    expect(
      derivePosture({
        directory: '099-empty',
        stage: null,
        kind: 'delivery',
        declaration: undefined,
      }),
    ).toBe('stalled');
  });
});

describe('T496 · reaching the end is not stalling', () => {
  it('reads no posture for a delivery Epic at Ready', () => {
    expect(
      derivePosture({
        directory: '026-epic-stage-kanban',
        stage: 'Ready',
        kind: 'delivery',
        declaration: undefined,
      }),
    ).toBeNull();
  });

  it('reads no posture for a parent design at Planned', () => {
    // The whole point of FR-ESK-024. EPIC-002 and EPIC-017 have finished; they
    // must never be shown as stalled for lacking a task list they are not
    // meant to have.
    expect(
      derivePosture({
        directory: '002-team-review-access-storage',
        stage: 'Planned',
        kind: 'parent-design',
        declaration: { kind: 'parent-design', children: ['023-unattended-runs-review'] },
      }),
    ).toBeNull();
  });

  it('still reads stalled for a parent design short of Planned', () => {
    // Being a parent design excuses the absence of tasks, not the absence of a
    // plan. A parent design with no plan has genuinely stopped early.
    expect(
      derivePosture({
        directory: '002-team-review-access-storage',
        stage: 'Specified',
        kind: 'parent-design',
        declaration: { kind: 'parent-design', children: ['023-unattended-runs-review'] },
      }),
    ).toBe('stalled');
  });
});

describe('T496 · stalled cannot be declared', () => {
  it('is not one of the three posture kinds', () => {
    // "We have decided this is drifting" is not a decision anyone makes. If
    // `stalled` were declarable, the one honest signal in the column could be
    // switched off by the person it was reporting on.
    const declared = derivePosture({
      directory: '014-devops-release',
      stage: 'Specified',
      kind: 'delivery',
      // Deliberately invalid input: a caller trying to declare stalled.
      declaration: { posture: { kind: 'stalled', reason: 'x' } } as never,
    });
    // The invalid kind is not honoured; the Epic is still derived as stalled,
    // and `validateDeclarations` reports the invalid kind separately.
    expect(declared).toBe('stalled');
  });
});
