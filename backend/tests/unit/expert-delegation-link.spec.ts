/**
 * `T1951` (EPIC-047) — a delegate is its own record, linked to its parent.
 *
 * `FR-EXP-031`, `R-047-3`. The delegate is a separate execution with its own
 * session naming its own Expert and contract version. Its link is
 * `delegatedFromExecutionId` — **not** `EPIC-037`'s re-run parent, which would
 * make every delegated session read as a retry. Depth is the parent's plus one.
 */
import { describe, expect, it } from 'vitest';
import { addApproved, allowDelegation, ask, insideRun, world, ACTOR } from '../helpers/expert-dispatch.js';
import { contract } from '../helpers/expert-fixtures.js';

describe('T1951 · delegation linkage', () => {
  it('records the delegate as its own linked session at depth + 1', async () => {
    const w = await world({ contract: contract({ delegatesTo: ['reviewer'] }) });
    await addApproved(w, 'reviewer');
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    const { parent, inner } = await insideRun(w, ask(), (root) =>
      w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: root })),
    );
    expect(inner.executionId).not.toBe(parent.executionId);
    const child = await w.store.findSession('ws_1', inner.executionId);
    expect(child).toMatchObject({
      expertId: 'ex_reviewer',
      contractVersionId: 'cv_reviewer',
      delegatedFromExecutionId: parent.executionId,
      depth: 1,
    });
  });

  it('registers the delegate with no re-run parent — delegation is not a retry', async () => {
    const w = await world({ contract: contract({ delegatesTo: ['reviewer'] }) });
    await addApproved(w, 'reviewer');
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    await insideRun(w, ask(), (root) => w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: root })));
    for (const registered of w.executions.registered) {
      expect(registered).not.toHaveProperty('parentExecutionId');
    }
    expect(w.executions.registered.map((r) => r.expertKey)).toEqual(['test-engineer', 'reviewer']);
  });
});
