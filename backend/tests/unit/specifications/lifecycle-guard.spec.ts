/**
 * T106 — all eight permitted transitions of the M08 six-state lifecycle;
 * every other transition refused NAMING the permitted set.
 * Written to FAIL before T099/T111 exist (Constitution V).
 *
 * FR-011 / SRS M08 §8 (decision D-14). The permitted set is exactly the one
 * the database CHECK constraint enforces (specs/_shared/schema.sql) — two
 * implementations of one rule, and this suite pins the code half.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

// ------------------------------------------------------- T109 · persistence
//
// Added when the EPIC-008-gated half of this Epic landed. `lifecycle.machine.ts`
// records WHO and WHEN through a port; T109 is the table behind it.

describe('T109 · LifecycleTransition reaches the database (FR-014)', () => {
  const schema = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../prisma/schema.prisma'),
    'utf8',
  );
  const migration = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../prisma/migrations/20260820100100_epic009_lifecycle_findings/migration.sql',
    ),
    'utf8',
  );
  const model = /model LifecycleTransition\s*\{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? '';

  it('records who and when, neither nullable', () => {
    expect(model).toMatch(/actorId\s+String\b(?!\?)/);
    expect(model).toMatch(/occurredAt\s+DateTime/);
    expect(model).toMatch(/fromState\s+SpecLifecycleState/);
    expect(model).toMatch(/toState\s+SpecLifecycleState/);
  });

  it('carries workspaceId like every tenant-scoped model (FR-002)', () => {
    expect(model).toMatch(/workspaceId\s+String/);
  });

  it('is append-only at the database — history cannot be edited afterwards', () => {
    // "Who approved this, and when" is unanswerable if the answer can be
    // rewritten. Attached to EPIC-004's SHARED reject_mutation(), never a
    // redefinition.
    expect(migration).toMatch(
      /CREATE TRIGGER "lifecycle_transitions_immutable"[\s\S]*?BEFORE UPDATE OR DELETE ON "lifecycle_transitions"[\s\S]*?EXECUTE FUNCTION reject_mutation\(\)/,
    );
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?FUNCTION reject_mutation/);
  });

  it('the database CHECK permits EXACTLY the transitions the code permits', () => {
    // The two-layer rule, pinned. Until now this suite could only assert the
    // code half, because the constraint lived in the design DDL and in no
    // migration. A drift between them is how a state machine acquires a
    // transition nobody agreed to.
    const check = /lifecycle_permitted_transition" CHECK \(([\s\S]*?)\n    \);/.exec(migration)?.[1];
    expect(check, 'the CHECK constraint is missing from the migration').toBeDefined();

    const inSql = [...check!.matchAll(/"fromState" = '(\w+)'\s+AND "toState" = '(\w+)'/g)]
      .map(([, from, to]) => `${from}->${to}`)
      .sort();
    const inCode = PERMITTED_TRANSITIONS.map((t) => `${t.from}->${t.to}`).sort();

    expect(inSql).toEqual(inCode);
  });

  it('the CHECK does NOT permit approved -> draft (US5 scenario 4)', () => {
    expect(migration).not.toMatch(/"fromState" = 'approved'\s+AND "toState" = 'draft'/);
  });
});
