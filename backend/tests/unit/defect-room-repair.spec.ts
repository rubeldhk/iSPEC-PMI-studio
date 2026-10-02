/**
 * `T999g` (EPIC-035) — a confirmed defect becomes traceable repair work.
 *
 * `FR-DFR-050`, `FR-DFR-051`, `FR-DFR-052`, `SC-DFR-012`. `BR-0055` is the
 * bridge between confirming a defect and fixing it, **which is where
 * traceability is usually lost**: the defect is discussed in one place, the fix
 * is done in another, and six months later the task says *"fix the notification
 * bug"* and nothing says which one.
 *
 * ## Why this creates through `EPIC-012` and not here
 *
 * `FR-DFR-051` says the tasks use `EPIC-012`'s model, not a Room-local one, and
 * `R-035-2` bans `GenerateTasksService` by architecture test. That service is
 * named for this requirement and does something else: it derives tasks from
 * **specification text** through an engine, and stamps the engine's name on
 * them. Repair work derives from a defect and the test that proved it. Reusing
 * the name would have produced tasks whose recorded provenance was a lie.
 *
 * ## Refused before classification, and the refusal is the requirement
 *
 * `FR-DFR-052`, `SC-DFR-012`: **zero** repair tasks created before
 * classification. Work begun before the judgement makes the judgement a
 * formality — nobody unpicks a task somebody has started because triage later
 * called it a change request.
 */
import { describe, expect, it } from 'vitest';
import {
  RepairService,
  type RepairTaskPort,
  type CreatedTask,
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

/** Records what it was asked to create, and answers as `EPIC-012` would. */
function recordingPort(): RepairTaskPort & { seen: unknown[] } {
  const seen: unknown[] = [];
  return {
    seen,
    async createMany(rows): Promise<readonly CreatedTask[]> {
      seen.push(...rows);
      return rows.map((row, index) => ({ ...row, id: `tk_${index + 1}` }));
    },
  };
}


/** `EPIC-011`'s writer, as this Room sees it. */
function chainPort(): ChainLinkPort & { edges: string[] } {
  const edges: string[] = [];
  return {
    edges,
    async linkTaskToDefect(input): Promise<unknown> {
      edges.push(`task:${input.taskId}->defect:${input.defectId}`);
      return null;
    },
  };
}

/**
 * Two helpers, and deliberately not one with a default parameter.
 *
 * `room(port, undefined)` against `chain = chainPort()` would receive the
 * DEFAULT, so a test written to prove the unbound refusal would silently
 * exercise a bound writer and pass for the wrong reason. That bug has been
 * made twice already in this Room's tests; this is the shape that cannot.
 */
async function room(
  port: RepairTaskPort | undefined,
  chain: ChainLinkPort | undefined,
): Promise<{
  store: InMemoryDefectRoomStore;
  triage: TriageService;
  subject: RepairService;
}> {
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
  return {
    store,
    triage: new TriageService(store, finds),
    subject: new RepairService(store, port, chain),
  };
}

/** The ordinary case: both ports bound. */
const bound = (port?: RepairTaskPort): ReturnType<typeof room> => room(port, chainPort());

const confirm = (triage: TriageService, outcome?: 'change-request'): Promise<unknown> =>
  triage.triage({
    workspaceId: 'ws_1',
    defectId: 'df_1',
    classifiedBy: 'u_1',
    classifiedByKind: 'human',
    rationale: 'the baseline says one hour and it sends two',
    ...(outcome ? { proposedOutcome: outcome } : {}),
  });

const withTest = (store: InMemoryDefectRoomStore): Promise<unknown> =>
  store.recordTest({
    id: 'dt_1',
    workspaceId: 'ws_1',
    defectId: 'df_1',
    testRef: 'tests/notifications.spec.ts',
    contestedBehaviourRef: 'rv_1',
    firstObservedFailingAt: new Date(),
    lastRunOutcome: 'fail',
    lastRunEvidenceRef: null,
    createdAt: new Date(),
  });

const create = (over: Record<string, unknown> = {}): Parameters<RepairService['createRepairTasks']>[0] => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  specificationId: 'spec_1',
  requestedBy: 'u_1',
  descriptions: ['Send one notification per booking, not two'],
  ...over,
});

describe('T999g · conversion is refused before classification', () => {
  it('an untriaged defect produces nothing', async () => {
    // `FR-DFR-052`, `SC-DFR-012` — zero, and the count is the requirement.
    const { subject } = await bound(recordingPort());
    await expect(subject.createRepairTasks(create())).rejects.toThrow(/classif/i);
  });

  it('and nothing is created when it refuses', async () => {
    const port = recordingPort();
    const { subject } = await bound(port);
    await expect(subject.createRepairTasks(create())).rejects.toThrow();
    expect(port.seen).toHaveLength(0);
  });

  it('a change request is not repair work', async () => {
    // The Change Room decides what happens to it. Creating repair tasks here
    // would be the unbudgeted change channel arriving through the back door.
    const { store, triage, subject } = await bound(recordingPort());
    await confirm(triage, 'change-request');
    await withTest(store);
    await expect(subject.createRepairTasks(create())).rejects.toThrow(/confirmed/i);
  });

  it('and a confirmed defect with no failing test is refused', async () => {
    // `FR-DFR-050` links each task to the failing behaviour **and its test**,
    // and `RepairLink.defectTestId` is NOT NULL. There is nothing to link.
    const { triage, subject } = await bound(recordingPort());
    await confirm(triage);
    await expect(subject.createRepairTasks(create())).rejects.toThrow(/failing test/i);
  });
});

describe('T999g · a confirmed defect with a test converts', () => {
  it('creates the tasks', async () => {
    const port = recordingPort();
    const { store, triage, subject } = await bound(port);
    await confirm(triage);
    await withTest(store);

    const result = await subject.createRepairTasks(
      create({ descriptions: ['Send one notification', 'Add a regression guard'] }),
    );
    expect(result.tasks).toHaveLength(2);
    expect(port.seen).toHaveLength(2);
  });

  it('through EPIC-012’s model, with its own fields', async () => {
    // `FR-DFR-051`. A Room-local task table would be a second thing to keep in
    // step with the one people actually work from.
    const port = recordingPort();
    const { store, triage, subject } = await bound(port);
    await confirm(triage);
    await withTest(store);
    await subject.createRepairTasks(create());

    const row = port.seen[0] as Record<string, unknown>;
    expect(Object.keys(row).sort()).toEqual(
      ['description', 'engineName', 'engineVersion', 'specificationId', 'status', 'workspaceId'].sort(),
    );
    expect(row['status']).toBe('not_started');
  });

  it('and every task is reachable from the defect AND its test', async () => {
    // `SC-DFR-012` — 100%, and the link lives on this Room's side because
    // `TaskRecord` has nowhere to put it (`R-035-3`).
    const { store, triage, subject } = await bound(recordingPort());
    await confirm(triage);
    await withTest(store);
    const result = await subject.createRepairTasks(
      create({ descriptions: ['one', 'two', 'three'] }),
    );

    const links = await store.repairLinksFor('ws_1', 'df_1');
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.defectId).toBe('df_1');
      expect(link.defectTestId).toBe('dt_1');
      expect(result.tasks.map((task) => task.id)).toContain(link.taskId);
    }
  });

  it('refusing an empty list rather than creating nothing quietly', async () => {
    // A call that created no tasks and reported success would read as "this
    // defect has been converted" in every later count.
    const { store, triage, subject } = await bound(recordingPort());
    await confirm(triage);
    await withTest(store);
    await expect(subject.createRepairTasks(create({ descriptions: [] }))).rejects.toThrow(
      /at least one/i,
    );
  });

  it('and a blank description', async () => {
    const { store, triage, subject } = await bound(recordingPort());
    await confirm(triage);
    await withTest(store);
    await expect(
      subject.createRepairTasks(create({ descriptions: ['  '] })),
    ).rejects.toThrow(/description/i);
  });
});

describe('T999g · the port refuses when absent', () => {
  it('an unbound port refuses rather than degrading', async () => {
    // `DEFECT_ROOM_PORTS`: `RepairTaskPort` absent ⇒ refuse. A repair task with
    // no provenance is indistinguishable from ordinary work nobody can trace to
    // the defect it fixes.
    const { store, triage, subject } = await bound(undefined);
    await confirm(triage);
    await withTest(store);
    await expect(subject.createRepairTasks(create())).rejects.toThrow(/EPIC-012/);
  });

  it('and writes no links when it does', async () => {
    const { store, triage, subject } = await bound(undefined);
    await confirm(triage);
    await withTest(store);
    await expect(subject.createRepairTasks(create())).rejects.toThrow();
    expect(await store.repairLinksFor('ws_1', 'df_1')).toHaveLength(0);
  });

  it('the control: a bound port does create', async () => {
    // Without this, a service that refused every conversion would satisfy every
    // refusal above.
    const { store, triage, subject } = await bound(recordingPort());
    await confirm(triage);
    await withTest(store);
    expect((await subject.createRepairTasks(create())).tasks).toHaveLength(1);
  });

  it('a defect that does not exist is absent, not invented', async () => {
    const { subject } = await bound(recordingPort());
    await expect(subject.createRepairTasks(create({ defectId: 'df_none' }))).rejects.toThrow(
      /not found/i,
    );
  });

  it('and one in another workspace is absent too', async () => {
    const { store, triage, subject } = await bound(recordingPort());
    await confirm(triage);
    await withTest(store);
    await expect(subject.createRepairTasks(create({ workspaceId: 'ws_other' }))).rejects.toThrow(
      /not found/i,
    );
  });
});

describe('T999h · and the chain writer refuses when absent', () => {
  it('an unbound chain writer refuses', async () => {
    // Checked BEFORE anything is created. Tasks in `EPIC-012` that nothing
    // outside this Room can trace are the failure `FR-DFR-050` names, arrived
    // at by being half-finished rather than by being wrong.
    const port = recordingPort();
    const { store, triage, subject } = await room(port, undefined);
    await confirm(triage);
    await withTest(store);
    await expect(subject.createRepairTasks(create())).rejects.toThrow(/EPIC-011/);
    expect(port.seen).toHaveLength(0);
  });

  it('and every created task gets its task → defect edge', async () => {
    const chain = chainPort();
    const { store, triage, subject } = await room(recordingPort(), chain);
    await confirm(triage);
    await withTest(store);
    const result = await subject.createRepairTasks(create({ descriptions: ['one', 'two'] }));

    expect(chain.edges).toHaveLength(2);
    for (const task of result.tasks) {
      expect(chain.edges).toContain(`task:${task.id}->defect:df_1`);
    }
  });
});
