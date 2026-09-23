/**
 * `T994f`, `T994g` (EPIC-034) — the baseline delta.
 *
 * `FR-CHR-063`: the approved baseline delta is readable **as a delta**, not
 * only as two full versions. `R-034-4`: it is a set diff over the baseline's
 * member **version ids** — added, removed, version-changed — and never a text
 * diff.
 *
 * ## Why the distinction is load-bearing
 *
 * `EPIC-033`'s `R-033-5` stores a baseline as member requirement version ids
 * plus a set hash, **never copies of requirement text**. A text diff would have
 * to re-derive content the baseline deliberately does not hold, and would then
 * disagree with the set hash — presentation-layer output masquerading as the
 * delta.
 *
 * ## The third category is the one that needs a join
 *
 * Added and removed fall out of a set difference. **Version-changed** does not:
 * `rv_2` becoming `rv_2b` is one requirement moving forward, not one
 * disappearing and another arriving, and telling those apart needs to know
 * which requirement each version belongs to. That join is `EPIC-007`'s
 * (`FR-RQR-002`), so the caller supplies it — the same rule `assertEditable`
 * follows.
 */
import { describe, expect, it } from 'vitest';
import { computeBaselineDelta } from '../../src/modules/change-room/delta.service.js';

/** version id → requirement id, resolved by the caller through `EPIC-007`. */
const OWNER: Readonly<Record<string, string>> = {
  rv_1: 'req_1',
  rv_2: 'req_2',
  rv_2b: 'req_2',
  rv_3: 'req_3',
  rv_4: 'req_4',
};

const delta = (from: readonly string[], to: readonly string[]) =>
  computeBaselineDelta({
    fromBaselineVersion: 1,
    toBaselineVersion: 2,
    from,
    to,
    requirementOf: (versionId) => OWNER[versionId] ?? null,
  });

describe('T994f · added and removed', () => {
  it('names a version present only in the new set', () => {
    const result = delta(['rv_1'], ['rv_1', 'rv_4']);
    expect(result.added).toEqual(['rv_4']);
    expect(result.removed).toEqual([]);
  });

  it('names a version present only in the old set', () => {
    const result = delta(['rv_1', 'rv_3'], ['rv_1']);
    expect(result.removed).toEqual(['rv_3']);
    expect(result.added).toEqual([]);
  });

  it('an unchanged set produces an empty delta in all three categories', () => {
    const result = delta(['rv_1', 'rv_3'], ['rv_1', 'rv_3']);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.versionChanged).toEqual([]);
  });

  it('and order in the input does not create a difference', () => {
    // A baseline's members are a set. Reordering them is not a change, and a
    // delta that said otherwise would report movement on every re-approval.
    const result = delta(['rv_3', 'rv_1'], ['rv_1', 'rv_3']);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });
});

describe('T994f · version-changed is not an add plus a remove', () => {
  it('recognises one requirement moving forward', () => {
    // The category that needs the join. Reported as add+remove, this would read
    // as "requirement 2 was deleted and an unrelated one appeared".
    const result = delta(['rv_1', 'rv_2'], ['rv_1', 'rv_2b']);
    expect(result.versionChanged).toEqual([
      { requirementId: 'req_2', from: 'rv_2', to: 'rv_2b' },
    ]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('and keeps genuine additions separate from it', () => {
    const result = delta(['rv_1', 'rv_2'], ['rv_1', 'rv_2b', 'rv_4']);
    expect(result.versionChanged).toHaveLength(1);
    expect(result.added).toEqual(['rv_4']);
    expect(result.removed).toEqual([]);
  });

  it('and genuine removals too', () => {
    const result = delta(['rv_1', 'rv_2', 'rv_3'], ['rv_1', 'rv_2b']);
    expect(result.versionChanged).toHaveLength(1);
    expect(result.removed).toEqual(['rv_3']);
  });

  it('a version whose requirement cannot be resolved is added or removed, not guessed', () => {
    // `null` from the join means `EPIC-007` does not know this version. Pairing
    // it with something on a hunch would invent a requirement history.
    const result = computeBaselineDelta({
      fromBaselineVersion: 1,
      toBaselineVersion: 2,
      from: ['rv_1'],
      to: ['rv_unknown'],
      requirementOf: () => null,
    });
    expect(result.added).toEqual(['rv_unknown']);
    expect(result.removed).toEqual(['rv_1']);
    expect(result.versionChanged).toEqual([]);
  });
});

describe('T994f · it is a set diff, and says so', () => {
  it('carries the two versions it spans', () => {
    const result = delta(['rv_1'], ['rv_1', 'rv_4']);
    expect(result.fromBaselineVersion).toBe(1);
    expect(result.toBaselineVersion).toBe(2);
  });

  it('refuses a delta that does not move forward', () => {
    // The database CHECK says the same thing. A delta that goes nowhere is not
    // a delta.
    expect(() =>
      computeBaselineDelta({
        fromBaselineVersion: 2,
        toBaselineVersion: 2,
        from: [],
        to: [],
        requirementOf: () => null,
      }),
    ).toThrow(/forward/i);
  });

  it('never reads requirement text — there is none to read', () => {
    // `R-034-4`. The inputs are ids and a join; there is no text parameter, so
    // a text diff is not something a caller could ask for by mistake.
    const result = delta(['rv_1', 'rv_2'], ['rv_1', 'rv_2b']);
    const serialised = JSON.stringify(result);
    expect(serialised).not.toMatch(/shall|must|requirement text/i);
  });

  it('is deterministic — the same inputs give the same delta', () => {
    // Stored and later re-read, so two computations disagreeing would make the
    // record and the recomputation contradict each other.
    const a = delta(['rv_3', 'rv_1', 'rv_2'], ['rv_2b', 'rv_4', 'rv_1']);
    const b = delta(['rv_1', 'rv_2', 'rv_3'], ['rv_1', 'rv_2b', 'rv_4']);
    expect(a).toEqual(b);
  });
});

describe('T994f · a whole re-baseline reads as a delta', () => {
  it('one change, one addition, one removal', () => {
    // The realistic case, and the one `FR-CHR-063` is about: three lines a
    // reader can take in, rather than two full member lists to compare by eye.
    const result = delta(['rv_1', 'rv_2', 'rv_3'], ['rv_1', 'rv_2b', 'rv_4']);
    expect(result).toEqual({
      fromBaselineVersion: 1,
      toBaselineVersion: 2,
      added: ['rv_4'],
      removed: ['rv_3'],
      versionChanged: [{ requirementId: 'req_2', from: 'rv_2', to: 'rv_2b' }],
    });
  });
});
