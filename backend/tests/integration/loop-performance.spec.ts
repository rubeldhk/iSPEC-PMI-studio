/**
 * T982 — the `R-030-6` targets, measured. `SC-GEL-008`.
 *
 * Four figures the plan committed to:
 *
 *   transition overhead   p95 < 50 ms
 *   end-to-end            p95 < 150 ms
 *   projection            p95 < 100 ms
 *   throughput            ≥ 50 transitions/second per workspace
 *
 * **Measured against the in-memory store, and the report says so.** The
 * overhead this Epic controls is the loop's own — authority, gate evaluation,
 * record construction, the projection. Database latency belongs to whichever
 * store is bound, and mixing the two would produce a number that moves when
 * PostgreSQL is busy and tells you nothing about the loop.
 *
 * `DEF-030-002` is why that separation is stated rather than assumed: this
 * suite's one existing wall-clock assertion, `T147`, fails under container
 * contention and passes at 8× margin alone. A performance test that measures the
 * test runner does not measure the code.
 */
import { describe, expect, it } from 'vitest';
import { LOOP_STAGES, type StageHandler } from '@pmi/loop-contract';
import { loadLoopConfig } from '../../src/modules/loop/loop-config.loader.js';
import { StageRegistry } from '../../src/modules/loop/stage-registry.js';
import { LoopConfigRegistry } from '../../src/modules/loop/config-registry.js';
import { InMemoryLoopStore } from '../../src/modules/loop/loop.store.js';
import { authoritiesOf, directoryOf } from '../helpers/loop-principals.js';
import { LoopService } from '../../src/modules/loop/loop.service.js';

const stages = new StageRegistry(
  LOOP_STAGES.map((stage): StageHandler => ({ stage, async enter() { return { ok: true }; } })),
);

const CONFIG = loadLoopConfig(
  {
    schemaVersion: 1,
    workflowType: 'perf-type',
    stages: [...LOOP_STAGES],
    transitions: LOOP_STAGES.slice(0, -1).map((from, i) => ({
      from,
      to: LOOP_STAGES[i + 1],
      requiredGates: ['perf-gate'],
      trigger: null,
    })),
    approvedBy: 'u', approvalRef: 'c',
  },
  { registeredStages: stages.registeredStages },
);

const AUTHORITIES = Object.fromEntries(
  LOOP_STAGES.slice(0, -1).map((from, i) => [`${from}->${String(LOOP_STAGES[i + 1])}`, ['mover']]),
);

const SATISFIED = [{ gateId: 'perf-gate', result: 'satisfied' as const }];

function p95(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
}

function service() {
  return new LoopService(
    new InMemoryLoopStore(),
    new LoopConfigRegistry([CONFIG]),
    AUTHORITIES,
    undefined,
    directoryOf(ACTORS),
    authoritiesOf(ACTORS),
  );
}

async function declare(loop: LoopService) {
  return loop.declareObject(ACTING, {
    projectId: 'p', workflowType: 'perf-type', subjectType: 'o', subjectId: 's',
  });
}

const auth = ['mover'];

/**
 * The directory. `auth` used to be sent on every transition; it is now what the
 * resolver says this actor holds, so the measured path includes the resolution
 * the production path performs (`T1158`).
 */
const ACTORS = { u: { workspaceId: 'ws_perf', authorities: auth } } as const;
const ACTING = { workspaceId: 'ws_perf', userId: 'u' };

describe('T982 · R-030-6 performance targets, measured', () => {
  it('transition overhead p95 < 50 ms', async () => {
    const loop = service();
    const samples: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const ref = await declare(loop);
      const start = performance.now();
      await loop.transition(ACTING, {
        objectId: ref.objectId, toStage: 'Context', expectedVersion: 0,
        gates: SATISFIED,
      } as never);
      samples.push(performance.now() - start);
    }
    const measured = p95(samples);
    console.log(`T982 transition overhead p95 = ${measured.toFixed(2)} ms (target < 50)`);
    expect(measured).toBeLessThan(50);
  });

  it('end-to-end declare + seven transitions p95 < 150 ms', async () => {
    const loop = service();
    const samples: number[] = [];
    for (let round = 0; round < 30; round += 1) {
      const start = performance.now();
      const ref = await declare(loop);
      for (let i = 1; i < LOOP_STAGES.length; i += 1) {
        await loop.transition(ACTING, {
          objectId: ref.objectId, toStage: LOOP_STAGES[i], expectedVersion: i - 1,
          gates: SATISFIED,
        } as never);
      }
      samples.push(performance.now() - start);
    }
    const measured = p95(samples);
    console.log(`T982 end-to-end (declare + 7) p95 = ${measured.toFixed(2)} ms (target < 150)`);
    expect(measured).toBeLessThan(150);
  });

  it('projection p95 < 100 ms', async () => {
    const loop = service();
    const ref = await declare(loop);
    for (let i = 1; i < LOOP_STAGES.length; i += 1) {
      await loop.transition(ACTING, {
        objectId: ref.objectId, toStage: LOOP_STAGES[i], expectedVersion: i - 1,
        gates: SATISFIED,
      } as never);
    }
    const samples: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const start = performance.now();
      await loop.progressOf(ACTING, ref.objectId);
      samples.push(performance.now() - start);
    }
    const measured = p95(samples);
    console.log(`T982 projection p95 = ${measured.toFixed(2)} ms (target < 100)`);
    expect(measured).toBeLessThan(100);
  });

  it('sustains ≥ 50 transitions/second in one workspace', async () => {
    const loop = service();
    const refs = await Promise.all(Array.from({ length: 100 }, () => declare(loop)));
    const start = performance.now();
    await Promise.all(
      refs.map((ref) =>
        loop.transition(ACTING, {
          objectId: ref.objectId, toStage: 'Context', expectedVersion: 0,
          gates: SATISFIED,
        } as never),
      ),
    );
    const perSecond = 100 / ((performance.now() - start) / 1000);
    console.log(`T982 throughput = ${perSecond.toFixed(0)} transitions/second (target ≥ 50)`);
    expect(perSecond).toBeGreaterThanOrEqual(50);
  });
});
