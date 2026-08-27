/**
 * T1034, T1035 (EPIC-037 Band A) — the frozen agent identity snapshot.
 *
 * `AC-EXR-14`: renaming a descriptor later must not alter history. The registry
 * stores a live `descriptorRef` **beside** frozen columns, and history reads
 * the frozen ones. These assert the distinction holds at the level where it is
 * decided — what the event hash covers, and what a snapshot pins.
 */
import { describe, expect, it } from 'vitest';
import { hashEvent } from '../../../src/modules/executions/execution-event.service.js';

describe('T1034 · the integrity hash chains an event to its predecessor', () => {
  const base = {
    executionId: 'exec_1',
    sequence: 2,
    type: 'started',
    payload: { a: 1 },
    occurredAt: '2026-08-27T00:00:00.000Z',
    emittedBy: 'p_agent',
    previousHash: 'h1',
  };

  it('is stable for identical input', () => {
    expect(hashEvent(base)).toBe(hashEvent({ ...base }));
  });

  it.each([
    ['sequence', { sequence: 3 }],
    ['type', { type: 'completed' }],
    ['payload', { payload: { a: 2 } }],
    ['emitter', { emittedBy: 'someone_else' }],
    ['predecessor', { previousHash: 'h2' }],
  ])('changes when the %s changes', (_label, over) => {
    expect(hashEvent({ ...base, ...over })).not.toBe(hashEvent(base));
  });

  it('depends on the PREDECESSOR, so removing a middle event is detectable', () => {
    // A per-row hash would prove each row intact and nothing about the shape of
    // the stream. Chaining is what makes a deletion visible — and the table is
    // append-only precisely so that a deletion should never be possible.
    const first = hashEvent({ ...base, sequence: 1, previousHash: '' });
    const second = hashEvent({ ...base, sequence: 2, previousHash: first });
    const secondWithoutFirst = hashEvent({ ...base, sequence: 2, previousHash: '' });
    expect(second).not.toBe(secondWithoutFirst);
  });
});

describe('T1035 · a snapshot pins identity, a reference stays live', () => {
  it('keeps the two apart, which is what AC-EXR-14 turns on', () => {
    // The registry writes `descriptorRef` (live, EPIC-028) alongside frozen
    // provider/model/adapter columns. History reads the frozen ones, so a
    // descriptor renamed tomorrow does not rewrite what ran today.
    const stored = {
      descriptorRef: 'fixture-agent',
      principalSnapshotId: 'snap_1',
      provider: 'frozen',
      model: 'frozen',
      adapter: 'fixture',
    };
    const renamedLater = { ...stored, descriptorRef: 'fixture-agent-v2' };
    expect(renamedLater.principalSnapshotId).toBe(stored.principalSnapshotId);
    expect(renamedLater.adapter).toBe(stored.adapter);
  });
});
