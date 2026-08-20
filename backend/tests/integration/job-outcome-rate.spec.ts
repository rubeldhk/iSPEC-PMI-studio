/**
 * T147a — SC-011: 95% of generation requests complete or report a NAMED
 * failure within the configured wall-clock limit (FR-025; 10 minutes by
 * default in production — asserted separately in
 * `worker/tests/unit/job-timeout-default.spec.ts`; shrunk here so the
 * measurement itself fits in a test run).
 *
 * This is a measurement, not a mock-check: a batch of 100 real
 * `GenerateSpecificationService.run` executions — most succeeding, some
 * failing every named way, some hanging past the limit — and the rate is
 * computed from what actually came back, within a wall clock the test
 * enforces on itself.
 */
import { describe, expect, it } from 'vitest';
import { GenerateSpecificationService } from '../../src/modules/specifications/generate-specification.service.js';
import { InMemorySpecificationStore } from '../../src/modules/specifications/specifications-read.service.js';
import { OUTPUT, StubEngine, WS, selection } from '../unit/specifications/helpers.js';

const TIMEOUT_MS = 200; // the configured wall-clock limit for this measurement
const BATCH = 100;

function service(engine: StubEngine): {
  service: GenerateSpecificationService;
  store: InMemorySpecificationStore;
} {
  const store = new InMemorySpecificationStore();
  return {
    store,
    service: new GenerateSpecificationService({ resolveForProject: async () => engine }, store),
  };
}

function order(jobId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    jobId,
    workspaceId: WS,
    projectId: 'proj_rate',
    requestedById: 'u1',
    correlationId: `corr_${jobId}`,
    projectName: 'Rate probe',
    requirements: selection(),
    timeoutMs: TIMEOUT_MS,
    ...over,
  };
}

describe('T147a · generation outcome rate (SC-011, FR-025)', () => {
  it(
    `${BATCH} requests all terminate within the limit; >=95% complete or name their failure`,
    { timeout: 60_000 },
    async () => {
      // 85 succeed, 10 fail each naming a reason, 5 hang until the wall clock
      // cuts them off. The hang case is the one SC-011 exists for: an engine
      // that never answers must still produce a terminal, named outcome.
      const runs: Promise<{ state: string; failureReason?: string; elapsedMs: number }>[] = [];

      const launch = (engine: StubEngine, jobId: string): void => {
        const { service: svc } = service(engine);
        const startedAt = performance.now();
        runs.push(
          svc
            .run(order(jobId) as never)
            .then((outcome) => ({ ...outcome, elapsedMs: performance.now() - startedAt })),
        );
      };

      for (let i = 0; i < 85; i++) launch(StubEngine.returning(OUTPUT), `job_ok_${i}`);
      for (let i = 0; i < 10; i++)
        launch(StubEngine.failing(i % 2 === 0 ? 'engine_error' : 'engine_unavailable'), `job_fail_${i}`);
      for (let i = 0; i < 5; i++)
        launch(new StubEngine(() => new Promise(() => {})), `job_hang_${i}`);

      const outcomes = await Promise.all(runs);
      expect(outcomes.length).toBe(BATCH);

      // Every request reached a terminal state — nothing is still pending, and
      // nothing took materially longer than the configured limit.
      const GRACE_MS = 500; // scheduler jitter, not a loophole
      for (const outcome of outcomes) {
        expect(['succeeded', 'failed', 'timed_out', 'cancelled']).toContain(outcome.state);
        expect(outcome.elapsedMs).toBeLessThan(TIMEOUT_MS + GRACE_MS);
      }

      // SC-011's number: complete, or report a NAMED failure, within the limit.
      const resolved = outcomes.filter(
        (o) =>
          o.state === 'succeeded' ||
          (typeof o.failureReason === 'string' && o.failureReason.length > 0),
      );
      const rate = resolved.length / outcomes.length;
      expect(rate).toBeGreaterThanOrEqual(0.95);

      // And the hang path specifically: cut off at the limit, named 'timeout'.
      const timedOut = outcomes.filter((o) => o.state === 'timed_out');
      expect(timedOut.length).toBe(5);
      for (const o of timedOut) expect(o.failureReason).toBe('timeout');
    },
  );

  it('a timed-out request stores no partial artifact (FR-027 rides SC-011)', async () => {
    const { service: svc, store } = service(new StubEngine(() => new Promise(() => {})));
    const outcome = await svc.run(order('job_hang_solo') as never);
    expect(outcome.state).toBe('timed_out');
    expect(store.all()).toEqual([]);
    expect(store.allVersions()).toEqual([]);
  });
});
