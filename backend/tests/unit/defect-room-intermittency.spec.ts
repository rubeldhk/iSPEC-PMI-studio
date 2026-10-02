/**
 * `T998w` (EPIC-035) — intermittency. `FR-DFR-031`.
 *
 * *Intermittency MUST be representable; a single passing run MUST NOT close or
 * reclassify an intermittent defect.*
 *
 * ## Why the single run is the dangerous one
 *
 * An intermittent defect that passes once has told you nothing you did not
 * already know: it is intermittent. Reading that run as *"cannot reproduce"* is
 * the reading that closes the ticket, and it is available to anybody in a
 * hurry — no argument required, no bad faith, just the most convenient
 * interpretation of a green result.
 *
 * The reporter, meanwhile, has watched it fail. What they learn from a closure
 * on one passing run is that the process is a lottery, and the next
 * intermittent failure goes unreported.
 *
 * ## Representable, not a flag
 *
 * `intermittent` is a member of `REPRODUCIBILITY`, beside `always`,
 * `not-reproduced` and `not-automatable`. A boolean `isIntermittent` beside a
 * boolean `reproduced` would make "intermittent" and "did not reproduce this
 * time" the same fact, which is exactly the collapse this requirement forbids.
 */
import { describe, expect, it } from 'vitest';
import { EvidenceCheckService } from '../../src/modules/defect-room/evidence-check.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import { REPRODUCIBILITY } from '../../src/modules/defect-room/reproduction.types.js';

const NOW = new Date('2026-08-31T09:00:00.000Z');
const FAILED_AT = new Date('2026-08-20T09:00:00.000Z');

async function room(reproducible: string) {
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
  path: 'reclassify',
  chosenBy: 'u_1',
  reason: 'it passed this time, and the report was against a different build',
  now: NOW,
  ...over,
});

describe('T998w · intermittency is representable, and not a boolean', () => {
  it('it is a member of the vocabulary', () => {
    expect(REPRODUCIBILITY).toContain('intermittent');
  });

  it('distinct from not-reproduced, which is a different fact', () => {
    // "It behaves this way sometimes" and "it did not behave this way today"
    // are not the same claim, and a pair of booleans would make them one.
    expect(REPRODUCIBILITY).toContain('not-reproduced');
    expect(new Set(REPRODUCIBILITY).size).toBe(REPRODUCIBILITY.length);
  });
});

describe('T998w · a single passing run does not reclassify an intermittent defect', () => {
  it('refuses the reclassify path on the first check', async () => {
    // `FR-DFR-031`. One green run on an intermittent defect has told you what
    // you already knew.
    const { subject } = await room('intermittent');
    await expect(subject.choose(choice())).rejects.toThrow(/FR-DFR-031|single passing run/i);
  });

  it('writing nothing while refusing', async () => {
    const { store, subject } = await room('intermittent');
    await expect(subject.choose(choice())).rejects.toThrow();
    expect(await store.evidenceChecksFor('ws_1', 'df_1')).toHaveLength(0);
    expect(await store.listClassifications('ws_1', 'df_1')).toHaveLength(0);
  });

  it('but the other two paths are open on the first check', async () => {
    // The refusal is about reclassifying, not about answering. Refining the
    // test or investigating further is exactly what an intermittent defect
    // needs, and blocking those would leave the check with no way out at all.
    const { store, subject } = await room('intermittent');
    await subject.choose(choice({ path: 'refine-the-test' }));
    expect(await store.evidenceChecksFor('ws_1', 'df_1')).toHaveLength(1);
  });

  it('and reclassify opens once a second passing run has been examined', async () => {
    // Not a permanent block: a second run, examined by a person who recorded
    // what they made of the first, is no longer a *single* passing run.
    const { store, subject } = await room('intermittent');
    await subject.choose(choice({ path: 'investigate-further' }));
    await subject.choose(choice({ path: 'reclassify' }));

    const checks = await store.evidenceChecksFor('ws_1', 'df_1');
    expect(checks).toHaveLength(2);
    expect(checks[1]?.path).toBe('reclassify');
  });

  it('while a defect that always reproduces may reclassify on the first', async () => {
    // The control. Without it, a service refusing every reclassify would
    // satisfy the assertions above and `FR-DFR-044`'s third path would be
    // unreachable.
    const { store, subject } = await room('always');
    await subject.choose(choice());
    expect(await store.evidenceChecksFor('ws_1', 'df_1')).toHaveLength(1);
  });

  it('and reclassifying still writes no classification, whatever the reproducibility', async () => {
    // `SC-DFR-004` does not weaken on the second run. The path records a
    // decision; stating the new outcome is a separate act in front of approved
    // behaviour.
    const { store, subject } = await room('intermittent');
    await subject.choose(choice({ path: 'refine-the-test' }));
    await subject.choose(choice({ path: 'reclassify' }));
    expect(await store.listClassifications('ws_1', 'df_1')).toHaveLength(0);
  });
});

describe('T998w · and an evidence check may be entered more than once', () => {
  it('records each entry, rather than replacing the last', async () => {
    // `FR-DFR-031`. An intermittent defect passes and fails repeatedly; a
    // single row per defect would keep only the most recent reading and lose
    // the pattern, which is the only evidence intermittency ever produces.
    const { store, subject } = await room('intermittent');
    await subject.choose(choice({ path: 'refine-the-test', reason: 'the first pass' }));
    await subject.choose(choice({ path: 'investigate-further', reason: 'the second pass' }));

    const checks = await store.evidenceChecksFor('ws_1', 'df_1');
    expect(checks).toHaveLength(2);
    expect(checks.map((row) => row.rationale)).toEqual(['the first pass', 'the second pass']);
  });

  it('and a raise may be repeated too', async () => {
    const { subject } = await room('intermittent');
    const raise = {
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testId: 'dt_1',
      outcome: 'pass' as const,
      evidenceRef: 'ev_run_1',
    };
    await expect(subject.raise(raise)).resolves.toBeTruthy();
    await expect(subject.raise({ ...raise, evidenceRef: 'ev_run_2' })).resolves.toBeTruthy();
  });

  it('and none of it closes the defect', async () => {
    const { store, subject } = await room('intermittent');
    await subject.choose(choice({ path: 'refine-the-test' }));
    await subject.choose(choice({ path: 'reclassify' }));
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('triaged');
  });
});
