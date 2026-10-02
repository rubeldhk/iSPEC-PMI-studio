/**
 * `T1485` (EPIC-042, `FR-EXT-041`, `FR-EXT-046`–`048`, `R-042-7`, `R-042-8`,
 * data-model.md §9) — the decomposition plan is a projection over the project
 * context reads and the policy; first-run is a platform fact.
 *
 * Written to FAIL before `T1486`.
 */
import { describe, expect, it } from 'vitest';
import { DecompositionPlanService } from '../../../src/modules/governance/decomposition-plan.service.js';
import { DecompositionPolicyService } from '../../../src/modules/governance/decomposition-policy.service.js';
import { InMemoryDecompositionPolicyStore } from '../../../src/modules/governance/decomposition-policy.store.js';

const CTX = { credentialId: 'cred_a', workspaceId: 'ws_a', projectId: 'p_a', principalId: 'pr_a' };
const REQ = (reference: string) => ({ id: `r_${reference}`, reference, description: `${reference} shall`, type: 'functional', priority: 'p1', status: 'approved', baselineState: null });

function harness(opts: { groups?: unknown[]; completedSpecify?: boolean; openSpecify?: string | null } = {}) {
  const audits: Record<string, unknown>[] = [];
  const policy = new DecompositionPolicyService({ store: new InMemoryDecompositionPolicyStore(), audit: { record: async () => undefined } });
  const service = new DecompositionPlanService({
    context: {
      context: async () => ({ projectId: 'p_a', name: 'Alpha', epics: [], epicSource: 'unavailable-until-EPIC-044' }),
      requirementsByEpic: async () => ({ groups: (opts.groups ?? []) as never, epicSource: 'unavailable-until-EPIC-044' as const }),
    } as never,
    policy,
    executions: {
      hasCompletedCommand: async (_ws: string, _p: string, command: string) => command === 'specify' && (opts.completedSpecify ?? false),
      openCommand: async (_ws: string, _p: string, command: string) => (command === 'specify' ? (opts.openSpecify ?? null) : null),
    },
    audit: { record: async (row) => void audits.push(row) },
  });
  return { service, audits };
}

describe('T1485 · the plan', () => {
  it('carries the policy with its version, the Epic groups, the unassigned bundle, and the derivation', async () => {
    const { service } = harness({
      groups: [
        { epic: { number: 1, slug: 'intake', name: 'Intake' }, requirements: [REQ('REQ-001'), REQ('REQ-002')] },
        { epic: 'unassigned', requirements: [REQ('REQ-009')] },
      ],
    });
    const plan = await service.plan(CTX);
    expect(plan.policy).toMatchObject({ oneSpecPerEpic: true, taskCeiling: 50, splitRequiresConfirmation: true, offlineMode: 'strict', version: 1 });
    expect(plan.epics).toEqual([{ number: 1, slug: 'intake', name: 'Intake', requirements: [REQ('REQ-001'), REQ('REQ-002')] }]);
    expect(plan.unassigned).toEqual([REQ('REQ-009')]);
    expect(plan.epicSource).toBe('unavailable-until-EPIC-044');
  });

  it('firstRun is true only when no completed specify execution exists for the project', async () => {
    expect((await harness({ completedSpecify: false }).service.plan(CTX)).firstRun).toBe(true);
    expect((await harness({ completedSpecify: true }).service.plan(CTX)).firstRun).toBe(false);
  });

  it('a project with no Epic and no baselined or approved requirement is nothing to decompose', async () => {
    const { service } = harness({ groups: [{ epic: 'unassigned', requirements: [{ ...REQ('REQ-001'), status: 'draft' }] }] });
    const plan = await service.plan(CTX);
    expect(plan.epics).toEqual([]);
    expect(plan.unassigned).toEqual([]);
    expect(plan.nothingToDecompose).toBe(true);
  });

  it('audits the read naming the connector principal', async () => {
    const { service, audits } = harness();
    await service.plan(CTX);
    expect(audits.at(-1)).toMatchObject({ workspaceId: 'ws_a', actorId: 'pr_a', targetType: 'project', targetId: 'p_a', detail: { kind: 'connector', operation: 'decomposition.read', credentialId: 'cred_a' } });
  });
});

describe('T1544 · openFirstRun names a registered, non-terminal specify execution (Phase 9, edge case)', () => {
  it('is null when none is open and the execution id when one is', async () => {
    expect((await harness({}).service.plan(CTX)).openFirstRun).toBeNull();
    expect((await harness({ openSpecify: 'exec_9' }).service.plan(CTX)).openFirstRun).toBe('exec_9');
  });
});
