/**
 * `T998q` (EPIC-035) — what happens to an offer, and what a change may not
 * become.
 *
 * `FR-DFR-073`, `FR-DFR-074`, `FR-DFR-075`, `FR-DFR-076`, `SC-DFR-003`,
 * `SC-DFR-010`.
 *
 * ## Both halves of a decline
 *
 * `FR-DFR-073` retains **the offer and the decline**. Keeping only the decline
 * loses why anyone thought a transfer was right; keeping only the offer loses
 * that somebody looked at it and said no. Six months later the difference
 * between *"nobody considered this"* and *"we considered it and declined"* is
 * the entire content of the record.
 *
 * ## An item is not lost between two Rooms
 *
 * `FR-DFR-074`. The Change Room refuses a transfer. If the Defect Room does
 * nothing, the defect sits saying "transferred" — this Room believes somebody
 * else has it, nobody does, and nobody is looking, because everyone who could
 * has been told it is handled. That is the worst state available, and it is
 * reached by doing nothing.
 *
 * ## A change is not fixable as a defect
 *
 * `FR-DFR-075`, `SC-DFR-003`. Without this, the transfer is advice. Somebody
 * declines the offer, fixes it anyway, and the change goes in unbudgeted —
 * which is the failure `BR-0057` names and the reason this Room is not a bug
 * tracker.
 */
import { describe, expect, it } from 'vitest';
import {
  DefectRoutingService,
  fixBlockFor,
  type ChangeIntakePort,
  type RequirementIntakePort,
} from '../../src/modules/defect-room/routing.service.js';
import { DefectTestService } from '../../src/modules/defect-room/defect-test.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import type { ClassificationOutcome } from '../../src/modules/defect-room/classification.types.js';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const DESTINATION_COLUMN: Record<ClassificationOutcome, string> = {
  'confirmed-defect': 'repair',
  'change-request': 'change-room',
  'requirement-gap': 'requirement-room',
};

const accepts: ChangeIntakePort = {
  async fromDefectTransfer() {
    return { id: 'cr_1' };
  },
};

/** `EPIC-034`'s `TransferRefusedError` reaches this port as a throw. */
const refuses: ChangeIntakePort = {
  async fromDefectTransfer() {
    throw new Error(
      'the transfer was refused and returns to the Defect Room: the baseline is not approved',
    );
  },
};

const gapAccepts: RequirementIntakePort = {
  async gapIntake() {
    return { id: 'rc_1' };
  },
};

async function build(options: {
  outcome?: ClassificationOutcome;
  changeIntake?: ChangeIntakePort | undefined;
  requirementIntake?: RequirementIntakePort | undefined;
}) {
  const outcome = options.outcome ?? 'change-request';
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: 'ws_1',
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
    workspaceId: 'ws_1',
    defectId: 'df_1',
    outcome,
    destination: DESTINATION_COLUMN[outcome],
    approvedBehaviourRef: outcome === 'requirement-gap' ? null : 'rv_1',
    absenceRecorded: outcome === 'requirement-gap',
    classifiedBy: 'u_1',
    classifiedByKind: 'human',
    proposedByAgent: false,
    supersededByClassificationId: null,
    reclassifiedAt: null,
    evaluatedAgainstVersion: null,
    rationale: 'the system does what it was told to do; the reporter wants something else',
    createdAt: NOW,
  });
  return {
    store,
    subject: new DefectRoutingService(store, {
      changeIntake: options.changeIntake,
      requirementIntake: options.requirementIntake,
    }),
  };
}

/** Separate helpers, never a default parameter (`T998j`'s lesson). */
const unbound = () => build({});
const bound = () => build({ changeIntake: accepts });

const offer = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  offeredReason: 'the baseline says one hour; you are asking for thirty minutes',
  offeredBy: 'u_1',
  evidenceRefs: ['ev_1'],
  now: NOW,
  ...over,
});

const delivery = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
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

describe('T998q · a declined transfer retains both the offer and the decline', () => {
  it('records the decline', async () => {
    const { store, subject } = await unbound();
    const routing = await subject.offerTransfer(offer());
    await subject.declineTransfer({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      routingId: routing.id,
      declinedReason: 'the one-hour window is what the regulator requires; we will not change it',
      declinedBy: 'u_2',
      now: NOW,
    });
    const [row] = await store.routingsFor('ws_1', 'df_1');
    expect(row?.state).toBe('declined');
    expect(row?.declinedAt).toBeInstanceOf(Date);
  });

  it('and the offer is still readable afterwards', async () => {
    // The half that gets lost. Six months later, "nobody considered this" and
    // "we considered it and declined" are different facts, and only one of them
    // is true.
    const { store, subject } = await unbound();
    const routing = await subject.offerTransfer(offer());
    await subject.declineTransfer({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      routingId: routing.id,
      declinedReason: 'the regulator requires one hour',
      declinedBy: 'u_2',
      now: NOW,
    });
    const [row] = await store.routingsFor('ws_1', 'df_1');
    expect(row?.offeredReason).toMatch(/thirty minutes/);
    expect(row?.declinedReason).toMatch(/regulator/);
  });

  it('refusing a decline that says nothing', async () => {
    // The database CHECK says the same thing. A decline with no reason is the
    // offer disappearing rather than being answered.
    const { subject } = await unbound();
    const routing = await subject.offerTransfer(offer());
    await expect(
      subject.declineTransfer({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        routingId: routing.id,
        declinedReason: '   ',
        declinedBy: 'u_2',
        now: NOW,
      }),
    ).rejects.toThrow(/FR-DFR-073|reason/i);
  });

  it('and refusing to decline an offer that is not open', async () => {
    const { subject } = await unbound();
    const routing = await subject.offerTransfer(offer());
    const decline = {
      workspaceId: 'ws_1',
      defectId: 'df_1',
      routingId: routing.id,
      declinedReason: 'the regulator requires one hour',
      declinedBy: 'u_2',
      now: NOW,
    };
    await subject.declineTransfer(decline);
    await expect(subject.declineTransfer(decline)).rejects.toThrow(/not open|already/i);
  });
});

describe('T998q · delivery records what came back, never what was attempted', () => {
  it('accepts, and stores the reference the Change Room gave', async () => {
    const { store, subject } = await bound();
    await subject.offerTransfer(offer());
    const routing = await subject.deliverTransfer(delivery());
    expect(routing.state).toBe('accepted');
    expect(routing.targetRef).toBe('cr_1');
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('routed');
  });

  it('carrying the defect as the origin, so the Change Request can name it', async () => {
    // `FR-DFR-071` — the origin must be visible from the resulting Change
    // Request, which is `EPIC-034`'s `FR-CHR-012` read from this side.
    let seen: { originDefectRef?: string; evidenceRefs?: readonly string[] } = {};
    const recording: ChangeIntakePort = {
      async fromDefectTransfer(input) {
        seen = input;
        return { id: 'cr_1' };
      },
    };
    const { subject } = await build({ changeIntake: recording });
    await subject.offerTransfer(offer());
    await subject.deliverTransfer(delivery());
    expect(seen.originDefectRef).toBe('df_1');
    expect(seen.evidenceRefs).toEqual(['ev_1']);
  });

  it('refuses to deliver with no intake bound, and records nothing as routed', async () => {
    // `SC-DFR-010`. Recording it anyway is the worst state available, and it is
    // the one a hurried implementation reaches by writing what it set out to do
    // rather than what came back.
    const { store, subject } = await unbound();
    await subject.offerTransfer(offer());
    await expect(subject.deliverTransfer(delivery())).rejects.toThrow(/EPIC-034/);

    const [row] = await store.routingsFor('ws_1', 'df_1');
    expect(row?.state).toBe('offered');
    expect(row?.targetRef).toBeNull();
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('triaged');
  });

  it('and refuses to deliver an offer nobody made', async () => {
    // The offer is the record that a person was asked. Delivering without one
    // would make the transfer something the system did rather than something
    // somebody decided.
    const { subject } = await bound();
    await expect(subject.deliverTransfer(delivery())).rejects.toThrow(/no open transfer offer/i);
  });

  it('and refuses one naming no baseline', async () => {
    // Not defaulted from the defect's contested artifact. A change raised
    // against a baseline nobody named is one nobody chose, and the Change Room
    // would record it as though somebody had.
    const { subject } = await bound();
    await subject.offerTransfer(offer());
    await expect(
      subject.deliverTransfer(delivery({ targetBaselineId: '  ' })),
    ).rejects.toThrow(/baseline/i);
  });
});

describe('T998q · an item the Change Room refuses returns with the refusal attached', () => {
  it('records the refusal rather than losing the item', async () => {
    // `FR-DFR-074`. The state reached by doing nothing is the defect sitting
    // there saying "transferred", with nothing at the other end.
    const { store, subject } = await build({ changeIntake: refuses });
    await subject.offerTransfer(offer());
    await expect(subject.deliverTransfer(delivery())).rejects.toThrow(/refused/);

    const [row] = await store.routingsFor('ws_1', 'df_1');
    expect(row?.state).toBe('refused');
    expect(row?.refusalDetail).toMatch(/baseline is not approved/);
  });

  it('and the defect is workable here again, not marked routed', async () => {
    const { store, subject } = await build({ changeIntake: refuses });
    await subject.offerTransfer(offer());
    await expect(subject.deliverTransfer(delivery())).rejects.toThrow();
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('triaged');
  });

  it('a refusal arriving out of band is recorded the same way', async () => {
    // `POST /rooms/defect/:id/transfer-return`. `EPIC-034`'s
    // `TransferRefusedError` carries `returnTo: EPIC-035` and the defect id
    // precisely so a refusal raised elsewhere can be brought back here.
    const { store, subject } = await bound();
    const routing = await subject.offerTransfer(offer());
    await subject.recordReturn({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      routingId: routing.id,
      refusalDetail: 'the Change Room refused: no approved baseline at that version',
      returnedBy: 'u_2',
    });
    const [row] = await store.routingsFor('ws_1', 'df_1');
    expect(row?.state).toBe('returned');
    expect(row?.refusalDetail).toMatch(/no approved baseline/);
  });

  it('and a return carrying no detail is refused', async () => {
    // `FR-DFR-074` — a refusal with no detail tells the Defect Room only that
    // something went wrong somewhere else.
    const { subject } = await bound();
    const routing = await subject.offerTransfer(offer());
    await expect(
      subject.recordReturn({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        routingId: routing.id,
        refusalDetail: '  ',
        returnedBy: 'u_2',
      }),
    ).rejects.toThrow(/detail|FR-DFR-074/i);
  });
});

describe('T998q · a defect that is really a change cannot be fixed as one', () => {
  it('blocks a fix while the current classification is a change request', async () => {
    // `FR-DFR-075`, `SC-DFR-003`. Without this the transfer is advice: decline
    // the offer, fix it anyway, and the change goes in unbudgeted.
    const { store } = await build({ outcome: 'change-request' });
    const tests = new DefectTestService(store);
    await tests.recordTest({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testRef: 'spec.ts::sends one',
      contestedBehaviourRef: 'rv_1',
      firstObservedFailingAt: new Date('2026-08-20T09:00:00.000Z'),
      recordedBy: 'u_1',
      now: NOW,
    });

    const outcome = await tests.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(outcome.accepted).toBe(false);
    expect(outcome.accepted === false && outcome.reason).toMatch(/change request/i);
  });

  it('and while it is a requirement gap', async () => {
    // A different reason for the same refusal: there is no approved behaviour
    // to restore, so there is nothing here to fix.
    const { store } = await build({ outcome: 'requirement-gap' });
    const tests = new DefectTestService(store);
    await tests.recordTest({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testRef: 'spec.ts::sends one',
      contestedBehaviourRef: 'rv_1',
      firstObservedFailingAt: new Date('2026-08-20T09:00:00.000Z'),
      recordedBy: 'u_1',
      now: NOW,
    });
    const outcome = await tests.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(outcome.accepted).toBe(false);
    expect(outcome.accepted === false && outcome.reason).toMatch(/requirement gap/i);
  });

  it('but a confirmed defect is fixable — the control', async () => {
    // Without this, a fix-block that refused everything would satisfy both
    // assertions above, and the Room would accept no fixes at all.
    const { store } = await build({ outcome: 'confirmed-defect' });
    const tests = new DefectTestService(store);
    await tests.recordTest({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testRef: 'spec.ts::sends one',
      contestedBehaviourRef: 'rv_1',
      firstObservedFailingAt: new Date('2026-08-20T09:00:00.000Z'),
      recordedBy: 'u_1',
      now: NOW,
    });
    const outcome = await tests.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(outcome.accepted).toBe(true);
  });

  it('and the rule has one definition, not one per call site', async () => {
    // `fixBlockFor` is exported and consulted where fixes are accepted. A
    // second copy of the outcome list would be the `DEF-034-001` shape: two
    // artifacts agreeing until one of them is edited.
    expect(fixBlockFor(null)).toBeNull();
  });
});

describe('T998q · a Requirement Gap routes to EPIC-033, and only there', () => {
  it('refuses while no requirement intake is bound', async () => {
    // `R-035-4`, `SC-DFR-010`. The item stays visibly unrouted rather than
    // being marked routed to a destination that never received it.
    const { store, subject } = await build({ outcome: 'requirement-gap' });
    await expect(
      subject.routeGap({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        projectId: 'pr_1',
        roomObjectId: 'ro_1',
        text: 'notification timing after a payment failure has no approved behaviour',
        routedBy: 'u_1',
        now: NOW,
      }),
    ).rejects.toThrow(/EPIC-033/);

    expect(await store.routingsFor('ws_1', 'df_1')).toHaveLength(0);
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('triaged');
  });

  it('routes it when the intake is bound, retaining the defect record', async () => {
    // `FR-DFR-076`, `ADR-0016` — retained and marked reclassified, never
    // deleted. The reproduction context and evidence stay here and are reached
    // through the defect id, rather than copied into another Epic's register.
    const { store, subject } = await build({
      outcome: 'requirement-gap',
      requirementIntake: gapAccepts,
    });
    const routing = await subject.routeGap({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      text: 'notification timing after a payment failure has no approved behaviour',
      routedBy: 'u_1',
      now: NOW,
    });

    expect(routing.state).toBe('accepted');
    expect(routing.destination).toBe('requirement-room');
    expect(routing.targetRef).toBe('rc_1');
    expect(await store.findDefect('ws_1', 'df_1')).not.toBeNull();
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('routed');
  });

  it('and refuses to route a change request as a gap', async () => {
    const { subject } = await build({
      outcome: 'change-request',
      requirementIntake: gapAccepts,
    });
    await expect(
      subject.routeGap({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        projectId: 'pr_1',
        roomObjectId: 'ro_1',
        text: 'x',
        routedBy: 'u_1',
        now: NOW,
      }),
    ).rejects.toThrow(/change-request|requirement gap/i);
  });

  it('and refuses one with no text, which would arrive as intent nobody stated', async () => {
    const { subject } = await build({
      outcome: 'requirement-gap',
      requirementIntake: gapAccepts,
    });
    await expect(
      subject.routeGap({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        projectId: 'pr_1',
        roomObjectId: 'ro_1',
        text: '   ',
        routedBy: 'u_1',
        now: NOW,
      }),
    ).rejects.toThrow(/new intent|text/i);
  });
});
