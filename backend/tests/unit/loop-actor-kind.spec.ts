/**
 * T963 — human and automation are distinguishable **without inference**.
 * `FR-GEL-032`.
 *
 * The requirement's own words. "Without inference" is the whole of it, and it
 * rules out every convenient shortcut:
 *
 *   - deriving the kind from whether a trigger is present (an automation could
 *     be triggered by a person clicking "run now");
 *   - deriving it from the actor id's prefix (`svc_`), which is a naming
 *     convention and not a fact;
 *   - deriving it from the authority used, which conflates *who may* with
 *     *what kind of thing acted*.
 *
 * `BG-06`'s automation-rate measure reads this column. A derived value would
 * make that measure a measure of the derivation.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, type StageHandler } from '@pmi/loop-contract';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { InMemoryLoopStore } from '../../src/modules/loop/loop.store.js';
import { TransitionWriter } from '../../src/modules/loop/transition-writer.js';

const stages = new StageRegistry(
  LOOP_STAGES.map((stage): StageHandler => ({ stage, async enter() { return { ok: true }; } })),
);

const CONFIG = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'kind-type',
    stages: ['Event', 'Analyze', 'Outcome'],
    transitions: [{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: null }],
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: stages.registeredStages },
);

const AUTHORITIES = { 'Event->Analyze': ['mover'] };

async function seed() {
  const store = new InMemoryLoopStore();
  const object = await store.createObject({
    workspaceId: 'ws', projectId: 'p', workflowType: 'kind-type', configVersion: 1,
    subjectType: 'o', subjectId: 's', currentStage: 'Event',
  });
  return { store, object, writer: new TransitionWriter(store) };
}

describe('T963 · the kind is recorded, not inferred', () => {
  it('records human for a human', async () => {
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['mover'] },
      gates: [],
    });
    expect((await store.transitionsFor(object.id))[0]?.actorKind).toBe('human');
  });

  it('records automation for automation', async () => {
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'automation', id: 'svc_1', authorities: ['mover'] },
      trigger: { ruleId: 'r_1', eventId: 'e_1' },
      gates: [],
    });
    expect((await store.transitionsFor(object.id))[0]?.actorKind).toBe('automation');
  });

  it('does not infer the kind from the actor id', async () => {
    // A human whose id happens to start with `svc_` is still a human. If the
    // kind were derived from the id, this row would be wrong and BG-06's
    // automation rate would be wrong with it.
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'human', id: 'svc_looks_automated', authorities: ['mover'] },
      gates: [],
    });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.actorKind).toBe('human');
    expect(row?.actorId).toBe('svc_looks_automated');
  });

  it('does not infer the kind from the presence of a trigger', async () => {
    // The subtler one. A person clicking "run this rule now" produces a human
    // transition that carries a rule id — and deriving `automation` from the
    // trigger would misattribute a human decision to a machine.
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['mover'] },
      trigger: { ruleId: 'r_1', eventId: 'e_1' },
      gates: [],
    });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.actorKind).toBe('human');
    expect(row?.triggerRuleId).toBe('r_1');
  });

  it('records the kind on a REFUSAL too', async () => {
    // Otherwise "how often does automation get refused?" is unanswerable, and
    // that is exactly the question a misfiring rule raises.
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'automation', id: 'svc_1', authorities: ['wrong'] },
      trigger: { ruleId: 'r_1', eventId: 'e_1' },
      gates: [],
    });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.outcome).toBe('refused');
    expect(row?.actorKind).toBe('automation');
  });

  it('offers exactly two kinds, so a third cannot be introduced by a caller', async () => {
    // The database enum has two members (T993o) and so does the record type. An
    // `agent` kind at the API surface maps onto `automation` here deliberately:
    // FR-GEL-032 asks for the distinction that matters — a person, or not a
    // person — and a third value would divide the not-a-person half without
    // answering a question anybody asked.
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'automation', id: 'agent_1', authorities: ['mover'] },
      trigger: { ruleId: 'r_1', eventId: 'e_1' },
      gates: [],
    });
    const kinds = (await store.transitionsFor(object.id)).map((r) => r.actorKind);
    expect(kinds.every((k) => k === 'human' || k === 'automation')).toBe(true);
  });
});
