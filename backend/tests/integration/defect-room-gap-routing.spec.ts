/**
 * `T998t` (EPIC-035) — a Requirement Gap reaches `EPIC-033` as new intent.
 *
 * `FR-DFR-076`, `SC-DFR-010`, `R-035-4`, `ADR-0016`.
 *
 * ## The two states this file holds apart
 *
 * The task was written when `EPIC-033` had **no inbound route**, and said so:
 * *until it does, this asserts refusal — the item stays visibly unrouted rather
 * than being marked routed to a destination that never received it.*
 *
 * `T338v` has since landed and the route is mounted, so both states are
 * asserted here. **Unbound in a deployment still refuses**, because that is
 * what `SC-DFR-010` measures; and **bound, the gap arrives**, because a
 * refusal nobody can ever lift is a capability that does not exist.
 *
 * The distinction matters more than it looks: "`EPIC-033` has no route" and
 * "this deployment has not wired one" are different facts, and the first stopped
 * being true. A test that only asserted refusal would keep passing after the
 * gap was fixed, and would be read as evidence that it had not been.
 *
 * ## Why the gap is not a Change Request
 *
 * Clarified 2026-08-22. There is **no approved baseline to change**, and that
 * absence is what makes it a gap. Routing it to the Change Room would raise a
 * change against a baseline nobody ever wrote — which reads as a real record
 * and refers to nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  DefectRoutingService,
  type RequirementIntakePort,
} from '../../src/modules/defect-room/routing.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import { IntakeService, defectOriginOf } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

const NOW = new Date('2026-08-31T09:00:00.000Z');
const WS = 'ws_1';
const TEXT = 'notification timing after a payment failure has no approved behaviour at all';

/**
 * `EPIC-033`'s service, bound directly.
 *
 * `gapIntake` answers with candidates, and this Room records **one**
 * `targetRef`. Rather than quietly taking the first, the adapter refuses more
 * than one: `EPIC-033`'s own note says a routed gap is *"one statement of
 * missing behaviour, not a document to be segmented"* and that `SC-DFR-010`
 * counts items rather than candidates. If that ever stops being true, this
 * fails instead of silently dropping the rest.
 */
function joint(): { intake: IntakeService; requirements: InMemoryRequirementRoomStore; port: RequirementIntakePort } {
  const requirements = new InMemoryRequirementRoomStore();
  const intake = new IntakeService(requirements);
  return {
    intake,
    requirements,
    port: {
      async gapIntake(input) {
        const candidates = await intake.gapIntake(input);
        if (candidates.length !== 1) {
          throw new Error(
            `a routed gap is one item; EPIC-033 answered with ${candidates.length} candidates`,
          );
        }
        return { id: candidates[0]!.id };
      },
    },
  };
}

async function room(port: RequirementIntakePort | undefined) {
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: WS,
    projectId: 'pr_1',
    epicId: 'EPIC-999',
    state: 'triaged',
    origin: 'manual-report',
    contestedArtifactRef: 'spec_1',
    contestedArtifactVersion: 'v3',
    severity: 'high',
    reportedBy: 'u_0',
    reportedAt: NOW,
  });
  await store.recordClassification({
    id: 'cl_1',
    workspaceId: WS,
    defectId: 'df_1',
    outcome: 'requirement-gap',
    destination: 'requirement-room',
    approvedBehaviourRef: null,
    absenceRecorded: true,
    classifiedBy: 'u_1',
    classifiedByKind: 'human',
    proposedByAgent: false,
    supersededByClassificationId: null,
    reclassifiedAt: null,
    evaluatedAgainstVersion: null,
    rationale: 'the reader looked and found no approved behaviour for this at all',
    createdAt: NOW,
  });
  await store.recordReproduction({
    id: 'rp_1',
    workspaceId: WS,
    defectId: 'df_1',
    reproducible: 'always',
    environment: 'production, EU region',
    evidenceRefs: ['ev_har_1'],
    affectedBehaviourRef: 'rv_absent',
    notAutomatableReason: null,
    observedAt: NOW,
    createdAt: NOW,
  });
  return { store, subject: new DefectRoutingService(store, { requirementIntake: port }) };
}

const routeGap = (over: Record<string, unknown> = {}) => ({
  workspaceId: WS,
  defectId: 'df_1',
  projectId: 'pr_1',
  roomObjectId: 'ro_1',
  text: TEXT,
  routedBy: 'u_1',
  now: NOW,
  ...over,
});

describe('T998t · with no intake bound, the item stays visibly unrouted', () => {
  it('refuses, naming the Epic that owes the binding', async () => {
    const { subject } = await room(undefined);
    await expect(subject.routeGap(routeGap())).rejects.toThrow(/EPIC-033/);
  });

  it('and records nothing as routed', async () => {
    // `SC-DFR-010`. The alternative is the state where this Room believes the
    // Requirement Room has the gap, the Requirement Room has never seen it, and
    // nobody is looking because the record says it is handled.
    const { store, subject } = await room(undefined);
    await expect(subject.routeGap(routeGap())).rejects.toThrow();
    expect(await store.routingsFor(WS, 'df_1')).toHaveLength(0);
    expect((await store.findDefect(WS, 'df_1'))?.state).toBe('triaged');
  });
});

describe('T998t · bound to EPIC-033, the gap arrives as new intent', () => {
  it('creates a candidate in the Requirement Room', async () => {
    const { requirements, port } = joint();
    const { subject } = await room(port);
    const routing = await subject.routeGap(routeGap());

    const candidate = (await requirements.listCandidates(WS, 'ro_1')).find(
      (row) => row.id === routing.targetRef,
    );
    expect(candidate).toBeTruthy();
    expect(candidate?.normalizedText).toBe(TEXT);
  });

  it('whose origin names the defect it came from', async () => {
    // `FR-DFR-076`. The origin is the reference through which the reproduction
    // context and evidence stay reachable — `EPIC-033` reads it with
    // `defectOriginOf`, which is asserted here rather than reimplemented.
    const { requirements, port } = joint();
    const { subject } = await room(port);
    const routing = await subject.routeGap(routeGap());

    const candidate = (await requirements.listCandidates(WS, 'ro_1')).find(
      (row) => row.id === routing.targetRef,
    );
    expect(defectOriginOf(candidate?.sourceRef ?? '')).toBe('df_1');
  });

  it('as new intent rather than an approved requirement', async () => {
    // `FR-RQR-002` from this side: a candidate is not a requirement until
    // something decides. A gap arriving as settled intent would let a defect
    // report write the specification.
    const { requirements, port } = joint();
    const { subject } = await room(port);
    const routing = await subject.routeGap(routeGap());

    const candidate = (await requirements.listCandidates(WS, 'ro_1')).find(
      (row) => row.id === routing.targetRef,
    );
    expect(candidate?.promotedTo).toBeNull();
  });

  it('and the defect record is retained, marked routed, never deleted', async () => {
    // `ADR-0016`. The defect is where the reproduction and the evidence live,
    // and deleting it would take the gap's own supporting record with it.
    const { port } = joint();
    const { store: defects, subject } = await room(port);
    await subject.routeGap(routeGap());

    const defect = await defects.findDefect(WS, 'df_1');
    expect(defect).not.toBeNull();
    expect(defect?.state).toBe('routed');
    expect(await defects.reproductionsFor(WS, 'df_1')).toHaveLength(1);
  });

  it('carrying its evidence by reference on the routing record', async () => {
    const { port } = joint();
    const { subject } = await room(port);
    const routing = await subject.routeGap(routeGap());
    expect(routing.carriedEvidenceRefs).toEqual(['ev_har_1']);
  });

  it('and the routing says why it left', async () => {
    // The same rule as a transfer offer, one Room over: a routing that could
    // not say why it happened is `UX-0034`'s unexplained button.
    const { port } = joint();
    const { subject } = await room(port);
    const routing = await subject.routeGap(routeGap());
    expect(routing.offeredReason).toMatch(/no approved behaviour/i);
    expect(routing.destination).toBe('requirement-room');
  });
});

describe('T998t · and EPIC-033 refuses an incomplete gap rather than dropping it', () => {
  it('a gap naming no room object is refused by the Requirement Room', async () => {
    // `EPIC-033`'s `assertGapComplete` — asserted against its real service, not
    // a copy of the rule. An empty success there would be exactly the state
    // `SC-DFR-010` forbids: this Epic marks the defect reclassified, nothing is
    // recorded there, and the item is gone with both Epics believing the other
    // has it.
    const { port } = joint();
    const { store, subject } = await room(port);
    await expect(subject.routeGap(routeGap({ roomObjectId: '' }))).rejects.toThrow(
      /EPIC-035 FR-DFR-076|requires/,
    );
    expect(await store.routingsFor(WS, 'df_1')).toHaveLength(0);
    expect((await store.findDefect(WS, 'df_1'))?.state).toBe('triaged');
  });
});
