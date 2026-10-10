/**
 * `T2012` (EPIC-047) — a fault reading the effective version is a refusal on the record too.
 *
 * `FR-EXP-061`, contracts/experts-api.md. Every refusal after the shape check
 * is an event on a registered execution. Reading which contract version is in
 * force asks `EPIC-031` (`ContractApprovals`); when that port is unbound or
 * faults, the dispatch is refused like any other — registered first, then
 * recorded `dispatch-refused`, closed, and returned with the execution id and
 * the port's own status (`503` stays `503`).
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError } from '../../src/core/errors.js';
import { refusingContractApprovals } from '../../src/modules/experts/experts.tokens.js';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { contract, version } from '../helpers/expert-fixtures.js';

describe('T2012 · early faults are refusals on a registered execution', () => {
  it('an unbound ContractApprovals is recorded as dispatch-refused, and stays a 503', async () => {
    const w = await world();
    w.ports.approvals = refusingContractApprovals();

    const error = await w.service.dispatch(ACTOR, ask()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GovernanceSeamUnboundError);
    expect((error as GovernanceSeamUnboundError).details).toMatchObject({ executionId: 'exe_1' });
    expect(w.executions.registered).toHaveLength(1);
    expect(w.executions.kindsFor('exe_1')).toEqual(['dispatch-refused']);
    expect(w.executions.events[0]?.detail['reason']).toMatch(/ContractApprovals/);
    expect(w.executions.completed).toEqual([expect.objectContaining({ executionId: 'exe_1', outcome: 'cancelled' })]);
  });

  it('a ContractApprovals fault is recorded the same way', async () => {
    const w = await world();
    w.ports.approvals = {
      ...w.approvals,
      async resolutionOf() {
        throw new Error('the decision store timed out');
      },
    };
    await expect(w.service.dispatch(ACTOR, ask())).rejects.toThrow(/timed out/);
    expect(w.executions.kindsFor('exe_1')).toEqual(['dispatch-refused']);
  });

  it('registers under the newest version when none is yet known to be in force, and records the one that is', async () => {
    const w = await world();
    await w.store.addVersion(version({ id: 'cv_2', version: 2, contract: contract({ models: { preferred: 'draft-model', fallbacks: [] } }) }));
    const result = await w.service.dispatch(ACTOR, ask());
    expect(w.executions.registered[0]).toMatchObject({ contractVersion: 2, model: 'draft-model' });
    expect(w.executions.events.find((e) => e.kind === 'contract-version-in-force')?.detail).toMatchObject({
      contractVersion: 1,
      model: 'claude-opus-5-5',
    });
    expect(result.contractVersion).toBe(1);
  });
});
