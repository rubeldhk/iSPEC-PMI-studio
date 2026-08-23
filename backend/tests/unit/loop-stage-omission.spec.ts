/**
 * T939 — an omitted stage is visible, not absent. `FR-GEL-008`, `FR-GEL-050`,
 * `FR-GEL-051`.
 *
 * The distinction the whole projection turns on: *configured not to apply* and
 * *not reached* are different facts about a workflow, and a missing row
 * conflates them. A Room rendering a loop with no `Execute` stage must be able
 * to say **"this workflow has no Execute"**, which is not the same sentence as
 * **"Execute has not happened yet"** — and a consumer that received seven rows
 * instead of eight would have to guess which.
 *
 * The same rule `EPIC-034` applies to an impact area it cannot determine, and
 * `EPIC-035` to an origin distribution it cannot complete. Three Epics, one
 * idea: an absence you chose and an absence you could not fill must not look
 * alike.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES } from '@pmi/loop-contract';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { LoopService } from '../../src/modules/loop/loop.service.js';

const HANDLED = [...LOOP_STAGES];

const SHORT = {
  schemaVersion: 1,
  workflowType: 'short-loop',
  stages: ['Event', 'Analyze', 'Decide', 'Outcome'],
  transitions: [{ from: 'Event', to: 'Analyze', requiredGates: [], trigger: null }],
  approvedBy: 'u', approvalRef: 'c',
};

const config = loadLoopConfig(SHORT, { registeredStages: HANDLED });
const service = new LoopService();

describe('T939 · the projection returns all eight stages, always', () => {
  const rows = service.progressForConfig(config, { currentStage: 'Analyze', completedStages: ['Event'] });

  it('returns eight rows for a four-stage workflow type', () => {
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.stage)).toEqual([...LOOP_STAGES]);
  });

  it('marks the four the type does not configure as omitted', () => {
    const omitted = rows.filter((r) => r.omitted).map((r) => r.stage);
    expect(omitted).toEqual(['Context', 'Execute', 'Verify', 'Evidence']);
  });

  it('never reports an omitted stage as done or current', () => {
    // An omitted stage was not skipped past — it was never part of this loop.
    for (const row of rows.filter((r) => r.omitted)) expect(row.status).toBe('pending');
  });

  it('distinguishes omitted from not-yet-reached', () => {
    const byStage = new Map(rows.map((r) => [r.stage, r]));
    const notReached = byStage.get('Decide');
    const notInLoop = byStage.get('Execute');
    // Both are `pending`. Only one of them will ever stop being pending, and
    // the flag is the only thing that says which.
    expect(notReached?.status).toBe('pending');
    expect(notInLoop?.status).toBe('pending');
    expect(notReached?.omitted).toBe(false);
    expect(notInLoop?.omitted).toBe(true);
  });

  it('reports position within the configured stages', () => {
    const byStage = new Map(rows.map((r) => [r.stage, r]));
    expect(byStage.get('Event')?.status).toBe('done');
    expect(byStage.get('Analyze')?.status).toBe('current');
  });
});

describe('FR-GEL-051 · every workflow type speaks the same vocabulary', () => {
  it('returns the same eight stages in the same order for a different type', () => {
    const long = loadLoopConfig(
      { ...SHORT, workflowType: 'long-loop', stages: [...LOOP_STAGES], transitions: [] },
      { registeredStages: HANDLED },
    );
    const a = service.progressForConfig(config, { currentStage: 'Event', completedStages: [] });
    const b = service.progressForConfig(long, { currentStage: 'Event', completedStages: [] });
    expect(a.map((r) => r.stage)).toEqual(b.map((r) => r.stage));
    // …and a type that configures all eight omits none, or `omitted` would be
    // decoration rather than a fact about the type.
    expect(b.every((r) => !r.omitted)).toBe(true);
  });
});
