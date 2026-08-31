/**
 * `T998s` (EPIC-035) — the transfer round trip, against `EPIC-034` itself.
 *
 * `FR-DFR-071`, `FR-DFR-074`, jointly with `EPIC-034`'s `FR-CHR-012`. This is
 * the exercise `EPIC-034`'s `T995u` and `T1219` were waiting on: that Epic
 * proved its own half in `T994x` — fourteen tests, including a refusal carrying
 * `returnTo: EPIC-035` — and could not prove the other side, because no Defect
 * Room existed to send anything.
 *
 * ## What only a joint test can catch
 *
 * Two Epics agreeing about a handover in prose, and disagreeing in code. Both
 * halves pass their own tests: this Room believes it sent a transfer, and the
 * Change Room believes it was never called. Nothing fails until somebody wires
 * them together, and by then the two shapes have been "obviously right" for
 * months.
 *
 * So the real `ChangeIntakeService` is bound as the `ChangeIntakePort` — no
 * stub, no adapter reshaping fields. If the payload names drift, this file
 * stops compiling.
 */
import { describe, expect, it } from 'vitest';
import {
  DefectRoutingService,
  type ChangeIntakePort,
} from '../../src/modules/defect-room/routing.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import { ChangeIntakeService } from '../../src/modules/change-room/intake.service.js';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';

const NOW = new Date('2026-08-31T09:00:00.000Z');
const WS = 'ws_1';

/**
 * `EPIC-034`'s service, bound directly.
 *
 * The only adaptation is dropping the returned `ChangeRequestRow` to the `id`
 * this Room records as `targetRef` — a widening, not a reshaping. Everything
 * going the other way is passed through untouched, which is the point.
 */
function joint(): { intake: ChangeIntakeService; changes: InMemoryChangeRoomStore; port: ChangeIntakePort } {
  const changes = new InMemoryChangeRoomStore();
  const intake = new ChangeIntakeService(changes);
  return {
    intake,
    changes,
    port: { fromDefectTransfer: (input) => intake.fromDefectTransfer(input) },
  };
}

async function room(port: ChangeIntakePort) {
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: WS,
    projectId: 'pr_1',
    epicId: 'EPIC-999',
    state: 'triaged',
    origin: 'manual-report',
    contestedArtifactRef: 'b_1',
    contestedArtifactVersion: 'v3',
    severity: 'high',
    reportedBy: 'u_0',
    reportedAt: NOW,
  });
  await store.recordClassification({
    id: 'cl_1',
    workspaceId: WS,
    defectId: 'df_1',
    outcome: 'change-request',
    destination: 'change-room',
    approvedBehaviourRef: 'rv_1',
    absenceRecorded: false,
    classifiedBy: 'u_1',
    classifiedByKind: 'human',
    proposedByAgent: false,
    supersededByClassificationId: null,
    reclassifiedAt: null,
    evaluatedAgainstVersion: null,
    rationale: 'the system does what the baseline says; the reporter wants the baseline changed',
    createdAt: NOW,
  });
  await store.recordReproduction({
    id: 'rp_1',
    workspaceId: WS,
    defectId: 'df_1',
    reproducible: 'always',
    environment: 'production, EU region',
    evidenceRefs: ['ev_har_1'],
    affectedBehaviourRef: 'rv_1',
    notAutomatableReason: null,
    observedAt: NOW,
    createdAt: NOW,
  });
  return { store, subject: new DefectRoutingService(store, { changeIntake: port }) };
}

const offer = {
  workspaceId: WS,
  defectId: 'df_1',
  offeredReason: 'the baseline says one hour and the system sends at one hour; you want thirty minutes',
  offeredBy: 'u_1',
  evidenceRefs: ['ev_har_1'],
  now: NOW,
};

const delivery = (over: Record<string, unknown> = {}) => ({
  workspaceId: WS,
  defectId: 'df_1',
  projectId: 'pr_1',
  roomObjectId: 'ro_1',
  targetBaselineId: 'b_1',
  targetBaselineVersion: 2,
  requestedOutcome: 'notify within thirty minutes',
  requester: 'u_1',
  now: NOW,
  ...over,
});

describe('T998s · the item arrives in the Change Room, carrying where it came from', () => {
  it('creates a real Change Request', async () => {
    const { changes, port } = joint();
    const { subject } = await room(port);
    await subject.offerTransfer(offer);
    const routing = await subject.deliverTransfer(delivery());

    const created = await changes.findById(WS, routing.targetRef!);
    expect(created).not.toBeNull();
    expect(created?.requestedOutcome).toBe('notify within thirty minutes');
  });

  it('whose origin names the defect — FR-CHR-012 from this side', async () => {
    // `FR-DFR-071`: the origin MUST be visible from the resulting Change
    // Request. `EPIC-034` refuses a `defect-transfer` that names no defect, and
    // this is the assertion that the two rules are the same rule.
    const { changes, port } = joint();
    const { subject } = await room(port);
    await subject.offerTransfer(offer);
    const routing = await subject.deliverTransfer(delivery());

    const created = await changes.findById(WS, routing.targetRef!);
    expect(created?.origin).toBe('defect-transfer');
    expect(created?.originDefectRef).toBe('df_1');
  });

  it('and carries evidence and context by reference, not by copy', async () => {
    // `FR-DFR-071`, `R-034-6`. The reproduction stays in this Epic; the Change
    // Room holds the ids through which it is reached. A copied attestation is a
    // second artifact with the same digest and a different id.
    const { changes, port } = joint();
    const { subject } = await room(port);
    await subject.offerTransfer(offer);
    const routing = await subject.deliverTransfer(delivery());

    // `EPIC-034` stores them under `transferred*` — the input names and the
    // column names differ, and asserting the input's names against the stored
    // row is how a test claims a preservation nobody performed.
    const created = await changes.findById(WS, routing.targetRef!);
    expect(created?.transferredEvidenceRefs).toEqual(['ev_har_1']);
    expect(created?.transferredContextRefs).toContain('df_1');
    expect(created?.transferredContextRefs).toContain('rp_1');
  });

  it('and the reason defaults to the reason the transfer was offered for', async () => {
    // One fact, stated once. A second field restating why would be the place
    // the two versions come to disagree.
    const { changes, port } = joint();
    const { subject } = await room(port);
    await subject.offerTransfer(offer);
    const routing = await subject.deliverTransfer(delivery());

    const created = await changes.findById(WS, routing.targetRef!);
    expect(created?.reason).toMatch(/thirty minutes/);
  });

  it('and this Room records the reference the Change Room gave back', async () => {
    // `SC-DFR-010`. Not "we sent it" — the identifier of the thing that now
    // exists somewhere else.
    const { port } = joint();
    const { store: defects, subject } = await room(port);
    await subject.offerTransfer(offer);
    const routing = await subject.deliverTransfer(delivery());

    const [row] = await defects.routingsFor(WS, 'df_1');
    expect(row?.state).toBe('accepted');
    expect(row?.targetRef).toBe(routing.targetRef);
    expect((await defects.findDefect(WS, 'df_1'))?.state).toBe('routed');
  });
});

describe('T998s · and when the Change Room refuses, the item comes back', () => {
  it('the refusal is recorded here, with its detail', async () => {
    // `FR-DFR-074`. `EPIC-034` refuses a change with no requested outcome
    // (`BR-0043`) and re-throws it as a `TransferRefusedError` so it returns.
    const { port } = joint();
    const { store, subject } = await room(port);
    await subject.offerTransfer(offer);

    await expect(subject.deliverTransfer(delivery({ requestedOutcome: '  ' }))).rejects.toThrow(
      /refused/i,
    );

    const [row] = await store.routingsFor(WS, 'df_1');
    expect(row?.state).toBe('refused');
    expect(row?.refusalDetail).toMatch(/requestedOutcome/);
  });

  it('the defect is not marked routed, and nothing was created', async () => {
    // The state this requirement exists to prevent: the defect saying somebody
    // else has it while nobody does.
    const { changes, port } = joint();
    const { store, subject } = await room(port);
    await subject.offerTransfer(offer);
    await expect(subject.deliverTransfer(delivery({ requestedOutcome: '  ' }))).rejects.toThrow();

    expect((await store.findDefect(WS, 'df_1'))?.state).toBe('triaged');
    expect(await changes.listForBaseline(WS, 'b_1')).toHaveLength(0);
  });

  it('and EPIC-034’s refusal says to return it here', async () => {
    // The other half of the contract, asserted against `EPIC-034`'s own error
    // rather than against a copy of it: `TransferRefusedError` carries
    // `returnTo: 'EPIC-035'` and the defect id precisely so a refusal knows
    // where to go back to.
    const { intake } = joint();
    const error = await intake
      .fromDefectTransfer({
        workspaceId: WS,
        projectId: 'pr_1',
        roomObjectId: 'ro_1',
        targetBaselineId: 'b_1',
        targetBaselineVersion: 2,
        requestedOutcome: '  ',
        reason: 'because',
        requester: 'u_1',
        originDefectRef: 'df_1',
        evidenceRefs: [],
        contextRefs: [],
      })
      .then(() => null)
      .catch((e: unknown) => e as { details?: Record<string, unknown> });

    expect(error?.details?.['returnTo']).toBe('EPIC-035');
    expect(error?.details?.['originDefectRef']).toBe('df_1');
  });

  it('and a refusal returned out of band lands on the same routing row', async () => {
    // `POST /rooms/defect/:id/transfer-return`. The Change Room can refuse a
    // transfer this Room did not deliver in-process — the refusal still has to
    // land somewhere, and `returnTo` is what tells it where.
    const { port } = joint();
    const { store, subject } = await room(port);
    const routing = await subject.offerTransfer(offer);
    await subject.recordReturn({
      workspaceId: WS,
      defectId: 'df_1',
      routingId: routing.id,
      refusalDetail: 'the Change Room refused: no approved baseline at that version',
      returnedBy: 'u_2',
    });

    const [row] = await store.routingsFor(WS, 'df_1');
    expect(row?.state).toBe('returned');
    expect(row?.offeredReason).toMatch(/thirty minutes/);
    expect(row?.refusalDetail).toMatch(/no approved baseline/);
  });
});
