/**
 * `T2561` (EPIC-047) — `ExpertExecutions` over `EPIC-037`'s registry, with an
 * identity minted for a run the platform itself dispatches. `DEF-047-001`.
 *
 * `FR-EXP-060`: every Expert run is registered before it begins. The registry
 * will register nothing without an authenticated principal, its identity
 * snapshot, a connector registration, a sponsor and an `execution.register`
 * delegation. Until now only a connector credential (`EPIC-043`) had those.
 *
 * What these tests hold the adapter to:
 *
 * - **One agent principal per (Expert, sponsoring user)**, reused. `EPIC-028`
 *   freezes a principal's sponsor, so one principal cannot serve two sponsors.
 * - **The sponsor must be able to act on the project.** `EPIC-024`'s delegation
 *   service grants whatever it is asked, so the adapter checks first: a user may
 *   not hand an agent authority they do not hold.
 * - **A delegation is reused while valid**, granted only when missing.
 * - **The identity an execution registered with is the one it completes under**,
 *   read back from the store when the adapter that registered it is gone.
 * - Nothing about a refusal is softened: the registry's code arrives in the
 *   platform's status vocabulary.
 */
import { describe, expect, it } from 'vitest';
import type {
  AppendEventRequest,
  CompleteExecutionRequest,
  RegisterExecutionRequest,
} from '@pmi/execution-registry-contract';
import { RegistryRefusedError } from '@pmi/execution-registry-contract';
import { ForbiddenError, ValidationFailedError } from '../../src/core/errors.js';
import { DelegationRefused } from '../../src/modules/access/principal-delegation.service.js';
import {
  expertExecutions,
  type ExpertIdentityPorts,
} from '../../src/modules/experts/adapters/executions.adapter.js';
import { InMemoryExpertIdentityStore } from '../../src/modules/experts/adapters/identity.store.js';

interface Delegation {
  id: string;
  principalId: string;
  artifactId: string;
  actions: readonly string[];
  identityVersion: number;
}

function world(options: { editors?: string[] } = {}) {
  const editors = new Set(options.editors ?? ['u_1:pr_1', 'u_2:pr_1']);
  const calls: string[] = [];
  const principals: { principalId: string; sponsorUserId: string; descriptorRef: string; connectorRegistrationId: string }[] = [];
  const delegations: Delegation[] = [];
  const registered: RegisterExecutionRequest[] = [];
  const appended: AppendEventRequest[] = [];
  const completed: CompleteExecutionRequest[] = [];
  let refuseRegistration: RegistryRefusedError | null = null;
  let ids = 0;

  const ports: ExpertIdentityPorts = {
    access: {
      async mayEdit(_ws, userId, artifact) {
        calls.push(`mayEdit ${userId} ${artifact.artifactType}:${artifact.artifactId}`);
        return editors.has(`${userId}:${artifact.artifactId}`);
      },
    },
    principals: {
      async ensureConnector(input) {
        calls.push(`ensureConnector ${input.kind}`);
        return { connectorId: 'cr_sandbox' };
      },
      async register(input) {
        calls.push(`registerPrincipal ${input.descriptorRef} sponsor=${input.sponsorUserId}`);
        const principalId = `pa_${principals.length + 1}`;
        principals.push({
          principalId,
          sponsorUserId: input.sponsorUserId,
          descriptorRef: input.descriptorRef,
          connectorRegistrationId: input.connectorRegistrationId!,
        });
        return { principalId };
      },
      async find(_ws, principalId) {
        const p = principals.find((x) => x.principalId === principalId);
        return p
          ? { principalId, identityVersion: 1, sponsorUserId: p.sponsorUserId, connectorRegistrationId: p.connectorRegistrationId }
          : null;
      },
    },
    snapshots: {
      async capture(_ws, principalId) {
        calls.push(`capture ${principalId}`);
        return { snapshotId: `snap_${++ids}` };
      },
    },
    delegations: {
      async requireDelegated(input) {
        const found = delegations.find(
          (d) => d.principalId === input.principalId && d.artifactId === input.artifact.artifactId && d.actions.includes(input.action),
        );
        if (!found) throw new DelegationRefused('no delegation');
        return { id: found.id, identityVersion: found.identityVersion };
      },
      async delegate(input) {
        calls.push(`delegate ${input.principalId} ${input.artifact.artifactType}:${input.artifact.artifactId} [${input.actions.join(',')}] by ${input.sponsorUserId}`);
        const row = {
          id: `dl_${delegations.length + 1}`,
          principalId: input.principalId,
          artifactId: input.artifact.artifactId,
          actions: input.actions,
          identityVersion: input.identityVersion,
        };
        delegations.push(row);
        return { id: row.id, identityVersion: row.identityVersion };
      },
    },
    registry: {
      async register(request) {
        if (refuseRegistration) throw refuseRegistration;
        registered.push(request);
        return { executionId: `exe_${registered.length}` };
      },
      async appendEvent(request) {
        appended.push(request);
      },
      async complete(request) {
        completed.push(request);
      },
    },
    timeline: {
      async projectIdOf() {
        return 'pr_1';
      },
      async events(_ws, _projectId, executionId) {
        return [
          { type: 'registered', payload: {} },
          ...appended
            .filter((a) => a.executionId === executionId)
            .map((a) => ({ type: a.type as string, payload: a.payload as Record<string, unknown> })),
        ];
      },
    },
  };
  return {
    ports,
    calls,
    principals,
    delegations,
    registered,
    appended,
    completed,
    refuse(error: RegistryRefusedError) {
      refuseRegistration = error;
    },
  };
}

const run = (over: Record<string, unknown> = {}) => ({
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  command: 'implement',
  actorId: 'u_1',
  expertKey: 'test-engineer',
  contractVersion: 3,
  model: 'model-a',
  objective: 'write the tests for the booking notification',
  ...over,
});

describe('T2561 · registering an Expert run under its own identity', () => {
  it('registers with the registry before anything runs, under the contract EPIC-037 expects', async () => {
    const w = world();
    const store = new InMemoryExpertIdentityStore();
    const { executionId } = await expertExecutions(w.ports, store).register(run());
    expect(executionId).toBe('exe_1');
    expect(w.registered).toHaveLength(1);
    const req = w.registered[0]!;
    expect(req).toMatchObject({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      command: 'implement',
      surface: 'managed-sandbox',
      input: { targetType: 'project', targetId: 'pr_1' },
      contractVersion: '1.0',
      argsSanitized: { expert: 'test-engineer', contractVersion: 3, model: 'model-a', objective: 'write the tests for the booking notification' },
      identity: {
        authenticatedPrincipalId: 'pa_1',
        agentSnapshotId: 'snap_1',
        connectorRegistrationId: 'cr_sandbox',
        sponsorUserId: 'u_1',
        delegationId: 'dl_1',
        delegationIdentityVersion: 1,
      },
    });
    expect(req).not.toHaveProperty('assurance');
    expect(req.idempotencyKey).toMatch(/\S/);
    expect(req.correlationId).toMatch(/\S/);
  });

  it('mints an agent principal sponsored by the dispatching user, on the managed-sandbox registration', async () => {
    const w = world();
    await expertExecutions(w.ports, new InMemoryExpertIdentityStore()).register(run());
    expect(w.calls).toEqual([
      'mayEdit u_1 project:pr_1',
      'ensureConnector managed-sandbox',
      'registerPrincipal engineering-expert:test-engineer sponsor=u_1',
      'capture pa_1',
      'delegate pa_1 project:pr_1 [execution.register,execution.report] by u_1',
    ]);
  });

  it('reuses the principal and the delegation for the same Expert and sponsor; a new snapshot each run', async () => {
    const w = world();
    const store = new InMemoryExpertIdentityStore();
    const executions = expertExecutions(w.ports, store);
    await executions.register(run());
    await executions.register(run());
    expect(w.principals).toHaveLength(1);
    expect(w.delegations).toHaveLength(1);
    expect(w.calls.filter((c) => c.startsWith('capture'))).toEqual(['capture pa_1', 'capture pa_1']);
    expect(w.registered.map((r) => r.identity.agentSnapshotId)).toEqual(['snap_1', 'snap_2']);
  });

  it('a second sponsor gets a principal of their own — a sponsor is frozen on the principal', async () => {
    const w = world();
    const executions = expertExecutions(w.ports, new InMemoryExpertIdentityStore());
    await executions.register(run({ actorId: 'u_1' }));
    await executions.register(run({ actorId: 'u_2' }));
    expect(w.principals.map((p) => p.sponsorUserId)).toEqual(['u_1', 'u_2']);
    expect(w.registered.map((r) => r.identity.sponsorUserId)).toEqual(['u_1', 'u_2']);
  });

  it('a principal found in a fresh adapter is reused, not minted again', async () => {
    const w = world();
    const store = new InMemoryExpertIdentityStore();
    await expertExecutions(w.ports, store).register(run());
    await expertExecutions(w.ports, store).register(run());
    expect(w.principals).toHaveLength(1);
  });

  it('a project the sponsor may not edit is refused 403 before anything is minted or registered', async () => {
    const w = world({ editors: [] });
    await expect(expertExecutions(w.ports, new InMemoryExpertIdentityStore()).register(run())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(w.calls).toEqual(['mayEdit u_1 project:pr_1']);
    expect(w.registered).toEqual([]);
  });

  it('a command that is not governed is refused 400 before anything is minted or registered (R-047-3)', async () => {
    const w = world();
    await expect(
      expertExecutions(w.ports, new InMemoryExpertIdentityStore()).register(run({ command: 'deploy' })),
    ).rejects.toThrow(ValidationFailedError);
    expect(w.calls).toEqual([]);
  });

  it('a run with no project is refused 400 — a delegation needs something to be on', async () => {
    const w = world();
    await expect(
      expertExecutions(w.ports, new InMemoryExpertIdentityStore()).register(run({ projectId: '  ' })),
    ).rejects.toThrow(ValidationFailedError);
    expect(w.registered).toEqual([]);
  });

  it("a registry refusal arrives in the platform's vocabulary, with the registry's own code", async () => {
    const w = world();
    w.refuse(new RegistryRefusedError('delegation_missing', 'no delegation for execution.register'));
    const error = await expertExecutions(w.ports, new InMemoryExpertIdentityStore())
      .register(run())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect((error as ForbiddenError).details).toMatchObject({ refusal: 'delegation_missing' });
  });

  it('a delegation store fault propagates; it is never read as "no delegation, so grant one"', async () => {
    const w = world();
    w.ports.delegations.requireDelegated = async () => {
      throw new Error('delegation store unreachable');
    };
    await expect(expertExecutions(w.ports, new InMemoryExpertIdentityStore()).register(run())).rejects.toThrow(
      /unreachable/,
    );
    expect(w.delegations).toEqual([]);
    expect(w.registered).toEqual([]);
  });
});

describe('T2561 · what happens on the execution afterwards', () => {
  async function registered() {
    const w = world();
    const store = new InMemoryExpertIdentityStore();
    const executions = expertExecutions(w.ports, store);
    const { executionId } = await executions.register(run());
    return { w, store, executions, executionId };
  }

  it('a governance fact is an expert-governance-recorded event carrying its kind, under the registered identity', async () => {
    const { w, executions, executionId } = await registered();
    await executions.record('ws_1', executionId, 'fallback-used', { model: 'model-b', reason: 'unavailable' });
    expect(w.appended).toEqual([
      expect.objectContaining({
        executionId,
        workspaceId: 'ws_1',
        type: 'expert-governance-recorded',
        payload: { model: 'model-b', reason: 'unavailable', kind: 'fallback-used' },
        identity: w.registered[0]!.identity,
      }),
    ]);
  });

  it('a kind outside the closed set is refused, never written as something else', async () => {
    const { w, executions, executionId } = await registered();
    await expect(executions.record('ws_1', executionId, 'approved-anyway', {})).rejects.toThrow(/approved-anyway/);
    expect(w.appended).toEqual([]);
  });

  it('a detail cannot overwrite the kind', async () => {
    const { w, executions, executionId } = await registered();
    await executions.record('ws_1', executionId, 'limit-reached', { kind: 'review-required', limit: 'time' });
    expect(w.appended[0]!.payload).toMatchObject({ kind: 'limit-reached', limit: 'time' });
  });

  it('completed carries an empty output binding; every other outcome carries none', async () => {
    const { w, executions, executionId } = await registered();
    await executions.complete('ws_1', executionId, 'completed', 'done');
    await executions.complete('ws_1', executionId, 'cancelled', 'stopped');
    expect(w.completed[0]).toMatchObject({ outcome: 'completed', output: {}, completionComment: 'done' });
    expect(w.completed[1]).toMatchObject({ outcome: 'cancelled', completionComment: 'stopped' });
    expect(w.completed[1]).not.toHaveProperty('output');
    expect(w.completed.every((c) => c.identity.authenticatedPrincipalId === 'pa_1')).toBe(true);
  });

  it('proposing completion records completion-proposed and completes nothing (FR-EXP-063)', async () => {
    const { w, executions, executionId } = await registered();
    await executions.proposeCompletion('ws_1', executionId, 'finished unattended: succeeded');
    expect(w.completed).toEqual([]);
    expect(w.appended).toEqual([
      expect.objectContaining({
        type: 'expert-governance-recorded',
        payload: { kind: 'completion-proposed', comment: 'finished unattended: succeeded' },
      }),
    ]);
  });

  it('eventsOf returns the Expert governance events only, as kind and detail', async () => {
    const { executions, executionId } = await registered();
    await executions.record('ws_1', executionId, 'fallback-used', { model: 'model-b' });
    await executions.record('ws_1', executionId, 'limit-narrowed', { limit: 'tokens' });
    expect(await executions.eventsOf('ws_1', executionId)).toEqual([
      { kind: 'fallback-used', detail: { model: 'model-b' } },
      { kind: 'limit-narrowed', detail: { limit: 'tokens' } },
    ]);
  });

  it('a fresh adapter completes under the identity the execution registered with', async () => {
    const { w, store, executionId } = await registered();
    await expertExecutions(w.ports, store).complete('ws_1', executionId, 'failed', 'stopped elsewhere');
    expect(w.completed[0]!.identity).toEqual(w.registered[0]!.identity);
  });

  it('an execution this adapter never registered is refused, not recorded under an invented identity', async () => {
    const { w, executions } = await registered();
    await expect(executions.record('ws_1', 'exe_unknown', 'fallback-used', {})).rejects.toThrow(/exe_unknown/);
    await expect(executions.complete('ws_1', 'exe_unknown', 'failed', 'x')).rejects.toThrow(/exe_unknown/);
    expect([...w.appended, ...w.completed]).toEqual([]);
  });

  it('another workspace cannot reach an execution through its id', async () => {
    const { executions, executionId } = await registered();
    await expect(executions.record('ws_2', executionId, 'fallback-used', {})).rejects.toThrow(new RegExp(executionId));
  });
});
