/**
 * `T998l` (EPIC-035) — regression scope, over `EPIC-011`'s real chain.
 *
 * `FR-DFR-060`, `FR-DFR-061`, `SC-DFR-007`. **A fix in Epic A that breaks a test
 * in Epic B is refused closure, and the failing regression is named.**
 *
 * ## Why this is an integration test and not a unit one
 *
 * `applicableRegressionScope` is pure and `T998m` covers it. What cannot be
 * covered there is whether this Room walks the chain in the direction
 * `EPIC-011` actually writes it. Both halves are internally consistent while
 * disagreeing: a walker that follows the wrong edges finds nothing, reports a
 * known-and-empty set, and closes every defect with a green tick.
 *
 * So the links here are written through `EPIC-011`'s own store and validated by
 * `assertPermittedEdge` — its authority on direction, read rather than
 * restated. If the chain is ever reversed, this file fails instead of quietly
 * agreeing.
 *
 * ## Applicable is derivable, not chosen
 *
 * *(defined 2026-08-23, analysis finding `A1` — the term gated `FR-DFR-060` and
 * `SC-DFR-007` and was defined in none of the seven artifacts.)*
 *
 * The set is what the chain reaches from the artifacts the fix touched. Nobody
 * selects it, because a selected set is one the person closing the defect can
 * make small — not dishonestly, but by not knowing about the Epic downstream.
 * That is the whole content of `FR-DFR-061`: the walk knows nothing about Epic
 * boundaries, so it cannot stop at one.
 */
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  InMemoryTraceabilityLinkStore,
  PERMITTED_EDGES,
  assertPermittedEdge,
  type TraceArtifactType,
  type TraceabilityLinkStore,
} from '../../src/modules/traceability/link-writer.service.js';
import { InMemoryDefectRoomStore } from '../../src/modules/defect-room/defect-room.store.js';
import { DefectTestService } from '../../src/modules/defect-room/defect-test.service.js';
import {
  VerificationService,
  type TestExecutionPort,
} from '../../src/modules/defect-room/verification.service.js';

const WS = 'ws_a';
const FAILED_AT = new Date('2026-08-20T09:00:00.000Z');
const NOW = new Date('2026-08-31T09:00:00.000Z');

/** Epic A's code, its own test, and Epic B's test over the same code. */
const CODE = 'code_notification_window';
const TEST_A = 'test_epic_a_window';
const TEST_B = 'test_epic_b_digest';

let links: TraceabilityLinkStore;

async function write(
  sourceType: TraceArtifactType,
  sourceId: string,
  targetType: TraceArtifactType,
  targetId: string,
  workspaceId = WS,
): Promise<void> {
  // `EPIC-011`'s own gate on direction. Writing straight into the store without
  // it would let this file assert a chain shape the real writer would refuse.
  assertPermittedEdge(sourceType, targetType);
  await links.append({
    id: randomUUID(),
    workspaceId,
    sourceType,
    sourceId,
    targetType,
    targetId,
    relationship: 'generated_from',
    createdAt: NOW,
  });
}

function runner(failing: readonly string[]): TestExecutionPort {
  return {
    async run({ testRefs }) {
      return testRefs.map((testRef) => ({
        testRef,
        outcome: failing.includes(testRef) ? ('fail' as const) : ('pass' as const),
        evidenceRef: `ev_${testRef}`,
      }));
    },
  };
}

async function room(execution: TestExecutionPort) {
  const store = new InMemoryDefectRoomStore();
  await store.createDefect({
    id: 'df_1',
    workspaceId: WS,
    projectId: 'pr_1',
    epicId: 'EPIC-A',
    state: 'triaged',
    origin: 'manual-report',
    contestedArtifactRef: 'spec_a',
    contestedArtifactVersion: 'v3',
    severity: 'high',
    reportedBy: 'u_0',
    reportedAt: NOW,
  });
  const tests = new DefectTestService(store);
  await tests.recordTest({
    workspaceId: WS,
    defectId: 'df_1',
    testRef: TEST_A,
    contestedBehaviourRef: 'rv_1',
    firstObservedFailingAt: FAILED_AT,
    recordedBy: 'u_1',
    now: NOW,
  });
  return {
    store,
    subject: new VerificationService(store, tests, execution, links),
  };
}

const closing = (over: Record<string, unknown> = {}) => ({
  workspaceId: WS,
  defectId: 'df_1',
  touchedArtifacts: [{ artifactType: 'code' as const, artifactId: CODE }],
  closedBy: 'u_1',
  ...over,
});

beforeEach(async () => {
  links = new InMemoryTraceabilityLinkStore();
  // Epic A's chain: a specification, its task, its code.
  await write('task', 'task_a', 'specification', 'spec_a');
  await write('code', CODE, 'task', 'task_a');
  // Two tests over that code. Nothing marks either as belonging to an Epic,
  // which is exactly the point — the chain has no Epic boundaries in it.
  await write('test', TEST_A, 'code', CODE);
  await write('test', TEST_B, 'code', CODE);
});

describe('T998l · the direction this Room walks is the one EPIC-011 writes', () => {
  it('a test links TO the code it covers, and not the other way', () => {
    // The claim the whole file rests on, taken from `EPIC-011`'s constant
    // rather than restated. If the chain is ever reversed, this fails first and
    // the failures below become explicable rather than mysterious.
    const permits = (sourceType: string, targetType: string): boolean =>
      PERMITTED_EDGES.some((e) => e.sourceType === sourceType && e.targetType === targetType);

    expect(permits('test', 'code')).toBe(true);
    expect(permits('code', 'test')).toBe(false);
  });

  it('so walking down from code reaches the tests', async () => {
    const { subject } = await room(runner([]));
    const outcome = await subject.verify(closing());
    expect([...outcome.testRefs].sort()).toEqual([TEST_A, TEST_B].sort());
  });
});

describe('T998l · a fix in Epic A that breaks a test in Epic B is refused', () => {
  it('refuses closure', async () => {
    const { subject } = await room(runner([TEST_B]));
    await expect(subject.close(closing())).rejects.toThrow();
  });

  it('naming the failing regression', async () => {
    // `SC-DFR-007`, and the difference between a refusal somebody can act on
    // and one they work around.
    const { subject } = await room(runner([TEST_B]));
    await expect(subject.close(closing())).rejects.toThrow(new RegExp(TEST_B));
  });

  it('and the defect is not closed', async () => {
    const { store, subject } = await room(runner([TEST_B]));
    await expect(subject.close(closing())).rejects.toThrow();
    expect((await store.findDefect(WS, 'df_1'))?.state).not.toBe('closed');
  });

  it('even though the defect’s own test passes', async () => {
    // The failure mode `FR-DFR-061` exists for. Epic A's own suite is green,
    // the person closing it has no reason to look further, and Epic B finds out
    // in production.
    const { subject } = await room(runner([TEST_B]));
    const error = await subject.close(closing()).catch((e: Error) => e);
    expect(String(error)).not.toMatch(new RegExp(`${TEST_A}[^_]`));
    expect(String(error)).toMatch(new RegExp(TEST_B));
  });

  it('but closes when Epic B’s test passes too — the control', async () => {
    // Without this, a service that refused every closure would satisfy all four
    // assertions above.
    const { store, subject } = await room(runner([]));
    await subject.close(closing());
    expect((await store.findDefect(WS, 'df_1'))?.state).toBe('closed');
  });
});

describe('T998l · the set is transitive, and bounded only by the chain', () => {
  it('reaches the tests from a specification, through the artifacts between', async () => {
    // `FR-DFR-060` says transitive. One hop from the specification would find
    // the task and stop, silently answering a smaller question.
    const { subject } = await room(runner([]));
    const outcome = await subject.verify(
      closing({ touchedArtifacts: [{ artifactType: 'specification', artifactId: 'spec_a' }] }),
    );
    expect([...outcome.testRefs].sort()).toEqual([TEST_A, TEST_B].sort());
  });

  it('and does not cross into another workspace', async () => {
    // `FR-002`. The chain crosses Epic boundaries because artifacts do; it does
    // not cross tenants, because artifacts do not.
    await write('test', 'test_elsewhere', 'code', CODE, 'ws_other');
    const { subject } = await room(runner([]));
    const outcome = await subject.verify(closing());
    expect(outcome.testRefs).not.toContain('test_elsewhere');
  });

  it('and an artifact the chain has never heard of refuses rather than closing', async () => {
    // `FR-DFR-064`. The fix touched something nothing links to, so what it might
    // break is unknown — which is not the same as nothing.
    const { store, subject } = await room(runner([]));
    await expect(
      subject.close(
        closing({ touchedArtifacts: [{ artifactType: 'code', artifactId: 'code_unlinked' }] }),
      ),
    ).rejects.toThrow(/cannot be computed/i);
    expect((await store.findDefect(WS, 'df_1'))?.state).not.toBe('closed');
  });
});
