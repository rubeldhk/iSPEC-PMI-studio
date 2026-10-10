/**
 * A ready-to-dispatch world for `EPIC-047`'s dispatch tests.
 *
 * One active Expert (`test-engineer`) whose version 1 is **approved**, a runner
 * for its preferred model, and recording bindings for every port. Each test
 * changes what it is about — a tool, a model table, a target — at the call
 * site, so what a test exercises is visible in the test.
 */
import { DispatchService, type DispatchRequest } from '../../src/modules/experts/dispatch.service.js';
import type { ExpertContract } from '../../src/modules/experts/expert.types.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import type { ActorAccess, ExpertPorts, ExpertRunner } from '../../src/modules/experts/experts.tokens.js';
import {
  accessFrom,
  contract,
  evidenceKnowing,
  expert,
  gatewaysFor,
  recordingApprovals,
  recordingContext,
  recordingExecutions,
  runner,
  version,
  type RecordingApprovals,
  type RecordingContext,
  type RecordingExecutions,
  type RecordingRunner,
} from './expert-fixtures.js';

export interface World {
  readonly store: InMemoryExpertsStore;
  readonly approvals: RecordingApprovals;
  readonly executions: RecordingExecutions;
  readonly context: RecordingContext;
  readonly preferred: RecordingRunner;
  readonly ports: ExpertPorts;
  readonly service: DispatchService;
}

export async function world(
  over: {
    contract?: ExpertContract;
    runners?: Record<string, ExpertRunner[]>;
    access?: ActorAccess;
  } = {},
): Promise<World> {
  const store = new InMemoryExpertsStore();
  const approvals = recordingApprovals();
  await store.addExpert(expert());
  await store.addVersion(version({ contract: over.contract ?? contract(), decisionId: 'd_ok' }));
  approvals.resolve('d_ok', 'approved');

  const preferred = runner();
  const executions = recordingExecutions();
  const context = recordingContext();
  const ports: ExpertPorts = {
    gateways: gatewaysFor(over.runners ?? { 'claude-opus-5-5': [preferred] }),
    approvals,
    evidence: evidenceKnowing('implementation@1'),
    context,
    executions,
  };
  let n = 0;
  const service = new DispatchService(store, {
    access: over.access ?? accessFrom({ 'u_1:specification:sp_1': 'edit', 'u_1:task:t_1': 'edit' }),
    ports,
    clock: () => `2026-10-09T09:00:${String((n += 1) % 60).padStart(2, '0')}.000Z`,
  });
  return { store, approvals, executions, context, preferred, ports, service };
}

/** A request the default world admits, overridable field by field. */
export function ask(over: Partial<DispatchRequest> = {}): DispatchRequest {
  return {
    expertId: 'ex_test',
    command: 'implement',
    objective: 'write the tests for the booking notification',
    projectId: 'pr_1',
    capabilities: ['test'],
    tools: ['run-tests'],
    actions: [],
    targets: [{ artifactType: 'specification', artifactId: 'sp_1', action: 'read' }],
    ...over,
  };
}

/** The acting user, as the controller would pass it from the session. */
export const ACTOR = { workspaceId: 'ws_1', userId: 'u_1', role: 'engineer' } as const;

/** Register another active Expert with an approved version 1 in the world. */
export async function addApproved(
  w: World,
  key: string,
  over: Partial<ExpertContract> = {},
): Promise<string> {
  const id = `ex_${key}`;
  await w.store.addExpert(expert({ id, key, name: key }));
  const decisionId = `d_${key}`;
  await w.store.addVersion(version({ id: `cv_${key}`, expertId: id, contract: contract(over), decisionId }));
  w.approvals.resolve(decisionId, 'approved');
  return id;
}

/** A delegation policy permitting the given pairs, overridable field by field. */
export async function allowDelegation(
  w: World,
  pairs: { from: string; to: string }[],
  over: Partial<{ maxDepth: number; maxFanOut: number }> = {},
): Promise<void> {
  await w.store.putPolicy({
    workspaceId: 'ws_1',
    maxDepth: over.maxDepth ?? 3,
    maxFanOut: over.maxFanOut ?? 5,
    allowedPairs: pairs,
    maxUnattendedBand: 'medium',
    updatedBy: 'u_1',
    updatedAt: '2026-10-09T09:00:00.000Z',
  });
}

/**
 * Start a parent run that stays open while `during` runs inside it — the way a
 * real Expert delegates from within its own run. Resolves with the parent's
 * result and whatever `during` returned.
 */
export async function insideRun<T>(
  w: World,
  parentAsk: DispatchRequest,
  during: (parentExecutionId: string) => Promise<T>,
): Promise<{ parent: Awaited<ReturnType<DispatchService['dispatch']>>; inner: T }> {
  let inner!: T;
  const original = w.preferred.run.bind(w.preferred);
  w.preferred.run = async (invocation, ctx) => {
    w.preferred.run = original;
    inner = await during(ctx.correlationId);
    return original(invocation, ctx);
  };
  const parent = await w.service.dispatch(ACTOR, parentAsk);
  return { parent, inner };
}
