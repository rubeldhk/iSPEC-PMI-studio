/**
 * T923 — result and projection types, written to fail first.
 *
 * Two guarantees, both structural:
 *
 *   - `TransitionResult.outcome` has five members and **no throw path**
 *     (`FR-GEL-014`). A governed refusal is a value that gets recorded, not an
 *     exception a caller's `catch` might swallow — and if it were an exception,
 *     the record of *why* would be the first thing lost.
 *   - `LoopProgress` carries an `omitted` flag (`FR-GEL-008`), because
 *     *configured not to apply* and *not reached* are different facts and a
 *     missing row conflates them.
 */
import { describe, expect, it } from 'vitest';
import {
  TRANSITION_OUTCOMES,
  STAGE_STATUSES,
  isTransitionOutcome,
  projectProgress,
  type LoopProgress,
} from '../src/types.js';

describe('FR-GEL-014 · a refusal is a result, not a thrown error', () => {
  it('names five outcomes', () => {
    expect(TRANSITION_OUTCOMES).toEqual([
      'accepted',
      'refused',
      'conflict',
      'exception',
      'violation',
    ]);
    expect(TRANSITION_OUTCOMES).toHaveLength(5);
    expect(Object.isFrozen(TRANSITION_OUTCOMES)).toBe(true);
  });

  it('distinguishes a lost race from a refusal — they are different answers', () => {
    // `conflict` is the OCC loser (R-030-1) and `refused` is missing authority.
    // Collapsing them would make a 409 and a 403 the same event in the history.
    expect(isTransitionOutcome('conflict')).toBe(true);
    expect(isTransitionOutcome('refused')).toBe(true);
    expect(isTransitionOutcome('error')).toBe(false);
    expect(isTransitionOutcome('ok')).toBe(false);
  });
});

describe('FR-GEL-050 · the progress projection speaks one vocabulary', () => {
  it('offers exactly three statuses', () => {
    expect(STAGE_STATUSES).toEqual(['done', 'current', 'pending']);
  });

  it('marks a configured stage done, current or pending by its position', () => {
    const progress = projectProgress({
      configuredStages: ['Event', 'Context', 'Analyze', 'Decide', 'Outcome'],
      currentStage: 'Analyze',
      completedStages: ['Event', 'Context'],
    });
    const byStage = new Map(progress.map((row) => [row.stage, row]));
    expect(byStage.get('Event')?.status).toBe('done');
    expect(byStage.get('Context')?.status).toBe('done');
    expect(byStage.get('Analyze')?.status).toBe('current');
    expect(byStage.get('Decide')?.status).toBe('pending');
  });

  it('FR-GEL-008 · returns omitted stages as rows, not as absences', () => {
    const progress = projectProgress({
      configuredStages: ['Event', 'Context', 'Analyze', 'Decide', 'Outcome'],
      currentStage: 'Analyze',
      completedStages: ['Event', 'Context'],
    });
    // All eight are present even though the type configures five. An absent row
    // and an omitted row must not look alike — the same rule EPIC-034 applies to
    // an impact area it cannot determine.
    expect(progress).toHaveLength(8);
    const omitted = progress.filter((row) => row.omitted).map((row) => row.stage);
    expect(omitted).toEqual(['Execute', 'Verify', 'Evidence']);
  });

  it('FR-GEL-051 · returns the stages in model order for every workflow type', () => {
    const a = projectProgress({
      configuredStages: ['Event', 'Outcome'],
      currentStage: 'Event',
      completedStages: [],
    });
    const b = projectProgress({
      configuredStages: ['Event', 'Execute', 'Verify', 'Outcome'],
      currentStage: 'Execute',
      completedStages: ['Event'],
    });
    const order = (rows: readonly LoopProgress[]) => rows.map((row) => row.stage);
    expect(order(a)).toEqual(order(b));
    expect(order(a)[0]).toBe('Event');
    expect(order(a)[7]).toBe('Outcome');
  });

  it('never reports an omitted stage as done or current', () => {
    const progress = projectProgress({
      configuredStages: ['Event', 'Outcome'],
      currentStage: 'Event',
      completedStages: ['Event'],
    });
    for (const row of progress) {
      if (row.omitted) expect(row.status).toBe('pending');
    }
  });
});
