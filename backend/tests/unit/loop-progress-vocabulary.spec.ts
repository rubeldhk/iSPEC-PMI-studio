/**
 * T974 — one vocabulary, every workflow type. `FR-GEL-051`, `SC-GEL-007`.
 *
 * *"A Room can render loop progress without knowing how the loop works."*
 *
 * That is only true if the projection's **shape does not vary by type**. A Room
 * that received five rows for one type and eight for another would have to know
 * which type it was looking at — and knowing that is the coupling this Epic
 * exists to remove.
 *
 * So the assertion is deliberately about *sameness across types*, which no
 * single-type test can make. Three types with nothing in common are projected
 * and their outputs compared position by position.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, STAGE_STATUSES, type LoopProgress } from '@pmi/loop-contract';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { projectFor } from '../../src/modules/loop/progress.projection.js';

const HANDLED = [...LOOP_STAGES];

function config(workflowType: string, stages: string[]) {
  return loadLoopConfig(
    { schemaVersion: 1, workflowType, stages, transitions: [], approvedBy: 'u', approvalRef: 'c' },
    { registeredStages: HANDLED },
  );
}

/** Three types sharing only `Event` — the hardest case for a uniform shape. */
const SHORTEST = config('shortest', ['Event', 'Outcome']);
const MIDDLE = config('middle', ['Event', 'Analyze', 'Decide', 'Outcome']);
const LONGEST = config('longest', [...LOOP_STAGES]);

const project = (c: ReturnType<typeof config>): readonly LoopProgress[] =>
  projectFor({ object: { currentStage: 'Event' }, config: c, history: [] });

describe('FR-GEL-051 · the shape does not vary by workflow type', () => {
  it('returns the same number of rows for every type', () => {
    expect(project(SHORTEST)).toHaveLength(8);
    expect(project(MIDDLE)).toHaveLength(8);
    expect(project(LONGEST)).toHaveLength(8);
  });

  it('returns the same stages, in the same order, for every type', () => {
    const stagesOf = (rows: readonly LoopProgress[]) => rows.map((r) => r.stage);
    expect(stagesOf(project(SHORTEST))).toEqual(stagesOf(project(MIDDLE)));
    expect(stagesOf(project(MIDDLE))).toEqual(stagesOf(project(LONGEST)));
    expect(stagesOf(project(SHORTEST))).toEqual([...LOOP_STAGES]);
  });

  it('uses the same three status words for every type', () => {
    for (const c of [SHORTEST, MIDDLE, LONGEST]) {
      for (const row of project(c)) {
        expect(STAGE_STATUSES as readonly string[]).toContain(row.status);
      }
    }
  });

  it('returns the same KEYS on every row, so a renderer needs no per-type branch', () => {
    const keys = (rows: readonly LoopProgress[]) =>
      [...new Set(rows.flatMap((r) => Object.keys(r)))].sort();
    expect(keys(project(SHORTEST))).toEqual(['omitted', 'stage', 'status']);
    expect(keys(project(SHORTEST))).toEqual(keys(project(LONGEST)));
  });
});

describe('SC-GEL-007 · what DOES vary is the omitted flag, and only that', () => {
  it('reports different omissions for different types', () => {
    const omittedOf = (rows: readonly LoopProgress[]) =>
      rows.filter((r) => r.omitted).map((r) => r.stage);
    expect(omittedOf(project(SHORTEST))).toHaveLength(6);
    expect(omittedOf(project(MIDDLE))).toHaveLength(4);
    expect(omittedOf(project(LONGEST))).toHaveLength(0);
  });

  it('lets a Room ask "is this stage part of this loop?" without knowing the type', () => {
    // The practical form of FR-GEL-051. A renderer asks the row, not the type.
    const rows = project(MIDDLE);
    const execute = rows.find((r) => r.stage === 'Execute');
    expect(execute).toBeDefined();
    expect(execute?.omitted).toBe(true);
  });

  it('would notice a projection that dropped omitted stages entirely', () => {
    // The regression this suite exists for: returning only the configured
    // stages. Every per-type test would still pass — the rows would be correct,
    // there would just be fewer of them — and a Room would silently render a
    // different loop for each type.
    const rows = project(SHORTEST);
    expect(rows.length).toBeGreaterThan(SHORTEST.stages.length);
  });
});
