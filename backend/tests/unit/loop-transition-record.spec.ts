/**
 * T949 — what every transition record must carry. `FR-GEL-011`, `FR-GEL-012`,
 * `FR-GEL-032`, `FR-GEL-013`.
 *
 * `FR-GEL-013` says the history must be *"sufficient to reconstruct the whole
 * loop without reading current state"*. That is a property of the **fields**,
 * not of the query — and it is why this test enumerates them rather than
 * checking a couple of interesting ones. A record missing `objectVersion`
 * cannot be ordered against a concurrent attempt; one missing `authorityBasis`
 * cannot answer *why was this permitted*; one missing `configVersion` cannot be
 * read against the rules in force when it happened.
 *
 * `T960` proves the reconstruction end to end. This proves the raw material
 * exists.
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
    workflowType: 'record-type',
    stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
    transitions: [
      { from: 'Event', to: 'Analyze', requiredGates: [], trigger: null },
      { from: 'Analyze', to: 'Decide', requiredGates: ['g1'], trigger: null },
    ],
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: stages.registeredStages },
);

const AUTHORITIES = { 'Event->Analyze': ['analyst'], 'Analyze->Decide': ['lead'] };

async function seed() {
  const store = new InMemoryLoopStore();
  const object = await store.createObject({
    workspaceId: 'ws_1',
    projectId: 'p_1',
    workflowType: 'record-type',
    configVersion: 1,
    subjectType: 'opaque',
    subjectId: 's_1',
    currentStage: 'Event',
  });
  return { store, object, writer: new TransitionWriter(store) };
}

describe('T949 · an accepted transition records everything the history needs', () => {
  it('advances the object and records the move', async () => {
    const { store, object, writer } = await seed();
    const result = await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['analyst'] },
      gates: [],
    });
    expect(result.outcome).toBe('accepted');
    expect((await store.findObject(object.id))?.currentStage).toBe('Analyze');
  });

  it.each([
    'objectId', 'objectVersion', 'fromStage', 'toStage', 'outcome',
    'actorId', 'actorKind', 'authorityBasis', 'configVersion', 'gateOutcomes', 'occurredAt',
  ])('carries %s', async (field) => {
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['analyst'] },
      gates: [],
    });
    const [row] = await store.transitionsFor(object.id);
    expect(row).toBeDefined();
    expect((row as unknown as Record<string, unknown>)[field]).not.toBeUndefined();
  });

  it('records the version the attempt was made AGAINST, not the one it produced', async () => {
    // FR-GEL-012. The distinction matters when two attempts race: both were made
    // against version 0, and a record holding the post-increment value would
    // make the loser look like it came second by design rather than by losing.
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['analyst'] },
      gates: [],
    });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.objectVersion).toBe(0);
    expect((await store.findObject(object.id))?.version).toBe(1);
  });

  it('records WHICH authority permitted it (FR-GEL-011)', async () => {
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['lead', 'analyst'] },
      gates: [],
    });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.authorityBasis).toBe('analyst');
  });

  it('leaves fromStage null only for the initial Event', async () => {
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['analyst'] },
      gates: [],
    });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.fromStage).toBe('Event');
  });
});

describe('FR-GEL-032 · human and automation are distinguishable without inference', () => {
  it('records actorKind for a human', async () => {
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['analyst'] },
      gates: [],
    });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.actorKind).toBe('human');
    expect(row?.triggerRuleId).toBeNull();
  });

  it('records actorKind and the rule for automation (FR-GEL-031)', async () => {
    const { object, store, writer } = await seed();
    await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'automation', id: 'svc_1', authorities: ['analyst'] },
      trigger: { ruleId: 'r_nightly', eventId: 'e_1' },
      gates: [],
    });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.actorKind).toBe('automation');
    expect(row?.triggerRuleId).toBe('r_nightly');
    expect(row?.triggerEventId).toBe('e_1');
  });

  it('REFUSES automation that names no rule, before writing anything (RULE-11)', async () => {
    // The database rejects this too (T929). Both, because the database catches
    // what goes around the service and the service explains what the database
    // would only reject.
    const { object, store, writer } = await seed();
    const result = await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Analyze', expectedVersion: 0,
      actor: { kind: 'automation', id: 'svc_1', authorities: ['analyst'] },
      gates: [],
    });
    expect(result.outcome).toBe('refused');
    expect(result.detail).toMatch(/rule/i);
    expect((await store.findObject(object.id))?.currentStage).toBe('Event');
  });
});
