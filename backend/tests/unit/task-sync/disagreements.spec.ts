/**
 * `T1751` (EPIC-046, `FR-KAN-020`, `FR-KAN-024`, `FR-KAN-036`) — the open
 * disagreements.
 *
 * ## Why this is a list and not a repair
 *
 * `FR-KAN-020`: a disagreement is **surfaced**, never resolved silently. Every
 * entry here names both sides and the rule that decided the outcome, so a
 * reviewer can see that the board knows it does not know — which is the
 * difference between a board that reconciles and one that quietly forgets.
 *
 * Five kinds, and each exists because something real can produce it:
 *
 *   - **ahead of the file** — a person said `in_progress`; a checkbox cannot.
 *   - **not in the latest parse** — the task was removed from `tasks.md`.
 *   - **unmatched progress report** — the hook reported a token the grammar
 *     rejects, which `R-046-1` says is an ordinary outcome, not an error.
 *   - **refused lines** — reported, never dropped.
 *   - **digest mismatch** — the parse and `EPIC-045`'s stored `tasks.md` for the
 *     same execution disagree about which bytes were read. Reported, never
 *     repaired (`FR-KAN-036`).
 *
 * Written to FAIL before `T1752`.
 */
import { describe, expect, it } from 'vitest';
import { TaskBoardService } from '../../../src/modules/task-sync/task-board.service.js';
import {
  InMemoryTaskSyncStore,
  type NewSyncedTask,
  type NewTaskSync,
  type NewTaskSyncLine,
} from '../../../src/modules/task-sync/task-sync.store.js';

const WS = 'ws_a';
const EPIC = 'e_1';

function task(over: Partial<NewSyncedTask> = {}): NewSyncedTask {
  return {
    workspaceId: WS, epicId: EPIC, specificationId: null, taskKey: 'T1',
    description: 'Do the thing', status: 'not_started', statusSource: 'parse',
    engineName: 'claude', engineVersion: '1', sourceLine: 1, sourceDigest: 'abc',
    parallel: false, sourcePaths: [], presentInLatestParse: true,
    lastParsedExecutionId: 'x_1', lastMovedAt: null, lastMovedBy: null, ...over,
  };
}

function sync(over: Partial<NewTaskSync> = {}): NewTaskSync {
  return {
    workspaceId: WS, projectId: 'p_a', epicId: EPIC, executionId: 'x_1', actorId: 'cred_1',
    idempotencyKey: 'k1', tasksDigest: 'abc', linesConsidered: 1, parsed: 1, refused: 0,
    duplicates: 0, added: 1, changed: 0, unchanged: 0, disappeared: 0, outOfBandEdit: false, ...over,
  };
}

function line(over: Partial<NewTaskSyncLine> = {}): NewTaskSyncLine {
  return {
    lineNumber: 1, rawText: '- [ ] T1 Do the thing', outcome: 'parsed', refusalCode: null,
    taskKey: 'T1', changeKind: 'added', previousStatus: null, newStatus: 'not_started', marker: null, ...over,
  };
}

async function seeded(opts: {
  tasks?: NewSyncedTask[];
  sync?: NewTaskSync;
  lines?: NewTaskSyncLine[];
  unmatched?: { executionId: string; taskId: string; occurredAt: string; emittedBy: string }[];
  artifactDigest?: string | null;
} = {}) {
  const store = new InMemoryTaskSyncStore();
  for (const t of opts.tasks ?? [task()]) await store.upsertTask(t);
  await store.recordSync(opts.sync ?? sync(), opts.lines ?? [line()]);
  const service = new TaskBoardService({
    store,
    events: { unmatched: async () => opts.unmatched ?? [] },
    artifacts: { digestForExecution: async () => opts.artifactDigest ?? null },
  });
  return { store, service };
}

describe('T1751 · the five kinds (FR-KAN-024)', () => {
  it('lists a task running ahead of the file', async () => {
    const { service } = await seeded({
      tasks: [task({ status: 'in_progress', statusSource: 'proposal' })],
      lines: [line({ marker: 'aheadOfFile', newStatus: 'in_progress' })],
    });
    const found = await service.disagreements(WS, EPIC);
    expect(found.aheadOfFile).toEqual([{ taskKey: 'T1', status: 'in_progress' }]);
  });

  it('lists a task the latest parse no longer contains', async () => {
    const { service } = await seeded({ tasks: [task({ presentInLatestParse: false })] });
    expect((await service.disagreements(WS, EPIC)).notInLatestParse).toEqual([{ taskKey: 'T1' }]);
  });

  it('lists an unmatched progress report', async () => {
    const report = { executionId: 'x_9', taskId: 'tidy-up', occurredAt: '2026-09-07T10:00:00.000Z', emittedBy: 'cred_1' };
    const { service } = await seeded({ unmatched: [report] });
    expect((await service.disagreements(WS, EPIC)).unmatchedProgress).toEqual([report]);
  });

  it('lists the refused lines of the latest parse', async () => {
    const { service } = await seeded({
      lines: [line(), line({ lineNumber: 2, rawText: '- [ ] Tidy up', outcome: 'refused', refusalCode: 'identifier_not_matched', taskKey: null, changeKind: null, newStatus: null })],
    });
    const found = await service.disagreements(WS, EPIC);
    expect(found.refusedLines).toEqual([{ line: 2, code: 'identifier_not_matched', text: '- [ ] Tidy up' }]);
  });

  it('reports the out-of-band edit', async () => {
    const { service } = await seeded({ sync: sync({ outOfBandEdit: true }) });
    expect((await service.disagreements(WS, EPIC)).outOfBandEdit).toBe(true);
  });
});

describe('T1751 · the digest cross-check (FR-KAN-036)', () => {
  it('reports a mismatch against the artifact version of the same execution', async () => {
    const { service } = await seeded({ artifactDigest: 'a-different-digest' });
    const found = await service.disagreements(WS, EPIC);
    expect(found.digestMismatch).toEqual({ parsed: 'abc', artifact: 'a-different-digest' });
  });

  it('reports nothing when the two agree', async () => {
    const { service } = await seeded({ artifactDigest: 'abc' });
    expect((await service.disagreements(WS, EPIC)).digestMismatch).toBeNull();
  });

  it('reports nothing when the artifact was never synced — absence is not disagreement', async () => {
    const { service } = await seeded({ artifactDigest: null });
    expect((await service.disagreements(WS, EPIC)).digestMismatch).toBeNull();
  });

  it('never repairs either side — it only reports', async () => {
    const { store, service } = await seeded({ artifactDigest: 'a-different-digest' });
    await service.disagreements(WS, EPIC);
    // The parse's digest is untouched: a finding is not a fix.
    expect((await store.latestSyncForEpic(WS, EPIC))?.tasksDigest).toBe('abc');
  });
});

describe('T1751 · a board with nothing to report', () => {
  it('returns every list empty rather than omitting them', async () => {
    const { service } = await seeded();
    const found = await service.disagreements(WS, EPIC);
    expect(found).toEqual({
      aheadOfFile: [],
      notInLatestParse: [],
      unmatchedProgress: [],
      refusedLines: [],
      outOfBandEdit: false,
      digestMismatch: null,
      total: 0,
    });
  });

  it('counts the open disagreements, so the header can state a number', async () => {
    const { service } = await seeded({
      tasks: [task({ status: 'in_progress', statusSource: 'proposal' }), task({ taskKey: 'T2', sourceLine: 2, presentInLatestParse: false })],
      lines: [line({ marker: 'aheadOfFile' }), line({ lineNumber: 2, outcome: 'refused', refusalCode: 'missing_description', taskKey: 'T9', changeKind: null, newStatus: null })],
      unmatched: [{ executionId: 'x_9', taskId: 'tidy-up', occurredAt: '', emittedBy: 'cred_1' }],
      artifactDigest: 'different',
    });
    // ahead 1 + absent 1 + unmatched 1 + refused 1 + out-of-band 0 + digest 1.
    expect((await service.disagreements(WS, EPIC)).total).toBe(5);
  });
});
