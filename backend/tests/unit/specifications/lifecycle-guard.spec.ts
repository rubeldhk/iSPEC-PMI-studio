/**
 * T106 — all eight permitted transitions of the M08 six-state lifecycle;
 * every other transition refused NAMING the permitted set.
 * Written to FAIL before T099/T111 exist (Constitution V).
 *
 * FR-011 / SRS M08 §8 (decision D-14). The permitted set is exactly the one
 * the database CHECK constraint enforces (specs/_shared/schema.sql) — two
 * implementations of one rule, and this suite pins the code half.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryTransitionRecorder,
  LifecycleMachine,
  PERMITTED_TRANSITIONS,
  SPEC_LIFECYCLE_STATES,
  assertTransition,
  permittedFrom,
} from '../../../src/modules/specifications/lifecycle.machine.js';
import { InvalidLifecycleTransitionError } from '../../../src/core/errors.js';

const EXPECTED: readonly [string, string][] = [
  ['draft', 'review'],
  ['review', 'draft'], // rejection returns it for rework
  ['review', 'approved'],
  ['approved', 'baselined'],
  ['baselined', 'implemented'],
  ['approved', 'archived'],
  ['baselined', 'archived'],
  ['implemented', 'archived'],
];

describe('the permitted set (FR-011, M08 §8)', () => {
  it('is exactly the eight transitions the SRS names', () => {
    const actual = PERMITTED_TRANSITIONS.map((t) => [t.from, t.to]).sort();
    expect(actual).toEqual([...EXPECTED].sort());
  });

  it.each(EXPECTED)('%s → %s is permitted', (from, to) => {
    expect(() => assertTransition(from as never, to as never)).not.toThrow();
  });

  it('refuses every other pairing, NAMING the permitted set', () => {
    for (const from of SPEC_LIFECYCLE_STATES) {
      for (const to of SPEC_LIFECYCLE_STATES) {
        if (from === to) continue;
        if (EXPECTED.some(([f, t]) => f === from && t === to)) continue;
        const err = ((): unknown => {
          try {
            assertTransition(from, to);
            return null;
          } catch (e) {
            return e;
          }
        })();
        expect(err, `${from} → ${to} must be refused`).toBeInstanceOf(
          InvalidLifecycleTransitionError,
        );
        const details = (err as InvalidLifecycleTransitionError).details as {
          from: string;
          to: string;
          permitted: string[];
        };
        expect(details.permitted.sort()).toEqual(permittedFrom(from).sort());
      }
    }
  });

  it('approved → draft is NOT permitted (US5 scenario 4) — the named counterexample', () => {
    expect(() => assertTransition('approved', 'draft')).toThrow(InvalidLifecycleTransitionError);
  });

  it('archived is terminal — nothing leaves it', () => {
    expect(permittedFrom('archived')).toEqual([]);
  });
});

describe('T111 — every transition records actor and time (FR-014)', () => {
  it('appends a transition record carrying who and when', async () => {
    const recorder = new InMemoryTransitionRecorder();
    const machine = new LifecycleMachine(recorder, {
      now: (): Date => new Date('2026-08-20T12:00:00Z'),
    });
    const record = await machine.transition({
      workspaceId: 'ws_a',
      specificationId: 's1',
      from: 'draft',
      to: 'review',
      actorId: 'u1',
    });
    expect(record.actorId).toBe('u1');
    expect(record.occurredAt).toEqual(new Date('2026-08-20T12:00:00Z'));
    expect(recorder.records).toHaveLength(1);
    expect(recorder.records[0]).toMatchObject({
      workspaceId: 'ws_a',
      specificationId: 's1',
      fromState: 'draft',
      toState: 'review',
      actorId: 'u1',
    });
  });

  it('a refused transition records NOTHING — refusals are audit events, not history', async () => {
    const recorder = new InMemoryTransitionRecorder();
    const machine = new LifecycleMachine(recorder);
    await expect(
      machine.transition({
        workspaceId: 'ws_a',
        specificationId: 's1',
        from: 'approved',
        to: 'draft',
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(InvalidLifecycleTransitionError);
    expect(recorder.records).toHaveLength(0);
  });

  it('the recorder port is append-only — no update or delete exists to call', () => {
    const recorder = new InMemoryTransitionRecorder();
    for (const forbidden of ['update', 'delete', 'remove', 'destroy']) {
      expect(
        (recorder as unknown as Record<string, unknown>)[forbidden],
        `recorder must not expose ${forbidden}()`,
      ).toBeUndefined();
    }
  });
});
