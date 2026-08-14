/**
 * T652 — the worker actually consumes.
 *
 * Convergence found `worker/src/main.ts` composing the engine registry, logging
 * `worker.started`, and exiting. `consumeGenerationJob` — 8 passing tests, the
 * whole of F-00.4's persistence path — was referenced by nothing but its own
 * spec. No BullMQ `Worker` existed anywhere in the repository, so no job could
 * ever run.
 *
 * The BullMQ binding is injected as a narrow factory so this asserts the
 * dispatch contract without Valkey.
 */
import { describe, expect, it, vi } from 'vitest';
import { PHASE_1_CAPABILITIES, engineOk, type SpecificationEngine } from '@pmi/engine-contract';
import {
  GENERATION_QUEUE_NAME,
  createGenerationWorker,
  type WorkerFactory,
} from '../../src/worker-bootstrap.js';

function stubEngine(name = 'fixture'): SpecificationEngine {
  const descriptor = { name, version: `${name}-1.0.0`, capabilities: [...PHASE_1_CAPABILITIES] };
  return {
    descriptor,
    generateSpecification: async () =>
      engineOk({ title: 't', contentRaw: 'raw', contentParsed: {} }, descriptor),
    generateTasks: async () => engineOk([{ description: 'd' }], descriptor),
    validateSpecification: async () => engineOk([], descriptor),
  };
}

/** Captures what the bootstrap asked BullMQ for, and lets a test drive it. */
function captureFactory() {
  const calls: { queue: string; opts: Record<string, unknown> }[] = [];
  let handler: ((job: { data: unknown }) => Promise<unknown>) | undefined;
  const factory: WorkerFactory = (queue, processor, opts) => {
    calls.push({ queue, opts });
    handler = processor;
    return { close: vi.fn(async () => undefined) };
  };
  return { factory, calls, run: (data: unknown) => handler?.({ data }) };
}

const payload = {
  id: 'job-1',
  workspaceId: 'ws',
  projectId: 'proj',
  requestedById: 'user',
  correlationId: '00000000-0000-4000-8000-000000000000',
  projectName: 'demo',
  requirements: [{ reference: 'R1', description: 'd', type: 'functional', priority: 'p1' }],
};

describe('T652 · the worker binds to the generation queue', () => {
  it('creates exactly one Worker on the shared queue name', () => {
    const { factory, calls } = captureFactory();
    createGenerationWorker({
      factory,
      resolveEngine: () => stubEngine(),
      persistence: { transaction: async (fn) => fn({ write: async () => undefined }) },
      limits: { timeoutMs: 1000 },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.queue).toBe(GENERATION_QUEUE_NAME);
  });

  it('agrees with the producer on the queue name', () => {
    // The producer is in `backend` and the boundary rules forbid importing it.
    // `jobs.module.spec.ts` asserts the other half against the same literal.
    expect(GENERATION_QUEUE_NAME).toBe('generation');
  });
});

describe('T652 · each delivered job reaches consumeGenerationJob', () => {
  it('persists on the success path and reports the terminal state', async () => {
    const written: Record<string, unknown>[] = [];
    const { factory, run } = captureFactory();
    createGenerationWorker({
      factory,
      resolveEngine: () => stubEngine(),
      persistence: {
        transaction: async (fn) => fn({ write: async (row) => void written.push(row) }),
      },
      limits: { timeoutMs: 1000 },
    });

    const result = (await run(payload)) as { state: string };

    expect(result.state).toBe('succeeded');
    expect(written.length).toBeGreaterThan(0);
  });

  it('writes NO artifact when the selection is empty (FR-027, SC-006)', async () => {
    const written: Record<string, unknown>[] = [];
    const { factory, run } = captureFactory();
    createGenerationWorker({
      factory,
      resolveEngine: () => stubEngine(),
      persistence: {
        transaction: async (fn) => fn({ write: async (row) => void written.push(row) }),
      },
      limits: { timeoutMs: 1000 },
    });

    const result = (await run({ ...payload, requirements: [] })) as {
      state: string;
      failureReason?: string;
    };

    expect(result.state).toBe('failed');
    expect(result.failureReason).toBe('empty_selection');
    // The terminal row is written; a generated artifact is not.
    expect(written.some((r) => 'contentRaw' in r)).toBe(false);
  });

  it('reports cancelled — never timeout — when the signal is already aborted', async () => {
    // The exact confusion `T045a` was written to prevent, and which the EPIC-003
    // conformance suite caught recurring in a different component.
    const { factory, run } = captureFactory();
    createGenerationWorker({
      factory,
      resolveEngine: () => stubEngine(),
      persistence: { transaction: async (fn) => fn({ write: async () => undefined }) },
      limits: { timeoutMs: 1000, signal: AbortSignal.abort() },
    });

    const result = (await run(payload)) as { state: string };
    expect(result.state).toBe('cancelled');
  });
});
