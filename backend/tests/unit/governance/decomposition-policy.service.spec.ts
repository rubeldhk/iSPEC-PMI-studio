/**
 * `T1481` (EPIC-042, `FR-EXT-040`, `FR-EXT-051`, data-model.md §2) — one policy
 * per project: defaults on first read (`D-4`, strict offline mode), validated
 * ranges, a version that grows on every change.
 *
 * Written to FAIL before `T1482`.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { DecompositionPolicyService } from '../../../src/modules/governance/decomposition-policy.service.js';
import { InMemoryDecompositionPolicyStore } from '../../../src/modules/governance/decomposition-policy.store.js';

const CTX = { workspaceId: 'ws_a', projectId: 'p_a', userId: 'u_owner' };

function harness() {
  const audits: Record<string, unknown>[] = [];
  const service = new DecompositionPolicyService({ store: new InMemoryDecompositionPolicyStore(), audit: { record: async (row) => void audits.push(row) } });
  return { service, audits };
}

describe('T1481 · get', () => {
  it('creates the D-4 defaults on first read, strict offline mode, version 1', async () => {
    const { service } = harness();
    const policy = await service.get(CTX);
    expect(policy).toMatchObject({ oneSpecPerEpic: true, taskCeiling: 50, splitRequiresConfirmation: true, offlineMode: 'strict', version: 1 });
  });

  it('is one row per project: a second read returns the same version', async () => {
    const { service } = harness();
    await service.get(CTX);
    await service.get(CTX);
    expect((await service.get(CTX)).version).toBe(1);
  });
});

describe('T1481 · put', () => {
  it('validates the ranges and increments the version', async () => {
    const { service } = harness();
    const next = await service.put(CTX, { oneSpecPerEpic: true, taskCeiling: 30, splitRequiresConfirmation: false, offlineMode: 'provisional' });
    expect(next).toMatchObject({ taskCeiling: 30, splitRequiresConfirmation: false, offlineMode: 'provisional', version: 2 });
    expect((await service.get(CTX)).version).toBe(2);
  });

  it.each([
    ['ceiling 0', { taskCeiling: 0 }, 'taskCeiling'],
    ['ceiling 501', { taskCeiling: 501 }, 'taskCeiling'],
    ['offline mode outside the two', { offlineMode: 'sometimes' }, 'offlineMode'],
  ])('refuses %s naming the field', async (_label, patch, field) => {
    const { service } = harness();
    const err = await service.put(CTX, { oneSpecPerEpic: true, taskCeiling: 50, splitRequiresConfirmation: true, offlineMode: 'strict', ...patch } as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailedError);
    expect(JSON.stringify((err as ValidationFailedError).details)).toContain(field);
  });

  it('audits the change with the actor and the new version', async () => {
    const { service, audits } = harness();
    await service.put(CTX, { oneSpecPerEpic: false, taskCeiling: 40, splitRequiresConfirmation: true, offlineMode: 'strict' });
    expect(audits.at(-1)).toMatchObject({ workspaceId: 'ws_a', actorId: 'u_owner', action: 'update', targetType: 'decomposition_policy', outcome: 'success', detail: { projectId: 'p_a', operation: 'policy.update', version: 2 } });
  });
});
