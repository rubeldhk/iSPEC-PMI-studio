/**
 * `T999d` (EPIC-035) — closed defects answer why they escaped.
 *
 * `FR-DFR-080`, `FR-DFR-081`, `SC-DFR-008`. `BR-0058`'s stake: **the answer
 * comes from retained data, not a survey.**
 *
 * ## What "without opening each record" is protecting
 *
 * `FR-DFR-081` reads like a performance note and is not. The alternative to an
 * aggregate is somebody reading defects one at a time and tallying them, which
 * is a survey — and a survey answers *what the person doing it remembers to
 * count*. Six months later nobody repeats it, the question stops being asked,
 * and `BR-0058` quietly becomes a paragraph in a document.
 *
 * So the assertion here is behavioural rather than about shape: the store's
 * per-record read **throws**, and the aggregation still answers. A service that
 * fetched every row and counted in memory would pass a shape test and fail this
 * one.
 *
 * ## And the fields have to be there to be counted
 *
 * `FR-DFR-080` names six. `resolutionEvidenceRef` had a column, a field and no
 * writer at all until this phase — the same defect class this repository has
 * recorded seven times, inverted: not a capability nothing calls, but a field
 * nothing fills. It would have aggregated as null forever, and read as *"no
 * defect was ever resolved with evidence"*.
 */
import { describe, expect, it } from 'vitest';
import {
  DefectAnalyticsService,
  DefectBlockersService,
  ESCAPE_POINTS,
  InMemoryEscapeStore,
  type EscapeStore,
} from '../../src/modules/defect-room/analytics.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import { TriageService, type BaselineReaderPort } from '../../src/modules/defect-room/triage.service.js';

async function seeded(): Promise<{ store: InMemoryEscapeStore; subject: DefectAnalyticsService }> {
  const store = new InMemoryEscapeStore();
  const subject = new DefectAnalyticsService(store);

  const rows: readonly [string, string, string][] = [
    ['df_1', 'production-incident', 'high'],
    ['df_2', 'production-incident', 'low'],
    ['df_3', 'automated-test', 'high'],
    ['df_4', 'monitoring', 'medium'],
  ];
  for (const [defectId, origin, severity] of rows) {
    await subject.captureAtIntake({ workspaceId: 'ws_1', defectId, origin, severity });
  }
  // Two of the four have been determined. The other two are open, which is a
  // state the distribution has to be able to say.
  await subject.recordEscapePoint('ws_1', 'df_1', 'test', 'u_1');
  await subject.recordEscapePoint('ws_1', 'df_2', 'review', 'u_1');
  return { store, subject };
}

describe('T999d · the distribution is an aggregate, not a tally', () => {
  it('counts by origin', async () => {
    const { subject } = await seeded();
    const result = await subject.distribution('ws_1');
    expect(result.byOrigin).toEqual(
      expect.arrayContaining([
        { key: 'production-incident', count: 2 },
        { key: 'automated-test', count: 1 },
        { key: 'monitoring', count: 1 },
      ]),
    );
  });

  it('by escape point', async () => {
    // `SC-DFR-008` — escape point and origin, across closed defects.
    const { subject } = await seeded();
    const result = await subject.distribution('ws_1');
    expect(result.byEscapePoint).toEqual(
      expect.arrayContaining([
        { key: 'test', count: 1 },
        { key: 'review', count: 1 },
      ]),
    );
  });

  it('and by severity', async () => {
    const { subject } = await seeded();
    const result = await subject.distribution('ws_1');
    expect(result.bySeverity).toEqual(
      expect.arrayContaining([
        { key: 'high', count: 2 },
        { key: 'low', count: 1 },
        { key: 'medium', count: 1 },
      ]),
    );
  });

  it('saying how many have no escape point yet, rather than dropping them', async () => {
    // Two defects are open. A distribution that silently omitted them would
    // report escape points summing to less than the defect count, and the
    // difference would look like an error rather than a fact.
    const { subject } = await seeded();
    const result = await subject.distribution('ws_1');
    expect(result.notDetermined).toBe(2);
    expect(result.total).toBe(4);
  });

  it('without opening a single record', async () => {
    // `FR-DFR-081`. The behavioural assertion: per-record reads are wired to
    // explode, so a service that fetched every row and counted in memory fails
    // here while passing every shape test above.
    const inner = new InMemoryEscapeStore();
    const subject = new DefectAnalyticsService(inner);
    await subject.captureAtIntake({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      origin: 'monitoring',
      severity: 'high',
    });

    const noReads: EscapeStore = {
      create: inner.create.bind(inner),
      setEscapePoint: inner.setEscapePoint.bind(inner),
      setResolutionEvidence: inner.setResolutionEvidence.bind(inner),
      aggregate: inner.aggregate.bind(inner),
      async findForDefect() {
        throw new Error('aggregation opened an individual record (FR-DFR-081)');
      },
    };

    const result = await new DefectAnalyticsService(noReads).distribution('ws_1');
    expect(result.total).toBe(1);
  });

  it('the no-reads guard can fire', async () => {
    // The control for the control. If `findForDefect` were never called by
    // anything, the assertion above would prove nothing about aggregation.
    const inner = new InMemoryEscapeStore();
    const noReads: EscapeStore = {
      create: inner.create.bind(inner),
      setEscapePoint: inner.setEscapePoint.bind(inner),
      setResolutionEvidence: inner.setResolutionEvidence.bind(inner),
      aggregate: inner.aggregate.bind(inner),
      async findForDefect() {
        throw new Error('opened an individual record');
      },
    };
    await expect(
      new DefectAnalyticsService(noReads).captureAtIntake({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        origin: 'monitoring',
        severity: 'high',
      }),
    ).rejects.toThrow(/individual record/);
  });

  it('and one workspace never counts another’s defects', async () => {
    const { subject } = await seeded();
    await subject.captureAtIntake({
      workspaceId: 'ws_other',
      defectId: 'df_x',
      origin: 'monitoring',
      severity: 'high',
    });
    expect((await subject.distribution('ws_1')).total).toBe(4);
    expect((await subject.distribution('ws_other')).total).toBe(1);
  });
});

describe('T999d · all six retained fields, including the one nothing filled', () => {
  it('records resolution evidence against a determined defect', async () => {
    // `FR-DFR-080`. The column existed from the first migration and no code
    // path wrote it. Aggregated, it would have read "no defect was ever
    // resolved with evidence" — which is not what an empty column means.
    const { subject } = await seeded();
    const row = await subject.recordResolutionEvidence('ws_1', 'df_1', 'ev_run_9');
    expect(row.resolutionEvidenceRef).toBe('ev_run_9');
  });

  it('and the distribution says how many carry it', async () => {
    const { subject } = await seeded();
    await subject.recordResolutionEvidence('ws_1', 'df_1', 'ev_run_9');
    const result = await subject.distribution('ws_1');
    expect(result.withResolutionEvidence).toBe(1);
  });

  it('refusing a blank reference', async () => {
    // An empty string here is worse than null: it satisfies "is it set?" while
    // pointing at nothing in `EPIC-032`.
    const { subject } = await seeded();
    await expect(subject.recordResolutionEvidence('ws_1', 'df_1', '  ')).rejects.toThrow(
      /evidence/i,
    );
  });

  it('and refusing a defect with no escape record', async () => {
    // Same reasoning as `recordEscapePoint`: a row appearing here means intake
    // did not capture one, and creating it now would hide that.
    const { subject } = await seeded();
    await expect(subject.recordResolutionEvidence('ws_1', 'df_none', 'ev_1')).rejects.toThrow(
      /no escape record/i,
    );
  });
});

describe('T999d · the vocabulary the aggregate reports over', () => {
  it('is the eight escape points, and the distribution invents none', async () => {
    const { subject } = await seeded();
    const result = await subject.distribution('ws_1');
    for (const bucket of result.byEscapePoint) {
      expect(ESCAPE_POINTS as readonly string[]).toContain(bucket.key);
    }
  });

  it('and reports zero buckets rather than inventing an empty workspace', async () => {
    const subject = new DefectAnalyticsService(new InMemoryEscapeStore());
    const result = await subject.distribution('ws_empty');
    expect(result.total).toBe(0);
    expect(result.byOrigin).toEqual([]);
    // The note is still there. An empty workspace is not a complete picture
    // either — it is a workspace with nothing captured yet.
    expect(result.completeness.complete).toBe(false);
  });
});


/**
 * `T999f` — what is blocking, without opening another screen.
 *
 * `FR-DFR-093`, `UX-0032`. Derived from the record rather than computed in a
 * component, so the answer is the same on the page, in the API and in a report
 * — and so it cannot quietly stop appearing when a page fetches one thing less.
 */
const finds: BaselineReaderPort = {
  async approvedBehaviourFor() {
    return { found: true, behaviourRef: 'rv_1', baselineVersion: 3 };
  },
};

async function withDefect(over: Record<string, unknown> = {}): Promise<{
  store: InMemoryDefectRoomStore;
  blockers: DefectBlockersService;
  triage: TriageService;
}> {
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
    reportedAt: new Date(),
    ...over,
  });
  return {
    store,
    blockers: new DefectBlockersService(store),
    triage: new TriageService(store, finds),
  };
}

const confirm = async (triage: TriageService): Promise<void> => {
  await triage.triage({
    workspaceId: 'ws_1',
    defectId: 'df_1',
    classifiedBy: 'u_1',
    classifiedByKind: 'human',
    rationale: 'the baseline says one hour and it sends two',
  });
};

describe('T999f · what is blocking is derived, and says what would clear it', () => {
  it('an unlinked defect is blocked on its Epic', async () => {
    const { blockers } = await withDefect({ epicId: null, state: 'held-for-triage' });
    const found = await blockers.blockersFor('ws_1', 'df_1');
    expect(found.map((b) => b.what)).toContain('Not linked to an Epic');
  });

  it('an untriaged defect is blocked on triage', async () => {
    const { blockers } = await withDefect();
    const found = await blockers.blockersFor('ws_1', 'df_1');
    expect(found.map((b) => b.what)).toContain('Not triaged');
  });

  it('and every blocker names the requirement and the way out', async () => {
    // A blocker that says "blocked" and nothing else sends somebody to ask in
    // chat — the screen `UX-0032` exists to save them from opening.
    const { blockers } = await withDefect({ epicId: null, state: 'held-for-triage' });
    for (const blocker of await blockers.blockersFor('ws_1', 'df_1')) {
      expect(blocker.because).toMatch(/FR-DFR-|SC-DFR-|R-035-/);
      expect(blocker.needs.length).toBeGreaterThan(0);
    }
  });

  it('all of them at once, not one at a time', async () => {
    // A person told "not triaged", who triages, and is then told "no failing
    // test", has been sent round the loop twice for one answer.
    const { blockers } = await withDefect({ epicId: null, state: 'held-for-triage' });
    const found = await blockers.blockersFor('ws_1', 'df_1');
    expect(found.length).toBeGreaterThan(1);
  });

  it('but stops at triage, because the rest is downstream of a judgement nobody made', async () => {
    // "No failing test" on an untriaged defect is true and useless: nobody
    // writes a test for a defect nobody has confirmed.
    const { blockers } = await withDefect();
    const found = await blockers.blockersFor('ws_1', 'df_1');
    expect(found.map((b) => b.what)).not.toContain('No failing test on record');
  });

  it('a confirmed defect with no test is blocked on the test', async () => {
    const { blockers, triage } = await withDefect();
    await confirm(triage);
    const found = await blockers.blockersFor('ws_1', 'df_1');
    expect(found.map((b) => b.what)).toContain('No failing test on record');
  });

  it('and on the runner nobody owns', async () => {
    // `R-035-1`. Not a deployment fact: `BR-0080` has no callable owner
    // anywhere in the programme, so this blocks every closure everywhere.
    const { blockers, triage } = await withDefect();
    await confirm(triage);
    const found = await blockers.blockersFor('ws_1', 'df_1');
    expect(found.some((b) => /nothing can run tests/i.test(b.what))).toBe(true);
    expect(found.some((b) => /BR-0080/.test(b.because))).toBe(true);
  });

  it('a defect that does not exist is absent, not invented', async () => {
    const { blockers } = await withDefect();
    await expect(blockers.blockersFor('ws_1', 'df_none')).rejects.toThrow(/not found/i);
  });

  it('and one in another workspace is absent too', async () => {
    const { blockers } = await withDefect();
    await expect(blockers.blockersFor('ws_other', 'df_1')).rejects.toThrow(/not found/i);
  });

  it('a closed defect with a test is blocked by nothing', async () => {
    // The control. Without it, a service returning a blocker for every defect
    // would satisfy every assertion above.
    const { store, blockers, triage } = await withDefect();
    await confirm(triage);
    await store.recordTest({
      id: 'dt_1',
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testRef: 'tests/x.spec.ts',
      contestedBehaviourRef: 'rv_1',
      firstObservedFailingAt: new Date(),
      lastRunOutcome: 'pass',
      lastRunEvidenceRef: 'ev_1',
      createdAt: new Date(),
    });
    await store.setDefectState('ws_1', 'df_1', 'closed');

    expect(await blockers.blockersFor('ws_1', 'df_1')).toEqual([]);
  });
});
