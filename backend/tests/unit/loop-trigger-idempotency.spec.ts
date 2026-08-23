/**
 * T965 — a repeated firing records a duplicate rather than advancing twice.
 * `FR-GEL-033`.
 *
 * *One rule, one event, one advance.*
 *
 * At-least-once delivery is the normal case, not the broken one: a retry after a
 * timeout, a redelivered queue message, two workers on the same event. Each is a
 * correct caller doing a correct thing, so an object advancing twice would be
 * the loop's fault.
 *
 * **And the duplicate is recorded.** Silence would make a rule firing in a tight
 * loop indistinguishable from one firing correctly — which is precisely the
 * symptom a misconfigured trigger presents.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, type StageHandler } from '@pmi/loop-contract';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { InMemoryLoopStore } from '../../src/modules/loop/loop.store.js';
import { TransitionWriter } from '../../src/modules/loop/transition-writer.js';
import { TriggerDispatcher } from '../../src/modules/loop/trigger-dispatcher.js';

const stages = new StageRegistry(
  LOOP_STAGES.map((stage): StageHandler => ({ stage, async enter() { return { ok: true }; } })),
);

const CONFIG = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'idem-type',
    stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
    transitions: [
      { from: 'Event', to: 'Analyze', requiredGates: [], trigger: { ruleId: 'r_intake' } },
      { from: 'Analyze', to: 'Decide', requiredGates: [], trigger: null },
    ],
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: stages.registeredStages },
);

const AUTHORITIES = { 'Event->Analyze': ['mover'], 'Analyze->Decide': ['mover'] };

async function seed() {
  const store = new InMemoryLoopStore();
  const object = await store.createObject({
    workspaceId: 'ws', projectId: 'p', workflowType: 'idem-type', configVersion: 1,
    subjectType: 'o', subjectId: 's', currentStage: 'Event',
  });
  const dispatcher = new TriggerDispatcher(store, new TransitionWriter(store));
  return { store, object, dispatcher };
}

const firing = (objectId: string, eventId = 'e_1') => ({
  objectId,
  toStage: 'Analyze' as const,
  expectedVersion: 0,
  ruleId: 'r_intake',
  eventId,
  actorId: 'svc_rules',
  actorAuthorities: ['mover'],
});

describe('T965 · the first firing advances', () => {
  it('moves the object', async () => {
    const { store, object, dispatcher } = await seed();
    const result = await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    expect(result.kind).toBe('advanced');
    expect((await store.findObject(object.id))?.currentStage).toBe('Analyze');
  });

  it('records the rule and the event that caused it', async () => {
    const { store, object, dispatcher } = await seed();
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    const [row] = await store.transitionsFor(object.id);
    expect(row?.triggerRuleId).toBe('r_intake');
    expect(row?.triggerEventId).toBe('e_1');
    expect(row?.actorKind).toBe('automation');
  });
});

describe('FR-GEL-033 · a repeat does not advance again', () => {
  it('leaves the object where the first firing left it', async () => {
    const { store, object, dispatcher } = await seed();
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    const after = await store.findObject(object.id);
    expect(after?.currentStage).toBe('Analyze');
    expect(after?.version).toBe(1);
  });

  it('reports the repeat as a duplicate, not as an advance', async () => {
    const { object, dispatcher } = await seed();
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    const second = await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    expect(second.kind).toBe('duplicate');
  });

  it('names the transition that already handled the event', async () => {
    const { object, dispatcher } = await seed();
    const first = await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    const second = await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    expect(second.kind).toBe('duplicate');
    if (second.kind !== 'duplicate') throw new Error('unreachable');
    expect(second.originalId).toBe(first.result.transitionId);
  });

  it('RECORDS the duplicate rather than swallowing it', async () => {
    // The assertion that matters most. A rule firing every second because it is
    // misconfigured looks exactly like a rule firing correctly, unless the
    // repeats leave a trace.
    const { store, object, dispatcher } = await seed();
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    const rows = await store.transitionsFor(object.id);
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.outcome === 'accepted')).toHaveLength(1);
  });

  it('says WHY in the duplicate record', async () => {
    const { store, object, dispatcher } = await seed();
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    const repeat = (await store.transitionsFor(object.id))[1];
    expect(repeat?.refusalReason).toMatch(/already advanced/i);
    expect(repeat?.refusalReason).toMatch(/FR-GEL-033/);
  });

  it('does not report the duplicate as a lost race', async () => {
    // A duplicate and a conflict are different facts. Reporting the repeat as
    // `conflict` would say another actor got there first, when the truth is the
    // same rule fired twice.
    const { store, object, dispatcher } = await seed();
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    expect((await store.transitionsFor(object.id)).some((r) => r.outcome === 'conflict')).toBe(false);
  });
});

describe('the key is the rule AND the event, not one or the other', () => {
  it('lets the same rule advance for a DIFFERENT event', async () => {
    // Otherwise a nightly rule would fire once and never again.
    const { store, object, dispatcher } = await seed();
    await dispatcher.fire(firing(object.id, 'e_1'), CONFIG, AUTHORITIES);
    const second = await dispatcher.fire(
      { ...firing(object.id, 'e_2'), toStage: 'Decide', expectedVersion: 1 },
      CONFIG,
      AUTHORITIES,
    );
    expect(second.kind).toBe('advanced');
    expect((await store.findObject(object.id))?.currentStage).toBe('Decide');
  });

  it('does not treat a prior REFUSAL as already handled', async () => {
    // A firing refused for a reason that has since changed must be retryable.
    // Treating a refusal as "handled" would strand the object silently — which
    // is why the index in the migration is partial on accepted rows.
    const { store, object, dispatcher } = await seed();
    const refused = await dispatcher.fire(
      { ...firing(object.id), actorAuthorities: ['wrong'] },
      CONFIG,
      AUTHORITIES,
    );
    expect(refused.kind).toBe('refused');

    const retried = await dispatcher.fire(firing(object.id), CONFIG, AUTHORITIES);
    expect(retried.kind).toBe('advanced');
    expect((await store.findObject(object.id))?.currentStage).toBe('Analyze');
  });
});
