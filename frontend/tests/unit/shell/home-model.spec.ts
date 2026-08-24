/**
 * T439a (EPIC-036) — `HomeModel`: three sources, always, and not optional.
 *
 * This is the type doing a job a convention would forget. `FR-SHL-032` names
 * three kinds of attention item and **one of them has a source that exists**
 * (`R-036-4`). A model carrying only `items` would let a Home with one working
 * source render as though nothing were blocked — the confident blank screen
 * this Epic exists to stop repeating.
 *
 * Making `sources` a required 3-tuple means the absence has to be **rendered or
 * deliberately discarded**, and `FR-SHL-062` forbids the second.
 */
import { describe, expect, it } from 'vitest';
import {
  ATTENTION_KINDS,
  available,
  failed,
  homeModel,
  isEmptyAndWorking,
  unavailable,
  type AttentionItem,
} from '../../../src/shell/home-model';

const item: AttentionItem = {
  kind: 'pending-approval',
  subject: 'Run run_1 — 1 question unanswered',
  projectId: 'p1',
  href: '/runs/run_1',
};

describe('T439a · the model always carries three sources', () => {
  it('names exactly the three kinds FR-SHL-032 requires', () => {
    expect([...ATTENTION_KINDS]).toEqual([
      'pending-approval',
      'policy-block',
      'missing-evidence',
    ]);
  });

  it('returns three sources even when every one is empty', () => {
    const model = homeModel([
      available('pending-approval', []),
      available('policy-block', []),
      available('missing-evidence', []),
    ]);
    expect(model.sources).toHaveLength(3);
    expect(model.items).toHaveLength(0);
  });

  it('orders sources as ATTENTION_KINDS orders them, whatever order they arrive in', () => {
    const model = homeModel([
      unavailable('missing-evidence', 'EPIC-032'),
      available('pending-approval', [item]),
      unavailable('policy-block', 'EPIC-031'),
    ]);
    expect(model.sources.map((source) => source.kind)).toEqual([...ATTENTION_KINDS]);
  });

  it('keeps the items of every available source', () => {
    const model = homeModel([
      available('pending-approval', [item]),
      unavailable('policy-block', 'EPIC-031'),
      unavailable('missing-evidence', 'EPIC-032'),
    ]);
    expect(model.items).toEqual([item]);
  });

  it('carries a reason for every source that is not available', () => {
    const model = homeModel([
      failed('pending-approval', 'the runs service did not answer'),
      unavailable('policy-block', 'EPIC-031'),
      unavailable('missing-evidence', 'EPIC-032'),
    ]);
    for (const source of model.sources) {
      expect(source.state).not.toBe('available');
      expect(source.reason, `${source.kind} gives no reason`).toBeTruthy();
    }
  });

  it('contributes no items from a failed or unavailable source', () => {
    // The rule that keeps a fabricated governance state impossible: a source
    // that could not answer contributes silence, and the silence is labelled.
    expect(failed('policy-block', 'x').items).toEqual([]);
    expect(unavailable('policy-block', 'x').items).toEqual([]);
  });
});

describe('T439a · empty-and-working is a different claim from empty', () => {
  it('is true only when the source answered and had nothing', () => {
    const model = homeModel([
      available('pending-approval', []),
      unavailable('policy-block', 'EPIC-031'),
      failed('missing-evidence', 'boom'),
    ]);
    expect(isEmptyAndWorking(model, 'pending-approval')).toBe(true);
    expect(isEmptyAndWorking(model, 'policy-block')).toBe(false);
    expect(isEmptyAndWorking(model, 'missing-evidence')).toBe(false);
  });

  it('is false when the source answered and had something', () => {
    const model = homeModel([
      available('pending-approval', [item]),
      available('policy-block', []),
      available('missing-evidence', []),
    ]);
    expect(isEmptyAndWorking(model, 'pending-approval')).toBe(false);
  });
});
