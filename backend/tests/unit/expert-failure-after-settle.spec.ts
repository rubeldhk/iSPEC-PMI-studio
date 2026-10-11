/**
 * `T2530` (EPIC-047 Convergence) — a failure after the run settled does not
 * rewrite how it ended.
 *
 * `FR-EXP-061`. Once `#settle` has ended the session `succeeded` or
 * `incomplete`, a later failure — stopping delegates, charging consumption,
 * closing the execution — is recorded, but it must not leave the session saying
 * one thing and the execution another. The second audit found exactly that: the
 * session read `succeeded` while the execution was completed `failed`.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';

describe('T2530 · failure after settle', () => {
  it('an attended run whose closing write fails stays succeeded, and is never closed as failed', async () => {
    const w = await world();
    const complete = w.executions.complete.bind(w.executions);
    let first = true;
    w.ports.executions = {
      ...w.executions,
      async complete(ws, id, outcome, comment) {
        if (first) {
          first = false;
          throw new Error('registry write timed out');
        }
        return complete(ws, id, outcome, comment);
      },
    };
    await expect(w.service.dispatch(ACTOR, ask())).rejects.toThrow(/timed out/);
    const session = await w.store.findSession('ws_1', 'exe_1');
    expect(session?.outcome).toBe('succeeded');
    expect(w.executions.completed.map((c) => c.outcome)).not.toContain('failed');
    // Closed as it ended, on the retry.
    expect(w.executions.completed.map((c) => c.outcome)).toEqual(['completed']);
    const failure = w.executions.events.find((e) => e.kind === 'run-failed');
    expect(failure?.detail).toMatchObject({ settledOutcome: 'succeeded', reason: expect.stringMatching(/timed out/) });
  });

  it('an unattended run whose proposal fails stays succeeded, is not completed at all, and records why', async () => {
    const w = await world();
    w.ports.executions = {
      ...w.executions,
      async proposeCompletion() {
        throw new Error('proposal store unreachable');
      },
    };
    await expect(w.service.dispatch(ACTOR, ask({ unattended: true }))).rejects.toThrow(/unreachable/);
    expect((await w.store.findSession('ws_1', 'exe_1'))?.outcome).toBe('succeeded');
    // Unattended work is proposed, never completed by the Expert (FR-EXP-063) — not even on failure.
    expect(w.executions.completed).toEqual([]);
    expect(w.executions.events.find((e) => e.kind === 'run-failed')?.detail).toMatchObject({ settledOutcome: 'succeeded' });
  });

  it('a failure before settle still ends the session failed and closes the execution failed', async () => {
    const w = await world();
    w.preferred.run = async () => {
      throw new Error('runner crashed');
    };
    await expect(w.service.dispatch(ACTOR, ask())).rejects.toThrow(/crashed/);
    expect((await w.store.findSession('ws_1', 'exe_1'))?.outcome).toBe('failed');
    expect(w.executions.completed.map((c) => c.outcome)).toEqual(['failed']);
  });
});
