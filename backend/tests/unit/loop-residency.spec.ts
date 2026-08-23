/**
 * T977 — stage residency. `SC-GEL-006`, `PP-010`.
 *
 * *"Which stage, and for how long, without opening the object."*
 *
 * This is the only measurement in the Epic that is not about correctness. A loop
 * can be entirely correct and still have every object stuck in `Decide` for
 * eleven days because one approver is on leave — every transition authorised,
 * every gate satisfied, every refusal recorded, and nothing moving. No other
 * test here would notice, because nothing is wrong.
 *
 * `now` is injected rather than read from the clock. A duration test against
 * `Date.now()` either sleeps or asserts a range, and both are the kind of test
 * people delete.
 */
import { describe, expect, it } from 'vitest';
import { residencyByStage, residencyOf } from '../../src/modules/loop/residency.js';
import type { LoopTransitionRow } from '../../src/modules/loop/loop.store.js';

const T0 = new Date('2026-08-23T00:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

function row(over: Partial<LoopTransitionRow>): LoopTransitionRow {
  return {
    id: 'x', workspaceId: 'ws', objectId: 'o', objectVersion: 0,
    fromStage: 'Event', toStage: 'Context', outcome: 'accepted',
    refusalReason: null, wonBy: null, actorId: 'u', actorKind: 'human',
    authorityBasis: 'a', triggerRuleId: null, triggerEventId: null,
    configVersion: 1, gateOutcomes: [], occurredAt: at(0),
    ...over,
  };
}

const object = { currentStage: 'Decide' as const, createdAt: T0 };

describe('T977 · how long the object has been where it is', () => {
  it('measures from the accepted transition that brought it here', () => {
    const residency = residencyOf({
      object,
      history: [
        row({ fromStage: 'Event', toStage: 'Analyze', occurredAt: at(10) }),
        row({ fromStage: 'Analyze', toStage: 'Decide', occurredAt: at(30) }),
      ],
      now: at(90),
    });
    expect(residency.stage).toBe('Decide');
    expect(residency.since).toEqual(at(30));
    expect(residency.milliseconds).toBe(60 * 60_000);
  });

  it('does NOT reset the clock on a refused attempt', () => {
    // The object most worth noticing is the one people keep trying to move and
    // cannot. If a refusal reset the timer, it would look freshly arrived every
    // time someone tried — the exact inverse of the signal.
    const residency = residencyOf({
      object,
      history: [
        row({ fromStage: 'Analyze', toStage: 'Decide', occurredAt: at(30) }),
        row({ fromStage: 'Decide', toStage: 'Outcome', outcome: 'refused', refusalReason: 'no', occurredAt: at(80) }),
      ],
      now: at(90),
    });
    expect(residency.since).toEqual(at(30));
    expect(residency.milliseconds).toBe(60 * 60_000);
  });

  it('does not reset on a lost race either', () => {
    const residency = residencyOf({
      object,
      history: [
        row({ fromStage: 'Analyze', toStage: 'Decide', occurredAt: at(30) }),
        row({ toStage: 'Decide', outcome: 'conflict', refusalReason: 'lost', occurredAt: at(85) }),
      ],
      now: at(90),
    });
    expect(residency.since).toEqual(at(30));
  });

  it('takes the MOST RECENT arrival when a stage was entered twice', () => {
    // Possible after a loop back. The first arrival is history; the question is
    // how long it has been here THIS time.
    const residency = residencyOf({
      object,
      history: [
        row({ fromStage: 'Analyze', toStage: 'Decide', occurredAt: at(10) }),
        row({ fromStage: 'Decide', toStage: 'Analyze', occurredAt: at(20) }),
        row({ fromStage: 'Analyze', toStage: 'Decide', occurredAt: at(50) }),
      ],
      now: at(90),
    });
    expect(residency.since).toEqual(at(50));
  });

  it('falls back to createdAt for an object that has never moved', () => {
    // Not `now`, which would report zero and make a month-old object that never
    // left Event look like it arrived this second — the worst possible answer
    // for the stage most likely to hold abandoned work.
    const residency = residencyOf({
      object: { currentStage: 'Event', createdAt: T0 },
      history: [],
      now: at(240),
    });
    expect(residency.since).toEqual(T0);
    expect(residency.milliseconds).toBe(4 * 60 * 60_000);
  });

  it('never reports a negative duration', () => {
    const residency = residencyOf({
      object,
      history: [row({ fromStage: 'Analyze', toStage: 'Decide', occurredAt: at(90) })],
      now: at(30),
    });
    expect(residency.milliseconds).toBe(0);
  });
});

describe('SC-GEL-006 · the aggregate across many objects', () => {
  const residencies = [
    { stage: 'Decide' as const, since: at(0), milliseconds: 10 * 60_000 },
    { stage: 'Decide' as const, since: at(0), milliseconds: 43_200 * 60_000 },
    { stage: 'Analyze' as const, since: at(0), milliseconds: 5 * 60_000 },
  ];

  it('counts the objects sitting in each stage', () => {
    const byStage = residencyByStage(residencies);
    expect(byStage.get('Decide')?.count).toBe(2);
    expect(byStage.get('Analyze')?.count).toBe(1);
  });

  it('reports the OLDEST, not the mean', () => {
    // Nine objects moving in an hour and one stuck for a month gives an
    // unremarkable average and one real problem. The average hides it; the
    // maximum is the whole signal.
    const byStage = residencyByStage(residencies);
    expect(byStage.get('Decide')?.oldestMs).toBe(43_200 * 60_000);
  });

  it('omits a stage holding nothing, rather than reporting zero', () => {
    // Zero would read as "objects here move instantly" when the truth is
    // "nothing is here", and those are opposite operational facts.
    const byStage = residencyByStage(residencies);
    expect(byStage.has('Outcome')).toBe(false);
    expect(byStage.size).toBe(2);
  });

  it('answers without opening any object', () => {
    // The literal requirement. The input is a list of residencies; nothing in
    // this function reads a subject, a Room, or an object row.
    expect(residencyByStage([])).toEqual(new Map());
  });
});
