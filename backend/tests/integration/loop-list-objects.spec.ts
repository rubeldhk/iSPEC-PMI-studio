/**
 * `T1176`, `T1177` (EPIC-030) — `X20`: the loop can list a workspace's objects.
 *
 * `LoopStore` had `createObject` and `findObject` and nothing else, so the only
 * way to reach an object was to already know its id. `EPIC-033`'s Rooms index
 * needs *"the `requirement-room` objects in this workspace, with their stage"*,
 * and there was no capability to consume — recorded as `X20` when Phase 9 was
 * drafted rather than worked around.
 *
 * ## Why it is not built from the Room's own tables
 *
 * `requirement_candidates.roomObjectId` would give a list of Rooms that already
 * have candidates. It would miss a Room that was just opened, and its stage
 * would have to come from somewhere other than the loop — a Room-local
 * translation of loop progress, which `FR-RQR-074` forbids in as many words.
 *
 * ## The scope rule is the point
 *
 * A list is the one read where forgetting the workspace filter returns *more*
 * rather than failing. `DEF-030-003` found three read routes that took an object
 * id and no workspace; this one is written with the filter in the store, not
 * applied afterwards by the caller.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryLoopStore } from '../../src/modules/loop/loop.store.js';
import { LoopService } from '../../src/modules/loop/loop.service.js';
import { LoopConfigRegistry } from '../../src/modules/loop/config-registry.js';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { LOOP_STAGES } from '@pmi/loop-contract';
import { authoritiesOf, directoryOf } from '../helpers/loop-principals.js';

const WS = 'ws_list';
const OTHER = 'ws_list_other';

const ACTORS = {
  u_here: { workspaceId: WS, authorities: ['analyst'] },
  u_there: { workspaceId: OTHER, authorities: ['analyst'] },
} as const;

const HERE = { workspaceId: WS, userId: 'u_here' };
const THERE = { workspaceId: OTHER, userId: 'u_there' };

const registeredStages = new StageRegistry(
  LOOP_STAGES.map((stage) => ({ stage }) as never),
).registeredStages;

const config = (workflowType: string, stages: readonly string[]) =>
  loadLoopConfig(
    {
      schemaVersion: 1,
      workflowType,
      stages,
      transitions: stages.slice(0, -1).map((from, i) => ({
        from,
        to: stages[i + 1],
        requiredGates: [],
        trigger: null,
      })),
      approvedBy: 'test',
      approvalRef: 'T1176',
    } as never,
    { registeredStages },
  );

const ROOM = config('requirement-room', ['Event', 'Context', 'Analyze', 'Decide', 'Evidence', 'Outcome']);
const CHANGE = config('change-room', ['Event', 'Context', 'Execute', 'Verify', 'Outcome']);

function engine(): LoopService {
  return new LoopService(
    new InMemoryLoopStore(),
    new LoopConfigRegistry([ROOM, CHANGE]),
    { 'Event->Context': ['analyst'] },
    undefined,
    directoryOf(ACTORS),
    authoritiesOf(ACTORS),
  );
}

const declare = (loop: LoopService, principal: typeof HERE, workflowType: string, subjectId: string) =>
  loop.declareObject(principal, {
    projectId: 'pr_list',
    workflowType,
    subjectType: 'requirement-set',
    subjectId,
  });

describe('T1176 · listObjects returns this workspace’s objects of one type', () => {
  it('lists what was declared, with the stage the loop holds', async () => {
    const loop = engine();
    await declare(loop, HERE, 'requirement-room', 'sub_a');
    await declare(loop, HERE, 'requirement-room', 'sub_b');

    const rows = await loop.listObjects(HERE, 'requirement-room');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.subjectId).sort()).toEqual(['sub_a', 'sub_b']);
    // The stage comes from the loop's own row — the Rooms index renders it
    // rather than deriving one (`FR-RQR-074`).
    expect(rows.every((r) => r.currentStage === 'Event')).toBe(true);
  });

  it('filters by workflow type — one Room’s index does not list another’s', async () => {
    const loop = engine();
    await declare(loop, HERE, 'requirement-room', 'sub_room');
    await declare(loop, HERE, 'change-room', 'sub_change');

    const rooms = await loop.listObjects(HERE, 'requirement-room');
    expect(rooms.map((r) => r.subjectId)).toEqual(['sub_room']);

    // The control: the other type is really there, so the filter is doing the
    // work rather than the store being empty.
    const changes = await loop.listObjects(HERE, 'change-room');
    expect(changes.map((r) => r.subjectId)).toEqual(['sub_change']);
  });

  it('NEVER returns another workspace’s objects', async () => {
    // The assertion this whole capability is riskiest for. A list is the one
    // read where a forgotten filter returns more rather than failing.
    const loop = engine();
    await declare(loop, HERE, 'requirement-room', 'sub_mine');
    await declare(loop, THERE, 'requirement-room', 'sub_theirs');

    const mine = await loop.listObjects(HERE, 'requirement-room');
    expect(mine.map((r) => r.subjectId)).toEqual(['sub_mine']);

    const theirs = await loop.listObjects(THERE, 'requirement-room');
    expect(theirs.map((r) => r.subjectId)).toEqual(['sub_theirs']);

    // Neither list contains the other's object, asserted both ways so a store
    // that returned everything could not satisfy one of them by luck.
    expect(mine.some((r) => r.workspaceId === OTHER)).toBe(false);
    expect(theirs.some((r) => r.workspaceId === WS)).toBe(false);
  });

  it('takes the workspace from the resolved principal, not from an argument', async () => {
    // There is no workspace parameter to pass. `DEF-030-003`'s lesson, applied
    // at the point the capability is created rather than after.
    const loop = engine();
    await declare(loop, HERE, 'requirement-room', 'sub_x');
    const signature = loop.listObjects.length;
    expect(signature, 'listObjects accepts more than (principal, workflowType)').toBe(2);
  });

  it('refuses a caller with no session', async () => {
    const loop = engine();
    await expect(
      loop.listObjects({ workspaceId: '', userId: '' }, 'requirement-room'),
    ).rejects.toThrow();
  });

  it('refuses a principal the directory does not know', async () => {
    const loop = engine();
    await expect(
      loop.listObjects({ workspaceId: WS, userId: 'u_ghost' }, 'requirement-room'),
    ).rejects.toThrow();
  });

  it('returns an empty list for a workspace with nothing, not an error', async () => {
    // Empty is a real answer here, unlike `history`, where an absent object and
    // an object with no transitions are different facts. A workspace with no
    // Rooms genuinely has none.
    const loop = engine();
    const rows = await loop.listObjects(HERE, 'requirement-room');
    expect(rows).toEqual([]);
  });

  it('refuses a workflow type the registry does not declare', async () => {
    // Otherwise a caller could enumerate by guessing type names and learn from
    // the empty/non-empty answer which types exist.
    const loop = engine();
    await expect(loop.listObjects(HERE, 'not-a-workflow')).rejects.toThrow();
  });

  it('orders newest first, so an index does not reshuffle between loads', async () => {
    const loop = engine();
    await declare(loop, HERE, 'requirement-room', 'sub_1');
    await declare(loop, HERE, 'requirement-room', 'sub_2');
    await declare(loop, HERE, 'requirement-room', 'sub_3');
    const rows = await loop.listObjects(HERE, 'requirement-room');
    const times = rows.map((r) => r.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});
