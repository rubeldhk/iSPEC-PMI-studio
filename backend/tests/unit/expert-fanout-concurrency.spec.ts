/**
 * `T2534` (EPIC-047 Convergence) — fan-out holds under concurrency.
 *
 * `FR-EXP-033`. The bound was checked against the current number of delegates
 * and the delegate's row inserted several awaits later, so delegations arriving
 * together could all pass. The check and the insert are now one step in the
 * store. The PostgreSQL half is `backend/tests/integration/expert-fanout-prisma.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { ExpertSession } from '../../src/modules/experts/expert.types.js';
import { InMemoryExpertsStore } from '../../src/modules/experts/experts.store.js';
import { ACTOR, addApproved, allowDelegation, ask, insideRun, world } from '../helpers/expert-dispatch.js';
import { contract } from '../helpers/expert-fixtures.js';

const row = (executionId: string, parent: string | null): ExpertSession => ({
  executionId, workspaceId: 'ws_1', expertId: 'ex_test', contractVersionId: 'cv_1', delegatedFromExecutionId: parent,
  actorId: 'u_1', depth: parent === null ? 0 : 1, model: 'm', usedFallback: false, fallbackReason: null,
  effectiveAuthority: { capabilities: [], tools: [], permissions: [], prohibitedActions: [] },
  toolObservation: 'unobserved', unattended: false, reviewRequired: false, outcome: null,
  startedAt: '2026-10-09T09:00:00.000Z', endedAt: null,
});

describe('T2534 · fan-out under concurrency', () => {
  it('the store admits a delegate row only while the parent is under its bound', async () => {
    const store = new InMemoryExpertsStore();
    await store.addSession(row('root', null));
    const results = await Promise.all(['a', 'b', 'c'].map((id) => store.addDelegateSession(row(id, 'root'), 2)));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await store.childrenOf('ws_1', 'root')).toHaveLength(2);
  });

  it('three delegations arriving together under a bound of one: one runs, two are refused', async () => {
    const w = await world({ contract: contract({ delegatesTo: ['reviewer'] }) });
    await addApproved(w, 'reviewer');
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }], { maxFanOut: 1 });
    const { inner } = await insideRun(w, ask(), (parent) =>
      Promise.all(
        [0, 1, 2].map(() =>
          w.service
            .dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: parent }))
            .catch((e: unknown) => e as Error),
        ),
      ),
    );
    const refused = inner.filter((r) => r instanceof Error);
    expect(inner.length - refused.length).toBe(1);
    for (const e of refused) expect((e as Error).message).toMatch(/fan-out/);
  });
});
