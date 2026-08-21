/**
 * T340 — an unattended run completes without pausing and stops at the
 * user-selected range (FR-RUN-001, FR-RUN-002, FR-RUN-008a).
 */
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../../src/core/errors.js';
import { OTHER_WS, PROJECT, WS, harness, startUnattended, ask } from '../review/helpers.js';

describe('T340 · run mode and the user-selected stop point', () => {
  it('starts a run with the selected mode and stop range (FR-RUN-001)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    expect(run.mode).toBe('unattended');
    expect(run.stopRange).toBe('after_specification');
    expect(run.state).toBe('running');
  });

  it('refuses a run without a mode, naming the field', async () => {
    const h = harness();
    await expect(
      h.runMode.start(WS, { projectId: PROJECT, stopRange: 'through_tasks', initiatedById: 'u1' }),
    ).rejects.toThrow(ValidationFailedError);
  });

  it('refuses a run without a stop range, naming the field', async () => {
    const h = harness();
    await expect(
      h.runMode.start(WS, { projectId: PROJECT, mode: 'unattended', initiatedById: 'u1' }),
    ).rejects.toThrow(ValidationFailedError);
  });

  it('an unattended run never pauses: questions record while it stays running', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 5);
    // Five questions raised, zero stops — the run is still running.
    expect((await h.runMode.get(WS, run.id)).state).toBe('running');
  });

  it('stops at the selected range as a SUCCESS state and reports that it did (FR-RUN-008a)', async () => {
    const h = harness();
    const run = await startUnattended(h);
    const stopped = await h.runMode.reachStopPoint(WS, run.id);
    expect(stopped.state).toBe('reached_stop_point');
    expect(stopped.outcomeReason).toContain('after_specification');
    expect(stopped.endedAt).not.toBeNull();
  });

  it('continues past the stop point when asked, widening the range', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await h.runMode.reachStopPoint(WS, run.id);
    const continued = await h.runMode.continue(WS, run.id);
    expect(continued.state).toBe('running');
    expect(continued.stopRange).toBe('through_tasks');
  });

  it('refuses to continue a run that is not at its stop point', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await expect(h.runMode.continue(WS, run.id)).rejects.toThrow(ConflictError);
  });

  it('a cancelled run keeps the questions recorded so far', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await ask(h, run.id, 3);
    await h.runMode.cancel(WS, run.id);
    expect(await h.questions.listForRun(WS, run.id)).toHaveLength(3);
  });

  it('a run in another workspace is absent, never forbidden', async () => {
    const h = harness();
    const run = await startUnattended(h);
    await expect(h.runMode.get(OTHER_WS, run.id)).rejects.toThrow(NotFoundError);
  });
});
