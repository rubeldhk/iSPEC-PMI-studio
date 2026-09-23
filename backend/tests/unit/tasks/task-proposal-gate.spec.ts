/**
 * `T1745` (EPIC-046, `FR-KAN-017`, `Q3`) — the boundary between the two ways a
 * task status can change.
 *
 * Proposal gating applies to **synced** tasks only. The reason a move must be a
 * proposal is that a file elsewhere is authoritative; a task generated for a
 * specification has no such file, and gating it would stop `EPIC-012`'s working
 * path to protect nothing. The requester ruled on that on 2026-09-06 (`Q3`).
 *
 * Both halves are asserted, because a gate that refuses everything and a gate
 * that refuses nothing both pass a test that only checks one side.
 *
 * Written to FAIL before `T1746`.
 */
import { describe, expect, it, vi } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { TasksService, type SyncedTaskGuard } from '../../../src/modules/tasks/tasks.service.js';
import type { TaskRecord, TaskStore } from '../../../src/modules/tasks/generate-tasks.service.js';

function record(over: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 't_1',
    workspaceId: 'ws_a',
    specificationId: 's_1',
    description: 'Do the thing',
    status: 'not_started',
    engineName: 'fixture',
    engineVersion: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function harness(synced: boolean | null) {
  const row = record();
  const store = {
    findById: vi.fn(async () => row),
    updateStatus: vi.fn(async () => ({ ...row, status: 'in_progress' as const })),
  } as unknown as TaskStore;
  const guard: SyncedTaskGuard = { isSynced: vi.fn(async () => synced === true) };
  const service = new TasksService(
    store,
    { listSpecificationIds: vi.fn(async () => []) },
    synced === null ? {} : { syncedTasks: guard },
  );
  return { service, store, guard };
}

describe('T1745 · a SYNCED task is moved by proposal, not by this route', () => {
  it('refuses the direct update and names the proposal route', async () => {
    const h = harness(true);
    await expect(h.service.updateStatus('ws_a', 't_1', 'in_progress')).rejects.toBeInstanceOf(ValidationFailedError);
    await expect(h.service.updateStatus('ws_a', 't_1', 'in_progress')).rejects.toMatchObject({
      details: { code: 'task_is_proposal_gated' },
    });
    expect(h.store.updateStatus, 'the status must not be written').not.toHaveBeenCalled();
  });

  it('says where to go instead, because a refusal with no route is a dead end', async () => {
    const h = harness(true);
    await h.service.updateStatus('ws_a', 't_1', 'in_progress').catch((err: unknown) => {
      expect(JSON.stringify((err as { details: unknown }).details)).toContain('status-proposals');
    });
  });
});

describe('T1745 · an engine-generated task keeps EPIC-012 direct update', () => {
  it('applies the change as it always did', async () => {
    const h = harness(false);
    await expect(h.service.updateStatus('ws_a', 't_1', 'in_progress')).resolves.toMatchObject({ status: 'in_progress' });
    expect(h.store.updateStatus).toHaveBeenCalledWith('ws_a', 't_1', 'in_progress');
  });

  it('works with no guard wired at all — the database-less and pre-EPIC-046 posture', async () => {
    const h = harness(null);
    await expect(h.service.updateStatus('ws_a', 't_1', 'in_progress')).resolves.toMatchObject({ status: 'in_progress' });
  });
});

describe('T1745 · the gate runs AFTER the cheaper checks', () => {
  it('refuses an invalid status without consulting the guard', async () => {
    const h = harness(true);
    await expect(h.service.updateStatus('ws_a', 't_1', 'nonsense' as never)).rejects.toBeInstanceOf(ValidationFailedError);
    expect(h.guard.isSynced, 'a malformed status is not a gating question').not.toHaveBeenCalled();
  });
});
