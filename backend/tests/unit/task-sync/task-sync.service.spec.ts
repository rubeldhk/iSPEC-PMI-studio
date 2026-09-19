/**
 * `T1703` (EPIC-046, data-model.md §9) — the sync service's step order.
 *
 * The order is not arbitrary and is asserted rather than described:
 *
 *   1. the execution, and that it is **this project's** and task-bearing;
 *   2. the derived key — a replay returns the stored answer and writes nothing;
 *   3. whole-file validation, **before** anything is written;
 *   4. the Epic, from the execution's binding and never from a path;
 *   5–7. parse, reconcile, upsert, and flag what the parse no longer contains;
 *   8–10. the sync row, the `system` comment, the audit, the diff.
 *
 * Written to FAIL before `T1704`.
 */
import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/core/errors.js';
import { DEFAULT_TASK_GRAMMAR } from '../../../src/modules/task-sync/task-grammar.js';
import {
  TaskSyncService,
  type ExecutionLookupRow,
  type SyncCommentPort,
  type SyncContext,
  type TaskSyncDeps,
} from '../../../src/modules/task-sync/task-sync.service.js';
import { InMemoryTaskSyncStore } from '../../../src/modules/task-sync/task-sync.store.js';
import { DEFAULT_MAX_TASK_LINES, DEFAULT_TASKS_MAX_BYTES } from '../../../src/modules/task-sync/task-validation.js';

const CTX: SyncContext = { workspaceId: 'ws_a', projectId: 'p_a', actorId: 'cred_1' };

function execution(over: Partial<ExecutionLookupRow> = {}): ExecutionLookupRow {
  return {
    executionId: 'x_1',
    workspaceId: 'ws_a',
    projectId: 'p_a',
    command: 'tasks',
    initiatorId: 'u_1',
    state: 'completed',
    registeredAt: '2026-09-07T09:00:00.000Z',
    completedAt: '2026-09-07T09:05:00.000Z',
    completionComment: 'done',
    targetType: 'epic',
    targetId: '3',
    agentAdapter: 'claude',
    agentVersion: '1.2.3',
    ...over,
  };
}

function harness(over: { execution?: ExecutionLookupRow | null; limits?: { maxBytes: number; maxTaskLines: number } } = {}) {
  const store = new InMemoryTaskSyncStore();
  const comments = { add: vi.fn(async (_input: Parameters<SyncCommentPort['add']>[0]) => ({ commentId: 'c_1' })) };
  const audit = { record: vi.fn(async () => undefined) };
  const row = over.execution === undefined ? execution() : over.execution;
  const deps: TaskSyncDeps = {
    store,
    executions: { find: vi.fn(async () => row) },
    epics: { list: vi.fn(async () => [{ id: 'e_3', number: 3, slug: 'reports', parentEpicId: null, splitSuffix: null }] as never) },
    comments,
    audit,
    grammar: DEFAULT_TASK_GRAMMAR,
    limits: () => over.limits ?? { maxBytes: DEFAULT_TASKS_MAX_BYTES, maxTaskLines: DEFAULT_MAX_TASK_LINES },
  };
  return { service: new TaskSyncService(deps), store, comments, audit, deps };
}

const ONE = '- [ ] T1 Do the thing in `a/b.ts`\n';

describe('T1703 · the sync service', () => {
  describe('step 1 — the execution', () => {
    it('refuses an unknown execution as absence', async () => {
      const h = harness({ execution: null });
      await expect(h.service.sync(CTX, { executionId: 'x_nope', tasksMarkdown: ONE })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("refuses another project's execution as absence, disclosing nothing about it", async () => {
      const h = harness({ execution: execution({ projectId: 'p_other' }) });
      await expect(h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE })).rejects.toBeInstanceOf(NotFoundError);
    });

    it.each(['specify', 'plan', 'analyze', 'converge'])('refuses a `%s` execution — a task sync is not its business', async (command) => {
      const h = harness({ execution: execution({ command }) });
      await expect(h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE })).rejects.toMatchObject({ details: { code: 'command_not_task_bearing' } });
    });

    it.each(['tasks', 'implement'])('accepts a `%s` execution', async (command) => {
      const h = harness({ execution: execution({ command }) });
      await expect(h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE })).resolves.toMatchObject({ epicId: 'e_3' });
    });
  });

  describe('step 3 — whole-file validation before anything is written (FR-KAN-039)', () => {
    it('refuses the whole sync and leaves NO rows behind', async () => {
      const h = harness({ limits: { maxBytes: DEFAULT_TASKS_MAX_BYTES, maxTaskLines: 1 } });
      const two = '- [ ] T1 One in `a/b.ts`\n- [ ] T2 Two in `c/d.ts`\n';
      await expect(h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: two })).rejects.toMatchObject({
        name: 'ValidationFailedError',
        details: { code: 'too_many_task_lines' },
      });
      expect(await h.store.tasksForEpic('ws_a', 'e_3')).toEqual([]);
      expect(await h.store.latestSyncForEpic('ws_a', 'e_3')).toBeNull();
      expect(h.audit.record).not.toHaveBeenCalled();
    });
  });

  describe('step 4 — the Epic comes from the binding, never from a path (FR-KAN-030)', () => {
    it('resolves the Epic the execution names', async () => {
      const h = harness();
      const answer = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      expect(answer.epicId).toBe('e_3');
    });

    it('stores unbound when the execution names an Epic the project does not have', async () => {
      const h = harness({ execution: execution({ targetId: '99' }) });
      const answer = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      expect(answer.epicId).toBeNull();
      expect(await h.store.tasksForEpic('ws_a', 'e_3')).toEqual([]);
      // The sync itself is still recorded, under the project (FR-KAN-032).
      expect(await h.store.unboundSyncs('ws_a', 'p_a')).toHaveLength(1);
    });

    it('stores unbound when the execution is bound to a project rather than an Epic', async () => {
      const h = harness({ execution: execution({ targetType: 'project', targetId: 'p_a' }) });
      expect((await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE })).epicId).toBeNull();
    });
  });

  describe('steps 5–7 — parse, reconcile, upsert', () => {
    it('writes the row with its line, digest, paths and the AGENT that produced it', async () => {
      const h = harness();
      await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      const [row] = await h.store.tasksForEpic('ws_a', 'e_3');
      expect(row).toMatchObject({
        taskKey: 'T1',
        status: 'not_started',
        statusSource: 'parse',
        sourceLine: 1,
        parallel: false,
        presentInLatestParse: true,
        lastParsedExecutionId: 'x_1',
        // BR-0035: provenance is the execution's identity snapshot, never a literal.
        engineName: 'claude',
        engineVersion: '1.2.3',
      });
      expect(row?.sourcePaths).toEqual(['a/b.ts']);
      expect(row?.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
    });

    it('flags a task the latest parse omits, and deletes nothing (FR-KAN-025)', async () => {
      const h = harness();
      await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: `${ONE}- [ ] T2 Second in \`c/d.ts\`\n` });
      const answer = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      expect(answer.diff.noLongerPresent).toEqual([{ taskKey: 'T2' }]);
      const rows = await h.store.tasksForEpic('ws_a', 'e_3');
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.taskKey === 'T2')?.presentInLatestParse).toBe(false);
    });

    it('classifies the diff: added, description changed, checkbox changed, unchanged', async () => {
      const h = harness();
      const first = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      expect(first.diff.added).toEqual([{ taskKey: 'T1', line: 1 }]);

      const renamed = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: '- [ ] T1 Do it differently in `a/b.ts`\n' });
      expect(renamed.diff.descriptionChanged).toMatchObject([{ taskKey: 'T1', to: 'Do it differently in `a/b.ts`' }]);

      const ticked = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: '- [X] T1 Do it differently in `a/b.ts`\n' });
      expect(ticked.diff.checkboxChanged).toMatchObject([{ taskKey: 'T1', from: 'not_started', to: 'done' }]);

      const again = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: '- [X] T1 Do it differently in `a/b.ts`\n\n' });
      expect(again.diff.unchanged).toBe(1);
    });

    it('never sets a status the reconciliation rule did not decide', async () => {
      const h = harness();
      await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      const [row] = await h.store.tasksForEpic('ws_a', 'e_3');
      await h.store.applyStatus('ws_a', row!.id, { status: 'in_progress', statusSource: 'proposal', at: new Date(), by: 'u_1' });
      // The file is silent about `in_progress`, so the proposal stands and says so.
      const answer = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: '- [ ] T1 Do the thing in `a/b.ts`\n\n' });
      expect(answer.markers.aheadOfFile).toEqual(['T1']);
      expect((await h.store.tasksForEpic('ws_a', 'e_3'))[0]?.status).toBe('in_progress');
    });
  });

  describe('step 2 — a replay returns the stored answer and writes nothing (FR-KAN-026)', () => {
    it('answers with the original counts rather than the replayed request', async () => {
      const h = harness();
      const first = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      const second = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      expect(second.syncId).toBe(first.syncId);
      expect(second.counts).toEqual(first.counts);
      expect(second.diff.added).toEqual([]);
      expect(await h.store.syncsForEpic('ws_a', 'e_3')).toHaveLength(1);
      // The audit records the sync, once — a replay is not a second event.
      expect(h.audit.record).toHaveBeenCalledTimes(1);
    });
  });

  describe('steps 9–10 — the comment and the audit', () => {
    it('adds one `system` comment naming the refusals, and never the content', async () => {
      const h = harness();
      const secret = `pmi_ct_${'A'.repeat(30)}`;
      await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: `${ONE}- [ ] T2 Token ${secret}\n- [ ] Tidy up\n` });
      expect(h.comments.add).toHaveBeenCalledTimes(1);
      const body = h.comments.add.mock.calls[0]?.[0].body ?? '';
      expect(body).toContain('credential_in_description');
      expect(body).toContain('identifier_not_matched');
      expect(body).not.toContain(secret);
    });

    it('adds no comment when nothing was refused', async () => {
      const h = harness();
      await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      expect(h.comments.add).not.toHaveBeenCalled();
    });

    it('audits the sync with the execution, digest, counts and refusal codes (FR-KAN-072)', async () => {
      const h = harness();
      await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: ONE });
      expect(h.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_a',
          actorId: 'cred_1',
          action: 'create',
          targetType: 'task_sync',
          outcome: 'success',
          detail: expect.objectContaining({ executionId: 'x_1', epicId: 'e_3' }),
        }),
      );
    });

    it('never stores the raw text of a credential-bearing line', async () => {
      const h = harness();
      const secret = `pmi_ct_${'B'.repeat(30)}`;
      const answer = await h.service.sync(CTX, { executionId: 'x_1', tasksMarkdown: `- [ ] T2 Token ${secret}\n` });
      const manifest = await h.store.linesFor(answer.syncId);
      expect(JSON.stringify(manifest)).not.toContain(secret);
      expect(manifest[0]?.rawText).toContain('redacted');
    });
  });

  describe('the counts the manifest carries (FR-KAN-006, SC-KAN-001)', () => {
    it('account for every considered line, and the manifest has one row each', async () => {
      const h = harness();
      const answer = await h.service.sync(CTX, {
        executionId: 'x_1',
        tasksMarkdown: '# Heading\n\n- [ ] T1 One in `a/b.ts`\n- [ ] Tidy up\n- [ ] T1 Again\n| table |\n',
      });
      expect(answer.counts).toMatchObject({ linesConsidered: 3, parsed: 1, refused: 1, duplicates: 1 });
      expect(await h.store.linesFor(answer.syncId)).toHaveLength(3);
    });
  });
});
