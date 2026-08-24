/**
 * T972 — every stage exactly one of done/current/pending, omitted stages
 * visible. `FR-GEL-050`, `FR-GEL-008`.
 *
 * The projection is what a Room renders, so its failures are the ones a user
 * sees. Three of them are asserted here and all three are quiet:
 *
 *   - a stage an object *passed through* shown as pending, because completion
 *     was read from `toStage` instead of `fromStage`;
 *   - a stage marked done by a **refused** attempt, because the filter forgot
 *     the outcome;
 *   - the current stage marked done, because it appears as some transition's
 *     `toStage`.
 *
 * Each renders a plausible loop. None throws.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES } from '@pmi/loop-contract';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { completedStagesOf, projectFor } from '../../src/modules/loop/progress.projection.js';
import type { LoopTransitionRow } from '../../src/modules/loop/loop.store.js';

const CONFIG = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'progress-type',
    stages: ['Event', 'Context', 'Analyze', 'Decide', 'Outcome'],
    transitions: [],
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: [...LOOP_STAGES] },
);

function row(over: Partial<LoopTransitionRow>): LoopTransitionRow {
  return {
    id: 'x', workspaceId: 'ws', objectId: 'o', objectVersion: 0,
    fromStage: 'Event', toStage: 'Context', outcome: 'accepted',
    refusalReason: null, wonBy: null, actorId: 'u', actorKind: 'human',
    authorityBasis: 'a', triggerRuleId: null, triggerEventId: null,
    configVersion: 1, gateOutcomes: [], occurredAt: new Date(),
    ...over,
  };
}

describe('T972 · every stage gets exactly one status', () => {
  const rows = [
    row({ fromStage: 'Event', toStage: 'Context' }),
    row({ fromStage: 'Context', toStage: 'Analyze' }),
  ];
  const progress = projectFor({ object: { currentStage: 'Analyze' }, config: CONFIG, history: rows });

  it('returns all eight stages, in model order', () => {
    expect(progress.map((p) => p.stage)).toEqual([...LOOP_STAGES]);
  });

  it('gives each stage exactly one of done, current or pending', () => {
    for (const entry of progress) {
      expect(['done', 'current', 'pending']).toContain(entry.status);
    }
    expect(progress.filter((p) => p.status === 'current')).toHaveLength(1);
  });

  it('marks the stages the object LEFT as done', () => {
    const byStage = new Map(progress.map((p) => [p.stage, p]));
    expect(byStage.get('Event')?.status).toBe('done');
    expect(byStage.get('Context')?.status).toBe('done');
  });

  it('does NOT mark the current stage done, even though it is a toStage', () => {
    // The quiet failure: `Analyze` is the `toStage` of the second transition, so
    // reading completion from `toStage` would paint the stage the object is
    // sitting in as finished.
    const byStage = new Map(progress.map((p) => [p.stage, p]));
    expect(byStage.get('Analyze')?.status).toBe('current');
  });

  it('leaves a configured stage not yet reached as pending', () => {
    const byStage = new Map(progress.map((p) => [p.stage, p]));
    expect(byStage.get('Decide')?.status).toBe('pending');
    expect(byStage.get('Decide')?.omitted).toBe(false);
  });
});

describe('FR-GEL-008 · omitted stages are visible, not absent', () => {
  const progress = projectFor({
    object: { currentStage: 'Context' },
    config: CONFIG,
    history: [row({ fromStage: 'Event', toStage: 'Context' })],
  });

  it('reports the stages this type does not configure', () => {
    const omitted = progress.filter((p) => p.omitted).map((p) => p.stage);
    expect(omitted).toEqual(['Execute', 'Verify', 'Evidence']);
  });

  it('distinguishes omitted from not-yet-reached, which both read pending', () => {
    const byStage = new Map(progress.map((p) => [p.stage, p]));
    expect(byStage.get('Decide')?.omitted).toBe(false);
    expect(byStage.get('Execute')?.omitted).toBe(true);
    expect(byStage.get('Decide')?.status).toBe(byStage.get('Execute')?.status);
  });
});

describe('completedStagesOf · only accepted transitions complete a stage', () => {
  it('ignores a refused attempt', () => {
    // The quiet failure: a rejected transition painting a stage green.
    const completed = completedStagesOf([
      row({ fromStage: 'Event', toStage: 'Context', outcome: 'refused', refusalReason: 'no' }),
    ]);
    expect(completed).toEqual([]);
  });

  it('ignores a lost race', () => {
    const completed = completedStagesOf([
      row({ fromStage: 'Event', toStage: 'Context', outcome: 'conflict', refusalReason: 'lost' }),
    ]);
    expect(completed).toEqual([]);
  });

  it('reads fromStage, not toStage', () => {
    const completed = completedStagesOf([row({ fromStage: 'Event', toStage: 'Context' })]);
    expect(completed).toEqual(['Event']);
    expect(completed).not.toContain('Context');
  });

  it('ignores the null fromStage of an initial Event', () => {
    expect(completedStagesOf([row({ fromStage: null, toStage: 'Event' })])).toEqual([]);
  });

  it('does not double-count a stage left twice', () => {
    // Possible after a rebase or a loop back. A duplicate would not change the
    // projection, but it would make the array a bad answer to "which stages has
    // this been through".
    const completed = completedStagesOf([
      row({ fromStage: 'Event', toStage: 'Context' }),
      row({ fromStage: 'Context', toStage: 'Event' }),
      row({ fromStage: 'Event', toStage: 'Analyze' }),
    ]);
    expect(completed).toEqual(['Event', 'Context']);
  });
});
