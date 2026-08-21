/**
 * T823 — a run meeting a condition it cannot proceed past STOPS, preserves
 * every piece of completed work, and records the reason (FR-RUN-008) —
 * distinct from `reached_stop_point`, which is a success state.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../../src/core/errors.js';
import { WS, harness, startUnattended, ask } from '../review/helpers.js';

describe('T823 · the unrecoverable stop', () => {
  it('stops as failed and records the reason', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const failed = await h.runMode.failUnrecoverable(WS, run.id, 'Engine sandbox lost its container.');
    expect(failed.state).toBe('failed');
    expect(failed.outcomeReason).toBe('Engine sandbox lost its container.');
    expect(failed.endedAt).not.toBeNull();
  });

  it('refuses an unrecoverable stop with no recorded reason', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await expect(h.runMode.failUnrecoverable(WS, run.id, '  ')).rejects.toThrow(ValidationFailedError);
  });

  it('preserves every piece of completed work — questions and markings survive', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const raised = await ask(h, run.id, 4);
    await h.provisional.mark(WS, { artifactType: 'specification', artifactId: 's1' }, raised[0]!.id);

    await h.runMode.failUnrecoverable(WS, run.id, 'Out of budget.');

    expect(await h.questions.listForRun(WS, run.id)).toHaveLength(4);
    expect(
      await h.provisional.isProvisional(WS, { artifactType: 'specification', artifactId: 's1' }),
    ).toBe(true);
  });

  it('is distinct from reached_stop_point — the success state carries its own reason', async () => {
    const h = harness();
    const runA = await startUnattended(h);
    const runB = await startUnattended(h);
    const stopped = await h.runMode.reachStopPoint(WS, runA.id);
    const failed = await h.runMode.failUnrecoverable(WS, runB.id, 'Disk full.');
    expect(stopped.state).toBe('reached_stop_point');
    expect(failed.state).toBe('failed');
    expect(stopped.state).not.toBe(failed.state);
  });
});
