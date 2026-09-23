/**
 * `T1698` (EPIC-046, `R-046-4`) — reconciliation, as a table.
 *
 * PMI-DOC-007 §10 says of this Epic: *"parser is small; the rules are the
 * work."* This is the rules. A truth table is the only form in which they can be
 * reviewed by a person and mutated by a test, so the table below is the test —
 * one case per row of `research.md` `R-046-4`, including the row `FR-KAN-041`
 * makes unreachable, which is **asserted rather than assumed**.
 *
 * The direction is fixed by PMI-DOC-007 §2.3: task status is authoritative in
 * the `tasks.md` checkboxes *as observed*, and the PMI row is a mirror. So the
 * file wins for the two states a checkbox can express, and a status that came
 * from a proposal survives only while the file is silent about it.
 *
 * What must never happen — and `FR-KAN-022` says so — is that a proposal record
 * is deleted or amended when the file supersedes it. Reconciliation returns a
 * *marker*; it does not reach for the proposal.
 *
 * Written to FAIL before `T1699`.
 */
import { describe, expect, it } from 'vitest';
import { reconcile, type Previous } from '../../../src/modules/task-sync/task-reconcile.js';
import type { Marker, StatusSource, TaskStatusValue } from '../../../src/modules/task-sync/task-sync.store.js';

function prev(status: TaskStatusValue, statusSource: StatusSource): Previous {
  return { status, statusSource };
}

describe('T1698 · the reconciliation truth table (R-046-4)', () => {
  describe('a line CHECKED in the latest parse → done (FR-KAN-021)', () => {
    it.each<[TaskStatusValue, StatusSource, Marker | null]>([
      ['not_started', 'parse', null],
      ['not_started', 'engine', null],
      ['done', 'parse', null],
      ['done', 'event', null],
      ['done', 'proposal', null],
      // FR-KAN-022: the file supersedes a manual status, and SAYS SO.
      ['in_progress', 'proposal', 'supersededByFile'],
      ['blocked', 'proposal', 'supersededByFile'],
    ])('previous %s from %s → done, marker %s', (status, source, marker) => {
      const out = reconcile(prev(status, source), { checked: true });
      expect(out.status).toBe('done');
      expect(out.statusSource).toBe('parse');
      expect(out.marker).toBe(marker);
    });
  });

  describe('a line UNCHECKED in the latest parse', () => {
    it.each<[TaskStatusValue, StatusSource, TaskStatusValue, Marker | null]>([
      // Done, then the file no longer says so: the file wins.
      ['done', 'parse', 'not_started', null],
      ['done', 'event', 'not_started', null],
      // ...including when the Done came from a person. The proposal record stays.
      ['done', 'proposal', 'not_started', 'supersededByFile'],
      // A proposal-set middle state survives while the file is silent about it.
      ['in_progress', 'proposal', 'in_progress', 'aheadOfFile'],
      ['blocked', 'proposal', 'blocked', 'aheadOfFile'],
      // Nothing to say.
      ['not_started', 'parse', 'not_started', null],
      ['not_started', 'engine', 'not_started', null],
    ])('previous %s from %s → %s, marker %s', (status, source, expected, marker) => {
      const out = reconcile(prev(status, source), { checked: false });
      expect(out.status).toBe(expected);
      expect(out.marker).toBe(marker);
    });

    it('keeps the proposal as the source of a status it did not change', () => {
      expect(reconcile(prev('in_progress', 'proposal'), { checked: false }).statusSource).toBe('proposal');
    });

    it.each<[TaskStatusValue, StatusSource]>([
      ['in_progress', 'parse'],
      ['in_progress', 'event'],
      ['blocked', 'parse'],
      ['blocked', 'event'],
    ])('falls back to not_started for %s from %s — unreachable by FR-KAN-041, asserted not assumed', (status, source) => {
      // FR-KAN-041 says no parse and no event can produce these two states, so
      // this row cannot arise from live data. It is here because "cannot happen"
      // is a claim, and a claim in a comment is not a control: if a future
      // change lets an event set `in_progress`, this row is what notices.
      const out = reconcile(prev(status, source), { checked: false });
      expect(out.status).toBe('not_started');
      expect(out.marker).toBeNull();
    });
  });

  describe('a task the parse has not seen before', () => {
    it('takes its status from the checkbox alone', () => {
      expect(reconcile(null, { checked: false })).toEqual({ status: 'not_started', statusSource: 'parse', marker: null });
      expect(reconcile(null, { checked: true })).toEqual({ status: 'done', statusSource: 'parse', marker: null });
    });
  });

  describe('the properties the rule must hold whatever the row', () => {
    const statuses: TaskStatusValue[] = ['not_started', 'in_progress', 'done', 'blocked'];
    const sources: StatusSource[] = ['parse', 'event', 'proposal', 'engine'];
    const every = statuses.flatMap((s) => sources.flatMap((src) => [true, false].map((checked) => ({ s, src, checked }))));

    it('is idempotent — reconciling its own output changes nothing', () => {
      for (const { s, src, checked } of every) {
        const once = reconcile(prev(s, src), { checked });
        const twice = reconcile({ status: once.status, statusSource: once.statusSource }, { checked });
        expect(twice.status, `${s}/${src}/${checked}`).toBe(once.status);
      }
    });

    it('never invents a status the checkbox and the previous row do not between them justify', () => {
      for (const { s, src, checked } of every) {
        const out = reconcile(prev(s, src), { checked });
        expect(['not_started', 'done', s]).toContain(out.status);
      }
    });

    it('marks aheadOfFile only when it kept a status the file contradicts', () => {
      for (const { s, src, checked } of every) {
        const out = reconcile(prev(s, src), { checked });
        if (out.marker === 'aheadOfFile') {
          expect(checked).toBe(false);
          expect(out.status).toBe(s);
          expect(src).toBe('proposal');
        }
      }
    });

    it('marks supersededByFile only when it overrode a proposal', () => {
      for (const { s, src, checked } of every) {
        const out = reconcile(prev(s, src), { checked });
        if (out.marker === 'supersededByFile') {
          expect(src).toBe('proposal');
          expect(out.status).not.toBe(s);
        }
      }
    });

    it('is pure — no clock, no store, and the input is not mutated', () => {
      const input = prev('in_progress', 'proposal');
      const frozen = { ...input };
      reconcile(input, { checked: true });
      expect(input).toEqual(frozen);
    });
  });
});
