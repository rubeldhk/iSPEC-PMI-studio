/**
 * `T1730` (EPIC-046, `FR-KAN-055` to `FR-KAN-058`, `SC-KAN-009`) — progress.
 *
 * ## Why this could not stay in EPIC-012's aggregate unchanged
 *
 * `progressForProject` finds tasks **through specifications**. `Q1` made a
 * synced task's specification optional — its home is its Epic — so that query
 * misses every task of an Epic whose `spec.md` has not synced, and the
 * percentage is wrong in a way nobody looking at it can see.
 *
 * So the source widens and the **derivation stays single** (`FR-KAN-056`): one
 * function counts, and every surface calls it. Two functions that agree today
 * are two functions that can disagree tomorrow.
 *
 * ## The denominator is the argument
 *
 * `FR-KAN-058`. A task the latest parse no longer contains is kept and marked,
 * but counting it would make a completed Epic read as incomplete forever. It is
 * excluded, and the exclusion is stated wherever progress is shown.
 *
 * Written to FAIL before `T1731`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { computeProgress, TaskProgressService } from '../../../src/modules/task-sync/task-progress.service.js';
import { InMemoryTaskSyncStore, type NewSyncedTask, type TaskStatusValue } from '../../../src/modules/task-sync/task-sync.store.js';

const WS = 'ws_a';

function task(over: Partial<NewSyncedTask> = {}): NewSyncedTask {
  return {
    workspaceId: WS,
    epicId: 'e_1',
    specificationId: null,
    taskKey: 'T1',
    description: 'Do the thing',
    status: 'not_started',
    statusSource: 'parse',
    engineName: 'claude',
    engineVersion: '1.2.3',
    sourceLine: 1,
    sourceDigest: 'abc',
    parallel: false,
    sourcePaths: [],
    presentInLatestParse: true,
    lastParsedExecutionId: 'x_1',
    lastMovedAt: null,
    lastMovedBy: null,
    ...over,
  };
}

function rows(statuses: TaskStatusValue[], over: Partial<NewSyncedTask> = {}): NewSyncedTask[] {
  return statuses.map((status, i) => task({ taskKey: `T${i + 1}`, sourceLine: i + 1, status, ...over }));
}

async function harness(seed: NewSyncedTask[], epicIds: string[] = ['e_1'], legacy: { id: string; status: TaskStatusValue }[] = []) {
  const store = new InMemoryTaskSyncStore();
  for (const t of seed) await store.upsertTask(t);
  const service = new TaskProgressService({
    store,
    epics: { idsForProject: vi.fn(async () => epicIds) },
    // EPIC-012's specification-scoped rows — the tasks a generation produced,
    // which have no Epic and must still be counted in the project figure.
    legacy: { listForProject: vi.fn(async () => legacy) },
  });
  return { store, service };
}

describe('T1730 · the shape of a progress reading (FR-KAN-055)', () => {
  it('counts all four statuses and a whole-number percentage', () => {
    const progress = computeProgress([
      { id: '1', status: 'done', presentInLatestParse: true },
      { id: '2', status: 'done', presentInLatestParse: true },
      { id: '3', status: 'in_progress', presentInLatestParse: true },
      { id: '4', status: 'blocked', presentInLatestParse: true },
      { id: '5', status: 'not_started', presentInLatestParse: true },
    ]);
    expect(progress).toEqual({ total: 5, done: 2, inProgress: 1, notStarted: 1, blocked: 1, percentComplete: 40 });
  });

  it('reads 0 for an empty set — never absent, never NaN (FR-KAN-057)', () => {
    expect(computeProgress([])).toEqual({ total: 0, done: 0, inProgress: 0, notStarted: 0, blocked: 0, percentComplete: 0 });
  });

  it('rounds rather than truncating, so 1 of 3 is 33 and 2 of 3 is 67', () => {
    expect(computeProgress(rows(['done', 'not_started', 'not_started']).map((t, i) => ({ id: String(i), status: t.status, presentInLatestParse: true }))).percentComplete).toBe(33);
    expect(computeProgress(rows(['done', 'done', 'not_started']).map((t, i) => ({ id: String(i), status: t.status, presentInLatestParse: true }))).percentComplete).toBe(67);
  });

  it('excludes a task the latest parse no longer contains (FR-KAN-058)', () => {
    const progress = computeProgress([
      { id: '1', status: 'done', presentInLatestParse: true },
      { id: '2', status: 'not_started', presentInLatestParse: false },
    ]);
    // Counting it would leave a finished Epic reading 50% forever.
    expect(progress).toMatchObject({ total: 1, done: 1, percentComplete: 100 });
  });

  it('counts each task once, however many times it is supplied', () => {
    const duplicated = [
      { id: '1', status: 'done' as const, presentInLatestParse: true },
      { id: '1', status: 'done' as const, presentInLatestParse: true },
    ];
    expect(computeProgress(duplicated).total).toBe(1);
  });
});

describe('T1730 · per Epic (FR-KAN-055)', () => {
  it('counts only that Epic and reads 0 for an Epic with no tasks', async () => {
    const h = await harness([...rows(['done', 'done', 'not_started']), ...rows(['done'], { epicId: 'e_2', taskKey: 'T9' })]);
    expect(await h.service.forEpic(WS, 'e_1')).toMatchObject({ total: 3, done: 2, percentComplete: 67 });
    expect(await h.service.forEpic(WS, 'e_empty')).toMatchObject({ total: 0, percentComplete: 0 });
  });

  it('counts blocked separately from not started', async () => {
    const h = await harness(rows(['blocked', 'not_started', 'done']));
    expect(await h.service.forEpic(WS, 'e_1')).toMatchObject({ blocked: 1, notStarted: 1, done: 1 });
  });
});

describe('T1730 · per project (FR-KAN-057, SC-KAN-009)', () => {
  it('aggregates across the Epics of the project', async () => {
    const h = await harness(
      [
        ...rows(['done', 'done', 'done', 'done', 'not_started', 'not_started', 'not_started', 'not_started', 'not_started', 'not_started']),
        ...rows(['done', 'done', 'done', 'done', 'done'], { epicId: 'e_2' }).map((t, i) => ({ ...t, taskKey: `E2T${i}` })),
      ],
      ['e_1', 'e_2'],
    );
    expect(await h.service.forEpic(WS, 'e_1')).toMatchObject({ percentComplete: 40 });
    expect(await h.service.forEpic(WS, 'e_2')).toMatchObject({ percentComplete: 100 });
    // 9 of 15 — the figure every surface must show (SC-KAN-009).
    expect(await h.service.forProject(WS, 'p_a')).toMatchObject({ total: 15, done: 9, percentComplete: 60 });
  });

  it('includes tasks with no Epic — the generated ones EPIC-012 owns', async () => {
    const h = await harness(rows(['done']), ['e_1'], [{ id: 'legacy_1', status: 'not_started' }]);
    // The Epic reads 100%; the project does not, because it has one more task.
    expect(await h.service.forEpic(WS, 'e_1')).toMatchObject({ percentComplete: 100 });
    expect(await h.service.forProject(WS, 'p_a')).toMatchObject({ total: 2, done: 1, percentComplete: 50 });
  });

  it('reads 0 for a project with no tasks at all', async () => {
    const h = await harness([], []);
    expect(await h.service.forProject(WS, 'p_a')).toEqual({ total: 0, done: 0, inProgress: 0, notStarted: 0, blocked: 0, percentComplete: 0 });
  });

  it('counts a task once even when it has both an Epic and a specification', async () => {
    // The overlap is real: a synced task whose Epic has a specification-by-sync
    // is reachable from both sides, and counting it twice would understate the
    // percentage of every project that has one.
    const store = new InMemoryTaskSyncStore();
    for (const t of rows(['done'], { specificationId: 's_1' })) await store.upsertTask(t);
    const [only] = await store.tasksForEpic(WS, 'e_1');
    // The SAME row, reached the other way: EPIC-012's specification-scoped read
    // returns it too, because the Epic has a specification-by-sync.
    const service = new TaskProgressService({
      store,
      epics: { idsForProject: vi.fn(async () => ['e_1']) },
      legacy: { listForProject: vi.fn(async () => [{ id: only?.id ?? '', status: 'done' as const }]) },
    });
    expect(await service.forProject(WS, 'p_a')).toMatchObject({ total: 1, done: 1, percentComplete: 100 });
  });
});

describe('T1730 · one derivation for every surface (FR-KAN-056)', () => {
  it('the Epic reading and the project reading of a single-Epic project agree', async () => {
    const h = await harness(rows(['done', 'not_started', 'blocked', 'in_progress']));
    expect(await h.service.forProject(WS, 'p_a')).toEqual(await h.service.forEpic(WS, 'e_1'));
  });
});


/**
 * `T1781` (EPIC-046, `FR-KAN-057`) — the second source is actually connected.
 *
 * `T1731` declared `LegacyTaskSource` and left the factory building the service
 * without it, with a comment saying so: *their absence understates nothing for a
 * project whose tasks all came from a sync*. True — and not every project. The
 * convergence pass found a project holding `EPIC-012`-generated tasks with no
 * Epic reading them as absent from its own percentage.
 *
 * The unit tests above prove the service counts a legacy row when it is given
 * one. Only this proves it is ever given one, which is the part that was wrong.
 * A source scan rather than a container test, for the reason the module's other
 * boundary checks are source scans: it fails on the line that would reintroduce
 * the bug, and names it.
 */
describe('T1781 · the legacy source is wired, not merely declared (FR-KAN-057)', () => {
  const moduleSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/modules/task-sync/task-sync.module.ts'),
    'utf8',
  );

  it('constructs TaskProgressService with a legacy source', () => {
    expect(moduleSource).toMatch(/new TaskProgressService\(\{[^}]*legacy[^}]*\}\)/);
  });

  it('reads the real table when a database is configured, and empties otherwise', () => {
    // The `T1330` posture: a durable store is chosen in the factory body from
    // `DATABASE_URL`, never assumed. An in-memory default in a deployment would
    // silently understate every project's percentage.
    expect(moduleSource).toContain('PrismaLegacyTaskReader');
    expect(moduleSource).toContain('EmptyLegacyTaskReader');
  });

  it('no longer claims the source is unwired', () => {
    // The comment that documented the gap must not outlive it: a reader who
    // trusts it would go looking for a bug that is fixed.
    expect(moduleSource).not.toMatch(/are NOT\s+\/\/?\s*wired here yet/i);
    expect(moduleSource).not.toContain('rows are NOT');
  });
});
