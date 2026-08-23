/**
 * T956 — two attempts, one winner, both recorded. `R-030-1`, `FR-GEL-012`,
 * `FR-GEL-015`.
 *
 * *First commit wins* is easy to implement and easy to get subtly wrong in a way
 * nothing notices:
 *
 *   - both attempts succeed, because the check and the write were two
 *     statements with a window between them;
 *   - the loser is silently dropped, so the history says one person tried when
 *     two did;
 *   - the loser records `refused` rather than `conflict`, which reads as *"you
 *     were not allowed"* when the truth is *"you were allowed and you were
 *     second"*.
 *
 * All three are asserted below.
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
    workflowType: 'race-type',
    stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
    transitions: [
      { from: 'Event', to: 'Analyze', requiredGates: [], trigger: null },
      { from: 'Event', to: 'Decide', requiredGates: [], trigger: null },
    ],
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: stages.registeredStages },
);

const AUTHORITIES = { 'Event->Analyze': ['lead'], 'Event->Decide': ['lead'] };

async function seed() {
  const store = new InMemoryLoopStore();
  const object = await store.createObject({
    workspaceId: 'ws_1', projectId: 'p_1', workflowType: 'race-type', configVersion: 1,
    subjectType: 'opaque', subjectId: 's_1', currentStage: 'Event',
  });
  return { store, object, writer: new TransitionWriter(store) };
}

/** Both hold version 0 — the situation OCC exists for. */
function attempt(to: 'Analyze' | 'Decide', actorId: string) {
  return {
    toStage: to,
    expectedVersion: 0,
    actor: { kind: 'human' as const, id: actorId, authorities: ['lead'] },
    gates: [],
  };
}

describe('T956 · two concurrent transitions, exactly one accepted', () => {
  it('accepts one and conflicts the other', async () => {
    const { object, writer } = await seed();
    const [a, b] = await Promise.all([
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Analyze', 'u_a') }),
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Decide', 'u_b') }),
    ]);
    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(['accepted', 'conflict']);
  });

  it('moves the object exactly once', async () => {
    const { store, object, writer } = await seed();
    await Promise.all([
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Analyze', 'u_a') }),
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Decide', 'u_b') }),
    ]);
    const after = await store.findObject(object.id);
    expect(after?.version).toBe(1);
    expect(['Analyze', 'Decide']).toContain(after?.currentStage);
  });

  it('records BOTH attempts, so the history says two people tried', async () => {
    const { store, object, writer } = await seed();
    await Promise.all([
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Analyze', 'u_a') }),
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Decide', 'u_b') }),
    ]);
    const rows = await store.transitionsFor(object.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.actorId).sort()).toEqual(['u_a', 'u_b']);
  });

  it('records the loser as conflict, not refused (FR-GEL-015)', async () => {
    // "You were second" and "you were not allowed" are different facts, and a
    // 409 and a 403 are different answers. Collapsing them would make the
    // history say the loser lacked authority, which is false.
    const { store, object, writer } = await seed();
    await Promise.all([
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Analyze', 'u_a') }),
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Decide', 'u_b') }),
    ]);
    const rows = await store.transitionsFor(object.id);
    const loser = rows.find((r) => r.outcome === 'conflict');
    expect(loser).toBeDefined();
    expect(rows.filter((r) => r.outcome === 'refused')).toHaveLength(0);
  });

  it('tells the loser WHICH transition won (FR-GEL-015)', async () => {
    const { store, object, writer } = await seed();
    await Promise.all([
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Analyze', 'u_a') }),
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Decide', 'u_b') }),
    ]);
    const rows = await store.transitionsFor(object.id);
    const winner = rows.find((r) => r.outcome === 'accepted');
    const loser = rows.find((r) => r.outcome === 'conflict');
    expect(loser?.wonBy).toBe(winner?.id);
  });

  it('records both against the version they were made against (FR-GEL-012)', async () => {
    // Both held 0. A record holding the post-increment value would make the
    // loser look like it came second by design rather than by losing.
    const { store, object, writer } = await seed();
    await Promise.all([
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Analyze', 'u_a') }),
      writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Decide', 'u_b') }),
    ]);
    const rows = await store.transitionsFor(object.id);
    expect(rows.map((r) => r.objectVersion)).toEqual([0, 0]);
  });

  it('holds over many rounds, not one lucky interleaving', async () => {
    // A single round can pass by accident of scheduling. Twenty cannot.
    for (let round = 0; round < 20; round += 1) {
      const { store, object, writer } = await seed();
      const results = await Promise.all([
        writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Analyze', 'u_a') }),
        writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...attempt('Decide', 'u_b') }),
      ]);
      expect(results.filter((r) => r.outcome === 'accepted')).toHaveLength(1);
      expect((await store.findObject(object.id))?.version).toBe(1);
    }
  });
});
