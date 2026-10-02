/**
 * `T998m` (EPIC-035) — verification and closure.
 *
 * `FR-DFR-060` to `FR-DFR-064`, `BR-0144`, `BR-0056`, `R-035-1`.
 *
 * ## The sentence this file exists to enforce
 *
 * **"We could not run the tests" must never resolve to "the tests passed."**
 *
 * That is `BR-0144` and `FR-DFR-063` in one line, and it is why `TestExecution`
 * refuses when absent while `EPIC-034`'s `ImpactSource` degrades. A missing
 * analysis is a missing input a decision-maker can weigh. A missing test run is
 * not an input — it is the absence of the only thing that distinguishes a fix
 * from a claim.
 *
 * ## Applicable is derivable, not chosen
 *
 * `FR-DFR-060`: *applicable* means the **transitive test set reachable from the
 * artifacts the fix touched**, through `EPIC-011`'s chain. Not a set somebody
 * selects — a selected set is one the person closing the defect can make small.
 * It crosses Epic boundaries wherever the artifacts do (`FR-DFR-061`), which is
 * stated separately because it is the case most likely to be got wrong.
 *
 * ## An unknown set and an empty one must not behave alike
 *
 * `FR-DFR-064`. If the chain cannot answer, closure is **refused** — it does not
 * fall back to the defect test alone. The fallback is the tempting one: it looks
 * like graceful degradation and it is how a fix that broke another Epic gets
 * closed with a green tick.
 */
import { describe, expect, it } from 'vitest';
import {
  VerificationService,
  applicableRegressionScope,
  type TestExecutionPort,
} from '../../src/modules/defect-room/verification.service.js';
import { DefectTestService } from '../../src/modules/defect-room/defect-test.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import type { ChainLinkShape, ChainLinkSource } from '../../src/modules/traceability/chain-traversal.service.js';

const NOW = new Date('2026-08-31T09:00:00.000Z');
const FAILED_AT = new Date('2026-08-20T09:00:00.000Z');

/**
 * The chain, as `EPIC-011` records it: a link points from the derived artifact
 * to the one it derives from, so `test → code` means "this test covers that
 * code" and walking DOWN from the code finds it.
 */
const LINKS: ChainLinkShape[] = [
  { sourceType: 'task', sourceId: 'tk_1', targetType: 'specification', targetId: 'spec_1' },
  { sourceType: 'code', sourceId: 'code_1', targetType: 'task', targetId: 'tk_1' },
  { sourceType: 'test', sourceId: 'test_ours', targetType: 'code', targetId: 'code_1' },
  // `FR-DFR-061` — another Epic's test, over the same code. Nothing marks it as
  // foreign, which is the point: the chain crosses Epic boundaries wherever the
  // artifacts do.
  { sourceType: 'test', sourceId: 'test_other_epic', targetType: 'code', targetId: 'code_1' },
];

const chain: ChainLinkSource = { async linksForWorkspace() { return LINKS; } };
const emptyChain: ChainLinkSource = { async linksForWorkspace() { return []; } };

/**
 * A stub runner. Anything not named passes with evidence.
 *
 * The branch is on **whether the test was configured**, not on `??` over its
 * fields: `evidenceRef ?? \`ev_${ref}\`` swallows a deliberate `null`, which is
 * the exact value the two "a declaration is not evidence" tests exist to send.
 * Written the obvious way, those two tests passed against a runner that could
 * not produce the case they describe.
 */
function runner(
  results: Record<string, { outcome: 'pass' | 'fail'; evidenceRef: string | null }>,
): TestExecutionPort {
  return {
    async run({ testRefs }) {
      return testRefs.map((testRef) => {
        const configured = results[testRef];
        return configured
          ? { testRef, outcome: configured.outcome, evidenceRef: configured.evidenceRef }
          : { testRef, outcome: 'pass' as const, evidenceRef: `ev_${testRef}` };
      });
    },
  };
}

const allPass = runner({});

async function build(options: {
  execution?: TestExecutionPort | undefined;
  links?: ChainLinkSource | undefined;
  withTest?: boolean;
}) {
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
  const tests = new DefectTestService(store);
  if (options.withTest !== false) {
    await tests.recordTest({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      testRef: 'test_ours',
      contestedBehaviourRef: 'rv_1',
      firstObservedFailingAt: FAILED_AT,
      recordedBy: 'u_1',
      now: NOW,
    });
  }
  return {
    store,
    subject: new VerificationService(store, tests, options.execution, options.links),
  };
}

/** Bound both seams. Separate helpers, never a default parameter (`T998j`). */
const ready = () => build({ execution: allPass, links: chain });

const closing = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  defectId: 'df_1',
  touchedArtifacts: [{ artifactType: 'code' as const, artifactId: 'code_1' }],
  closedBy: 'u_1',
  ...over,
});

describe('T998m · applicable is the transitive set, derived from the chain', () => {
  it('finds the tests below the code the fix touched', () => {
    const scope = applicableRegressionScope(LINKS, [
      { artifactType: 'code', artifactId: 'code_1' },
    ]);
    expect(scope.known).toBe(true);
    expect(scope.known === true && [...scope.testRefs].sort()).toEqual([
      'test_other_epic',
      'test_ours',
    ]);
  });

  it('transitively, through the artifacts between', () => {
    // From the specification: down to the task, down to the code, down to the
    // tests. `FR-DFR-060` says transitive, and one hop would silently answer a
    // smaller question.
    const scope = applicableRegressionScope(LINKS, [
      { artifactType: 'specification', artifactId: 'spec_1' },
    ]);
    expect(scope.known === true && [...scope.testRefs].sort()).toEqual([
      'test_other_epic',
      'test_ours',
    ]);
  });

  it('and it is not bounded by the defect’s own Epic', () => {
    // `FR-DFR-061`. Nothing in the walk knows which Epic a test belongs to,
    // which is exactly why the boundary cannot quietly become the limit.
    const scope = applicableRegressionScope(LINKS, [
      { artifactType: 'code', artifactId: 'code_1' },
    ]);
    expect(scope.known === true && scope.testRefs).toContain('test_other_epic');
  });

  it('an artifact the chain has never heard of makes the set UNKNOWN', () => {
    // `FR-DFR-064`. Not zero tests — no answer. The fix touched something the
    // chain cannot place, so what it might break is unknown.
    const scope = applicableRegressionScope(LINKS, [
      { artifactType: 'code', artifactId: 'code_unlinked' },
    ]);
    expect(scope.known).toBe(false);
    expect(scope.known === false && scope.because).toMatch(/code_unlinked/);
  });

  it('but an artifact WITH links and no tests below it is a known, empty set', () => {
    // The distinction `FR-DFR-064` turns on. This one may close on the defect
    // test alone; the one above may not.
    const scope = applicableRegressionScope(
      [{ sourceType: 'code', sourceId: 'code_2', targetType: 'task', targetId: 'tk_1' }],
      [{ artifactType: 'code', artifactId: 'code_2' }],
    );
    expect(scope.known).toBe(true);
    expect(scope.known === true && scope.testRefs).toEqual([]);
  });
});

describe('T998m · with TestExecution absent, closure refuses — and never passes', () => {
  it('refuses verification with a 503 naming the seam', async () => {
    // `R-035-1`: no callable test-execution surface exists anywhere in the
    // programme. The refusal names it rather than reporting "an unexpected
    // error", which is what `DEF-033-002` found two unbound seams doing.
    const { subject } = await build({ execution: undefined, links: chain });
    await expect(subject.verify(closing())).rejects.toMatchObject({
      code: 'governance_seam_unbound',
    });
  });

  it('and closure too', async () => {
    const { subject } = await build({ execution: undefined, links: chain });
    await expect(subject.close(closing())).rejects.toMatchObject({
      code: 'governance_seam_unbound',
    });
  });

  it('naming TestExecution, so an operator knows what to bind', async () => {
    const { subject } = await build({ execution: undefined, links: chain });
    await expect(subject.close(closing())).rejects.toThrow(/TestExecution/);
  });

  it('and the defect is not closed', async () => {
    // The assertion that matters. A refusal that still closed the defect would
    // be the failure this Room exists to prevent, wearing a 503.
    const { store, subject } = await build({ execution: undefined, links: chain });
    await expect(subject.close(closing())).rejects.toThrow();
    expect((await store.findDefect('ws_1', 'df_1'))?.state).not.toBe('closed');
  });

  it('the control: with a runner bound, the same closure succeeds', async () => {
    // Without this, a service that refused every closure would satisfy all four
    // assertions above.
    const { store, subject } = await ready();
    await subject.close(closing());
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('closed');
  });
});

describe('T998m · closure requires the defect test AND the regression set', () => {
  it('refuses with no defect test on record', async () => {
    // `FR-DFR-041` again, at the other end of the workflow.
    const { subject } = await build({ execution: allPass, links: chain, withTest: false });
    await expect(subject.close(closing())).rejects.toThrow(/POST \/rooms\/defect\/:id\/test/);
  });

  it('refuses when the defect test itself still fails', async () => {
    const { subject } = await build({
      execution: runner({ test_ours: { outcome: 'fail', evidenceRef: 'ev_1' } }),
      links: chain,
    });
    await expect(subject.close(closing())).rejects.toThrow(/test_ours/);
  });

  it('refuses when a regression fails, and names it', async () => {
    // `US2` scenario 4. Naming it is the difference between a refusal somebody
    // can act on and one they work around.
    const { subject } = await build({
      execution: runner({ test_other_epic: { outcome: 'fail', evidenceRef: 'ev_2' } }),
      links: chain,
    });
    await expect(subject.close(closing())).rejects.toThrow(/test_other_epic/);
  });

  it('and retains the evidence for the run it did accept', async () => {
    // `FR-DFR-060` — "with the evidence retained". The reference is retained
    // here; the attestation itself lives in `EPIC-032`, which is where
    // `R-035-7` says it belongs.
    const { store, subject } = await ready();
    await subject.close(closing());
    const tests = await store.testsFor('ws_1', 'df_1');
    expect(tests[0]?.lastRunOutcome).toBe('pass');
    expect(tests[0]?.lastRunEvidenceRef).toBe('ev_test_ours');
  });
});

describe('T998m · a declaration of completion is not evidence', () => {
  it('refuses a passing result that carries no evidence reference', async () => {
    // `FR-DFR-063`, `BR-0144`. A result asserting "pass" with nothing behind it
    // is a declaration wearing the shape of a run, and a declaration is exactly
    // what evidence exists to replace.
    const { subject } = await build({
      execution: runner({ test_ours: { outcome: 'pass', evidenceRef: null } }),
      links: chain,
    });
    await expect(subject.close(closing())).rejects.toThrow(/no evidence/i);
  });

  it('including for a regression test', async () => {
    const { subject } = await build({
      execution: runner({ test_other_epic: { outcome: 'pass', evidenceRef: null } }),
      links: chain,
    });
    await expect(subject.close(closing())).rejects.toThrow(/no evidence/i);
  });

  it('and refuses a runner that answers about tests nobody asked to run', async () => {
    // A result set that does not cover the requested tests leaves some of them
    // unrun, and an unrun test that nothing reports is the silent version of
    // the whole problem.
    const partial: TestExecutionPort = {
      async run() {
        return [{ testRef: 'test_ours', outcome: 'pass', evidenceRef: 'ev_1' }];
      },
    };
    const { subject } = await build({ execution: partial, links: chain });
    await expect(subject.close(closing())).rejects.toThrow(/test_other_epic/);
  });
});

describe('T998m · an unknown regression set refuses; an empty one does not', () => {
  it('refuses when the chain cannot place a touched artifact', async () => {
    // `FR-DFR-064`. The fallback to "just the defect test" is the tempting one:
    // it looks like graceful degradation, and it is how a fix that broke
    // another Epic gets closed with a green tick.
    const { subject } = await ready();
    await expect(
      subject.close(
        closing({ touchedArtifacts: [{ artifactType: 'code', artifactId: 'code_unlinked' }] }),
      ),
    ).rejects.toThrow(/cannot be computed|unknown/i);
  });

  it('refuses when no chain source is bound at all', async () => {
    const { subject } = await build({ execution: allPass, links: undefined });
    await expect(subject.close(closing())).rejects.toThrow(/EPIC-011/);
  });

  it('and does not fall back to the defect test alone', async () => {
    const { store, subject } = await build({ execution: allPass, links: emptyChain });
    await expect(subject.close(closing())).rejects.toThrow();
    expect((await store.findDefect('ws_1', 'df_1'))?.state).not.toBe('closed');
  });

  it('but closes on the defect test alone when the set is known and empty', async () => {
    // The behaviour that makes the refusals above meaningful rather than a
    // blanket. An empty set is an answer; an unknown set is not.
    const onlyCode: ChainLinkSource = {
      async linksForWorkspace() {
        return [{ sourceType: 'code', sourceId: 'code_1', targetType: 'task', targetId: 'tk_1' }];
      },
    };
    const { store, subject } = await build({ execution: allPass, links: onlyCode });
    await subject.close(closing());
    expect((await store.findDefect('ws_1', 'df_1'))?.state).toBe('closed');
  });

  it('and a closure with no touched artifacts is refused, not treated as empty', async () => {
    // Nothing to derive a set from is the same fact as a set nobody can
    // compute. Reading it as "no regressions" would let a caller opt out of
    // `FR-DFR-060` by sending less.
    const { subject } = await ready();
    await expect(subject.close(closing({ touchedArtifacts: [] }))).rejects.toThrow(
      /which artifacts/i,
    );
  });
});
