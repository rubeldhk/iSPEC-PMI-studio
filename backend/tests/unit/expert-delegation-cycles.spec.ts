/**
 * `T1947` (EPIC-047) — no Expert appears twice on one chain; refusals land on
 * the parent.
 *
 * `FR-EXP-032`, `FR-EXP-035`. A→A and A→B→A are cycles and refused. A refused
 * delegation is recorded as `delegation-refused` on the **parent** session's
 * execution — the session that asked — as well as on the attempt itself.
 */
import { describe, expect, it } from 'vitest';
import { addApproved, allowDelegation, ask, insideRun, world, ACTOR } from '../helpers/expert-dispatch.js';
import { contract } from '../helpers/expert-fixtures.js';

describe('T1947 · delegation cycles', () => {
  it('A → A is refused, recorded on the parent', async () => {
    const w = await world({ contract: contract({ delegatesTo: ['test-engineer'] }) });
    await allowDelegation(w, [{ from: 'test-engineer', to: 'test-engineer' }]);
    const { parent, inner } = await insideRun(w, ask(), (root) =>
      w.service.dispatch(ACTOR, ask({ delegatedFromExecutionId: root })).catch((e: unknown) => e as Error),
    );
    expect((inner as Error).message).toMatch(/cycle.*test-engineer/);
    expect(w.executions.kindsFor(parent.executionId)).toContain('delegation-refused');
  });

  it('A → B → A is refused', async () => {
    const w = await world({ contract: contract({ delegatesTo: ['reviewer'] }) });
    await addApproved(w, 'reviewer', { delegatesTo: ['test-engineer'] });
    await allowDelegation(w, [
      { from: 'test-engineer', to: 'reviewer' },
      { from: 'reviewer', to: 'test-engineer' },
    ]);
    // reviewer is mid-run under test-engineer when it tries to hand back.
    const reviewerRunner = w.preferred;
    const { inner } = await insideRun(w, ask(), async (root) => {
      const back = new Promise<unknown>((resolve) => {
        const original = reviewerRunner.run.bind(reviewerRunner);
        reviewerRunner.run = async (invocation, ctx) => {
          reviewerRunner.run = original;
          resolve(
            await w.service
              .dispatch(ACTOR, ask({ expertId: 'ex_test', delegatedFromExecutionId: ctx.correlationId }))
              .catch((e: unknown) => e as Error),
          );
          return original(invocation, ctx);
        };
      });
      await w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: root }));
      return back;
    });
    expect((inner as Error).message).toMatch(/cycle/);
  });
});
