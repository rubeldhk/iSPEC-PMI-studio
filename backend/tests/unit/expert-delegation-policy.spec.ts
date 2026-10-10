/**
 * `T1945` (EPIC-047) — delegation happens only where contract and policy both
 * permit it.
 *
 * `FR-EXP-030`, `FR-EXP-033`. No policy means no delegation — the absence of a
 * rule is not a permission. A pair the policy does not allow, or that the
 * delegating contract does not name in `delegatesTo`, is refused; depth and
 * fan-out are bounded; `*` permits any delegate the contract names.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { addApproved, allowDelegation, ask, insideRun, world, ACTOR } from '../helpers/expert-dispatch.js';
import type { ExpertSession } from '../../src/modules/experts/expert.types.js';
import { contract } from '../helpers/expert-fixtures.js';

/** A session row still running, as a delegation parent. */
function running(executionId: string, expertId: string, contractVersionId: string, depth: number, parent: string | null): ExpertSession {
  return {
    executionId, workspaceId: 'ws_1', expertId, contractVersionId, delegatedFromExecutionId: depth === 0 ? null : parent,
    depth, model: 'claude-opus-5-5', usedFallback: false, fallbackReason: null,
    effectiveAuthority: { capabilities: ['test', 'analyze'], tools: ['read-file', 'run-tests'], permissions: [{ artifactType: 'specification', action: 'read' }], prohibitedActions: ['push', 'delete-branch'] },
    toolObservation: 'unobserved', unattended: false, reviewRequired: false, outcome: null,
    startedAt: '2026-10-09T08:00:00.000Z', endedAt: null,
  };
}

/** The default Expert (`test-engineer`) may delegate to `reviewer` by contract. */
async function delegatingWorld() {
  const w = await world({ contract: contract({ delegatesTo: ['reviewer'] }) });
  await addApproved(w, 'reviewer');
  return w;
}

const delegate = (w: Awaited<ReturnType<typeof world>>, parent: string, expertId = 'ex_reviewer') =>
  w.service.dispatch(ACTOR, ask({ expertId, delegatedFromExecutionId: parent })).catch((e: unknown) => e);

describe('T1945 · delegation policy', () => {
  it('no policy, no delegation', async () => {
    const w = await delegatingWorld();
    const { inner } = await insideRun(w, ask(), (parent) => delegate(w, parent));
    expect(inner).toBeInstanceOf(ValidationFailedError);
    expect((inner as Error).message).toMatch(/no delegation policy/);
  });

  it('a pair the policy allows and the contract names is admitted', async () => {
    const w = await delegatingWorld();
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    const { inner } = await insideRun(w, ask(), (parent) => delegate(w, parent));
    expect(inner).toMatchObject({ outcome: 'succeeded' });
  });

  it('`*` permits any delegate the contract names', async () => {
    const w = await delegatingWorld();
    await allowDelegation(w, [{ from: 'test-engineer', to: '*' }]);
    const { inner } = await insideRun(w, ask(), (parent) => delegate(w, parent));
    expect(inner).toMatchObject({ outcome: 'succeeded' });
  });

  it('a pair the policy does not allow is refused', async () => {
    const w = await delegatingWorld();
    await allowDelegation(w, [{ from: 'test-engineer', to: 'architect' }]);
    const { inner } = await insideRun(w, ask(), (parent) => delegate(w, parent));
    expect((inner as Error).message).toMatch(/policy does not permit test-engineer → reviewer/);
  });

  it('a delegate the contract does not name is refused, whatever the policy says', async () => {
    const w = await world();
    await addApproved(w, 'reviewer');
    await allowDelegation(w, [{ from: 'test-engineer', to: '*' }]);
    const { inner } = await insideRun(w, ask(), (parent) => delegate(w, parent));
    expect((inner as Error).message).toMatch(/contract of test-engineer does not name reviewer/);
  });

  it('fan-out is bounded per session', async () => {
    const w = await delegatingWorld();
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }], { maxFanOut: 1 });
    const { inner } = await insideRun(w, ask(), async (parent) => [await delegate(w, parent), await delegate(w, parent)]);
    expect(inner[0]).toMatchObject({ outcome: 'succeeded' });
    expect((inner[1] as Error).message).toMatch(/fan-out/);
  });

  it('depth is bounded', async () => {
    const w = await world();
    await addApproved(w, 'reviewer', { delegatesTo: ['auditor'] });
    await addApproved(w, 'auditor');
    await allowDelegation(w, [{ from: 'reviewer', to: 'auditor' }], { maxDepth: 1 });
    // A reviewer already running at depth 1: its delegate would sit at depth 2.
    await w.store.addSession(running('exe_reviewer', 'ex_reviewer', 'cv_reviewer', 1, 'exe_root'));
    const e = await delegate(w, 'exe_reviewer', 'ex_auditor');
    expect((e as Error).message).toMatch(/depth 2 exceeds the policy's maximum of 1/);
  });

  it('a session that has already ended delegates nothing', async () => {
    const w = await delegatingWorld();
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    const parent = await w.service.dispatch(ACTOR, ask());
    expect((await delegate(w, parent.executionId)) as Error).toBeInstanceOf(ValidationFailedError);
    expect(((await delegate(w, parent.executionId)) as Error).message).toMatch(/has ended/);
  });

  it('an unknown parent is refused, not treated as a root', async () => {
    const w = await delegatingWorld();
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    expect(((await delegate(w, 'exe_nowhere')) as Error).message).toMatch(/no Expert session exe_nowhere/);
  });
});
