/**
 * `T1941` (EPIC-047) — the context policy goes to `EPIC-038`; nothing is
 * assembled here.
 *
 * `FR-EXP-015`, `R-047-10`. The contract's context policy is passed to the
 * assembler with the run's objective and actor, and the package is bound to
 * the execution. If assembly refuses, the dispatch refuses — an Expert does not
 * run without the context its contract calls for. Unbound, `503`.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError, ValidationFailedError } from '../../src/core/errors.js';
import { refusingContextAssembler } from '../../src/modules/experts/experts.tokens.js';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { contract } from '../helpers/expert-fixtures.js';

describe('T1941 · context for a dispatch', () => {
  it('passes the policy, objective and actor, and binds the package to the execution', async () => {
    const w = await world();
    const result = await w.service.dispatch(ACTOR, ask());
    expect(w.context.assembled).toEqual([
      {
        workspaceId: 'ws_1',
        projectId: 'pr_1',
        objective: 'write the tests for the booking notification',
        actorId: 'u_1',
        actorRole: 'engineer',
        policy: contract().contextPolicy,
      },
    ]);
    expect(w.context.bound).toEqual([{ packageId: 'pkg_1', executionId: result.executionId }]);
    expect(result.contextPackageId).toBe('pkg_1');
  });

  it('an assembly refusal refuses the dispatch, on the record, before anything runs', async () => {
    const w = await world();
    w.ports.context = {
      async assemble() {
        throw new ValidationFailedError('an essential source was excluded by budget');
      },
    };
    const error = await w.service.dispatch(ACTOR, ask()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailedError);
    expect(w.executions.kindsFor('exe_1')).toEqual(['dispatch-refused']);
    expect(w.preferred.runs).toHaveLength(0);
  });

  it('unbound, the dispatch refuses 503', async () => {
    const w = await world();
    w.ports.context = refusingContextAssembler();
    await expect(w.service.dispatch(ACTOR, ask())).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
    expect(w.preferred.runs).toHaveLength(0);
  });
});
