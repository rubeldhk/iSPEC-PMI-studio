/**
 * T074 — every failure reason is distinct, and none stores a partial artifact.
 *
 * Written to FAIL before `generate-specification.service.ts` exists
 * (Constitution V).
 *
 * Two claims, both structural:
 *
 *   FR-026 / SC-005 — a non-success terminal state names a SPECIFIC reason.
 *   There is no `unknown`, and no two paths collapse into one reason.
 *
 *   FR-027 / SC-006 — a failed, cancelled or timed-out job leaves NOTHING
 *   behind. Asserted against the store, not against a return value: a cleanup
 *   that ran afterwards would pass a return-value check.
 */
import { describe, expect, it } from 'vitest';
import { ENGINE_FAILURE_REASONS } from '@pmi/engine-contract';
import { FAILURE_MESSAGES } from '../../../src/core/failure-taxonomy.js';
import { GenerateSpecificationService } from '../../../src/modules/specifications/generate-specification.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';
import { OUTPUT, PROJECT, StubEngine, WS, selection } from './helpers.js';

function build(
  engine: StubEngine | Error,
  options: { maxRequirements?: number } = {},
): { service: GenerateSpecificationService; store: InMemorySpecificationStore } {
  const store = new InMemorySpecificationStore();
  const engines = {
    resolveForProject: async (): Promise<never> => {
      if (engine instanceof Error) throw engine;
      return engine as never;
    },
  };
  return { store, service: new GenerateSpecificationService(engines, store, options) };
}

const request = (over: Record<string, unknown> = {}) => ({
  jobId: 'job_1',
  workspaceId: WS,
  projectId: PROJECT,
  requestedById: 'u1',
  correlationId: 'corr_1',
  projectName: 'Payments',
  requirements: selection(),
  timeoutMs: 50,
  ...over,
});

/** Every failure path, and the terminal state it must produce. */
const CASES: {
  reason: string;
  state: string;
  build: () => { service: GenerateSpecificationService; store: InMemorySpecificationStore };
  request: Record<string, unknown>;
}[] = [
  {
    reason: 'empty_selection',
    state: 'failed',
    build: () => build(StubEngine.returning()),
    request: { requirements: [] },
  },
  {
    reason: 'input_too_large',
    state: 'failed',
    build: () => build(StubEngine.returning(), { maxRequirements: 2 }),
    request: { requirements: selection(3) },
  },
  {
    reason: 'engine_unavailable',
    state: 'failed',
    build: () => build(new Error('no engine registered')),
    request: {},
  },
  {
    reason: 'engine_error',
    state: 'failed',
    build: () => build(StubEngine.failing('engine_error')),
    request: {},
  },
  {
    reason: 'malformed_output',
    state: 'failed',
    build: () => build(StubEngine.returning({ ...OUTPUT, contentParsed: null as never })),
    request: {},
  },
  {
    reason: 'empty_output',
    state: 'failed',
    build: () => build(StubEngine.returning({ ...OUTPUT, contentRaw: '   ' })),
    request: {},
  },
  {
    reason: 'timeout',
    state: 'timed_out',
    build: () =>
      build(
        new StubEngine(
          () => new Promise(() => {}),
        ),
      ),
    request: { timeoutMs: 10 },
  },
  {
    reason: 'cancelled',
    state: 'cancelled',
    build: () => build(StubEngine.returning()),
    request: { signal: AbortSignal.abort() },
  },
];

describe('every failure names a specific reason (FR-026, SC-005)', () => {
  it.each(CASES)('$reason → $state', async ({ reason, state, build: make, request: over }) => {
    const { service, store } = make();
    const outcome = await service.run(request(over) as never);

    expect(outcome.state).toBe(state);
    expect(outcome.failureReason).toBe(reason);
    expect(store.jobOutcomes).toEqual([{ jobId: 'job_1', state, failureReason: reason }]);
  });

  it('the eight reasons are distinct — no two paths collapse into one', () => {
    const reasons = CASES.map((c) => c.reason);
    expect(new Set(reasons).size).toBe(reasons.length);
    // The taxonomy is closed: every reason exercised here is a contract member,
    // and there is no `unknown` to fall back on.
    for (const reason of reasons) {
      expect(ENGINE_FAILURE_REASONS).toContain(reason);
    }
  });

  it('covers every reason the contract declares', () => {
    expect([...ENGINE_FAILURE_REASONS].sort()).toEqual(CASES.map((c) => c.reason).sort());
  });

  it('each reason carries its own user-facing message', () => {
    const messages = CASES.map((c) => FAILURE_MESSAGES[c.reason as keyof typeof FAILURE_MESSAGES]);
    expect(new Set(messages).size).toBe(messages.length);
  });
});

describe('no failure stores a partial artifact (FR-027, SC-006)', () => {
  it.each(CASES)('$reason stores nothing', async ({ build: make, request: over }) => {
    const { service, store } = make();
    await service.run(request(over) as never);

    expect(store.all()).toEqual([]);
    expect(store.allVersions()).toEqual([]);
    expect(store.allLinks()).toEqual([]);
    expect(store.commits).toEqual([]);
  });

  it('the outcome shape itself carries no specification on failure', async () => {
    const { service } = build(StubEngine.failing('engine_error'));
    const outcome = await service.run(request() as never);
    expect(Object.hasOwn(outcome, 'specification')).toBe(false);
  });
});

describe('pre-flight refusals never bill an engine run (contract rule E7, RAID R-02)', () => {
  it('an empty selection is refused before the engine is touched', async () => {
    const engine = StubEngine.returning();
    const { service } = build(engine);
    await service.run(request({ requirements: [] }) as never);
    expect(engine.calls).toEqual([]);
  });

  it('an oversized selection is refused before the engine is touched', async () => {
    const engine = StubEngine.returning();
    const store = new InMemorySpecificationStore();
    const service = new GenerateSpecificationService(
      { resolveForProject: async () => engine },
      store,
      { maxRequirements: 2 },
    );
    await service.run(request({ requirements: selection(3) }) as never);
    expect(engine.calls).toEqual([]);
  });

  it('an already-cancelled request never reaches the engine', async () => {
    const engine = StubEngine.returning();
    const { service } = build(engine);
    await service.run(request({ signal: AbortSignal.abort() }) as never);
    expect(engine.calls).toEqual([]);
  });
});

describe('a timeout is not reported as a user cancellation', () => {
  it('attributes the limit that actually fired', async () => {
    // Misreporting a cost overrun as a user action is how RAID R-02 becomes
    // invisible: nobody audits the runs a user chose to stop.
    const { service } = build(new StubEngine(() => new Promise(() => {})));
    const outcome = await service.run(request({ timeoutMs: 10 }) as never);
    expect(outcome.state).toBe('timed_out');
    expect(outcome.failureReason).toBe('timeout');
  });
});
