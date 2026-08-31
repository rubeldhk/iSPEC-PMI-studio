/**
 * `T998u` (EPIC-035) — a passing reproduction test is not automatically a
 * change.
 *
 * `FR-DFR-044`, `SC-DFR-004`, `R-035-6`, and `ADR-0016`'s named failure mode
 * stated in the imperative: *"Do NOT blindly classify every passing
 * reproduction test as a Change Request."*
 *
 * ## The inference this refuses
 *
 * The reproduction test passes. The obvious reading is that the defect is not
 * real, so the item becomes a change request and everyone moves on. That
 * reading is wrong often enough to matter: the test may reproduce the wrong
 * thing, the environment may differ from the one it was reported in, or the
 * defect may be intermittent.
 *
 * A system that reclassifies on a green run is not reasoning. It is guessing —
 * and guessing in the direction that closes work, which is the direction nobody
 * pushes back on.
 *
 * ## Even the `reclassify` path does not reclassify
 *
 * It records that somebody chose to, and hands back the route where the new
 * outcome is stated with its own rationale. The evidence check cannot know
 * *which* outcome the item becomes — that is the judgement `FR-DFR-020` puts in
 * front of approved behaviour, and a check that guessed it would be the
 * automatic reclassification arriving one step later.
 *
 * The spec calls this *"the easiest of the eight requirements to simplify into
 * a defect"*, which is why the vocabulary is required with no default, the loop
 * has no PASS → classification edge, and `T999m` mutation-tests it.
 */
import { describe, expect, it } from 'vitest';
import { EvidenceCheckService } from '../../src/modules/defect-room/evidence-check.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import { EVIDENCE_CHECK_PATHS } from '../../src/modules/defect-room/evidence-check.types.js';

const NOW = new Date('2026-08-31T09:00:00.000Z');
const FAILED_AT = new Date('2026-08-20T09:00:00.000Z');

async function room(reproducible = 'always') {
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
  await store.recordTest({
    id: 'dt_1',
    workspaceId: 'ws_1',
    defectId: 'df_1',
    testRef: 'spec.ts::sends one',
    contestedBehaviourRef: 'rv_1',
    firstObservedFailingAt: FAILED_AT,
    lastRunOutcome: 'fail',
    lastRunEvidenceRef: null,
    createdAt: NOW,
  });
  await store.recordReproduction({
    id: 'rp_1',
    workspaceId: 'ws_1',
    defectId: 'df_1',
    reproducible,
    environment: 'staging',
    evidenceRefs: ['ev_1'],
    affectedBehaviourRef: 'rv_1',
    notAutomatableReason: null,
    observedAt: NOW,
    createdAt: NOW,
  });
  return { store, subject: new EvidenceCheckService(store) };
}

const choice = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  testId: 'dt_1',
  path: 'investigate-further',
  chosenBy: 'u_1',
  reason: 'the run passed against staging, and the report was against production',
  now: NOW,
  ...over,
});

describe('T998u · a passing run raises a check, and offers exactly three ways out', () => {
  it('raises one when the run passed', async () => {
    const { subject } = await room();
    const raised = await subject.raise({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testId: 'dt_1',
      outcome: 'pass',
      evidenceRef: 'ev_run_1',
    });
    expect(raised.paths).toEqual([...EVIDENCE_CHECK_PATHS]);
  });

  it('and offers the three the vocabulary declares — read, not restated', async () => {
    // `R-035-6`. If a fourth path were added, or one removed, this assertion
    // moves with the vocabulary rather than disagreeing with it.
    const { subject } = await room();
    const raised = await subject.raise({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testId: 'dt_1',
      outcome: 'pass',
      evidenceRef: 'ev_run_1',
    });
    expect(raised.paths).toHaveLength(3);
    expect(raised.paths).toContain('reclassify');
  });

  it('records the passing run against the test', async () => {
    const { store, subject } = await room();
    await subject.raise({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testId: 'dt_1',
      outcome: 'pass',
      evidenceRef: 'ev_run_1',
    });
    const [test] = await store.testsFor('ws_1', 'df_1');
    expect(test?.lastRunOutcome).toBe('pass');
    expect(test?.lastRunEvidenceRef).toBe('ev_run_1');
  });

  it('but does not raise one for a failing run', async () => {
    // A failing reproduction test is the ordinary state: the defect reproduces.
    // Raising a check would ask somebody to explain a result nobody doubts.
    const { subject } = await room();
    await expect(
      subject.raise({
        workspaceId: 'ws_1',
        defectId: 'df_1',
        testId: 'dt_1',
        outcome: 'fail',
        evidenceRef: 'ev_run_1',
      }),
    ).rejects.toThrow(/passing|pass/i);
  });

  it('and nothing is chosen by raising it', async () => {
    // `FR-DFR-044`. The check is a question. A raise that also recorded an
    // answer would be the automatic path wearing a person's clothes.
    const { store, subject } = await room();
    await subject.raise({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testId: 'dt_1',
      outcome: 'pass',
      evidenceRef: 'ev_run_1',
    });
    expect(await store.evidenceChecksFor('ws_1', 'df_1')).toHaveLength(0);
  });

  it('and the answer it gives carries no choice either', async () => {
    // The hole `T999m`'s mutation found: the assertion above proves nothing was
    // WRITTEN, and a raise that RETURNS a suggested path passes it while every
    // screen rendering the response shows one pre-selected. That is the
    // automatic reclassification arriving through the caller instead of through
    // the store — `SC-DFR-004` counts it the same way.
    const { subject } = await room();
    const raised = await subject.raise({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testId: 'dt_1',
      outcome: 'pass',
      evidenceRef: 'ev_run_1',
    });

    expect(Object.keys(raised)).toEqual(['paths']);
    expect(JSON.stringify(raised)).not.toMatch(/chosen|selected|recommend|suggest|default/i);
  });

  it('the no-choice check can fire', () => {
    // The control. Without it a broken matcher would pass every response.
    expect(JSON.stringify({ paths: [], autoChosen: 'reclassify' })).toMatch(/chosen/i);
  });
});

describe('T998u · the path is chosen by a person, and recorded', () => {
  it('records which path was taken', async () => {
    // `US4` scenario 2 — which one, not merely that a check happened.
    const { store, subject } = await room();
    await subject.choose(choice());
    const [check] = await store.evidenceChecksFor('ws_1', 'df_1');
    expect(check?.path).toBe('investigate');
    expect(check?.resolvedBy).toBe('u_1');
  });

  it('and what was weighed', async () => {
    const { store, subject } = await room();
    await subject.choose(choice());
    const [check] = await store.evidenceChecksFor('ws_1', 'df_1');
    expect(check?.rationale).toMatch(/staging/);
  });

  it('refusing a path nobody declared', async () => {
    const { subject } = await room();
    await expect(subject.choose(choice({ path: 'close-it' }))).rejects.toThrow(/one of/i);
  });

  it('and refusing an omitted one, because a default is a decision nobody made', async () => {
    // `R-035-6` rejected defaulting to `investigate` for exactly this reason.
    const { subject } = await room();
    await expect(subject.choose(choice({ path: undefined }))).rejects.toThrow(/one of|required/i);
  });

  it('and refusing one with no rationale', async () => {
    const { subject } = await room();
    await expect(subject.choose(choice({ reason: '   ' }))).rejects.toThrow(/rationale|reason/i);
  });

  it('the control: a declared path with a rationale is recorded', async () => {
    const { store, subject } = await room();
    await subject.choose(choice({ path: 'refine-the-test' }));
    const [check] = await store.evidenceChecksFor('ws_1', 'df_1');
    expect(check?.path).toBe('refine-test');
  });
});

describe('T998u · and even choosing `reclassify` does not reclassify', () => {
  it('writes no classification', async () => {
    // `SC-DFR-004`: **zero** passing reproduction tests are automatically
    // reclassified. The check cannot know which outcome the item becomes —
    // that is the judgement `FR-DFR-020` puts in front of approved behaviour,
    // and guessing it would be the automatic reclassification one step later.
    const { store, subject } = await room();
    await subject.choose(choice({ path: 'reclassify' }));
    expect(await store.listClassifications('ws_1', 'df_1')).toHaveLength(0);
  });

  it('and hands back the route where somebody states the new outcome', async () => {
    const { subject } = await room();
    const result = await subject.choose(choice({ path: 'reclassify' }));
    expect(result.next).toMatch(/POST \/rooms\/defect\/:id\/reevaluate|triage/);
  });

  it('nor does it close the defect, or move it at all', async () => {
    const { store, subject } = await room();
    await subject.choose(choice({ path: 'reclassify' }));
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('triaged');
  });

  it('and the service has no method that could close one', async () => {
    // The promise kept by the absence of the capability rather than by
    // everyone remembering not to use it.
    const store = new InMemoryDefectRoomStore();
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(new EvidenceCheckService(store)),
    );
    for (const verb of ['close', 'reclassify', 'classify']) {
      expect(methods.some((name) => name.toLowerCase().startsWith(verb)), verb).toBe(false);
    }
  });

  it('the verb check can fire', () => {
    expect(['closeDefect'].some((n) => n.toLowerCase().startsWith('close'))).toBe(true);
  });
});
