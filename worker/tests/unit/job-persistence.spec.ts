/**
 * `T1320` (EPIC-041) — the worker no longer throws on persistence.
 *
 * `FR-LPW-040`, `R-041-6`. `worker/src/main.ts` carried a `persistence()` whose
 * `transaction()` threw *"Generation persistence is not connected"* — honest,
 * and a hold that PMI-DOC-004 v1.0 discharged on 2026-08-20 and nobody came back
 * for. The repair reaches the platform's real commit through
 * `@pmi/backend/worker-api`, so the worker processes the payload the API
 * actually enqueues — `{ jobId, correlationId }` (`BullJobQueue.enqueue`) — and
 * the commit is the same code the API would run.
 *
 * Three assertions: the throw is gone from `main.ts`; a bootstrap given a runner
 * hands it the enqueued job id and reports the result; a bootstrap given
 * neither a runner nor a persistence refuses at construction rather than at the
 * first job.
 *
 * Written to FAIL before `T1321` exists.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createGenerationWorker, type WorkerFactory } from '../../src/worker-bootstrap.js';

const here = dirname(fileURLToPath(import.meta.url));
const MAIN = readFileSync(resolve(here, '../../src/main.ts'), 'utf8');

/** A factory that captures the processor so the test can drive it directly. */
function capturingFactory(): { factory: WorkerFactory; run: (data: unknown) => Promise<unknown> } {
  let processor: ((job: { data: unknown }) => Promise<unknown>) | undefined;
  const factory: WorkerFactory = (_queue, p) => {
    processor = p;
    return { close: async () => undefined };
  };
  return { factory, run: (data) => processor!({ data }) };
}

describe('T1320 · the placeholder is gone', () => {
  it('main.ts no longer throws "Generation persistence is not connected"', () => {
    expect(MAIN).not.toContain('Generation persistence is not connected');
  });

  it('main.ts reaches persistence through the barrel', () => {
    expect(MAIN).toContain('@pmi/backend/worker-api');
  });
});

describe('T1320 · a runner-driven worker processes what the API enqueues', () => {
  it('hands the runner the job id from { jobId, correlationId } and reports its result', async () => {
    const { factory, run } = capturingFactory();
    const runner = { run: vi.fn(async () => ({ state: 'succeeded' as const })) };
    const onResult = vi.fn();

    createGenerationWorker({ factory, runner, limits: { timeoutMs: 1000 }, onResult });
    const result = await run({ jobId: 'job_7', correlationId: 'corr-7' });

    expect(runner.run).toHaveBeenCalledWith('job_7', expect.objectContaining({ timeoutMs: 1000 }));
    expect(result).toEqual({ state: 'succeeded' });
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job_7', correlationId: 'corr-7' }),
      { state: 'succeeded' },
    );
  });

  it('refuses at construction when it has neither a runner nor a persistence', () => {
    const { factory } = capturingFactory();
    expect(() =>
      createGenerationWorker({ factory, limits: { timeoutMs: 1000 } } as never),
    ).toThrow(/runner|persistence/i);
  });
});
