/**
 * `T999j` (EPIC-035) — the tasks that outlive the classification that made
 * them.
 *
 * `FR-DFR-025`, `ADR-0016`, `US7` scenario 4.
 *
 * ## What happens without this
 *
 * A defect is confirmed, three repair tasks are created, somebody starts one.
 * Then the defect is re-evaluated and turns out to be a change request.
 *
 * The tidy move is to delete the tasks. Somebody's work in progress disappears,
 * and the record now says the defect was always a change request — with nothing
 * to show that three people were asked to fix it.
 *
 * The other tidy move is to do nothing, and the tasks sit in a backlog
 * referencing a defect that no longer claims to be one. They get worked. The
 * change nobody approved gets built, and every artifact involved looks correct.
 *
 * So: **marked**. `orphanedByClassificationId` names the classification that
 * cut them loose. The tasks are still there, the reclassification is still
 * there, and the relationship between them is a fact somebody can read rather
 * than infer.
 *
 * ## Marked, not deleted, and not rewritten either
 *
 * `ADR-0016`'s never-delete rule, and the same reasoning as the superseded
 * classification: an updated row destroys the same history a deleted one does,
 * more quietly. The `taskId` is untouched, the `defectTestId` is untouched, and
 * only the pointer that says *"this was cut loose, and by what"* moves.
 */
import { describe, expect, it } from 'vitest';
import {
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

const finds: BaselineReaderPort = {
  async approvedBehaviourFor() {
    return { found: true, behaviourRef: 'rv_1', baselineVersion: 3 };
  },
};

const chain: ChainLinkPort = {
  async linkTaskToDefect(): Promise<unknown> {
    return null;
  },
};

const port: RepairTaskPort = {
  async createMany(rows): Promise<readonly CreatedTask[]> {
    return rows.map((row, index) => ({ ...row, id: `tk_${index + 1}` }));
  },
};

/** A defect confirmed, tested, and converted into two repair tasks. */
async function converted(): Promise<{
  store: InMemoryDefectRoomStore;
  triage: TriageService;
  repairs: RepairService;
}> {
  const store = new InMemoryDefectRoomStore();
  const repairs = new RepairService(store, port, chain);
  const triage = new TriageService(store, finds, repairs);

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
  await triage.triage({
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
  await repairs.createRepairTasks({
    workspaceId: 'ws_1',
    defectId: 'df_1',
    specificationId: 'spec_1',
    requestedBy: 'u_1',
    descriptions: ['Send one notification', 'Add a regression guard'],
  });

  return { store, triage, repairs };
}

const reevaluate = (triage: TriageService, outcome?: 'change-request'): Promise<unknown> =>
  triage.reevaluateAgainstCurrent({
    workspaceId: 'ws_1',
    defectId: 'df_1',
    currentArtifactVersion: 'v7',
    classifiedBy: 'u_2',
    classifiedByKind: 'human',
    rationale: 'v7 does what the baseline asks; this is a change request',
    ...(outcome ? { proposedOutcome: outcome } : {}),
  });

describe('T999j · reclassification marks the repair links', () => {
  it('marks them with the classification that cut them loose', async () => {
    const { store, triage } = await converted();
    const result = (await reevaluate(triage, 'change-request')) as {
      classification: { id: string };
    };

    const links = await store.repairLinksFor('ws_1', 'df_1');
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.orphanedByClassificationId).toBe(result.classification.id);
    }
  });

  it('and deletes nothing', async () => {
    // `ADR-0016`. Somebody has started one of these. Deleting it makes the
    // record say the defect was always a change request, with nothing to show
    // three people were asked to fix it.
    const { store, triage } = await converted();
    const before = await store.repairLinksFor('ws_1', 'df_1');
    await reevaluate(triage, 'change-request');
    const after = await store.repairLinksFor('ws_1', 'df_1');

    expect(after.map((link) => link.id).sort()).toEqual(before.map((link) => link.id).sort());
  });

  it('leaving the task and test references untouched', async () => {
    // Only the pointer moves — the same shape the superseded classification
    // takes. A rewritten `taskId` would destroy the link this row exists for.
    const { store, triage } = await converted();
    const before = await store.repairLinksFor('ws_1', 'df_1');
    await reevaluate(triage, 'change-request');
    const after = await store.repairLinksFor('ws_1', 'df_1');

    for (const link of after) {
      const original = before.find((row) => row.id === link.id)!;
      expect(link.taskId).toBe(original.taskId);
      expect(link.defectTestId).toBe(original.defectTestId);
      expect(link.defectId).toBe(original.defectId);
    }
  });

  it('so both the tasks and the reclassification stay visible', async () => {
    // `US7` scenario 4, stated as one assertion: the history is readable from
    // the record rather than reconstructed from what is missing.
    const { store, triage } = await converted();
    await reevaluate(triage, 'change-request');

    const classifications = await store.listClassifications('ws_1', 'df_1');
    const links = await store.repairLinksFor('ws_1', 'df_1');
    expect(classifications).toHaveLength(2);
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.orphanedByClassificationId !== null)).toBe(true);
  });
});

describe('T999j · and it marks only what should be marked', () => {
  it('a re-evaluation that stays a confirmed defect orphans nothing', async () => {
    // The control, and the one that matters most: an implementation that
    // orphaned on every reclassification would pass every assertion above
    // while cutting loose the tasks for a defect still being repaired.
    const { store, triage } = await converted();
    await reevaluate(triage);

    const links = await store.repairLinksFor('ws_1', 'df_1');
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.orphanedByClassificationId === null)).toBe(true);
  });

  it('marking is idempotent — a second reclassification does not re-mark', async () => {
    // The first classification that cut them loose is the honest answer. A
    // later one overwriting it would say the tasks survived until then.
    const { store, triage } = await converted();
    const first = (await reevaluate(triage, 'change-request')) as {
      classification: { id: string };
    };
    await triage.reevaluateAgainstCurrent({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      currentArtifactVersion: 'v9',
      classifiedBy: 'u_3',
      classifiedByKind: 'human',
      rationale: 'still a change request at v9',
      proposedOutcome: 'change-request',
    });

    for (const link of await store.repairLinksFor('ws_1', 'df_1')) {
      expect(link.orphanedByClassificationId).toBe(first.classification.id);
    }
  });

  it('and a defect with no repair tasks reclassifies without incident', async () => {
    const store = new InMemoryDefectRoomStore();
    const triage = new TriageService(store, finds, new RepairService(store, port, chain));
    await store.createDefect({
      id: 'df_2',
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
    await triage.triage({
      workspaceId: 'ws_1',
      defectId: 'df_2',
      classifiedBy: 'u_1',
      classifiedByKind: 'human',
      rationale: 'the baseline says one hour and it sends two',
    });

    await expect(
      triage.reevaluateAgainstCurrent({
        workspaceId: 'ws_1',
        defectId: 'df_2',
        currentArtifactVersion: 'v7',
        classifiedBy: 'u_2',
        classifiedByKind: 'human',
        rationale: 'this is a change request',
        proposedOutcome: 'change-request',
      }),
    ).resolves.toBeTruthy();
  });
});

describe('T999j · orphaned tasks are not converted again by accident', () => {
  it('a re-confirmed defect gets new links rather than reviving the old', async () => {
    // Reviving them would say the original classification never cut them
    // loose. Two sets of links, both true, and the history readable in order.
    const { store, triage, repairs } = await converted();
    await reevaluate(triage, 'change-request');
    await triage.reevaluateAgainstCurrent({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      currentArtifactVersion: 'v9',
      classifiedBy: 'u_3',
      classifiedByKind: 'human',
      rationale: 'v9 broke it again; this is a defect after all',
    });

    await repairs.createRepairTasks({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      specificationId: 'spec_1',
      requestedBy: 'u_3',
      descriptions: ['Fix it properly this time'],
    });

    const links = await store.repairLinksFor('ws_1', 'df_1');
    expect(links).toHaveLength(3);
    expect(links.filter((link) => link.orphanedByClassificationId === null)).toHaveLength(1);
  });
});
