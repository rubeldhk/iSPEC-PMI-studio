/**
 * `T2000` (EPIC-047) — a run that fails after it started is a failed run, not a refused dispatch.
 *
 * `FR-EXP-061`, `FR-EXP-037`. Once the session row exists the dispatch was
 * admitted; whatever goes wrong after that — the runner throwing, or settling,
 * charging or proposing failing — ends the session `failed`, records a run
 * failure on the execution, and closes the execution as failed. It is never
 * recorded as `dispatch-refused`, and no session is left at `outcome = null`,
 * where it could still accept delegates.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, addApproved, allowDelegation, ask, world } from '../helpers/expert-dispatch.js';
import { contract, runner } from '../helpers/expert-fixtures.js';

describe('T2000 · a run that fails after it started', () => {
  it('a runner that throws ends the session failed, records a run failure, and closes the execution failed', async () => {
    const w = await world();
    w.preferred.run = async () => {
      throw new Error('the provider went away mid-run');
    };

    await expect(w.service.dispatch(ACTOR, ask())).rejects.toThrow(/the provider went away/);

    const session = await w.store.findSession('ws_1', 'exe_1');
    expect(session?.outcome).toBe('failed');
    expect(session?.endedAt).not.toBeNull();
    const kinds = w.executions.kindsFor('exe_1');
    expect(kinds).toContain('run-failed');
    expect(kinds).not.toContain('dispatch-refused');
    expect(w.executions.completed).toEqual([expect.objectContaining({ executionId: 'exe_1', outcome: 'failed' })]);
  });

  it('the error carries the execution id, so the caller can open the record', async () => {
    const w = await world();
    w.preferred.run = async () => {
      throw new Error('boom');
    };
    const error = await w.service.dispatch(ACTOR, ask()).catch((e: unknown) => e);
    expect((error as { details?: { executionId?: string } }).details?.executionId).toBe('exe_1');
  });

  it('a failure while charging consumption after the run still closes the run as failed, never refused', async () => {
    const w = await world();
    w.preferred.run = async () => ({ status: 'succeeded', outputs: ['test-report'], consumption: { tokens: 10 } });
    const putLimit = w.store.putLimit.bind(w.store);
    w.store.putLimit = async (row) => {
      if (row.consumed !== null) throw new Error('the store refused the charge');
      return putLimit(row);
    };

    await expect(w.service.dispatch(ACTOR, ask())).rejects.toThrow(/refused the charge/);

    expect((await w.store.findSession('ws_1', 'exe_1'))?.outcome).not.toBeNull();
    expect(w.executions.kindsFor('exe_1')).toContain('run-failed');
    expect(w.executions.kindsFor('exe_1')).not.toContain('dispatch-refused');
    expect(w.executions.completed.filter((c) => c.executionId === 'exe_1')).toEqual([
      expect.objectContaining({ outcome: 'failed' }),
    ]);
  });

  it('a failure while proposing an unattended completion closes the run as failed', async () => {
    const w = await world();
    w.executions.proposeCompletion = async () => {
      throw new Error('the registry refused the proposal');
    };
    await expect(w.service.dispatch(ACTOR, ask({ unattended: true }))).rejects.toThrow(/refused the proposal/);
    expect(w.executions.kindsFor('exe_1')).toContain('run-failed');
    expect(w.executions.kindsFor('exe_1')).not.toContain('dispatch-refused');
    expect(w.executions.completed).toEqual([expect.objectContaining({ executionId: 'exe_1', outcome: 'failed' })]);
  });

  it('a session whose run threw accepts no delegates afterwards', async () => {
    const w = await world({ contract: contract({ delegatesTo: ['reviewer'] }) });
    await addApproved(w, 'reviewer', { models: { preferred: 'child-model', fallbacks: [] } });
    await allowDelegation(w, [{ from: 'test-engineer', to: 'reviewer' }]);
    w.preferred.run = async () => {
      throw new Error('boom');
    };
    await expect(w.service.dispatch(ACTOR, ask())).rejects.toThrow(/boom/);

    w.preferred.run = runner().run;
    await expect(
      w.service.dispatch(ACTOR, ask({ expertId: 'ex_reviewer', delegatedFromExecutionId: 'exe_1' })),
    ).rejects.toThrow(/has ended \(failed\)/);
  });
});
