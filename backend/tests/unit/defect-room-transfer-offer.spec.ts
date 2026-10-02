/**
 * `T998o` (EPIC-035) — the transfer offer.
 *
 * `FR-DFR-070`, `FR-DFR-072`, `UX-0034`, `BR-0057` — *the reason this Room is
 * not a bug tracker.*
 *
 * ## What the offer is for
 *
 * Approved current behaviour passes. The system does what it was told to do.
 * The reporter still wants something different — and that is a change to
 * intent, not a defect in the implementation.
 *
 * A bug tracker has one answer here: fix it. That answer costs nothing to give
 * and turns the defect queue into an unbudgeted change channel, which is the
 * whole failure `BR-0052` and `BR-0057` exist to close.
 *
 * ## Why the reason is required rather than encouraged
 *
 * `UX-0034`, stated in the task list as plainly as it can be: *an unexplained
 * transfer button is a reclassification nobody decided.*
 *
 * The person being transferred away from the Defect Room is usually the person
 * who reported the problem. If the offer arrives with no reason, what they
 * learn is that their report was moved somewhere else — and the next one does
 * not get filed. `offeredReason` is `NOT NULL` in the table for the same
 * reason it is required here.
 *
 * ## And why a Requirement Gap may not take this route
 *
 * `FR-DFR-076`, clarified 2026-08-22: a gap must **not** be routed to the
 * Change Room, because there is no approved baseline to change and that absence
 * is what makes it a gap. Transferring one would create a Change Request
 * against a baseline nobody wrote.
 */
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DefectRoutingService } from '../../src/modules/defect-room/routing.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import type { ClassificationOutcome } from '../../src/modules/defect-room/classification.types.js';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const DESTINATION_COLUMN: Record<ClassificationOutcome, string> = {
  'confirmed-defect': 'repair',
  'change-request': 'change-room',
  'requirement-gap': 'requirement-room',
};

async function room(outcome: ClassificationOutcome | null = 'change-request') {
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: 'ws_1',
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
  if (outcome) {
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
  }
  return { store, subject: new DefectRoutingService(store, {}) };
}

const offer = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  offeredReason:
    'the approved baseline says one hour and the system sends at one hour; you are asking for ' +
    'thirty minutes, which changes what was agreed',
  offeredBy: 'u_1',
  evidenceRefs: ['ev_1'],
  now: NOW,
  ...over,
});

describe('T998o · the offer is made where behaviour passes and intent would change', () => {
  it('records an offer to the Change Room', async () => {
    const { subject } = await room();
    const routing = await subject.offerTransfer(offer());
    expect(routing.destination).toBe('change-room');
    expect(routing.state).toBe('offered');
  });

  it('against the classification that justified it', async () => {
    // Not against the defect alone. A transfer is a consequence of a
    // judgement, and a routing row that could not name which judgement would
    // survive a reclassification while describing the old one.
    const { subject } = await room();
    const routing = await subject.offerTransfer(offer());
    expect(routing.classificationId).toBe('cl_1');
  });

  it('carrying evidence by reference', async () => {
    // `FR-DFR-071`. References, never copies: a copied attestation is a second
    // artifact with the same digest and a different id, and the two drift.
    const { subject } = await room();
    const routing = await subject.offerTransfer(offer());
    expect(routing.carriedEvidenceRefs).toEqual(['ev_1']);
  });

  it('and it is readable afterwards', async () => {
    const { store, subject } = await room();
    await subject.offerTransfer(offer());
    expect(await store.routingsFor('ws_1', 'df_1')).toHaveLength(1);
  });
});

describe('T998o · the reason is required, because an unexplained offer is a reclassification', () => {
  it('refuses an offer with no reason', async () => {
    // `FR-DFR-072`, `UX-0034`. The person being transferred away from the
    // Defect Room is usually the one who reported the problem; an offer with no
    // reason teaches them that reports get moved, and the next one is not
    // filed.
    const { subject } = await room();
    await expect(subject.offerTransfer(offer({ offeredReason: '' }))).rejects.toThrow(
      /FR-DFR-072|UX-0034/,
    );
  });

  it('and one whose reason is only whitespace', async () => {
    const { subject } = await room();
    await expect(subject.offerTransfer(offer({ offeredReason: '   ' }))).rejects.toThrow(
      /FR-DFR-072|UX-0034/,
    );
  });

  it('writing nothing while refusing', async () => {
    const { store, subject } = await room();
    await expect(subject.offerTransfer(offer({ offeredReason: '' }))).rejects.toThrow();
    expect(await store.routingsFor('ws_1', 'df_1')).toHaveLength(0);
  });
});

describe('T998o · and only a change request may be offered this route', () => {
  it('refuses to transfer a confirmed defect', async () => {
    // It stays. Offering a transfer for the outcome that does not leave would
    // make the offer available for every defect, which is how the Room becomes
    // a bug tracker with an extra button.
    const { subject } = await room('confirmed-defect');
    await expect(subject.offerTransfer(offer())).rejects.toThrow(/confirmed-defect/);
  });

  it('and refuses to transfer a requirement gap', async () => {
    // `FR-DFR-076`, clarified 2026-08-22. There is no approved baseline to
    // change, and that absence is what makes it a gap — a Change Request here
    // would be raised against a baseline nobody ever wrote.
    const { subject } = await room('requirement-gap');
    await expect(subject.offerTransfer(offer())).rejects.toThrow(/no approved baseline|gap/i);
  });

  it('and refuses when the defect has not been classified at all', async () => {
    // `SC-DFR-002` from the other side: routing is a consequence of a
    // judgement, so it cannot precede one.
    const { subject } = await room(null);
    await expect(subject.offerTransfer(offer())).rejects.toThrow(/not been classified/i);
  });

  it('and a defect in another workspace is absent, not forbidden', async () => {
    const { subject } = await room();
    await expect(subject.offerTransfer(offer({ workspaceId: 'ws_other' }))).rejects.toThrow(
      /not found/i,
    );
  });

  it('the control: a change request is offered', async () => {
    // Without this, a service that refused every offer would satisfy every
    // assertion above.
    const { subject } = await room('change-request');
    await expect(subject.offerTransfer(offer())).resolves.toBeTruthy();
  });
});

describe('T998o · the offer is not the transfer', () => {
  it('a second offer for the same defect is refused while one is open', async () => {
    // Two open offers for one defect are two people being asked the same
    // question, and the answers can disagree.
    const { subject } = await room();
    await subject.offerTransfer(offer());
    await expect(subject.offerTransfer(offer())).rejects.toThrow(/already/i);
  });

  it('and nothing has been delivered anywhere', async () => {
    // `SC-DFR-010`. An offer is a question put to a person. Recording it as
    // routed would leave this Room believing the Change Room has an item it has
    // never been shown.
    const { store, subject } = await room();
    await subject.offerTransfer(offer());
    const [routing] = await store.routingsFor('ws_1', 'df_1');
    expect(routing?.state).toBe('offered');
    expect(routing?.targetRef).toBeNull();
  });

  it('and the defect has not moved out of triaged', async () => {
    const { store, subject } = await room();
    await subject.offerTransfer(offer());
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('triaged');
  });

  it('an id is minted per offer, not reused', async () => {
    // Cheap, and it catches the shape of bug where every row overwrites the
    // last because the id came from the defect.
    const { subject } = await room();
    const first = await subject.offerTransfer(offer());
    expect(first.id).not.toBe('df_1');
    expect(first.id).not.toBe(randomUUID());
  });
});
