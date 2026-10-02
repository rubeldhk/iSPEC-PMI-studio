/**
 * T101a — task status transitions and project progress aggregation.
 * Written to FAIL before T102 exists (Constitution V).
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryTaskStore,
  type TaskRecord,
} from '../../../src/modules/tasks/generate-tasks.service.js';
import { TasksService } from '../../../src/modules/tasks/tasks.service.js';
import { computeProgress } from '../../../src/modules/task-sync/task-progress.service.js';
import { NotFoundError, ValidationFailedError } from '../../../src/core/errors.js';

async function seed(store: InMemoryTaskStore, specId: string, count: number): Promise<TaskRecord[]> {
  return store.createMany(
    Array.from({ length: count }, (_, i) => ({
      id: `${specId}-t${i + 1}`,
      workspaceId: 'ws_a',
      specificationId: specId,
      description: `Task ${i + 1}`,
      status: 'not_started' as const,
      engineName: 'fixture',
      engineVersion: '0.1.0',
    })),
  );
}

/**
 * `T1780` (EPIC-046, `FR-KAN-056`) — the progress port.
 *
 * `progressForProject` no longer counts anything itself. It asks the one
 * derivation, and the fake here calls `computeProgress` — the same exported
 * pure function `TaskProgressService` calls — over the same rows. What the port
 * abstracts is *which rows*, never *how they are counted*, which is the whole
 * content of `FR-KAN-056`.
 */
function build(): { svc: TasksService; store: InMemoryTaskStore } {
  const store = new InMemoryTaskStore();
  return {
    svc: new TasksService(
      store,
      {
        listSpecificationIds: async (ws, projectId) =>
          ws === 'ws_a' && projectId === 'p1' ? ['s1', 's2'] : [],
      },
      {
        progress: {
          forProject: async (ws, projectId) => {
            const ids = ws === 'ws_a' && projectId === 'p1' ? ['s1', 's2'] : [];
            return computeProgress(await store.listForSpecifications(ws, ids));
          },
        },
      },
    ),
    store,
  };
}

describe('TasksService · status (spec Assumptions: three states, richer arrives Phase 2)', () => {
  it('moves not_started → in_progress → done', async () => {
    const { svc, store } = build();
    const [task] = await seed(store, 's1', 1);
    const started = await svc.updateStatus('ws_a', task!.id, 'in_progress');
    expect(started.status).toBe('in_progress');
    const done = await svc.updateStatus('ws_a', task!.id, 'done');
    expect(done.status).toBe('done');
  });

  it('permits any of the three states in any order — no transition guard by design', async () => {
    const { svc, store } = build();
    const [task] = await seed(store, 's1', 1);
    await svc.updateStatus('ws_a', task!.id, 'done');
    // Reopening a task is legitimate; the Phase 2 workflow engine adds rules.
    const reopened = await svc.updateStatus('ws_a', task!.id, 'not_started');
    expect(reopened.status).toBe('not_started');
  });

  it('refuses an unknown status, naming the field', async () => {
    const { svc, store } = build();
    const [task] = await seed(store, 's1', 1);
    const err = await svc.updateStatus('ws_a', task!.id, 'blocked' as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
  });

  it('cross-workspace update is indistinguishable from absence (FR-002)', async () => {
    const { svc, store } = build();
    const [task] = await seed(store, 's1', 1);
    await expect(svc.updateStatus('ws_b', task!.id, 'done')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('TasksService · project progress (US4 scenario 3)', () => {
  it('aggregates across every specification of the project', async () => {
    const { svc, store } = build();
    const s1 = await seed(store, 's1', 3);
    await seed(store, 's2', 1);
    await svc.updateStatus('ws_a', s1[0]!.id, 'done');
    await svc.updateStatus('ws_a', s1[1]!.id, 'in_progress');

    const progress = await svc.progressForProject('ws_a', 'p1');
    expect(progress).toEqual({
      total: 4,
      done: 1,
      inProgress: 1,
      notStarted: 2,
      // `T1780`: the reading carries the fourth column, because the board has
      // four and a project figure missing one of them is a different figure.
      blocked: 0,
      percentComplete: 25,
    });
  });

  it('a project with no tasks reports zero progress, not an error', async () => {
    const { svc } = build();
    const progress = await svc.progressForProject('ws_a', 'p1');
    expect(progress.total).toBe(0);
    expect(progress.percentComplete).toBe(0);
  });

  it('is workspace-scoped (FR-002)', async () => {
    const { svc, store } = build();
    await seed(store, 's1', 2);
    const progress = await svc.progressForProject('ws_b', 'p1');
    expect(progress.total).toBe(0);
  });
});


/**
 * `T1780` (EPIC-046, `FR-KAN-056`, `SC-KAN-009`) — one derivation, or the two
 * screens disagree.
 *
 * ## The bug this exists to stop
 *
 * `/speckit-converge` found `progressForProject` counting `listForSpecifications`
 * itself while `TaskProgressService` counted the Epics' rows — two functions,
 * two answers, both rendered. `frontend/src/pages/Tasks.tsx` showed one and
 * `frontend/src/pages/PlanLanding.tsx` the other, and nothing in the codebase
 * would have said so.
 *
 * `SC-KAN-009` is unambiguous: the Epic's percentage and the project's read the
 * same value on **100%** of the surfaces that show them. Two functions that
 * agree today are two functions that can disagree tomorrow, so the test is not
 * *do they agree* — it is **is there only one of them**.
 *
 * Written to FAIL before the port exists.
 */
describe('T1780 · project progress is derived once (FR-KAN-056, SC-KAN-009)', () => {
  it('reads through the port and does not count for itself', async () => {
    const store = new InMemoryTaskStore();
    await seed(store, 's1', 4);
    let asked = 0;
    const svc = new TasksService(
      store,
      { listSpecificationIds: async () => ['s1'] },
      {
        progress: {
          forProject: async () => {
            asked += 1;
            // A reading the service could not have produced by counting the
            // store: if it ignores this and counts anyway, the numbers below
            // are 4/0/0%, not 9/3/33%.
            return { total: 9, done: 3, inProgress: 2, notStarted: 3, blocked: 1, percentComplete: 33 };
          },
        },
      },
    );

    const progress = await svc.progressForProject('ws_a', 'p1');
    expect(asked, 'progressForProject did not ask the one derivation').toBe(1);
    expect(progress).toEqual({ total: 9, done: 3, inProgress: 2, notStarted: 3, blocked: 1, percentComplete: 33 });
  });

  it('carries the blocked count, so the project figure and the board have the same four states', async () => {
    const { svc, store } = build();
    await seed(store, 's1', 2);
    const progress = await svc.progressForProject('ws_a', 'p1');
    expect(progress).toHaveProperty('blocked');
    expect(typeof progress.blocked).toBe('number');
  });

  it('still reads 0% for a project with no tasks, and never a non-number', async () => {
    const { svc } = build();
    const progress = await svc.progressForProject('ws_a', 'p1');
    expect(progress.percentComplete).toBe(0);
    expect(Number.isNaN(progress.percentComplete)).toBe(false);
  });

  it('excludes a row the latest parse no longer contains — the exclusion is the derivation, not the caller', async () => {
    // `FR-KAN-058`. The port hands over rows; `computeProgress` drops the ones
    // marked absent. A caller that re-implemented the filter would be the
    // second derivation this test exists to prevent.
    const rows = [
      { id: 'a', status: 'done' as const },
      { id: 'b', status: 'not_started' as const, presentInLatestParse: false },
    ];
    expect(computeProgress(rows)).toMatchObject({ total: 1, done: 1, percentComplete: 100 });
  });
});
