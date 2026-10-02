/**
 * `T403v` — three distinct workflow types over one engine. `FR-RQR-001`,
 * `ADR-0018`.
 *
 * A Requirement Room object must not be advanceable through another Room's
 * stages. `ADR-0018`'s one decided constraint is that the three Rooms are
 * distinct **types**, not variants of a shared one — and the engine enforces
 * that by resolving configuration from the **object's** type rather than from
 * anything the caller says (`FR-GEL-004`).
 *
 * The tempting way to test this is to assert the two configurations differ.
 * That proves the files differ, not that the engine keeps them apart. So these
 * declare a real object of one type and try to move it along the other's path.
 *
 * Since `T1156` the caller is resolved, so this also runs against a directory —
 * which is what makes the refusals below about the *type* rather than about an
 * unauthenticated request.
 */
import { describe, expect, it } from 'vitest';
import { LoopService } from '../../src/modules/loop/loop.service.js';
import { LoopConfigRegistry } from '../../src/modules/loop/config-registry.js';
import { InMemoryLoopStore } from '../../src/modules/loop/loop.store.js';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { LOOP_STAGES } from '@pmi/loop-contract';
import { authoritiesOf, directoryOf } from '../helpers/loop-principals.js';

const WS = 'ws_iso';
const ACTORS = { u_iso: { workspaceId: WS, authorities: ['analyst', 'lead'] } } as const;
const ACTING = { workspaceId: WS, userId: 'u_iso' };

const registeredStages = new StageRegistry(
  LOOP_STAGES.map((stage) => ({ stage }) as never),
).registeredStages;

/** The Requirement Room's shape: it has no Execute stage. */
const REQUIREMENT_ROOM = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'requirement-room',
    stages: ['Event', 'Context', 'Analyze', 'Decide', 'Evidence', 'Outcome'],
    transitions: [
      { from: 'Event', to: 'Context', requiredGates: [], trigger: null },
      { from: 'Context', to: 'Analyze', requiredGates: [], trigger: null },
      { from: 'Analyze', to: 'Decide', requiredGates: [], trigger: null },
      { from: 'Decide', to: 'Evidence', requiredGates: [], trigger: null },
      { from: 'Evidence', to: 'Outcome', requiredGates: [], trigger: null },
    ],
    approvedBy: 'test',
    approvalRef: 'T403v',
  } as never,
  { registeredStages },
);

/** A second Room's shape, with a stage and a path the first does not have. */
const CHANGE_ROOM = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'change-room',
    stages: ['Event', 'Context', 'Execute', 'Verify', 'Outcome'],
    transitions: [
      { from: 'Event', to: 'Context', requiredGates: [], trigger: null },
      { from: 'Context', to: 'Execute', requiredGates: [], trigger: null },
      { from: 'Execute', to: 'Verify', requiredGates: [], trigger: null },
      { from: 'Verify', to: 'Outcome', requiredGates: [], trigger: null },
    ],
    approvedBy: 'test',
    approvalRef: 'T403v',
  } as never,
  { registeredStages },
);

/** Both transitions authorised, so a refusal below is never about authority. */
const AUTHORITIES = {
  'Event->Context': ['analyst'],
  'Context->Analyze': ['analyst'],
  'Context->Execute': ['analyst'],
  'Analyze->Decide': ['lead'],
};

function engine(): LoopService {
  return new LoopService(
    new InMemoryLoopStore(),
    new LoopConfigRegistry([REQUIREMENT_ROOM, CHANGE_ROOM]),
    AUTHORITIES,
    undefined,
    directoryOf(ACTORS),
    authoritiesOf(ACTORS),
  );
}

const declare = (loop: LoopService, workflowType: string) =>
  loop.declareObject(ACTING, {
    projectId: 'pr_iso',
    workflowType,
    subjectType: 'specification',
    subjectId: 'spec_iso',
  });

describe('T403v · FR-RQR-001 — a Room object runs its own type’s stages, and no other’s', () => {
  it('advances along its OWN path', async () => {
    // The control. Every refusal below is only meaningful because this passes:
    // the engine can move a Requirement Room object when the move is its own.
    const loop = engine();
    const ref = await declare(loop, 'requirement-room');
    const moved = await loop.transition(ACTING, {
      objectId: ref.objectId,
      toStage: 'Context',
      expectedVersion: 0,
    });
    expect(moved.outcome).toBe('accepted');
  });

  it('refuses a stage the other Room has and this one does not', async () => {
    const loop = engine();
    const ref = await declare(loop, 'requirement-room');
    await loop.transition(ACTING, { objectId: ref.objectId, toStage: 'Context', expectedVersion: 0 });

    // `Context->Execute` is a real transition — in the Change Room. Authorised,
    // too. The only thing wrong with it is the object's type.
    const refused = await loop.transition(ACTING, {
      objectId: ref.objectId,
      toStage: 'Execute',
      expectedVersion: 1,
    });
    expect(refused.outcome).toBe('refused');
    expect(String(refused.detail)).toMatch(/requirement-room/);
  });

  it('names the workflow type in the refusal, so the reason is legible', async () => {
    const loop = engine();
    const ref = await declare(loop, 'requirement-room');
    const refused = await loop.transition(ACTING, {
      objectId: ref.objectId,
      toStage: 'Verify',
      expectedVersion: 0,
    });
    // "not declared by workflow type X" rather than a bare "no". A refusal that
    // does not say which rule refused sends the reader to the source.
    expect(String(refused.detail)).toMatch(/not declared by workflow type/i);
  });

  it('the other type advances along ITS path — the two are not both broken', async () => {
    // Anti-vacuity: without this, an engine that refused every transition would
    // pass every assertion above.
    const loop = engine();
    const ref = await declare(loop, 'change-room');
    await loop.transition(ACTING, { objectId: ref.objectId, toStage: 'Context', expectedVersion: 0 });
    const moved = await loop.transition(ACTING, {
      objectId: ref.objectId,
      toStage: 'Execute',
      expectedVersion: 1,
    });
    expect(moved.outcome).toBe('accepted');
  });

  it.each(['Execute', 'Verify'] as const)(
    '`%s` renders as OMITTED, not absent (T405i)',
    async (stage) => {
      // `FR-GEL-008`, `R-033-6`. Both stages, because the Requirement Room omits
      // both and a test naming only one would pass a projection that dropped the
      // other. A reader comparing two Rooms must see that this workflow has no
      // Execute stage — not wonder where the row went.
      const loop = engine();
      const ref = await declare(loop, 'requirement-room');
      const progress = await loop.progressOf(ACTING, ref.objectId);
      const row = progress.find((r) => r.stage === stage);
      expect(row, `${stage} vanished instead of being marked omitted`).toBeDefined();
      expect(row?.omitted).toBe(true);
      // An omitted stage is `pending` forever — `FR-GEL-008` keeps *omitted* and
      // *how far has this got* as two facts rather than one.
      expect(row?.status).toBe('pending');
    },
  );

  it('the object’s own stages are NOT omitted — or the flag means nothing', async () => {
    const loop = engine();
    const ref = await declare(loop, 'requirement-room');
    const progress = await loop.progressOf(ACTING, ref.objectId);
    const analyze = progress.find((row) => row.stage === 'Analyze');
    expect(analyze?.omitted).toBe(false);
  });

  it('the caller cannot name the configuration — only the object carries it', async () => {
    // `FR-GEL-004`: "a caller naming a workflow type is a caller choosing its
    // own rules". `TransitionInput` has no workflow field at all, so this
    // asserts the absence a JavaScript caller would try to exploit.
    const loop = engine();
    const ref = await declare(loop, 'requirement-room');
    const refused = await loop.transition(ACTING, {
      objectId: ref.objectId,
      toStage: 'Execute',
      expectedVersion: 0,
      workflowType: 'change-room',
    } as never);
    expect(refused.outcome).toBe('refused');
  });
});
