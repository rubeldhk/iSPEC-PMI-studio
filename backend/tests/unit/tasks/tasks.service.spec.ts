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

function build(): { svc: TasksService; store: InMemoryTaskStore } {
  const store = new InMemoryTaskStore();
  return {
    svc: new TasksService(store, {
      listSpecificationIds: async (ws, projectId) =>
        ws === 'ws_a' && projectId === 'p1' ? ['s1', 's2'] : [],
    }),
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
