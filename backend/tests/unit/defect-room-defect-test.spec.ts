/**
 * `T998g` (EPIC-035) — the failing-test precondition.
 *
 * `FR-DFR-040`, `FR-DFR-041`, `FR-DFR-042`, `BR-0054`. Constitution V's own
 * rule, offered as a product capability.
 *
 * ## Why a test that exists is not the same as a test that failed
 *
 * The check everyone writes is *"is there a test?"* A test written after the
 * fix, green from its first run, passes that check and demonstrates nothing: it
 * shows the code as written, not the defect as reported. So the record is not
 * *"a test exists"* — it is `firstObservedFailingAt`, an instant somebody
 * watched pass.
 *
 * This file is about the service. The type (`FixAcceptance`), the loop gate
 * (`defect-room.failing-test-on-record`) and the database trigger say the same
 * thing in three other places, and `T998i` proves each refuses on its own —
 * because a caller can go around a service, and the service is the layer most
 * likely to grow an exception at six on a Friday when the fix is obviously
 * right. It usually is obviously right.
 */
import { describe, expect, it } from 'vitest';
import { DefectTestService } from '../../src/modules/defect-room/defect-test.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';

const FAILED_AT = new Date('2026-08-20T09:00:00.000Z');
const NOW = new Date('2026-08-31T09:00:00.000Z');

async function room(state = 'triaged') {
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    epicId: 'EPIC-999',
    state,
    origin: 'manual-report',
    contestedArtifactRef: 'spec_1',
    contestedArtifactVersion: 'v3',
    severity: 'high',
    reportedBy: 'u_0',
    reportedAt: new Date(),
  });
  return { store, subject: new DefectTestService(store) };
}

const record = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  testRef: 'backend/tests/unit/notification-window.spec.ts::sends one',
  contestedBehaviourRef: 'rv_1',
  firstObservedFailingAt: FAILED_AT,
  recordedBy: 'u_1',
  now: NOW,
  ...over,
});

describe('T998g · recording the test that demonstrated the defect', () => {
  it('records it with the instant it was seen failing', async () => {
    const { subject } = await room();
    const test = await subject.recordTest(record());
    expect(test.firstObservedFailingAt).toEqual(FAILED_AT);
    expect(test.reference).toContain('notification-window');
  });

  it('and links it to the behaviour it contests, not only to the defect', async () => {
    // `FR-DFR-042`. A test linked only to the defect cannot answer *"what was
    // this supposed to do?"*, which is the question a reader has a year later.
    const { subject } = await room();
    const test = await subject.recordTest(record());
    expect(test.contestedBehaviourRef).toBe('rv_1');
    expect(test.defectId).toBe('df_1');
  });

  it('refusing one with no contested behaviour', async () => {
    const { subject } = await room();
    await expect(subject.recordTest(record({ contestedBehaviourRef: '  ' }))).rejects.toThrow(
      /FR-DFR-042/,
    );
  });

  it('and one with no reference, which nobody could run', async () => {
    const { subject } = await room();
    await expect(subject.recordTest(record({ testRef: '' }))).rejects.toThrow(/reference/i);
  });

  it('and one observed failing in the future', async () => {
    // An instant nobody has watched yet. The whole requirement rests on this
    // field being a record of something that happened.
    const { subject } = await room();
    await expect(
      subject.recordTest(record({ firstObservedFailingAt: new Date('2026-09-30T00:00:00.000Z') })),
    ).rejects.toThrow(/has not happened yet/i);
  });

  it('and one against a defect in another workspace', async () => {
    const { subject } = await room();
    await expect(subject.recordTest(record({ workspaceId: 'ws_other' }))).rejects.toThrow(
      /not found/i,
    );
  });
});

describe('T998g · a fix with no failing test on record is not accepted', () => {
  it('refuses', async () => {
    // `FR-DFR-041`. The refusal is a value, not an exception: `FixAcceptance`
    // has two arms because a refusal is a real outcome with its own shape, and
    // reusing the accepted arm with `test: null` is how the null becomes "not
    // recorded yet".
    const { subject } = await room();
    const outcome = await subject.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(outcome.accepted).toBe(false);
  });

  it('naming the route that records one', async () => {
    // The affordance. A refusal with nowhere to go is how the rule gets argued
    // back in — `T996i` recorded the same lesson for `RULE-02`.
    const { subject } = await room();
    const outcome = await subject.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(outcome.accepted === false && outcome.reason).toMatch(
      /POST \/rooms\/defect\/:id\/test/,
    );
  });

  it('and it carries no test, because there is none', async () => {
    const { subject } = await room();
    const outcome = await subject.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(Object.keys(outcome)).not.toContain('test');
  });

  it('but accepts one once a failing test is on record', async () => {
    // The control. Without it, a service that refused every fix would satisfy
    // all three assertions above.
    const { subject } = await room();
    await subject.recordTest(record());
    const outcome = await subject.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(outcome.accepted).toBe(true);
    expect(outcome.accepted === true && outcome.test.firstObservedFailingAt).toEqual(FAILED_AT);
  });
});

describe('T998g · the not-automatable exception, and its limit', () => {
  it('accepts a fix with no test when the defect is recorded not-automatable WITH evidence', async () => {
    // `FR-DFR-043`. `BR-0054` says "where automatable", and an unstated
    // exception is one nobody can count.
    const { store, subject } = await room();
    await store.recordReproduction({
      id: 'rp_1',
      workspaceId: 'ws_1',
      defectId: 'df_1',
      reproducible: 'not-automatable',
      environment: 'production, EU region',
      evidenceRefs: ['ev_1'],
      affectedBehaviourRef: 'rv_1',
      notAutomatableReason: 'reproduces only against the third-party sandbox, which has no runner',
      observedAt: NOW,
      createdAt: NOW,
    });
    const outcome = await subject.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(outcome.accepted).toBe(true);
  });

  it('but refuses when the exception carries no alternative evidence', async () => {
    // The half of `FR-DFR-043` that gets dropped. Without it, "not automatable"
    // becomes the sentence that accepts any fix at all — a bypass with a
    // checkbox, and the only one this Room would have.
    const { store, subject } = await room();
    await store.recordReproduction({
      id: 'rp_1',
      workspaceId: 'ws_1',
      defectId: 'df_1',
      reproducible: 'not-automatable',
      environment: 'production, EU region',
      evidenceRefs: [],
      affectedBehaviourRef: 'rv_1',
      notAutomatableReason: 'reproduces only against the third-party sandbox',
      observedAt: NOW,
      createdAt: NOW,
    });
    const outcome = await subject.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(outcome.accepted).toBe(false);
    expect(outcome.accepted === false && outcome.reason).toMatch(/alternative evidence/i);
  });

  it('and a reproduction that is merely hard to reproduce is not the exception', async () => {
    // `intermittent` is a member of `REPRODUCIBILITY`, not a synonym for
    // `not-automatable`. An intermittent defect is automatable — that is why
    // `FR-DFR-031` has to say a single passing run must not close one.
    const { store, subject } = await room();
    await store.recordReproduction({
      id: 'rp_1',
      workspaceId: 'ws_1',
      defectId: 'df_1',
      reproducible: 'intermittent',
      environment: 'staging',
      evidenceRefs: ['ev_1'],
      affectedBehaviourRef: 'rv_1',
      notAutomatableReason: null,
      observedAt: NOW,
      createdAt: NOW,
    });
    const outcome = await subject.acceptFix({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      acceptedBy: 'u_1',
    });
    expect(outcome.accepted).toBe(false);
  });
});
