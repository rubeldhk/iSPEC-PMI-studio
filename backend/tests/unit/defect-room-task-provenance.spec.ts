/**
 * `T999i` (EPIC-035) — the provenance sentinel.
 *
 * `R-035-3`, and `BR-0151` is capability area `U-12`, unowned.
 *
 * ## The two-line problem
 *
 * `TaskRecord` is `{ id, workspaceId, specificationId, description, status,
 * engineName, engineVersion, createdAt, updatedAt }`. There is no provenance
 * field — no defect reference, no origin — and **`engineName` and
 * `engineVersion` are not optional**.
 *
 * A repair task authored from a defect has no engine. So whatever this Room
 * writes into those two columns is a claim about provenance, and it will be
 * read as one: `'defect-room'` in a column named `engineName` is a lie that
 * `BR-0058`'s own analytics would later count as an engine.
 *
 * The Room cannot fix this. Extending `TaskRecord` is `EPIC-012`'s work and
 * `U-12`'s, and `FR-DFR-002` forbids implementing the task model here — so
 * inventing a provenance model would cross that in the same breath as
 * `R-035-2`.
 *
 * ## So the sentinel is asserted, and the assertion is the handover
 *
 * `R-035-3`: *the port writes a documented sentinel, the sentinel is asserted
 * by test so it cannot drift into looking like a real engine name.*
 *
 * "Cannot drift" is the whole point, and it is why this file asserts the shape
 * as well as the value. Somebody tidying the string to `'defect-room'` makes
 * the tests fail; somebody with a plausible-looking value **and** a matching
 * test change has done something deliberate that shows up in review. What is
 * being prevented is the quiet edit that makes a lie look like data.
 */
import { describe, expect, it } from 'vitest';
import {
  REPAIR_TASK_ENGINE,
  REPAIR_TASK_ENGINE_VERSION,
  RepairService,
  type CreatedTask,
  type RepairTaskPort,
  type ChainLinkPort,
} from '../../src/modules/defect-room/repair.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import {
  TriageService,
  type BaselineReaderPort,
} from '../../src/modules/defect-room/triage.service.js';

/** What a real engine identifier looks like: a slug, and nothing else. */
const PLAUSIBLE_ENGINE_NAME = /^[a-z0-9][a-z0-9._@/-]*$/i;

describe('T999i · the sentinel is not a name anything could mistake for an engine', () => {
  it('engineName is the documented sentinel', () => {
    expect(REPAIR_TASK_ENGINE).toBe('(none — authored from a defect)');
  });

  it('and engineVersion is too', () => {
    expect(REPAIR_TASK_ENGINE_VERSION).toBe('(none)');
  });

  it('neither could pass for an engine identifier', () => {
    // The shape assertion, which is what stops the drift. `'defect-room'`
    // matches this pattern; `'(none — …)'` cannot.
    expect(PLAUSIBLE_ENGINE_NAME.test(REPAIR_TASK_ENGINE)).toBe(false);
    expect(PLAUSIBLE_ENGINE_NAME.test(REPAIR_TASK_ENGINE_VERSION)).toBe(false);
  });

  it('and the shape check can fire', () => {
    // The control. Without it, a broken regex would let every sentinel through
    // while this file reported that none of them could pass.
    expect(PLAUSIBLE_ENGINE_NAME.test('defect-room')).toBe(true);
    expect(PLAUSIBLE_ENGINE_NAME.test('speckit-engine@2.1.0')).toBe(true);
  });

  it('neither names this Room, this Epic or a version', async () => {
    // The three tidyings somebody would reach for. Each is a claim about
    // provenance that nothing verified.
    for (const value of [REPAIR_TASK_ENGINE, REPAIR_TASK_ENGINE_VERSION]) {
      expect(value).not.toMatch(/defect-room|EPIC-035|speckit/i);
      expect(value).not.toMatch(/\d+\.\d+/);
    }
  });

  it('and both say what they are, in words', () => {
    // A bare `'-'` or `''` would satisfy every assertion above and tell a
    // reader nothing. The sentinel has to explain itself where it is read,
    // because the person reading it is looking at a task list, not this file.
    expect(REPAIR_TASK_ENGINE).toMatch(/none/i);
    expect(REPAIR_TASK_ENGINE).toMatch(/defect/i);
  });
});

const finds: BaselineReaderPort = {
  async approvedBehaviourFor() {
    return { found: true, behaviourRef: 'rv_1', baselineVersion: 3 };
  },
};

describe('T999i · and it is what actually reaches EPIC-012', () => {
  it('every created row carries the sentinel', async () => {
    // The constants could be right and unused. This is the assertion that ties
    // them to the rows `TaskStore.createMany` receives.
    const seen: Record<string, unknown>[] = [];
    const port: RepairTaskPort = {
      async createMany(rows): Promise<readonly CreatedTask[]> {
        seen.push(...(rows as unknown as Record<string, unknown>[]));
        return rows.map((row, index) => ({ ...row, id: `tk_${index + 1}` }));
      },
    };

    const store = new InMemoryDefectRoomStore();
    await store.createDefect({
      id: 'df_1',
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      epicId: 'EPIC-999',
      state: 'triaged',
      origin: 'manual-report',
      contestedArtifactRef: 'spec_1',
      contestedArtifactVersion: 'v3',
      severity: 'high',
      reportedBy: 'u_0',
      reportedAt: new Date(),
    });
    await new TriageService(store, finds).triage({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      classifiedBy: 'u_1',
      classifiedByKind: 'human',
      rationale: 'the baseline says one hour and it sends two',
    });
    await store.recordTest({
      id: 'dt_1',
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testRef: 'tests/x.spec.ts',
      contestedBehaviourRef: 'rv_1',
      firstObservedFailingAt: new Date(),
      lastRunOutcome: 'fail',
      lastRunEvidenceRef: null,
      createdAt: new Date(),
    });

    const chain: ChainLinkPort = { async linkTaskToDefect(): Promise<unknown> { return null; } };
    await new RepairService(store, port, chain).createRepairTasks({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      specificationId: 'spec_1',
      requestedBy: 'u_1',
      descriptions: ['Send one notification per booking'],
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]!['engineName']).toBe(REPAIR_TASK_ENGINE);
    expect(seen[0]!['engineVersion']).toBe(REPAIR_TASK_ENGINE_VERSION);
  });
});
