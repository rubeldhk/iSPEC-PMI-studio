/**
 * T960 — the history reconstructs the loop. `FR-GEL-013`.
 *
 * *"Returns every transition for an object, in order, sufficient to reconstruct
 * its whole loop **without reading current state**."*
 *
 * The phrase "without reading current state" is the test. So this rebuilds the
 * object from the transitions alone — `currentStage` and `version` withheld —
 * and asserts the rebuild agrees with the stored row.
 *
 * Why that is worth doing rather than asserting the rows look right: *sufficient
 * to reconstruct* is a property of the whole sequence, not of any field. A
 * history missing its refusals still has plausible rows; one recording the
 * post-increment version still orders correctly most of the time. Both fail
 * here, and neither fails a field-by-field check.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, type LoopStage, type StageHandler } from '@pmi/loop-contract';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { LoopConfigRegistry } from '../../src/modules/loop/config-registry.js';
import { InMemoryLoopStore, type LoopTransitionRow } from '../../src/modules/loop/loop.store.js';
import { LoopService } from '../../src/modules/loop/loop.service.js';

const stages = new StageRegistry(
  LOOP_STAGES.map((stage): StageHandler => ({ stage, async enter() { return { ok: true }; } })),
);

const CONFIG = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'rebuild-type',
    stages: ['Event', 'Context', 'Analyze', 'Decide', 'Outcome'],
    transitions: [
      { from: 'Event', to: 'Context', requiredGates: [], trigger: null },
      { from: 'Context', to: 'Analyze', requiredGates: [], trigger: null },
      { from: 'Analyze', to: 'Decide', requiredGates: [], trigger: null },
      { from: 'Decide', to: 'Outcome', requiredGates: [], trigger: null },
    ],
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: stages.registeredStages },
);

const AUTHORITIES = {
  'Event->Context': ['analyst'],
  'Context->Analyze': ['analyst'],
  'Analyze->Decide': ['lead'],
  'Decide->Outcome': ['lead'],
};

/**
 * Replay: the object's position from the transitions alone.
 *
 * Deliberately naive — an accepted transition moves it, anything else does not.
 * If reconstruction needed to know more than the rows carry, that would be the
 * finding.
 */
function replay(rows: readonly LoopTransitionRow[]): { stage: LoopStage; version: number } {
  let stage: LoopStage = 'Event';
  let version = 0;
  for (const row of rows) {
    if (row.outcome !== 'accepted') continue;
    stage = row.toStage;
    version += 1;
  }
  return { stage, version };
}

async function build() {
  const store = new InMemoryLoopStore();
  const service = new LoopService(store, new LoopConfigRegistry([CONFIG]), AUTHORITIES);
  const ref = await service.declareObject({
    workspaceId: 'ws_1', projectId: 'p_1', workflowType: 'rebuild-type',
    subjectType: 'opaque', subjectId: 's_1', actorId: 'u_1',
  });

  const analyst = { kind: 'human' as const, id: 'u_analyst' };
  const lead = { kind: 'human' as const, id: 'u_lead' };

  // A realistic loop: two advances, a refusal, an advance, a stale attempt.
  await service.transition({
    objectId: ref.objectId, toStage: 'Context', expectedVersion: 0,
    actor: analyst, actorAuthorities: ['analyst'],
  });
  await service.transition({
    objectId: ref.objectId, toStage: 'Analyze', expectedVersion: 1,
    actor: analyst, actorAuthorities: ['analyst'],
  });
  // Refused: the analyst may not decide.
  await service.transition({
    objectId: ref.objectId, toStage: 'Decide', expectedVersion: 2,
    actor: analyst, actorAuthorities: ['analyst'],
  });
  await service.transition({
    objectId: ref.objectId, toStage: 'Decide', expectedVersion: 2,
    actor: lead, actorAuthorities: ['lead'],
  });
  // Conflict: stale version.
  await service.transition({
    objectId: ref.objectId, toStage: 'Outcome', expectedVersion: 2,
    actor: lead, actorAuthorities: ['lead'],
  });

  return { store, service, objectId: ref.objectId };
}

describe('T960 · the loop rebuilds from its history alone', () => {
  it('records every attempt, including the ones that did not move it', async () => {
    const { service, objectId } = await build();
    const rows = await service.history(objectId);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.outcome)).toEqual([
      'accepted', 'accepted', 'refused', 'accepted', 'conflict',
    ]);
  });

  it('returns them in order', async () => {
    const { service, objectId } = await build();
    const rows = await service.history(objectId);
    const times = rows.map((r) => r.occurredAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('reconstructs the current stage WITHOUT reading it', async () => {
    const { store, service, objectId } = await build();
    const rebuilt = replay(await service.history(objectId));
    const stored = await store.findObject(objectId);
    expect(rebuilt.stage).toBe(stored?.currentStage);
    expect(rebuilt.stage).toBe('Decide');
  });

  it('reconstructs the version, which is what makes the next OCC token derivable', async () => {
    const { store, service, objectId } = await build();
    const rebuilt = replay(await service.history(objectId));
    expect(rebuilt.version).toBe((await store.findObject(objectId))?.version);
  });

  it('answers "who tried and was stopped" from the history alone', async () => {
    // The question a current-state read can never answer, and the reason
    // FR-GEL-014 makes refusals rows rather than responses.
    const { service, objectId } = await build();
    const rows = await service.history(objectId);
    const stopped = rows.filter((r) => r.outcome !== 'accepted');
    expect(stopped.map((r) => r.actorId)).toEqual(['u_analyst', 'u_lead']);
    expect(stopped.map((r) => r.refusalReason).every(Boolean)).toBe(true);
  });

  it('would notice a history that dropped its refusals', async () => {
    // The check checks itself: replaying only the accepted rows must still give
    // the right answer, but the ROW COUNT is what proves the refusals survived.
    // A history quietly discarding them would pass every reconstruction
    // assertion above.
    const { service, objectId } = await build();
    const rows = await service.history(objectId);
    expect(rows.filter((r) => r.outcome === 'accepted')).toHaveLength(3);
    expect(rows.length).toBeGreaterThan(3);
  });
});
