/**
 * `T2186` (EPIC-039, API contract §6, `R-039-11`) — the
 * `integrations.evidence-intake` job.
 *
 * A job, not a route: the enqueue route records the request, and this handler
 * works every due intake on the module's ticker (`R-039-6` — the same unref'd
 * timer as health, `manual` in route tests, `off` in every other test process).
 * `jobs/` is on-demand BullMQ with an optional queue, so a re-read every 120 s
 * built on it would silently never run on a local stack.
 */
import type { Ticker } from '../health/ticker.js';
import type { EvidenceIntakeService } from './evidence-intake.service.js';

export const INTAKE_JOB = 'integrations.evidence-intake';

/** The intake job ticks every 30 s; each intake's own `nextAttemptAt` decides whether it is due. */
export const INTAKE_TICK_MS = 30_000;

export function startIntakeJob(ticker: Ticker, intake: EvidenceIntakeService): void {
  ticker.start(INTAKE_TICK_MS, async () => {
    await intake.runDue();
  });
}
