/**
 * T951 — a refusal is itself recorded. `FR-GEL-014`.
 *
 * The requirement in one line: *a refusal is a result that gets recorded, not
 * an exception that might be swallowed by a caller's `catch`.*
 *
 * Which makes this the test for the thing that is hardest to notice missing.
 * A loop that refused correctly and recorded nothing would pass every
 * behavioural test anyone would think to write — the object did not move, the
 * caller got a refusal, the state is right. What is gone is the answer to
 * *"has anyone tried this, and what stopped them?"*, and nothing fails when
 * that answer disappears.
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
    workflowType: 'refusal-type',
    stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
    transitions: [
      { from: 'Event', to: 'Analyze', requiredGates: [], trigger: null },
      { from: 'Analyze', to: 'Decide', requiredGates: [], trigger: null },
    ],
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: stages.registeredStages },
);

const AUTHORITIES = { 'Event->Analyze': ['analyst'], 'Analyze->Decide': ['lead'] };

async function seed() {
  const store = new InMemoryLoopStore();
  const object = await store.createObject({
    workspaceId: 'ws_1', projectId: 'p_1', workflowType: 'refusal-type', configVersion: 1,
    subjectType: 'opaque', subjectId: 's_1', currentStage: 'Event',
  });
  return { store, object, writer: new TransitionWriter(store) };
}

const unauthorized = {
  toStage: 'Analyze' as const,
  expectedVersion: 0,
  actor: { kind: 'human' as const, id: 'u_1', authorities: ['intern'] },
  gates: [],
};

describe('T951 · a refusal is returned, never thrown', () => {
  it('returns a result rather than rejecting', async () => {
    const { object, writer } = await seed();
    const result = await writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...unauthorized });
    expect(result.outcome).toBe('refused');
  });

  it('does not move the object', async () => {
    const { object, store, writer } = await seed();
    await writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...unauthorized });
    const after = await store.findObject(object.id);
    expect(after?.currentStage).toBe('Event');
    expect(after?.version).toBe(0);
  });
});

describe('FR-GEL-014 · the refusal is written to the history', () => {
  it('appends a transition row for the refused attempt', async () => {
    // The whole point. Without this, "somebody tried to push this to Decide
    // without authority" is a fact that existed for one HTTP response and then
    // stopped existing.
    const { object, store, writer } = await seed();
    await writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...unauthorized });
    const rows = await store.transitionsFor(object.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe('refused');
  });

  it('records the reason, not merely the refusal', async () => {
    const { object, store, writer } = await seed();
    await writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...unauthorized });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.refusalReason).toBeTruthy();
    expect(row?.refusalReason).toMatch(/analyst/);
  });

  it('records who tried, and against which version', async () => {
    const { object, store, writer } = await seed();
    await writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...unauthorized });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.actorId).toBe('u_1');
    expect(row?.objectVersion).toBe(0);
    expect(row?.toStage).toBe('Analyze');
  });

  it('records the authority basis as the one that was MISSING, not as empty', async () => {
    // `authorityBasis` is non-null on every row. On a refusal it carries the
    // authority the transition required — the fact the record exists to hold.
    const { object, store, writer } = await seed();
    await writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...unauthorized });
    const [row] = await store.transitionsFor(object.id);
    expect(row?.authorityBasis).toBeTruthy();
    expect(row?.authorityBasis).toMatch(/analyst/);
  });

  it('returns the recorded transition id, so the caller can read the refusal', async () => {
    // The contract's §4: a 403 carries the recorded transition id, "so the
    // caller can read the refusal rather than infer it".
    const { object, store, writer } = await seed();
    const result = await writer.write({ object, config: CONFIG, authorities: AUTHORITIES, ...unauthorized });
    const [row] = await store.transitionsFor(object.id);
    expect(result.transitionId).toBe(row?.id);
  });
});

describe('an undeclared transition is refused and recorded the same way', () => {
  it('records the attempt to jump a stage', async () => {
    const { object, store, writer } = await seed();
    const result = await writer.write({
      object, config: CONFIG, authorities: AUTHORITIES,
      toStage: 'Decide', expectedVersion: 0,
      actor: { kind: 'human', id: 'u_1', authorities: ['lead'] },
      gates: [],
    });
    expect(result.outcome).toBe('refused');
    const [row] = await store.transitionsFor(object.id);
    expect(row?.refusalReason).toMatch(/not declared/i);
  });
});
