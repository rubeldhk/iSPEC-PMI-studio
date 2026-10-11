/**
 * `T2538` (EPIC-047 Convergence) — a delegate stopped by another process
 * stops itself.
 *
 * `FR-EXP-037`, spec Edge Cases "a delegate outlives its parent". The cascade
 * aborts a run only through the in-process map of runs; a delegate dispatched
 * by another backend instance was marked `stopped-by-parent` but kept running
 * to its own time limit. A running dispatch now reads its stored session while
 * it runs and aborts itself when it finds it stopped.
 */
import { describe, expect, it } from 'vitest';
import type { AgentContext } from '@pmi/agent-contract';
import { DispatchService } from '../../src/modules/experts/dispatch.service.js';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';
import { accessFrom, contract, gatewaysFor, runner } from '../helpers/expert-fixtures.js';

const untilAborted = (ctx: AgentContext) =>
  new Promise<{ status: 'cancelled'; outputs: string[] }>((resolve) => {
    ctx.signal?.addEventListener('abort', () => resolve({ status: 'cancelled', outputs: [] }));
  });

describe('T2538 · stopping across instances', () => {
  it('a run whose session another process marked stopped-by-parent aborts on its next check', async () => {
    const w = await world({ contract: contract({ budget: { time: { value: 60_000 } } }) });
    let started!: () => void;
    const running = new Promise<void>((r) => (started = r));
    w.ports.gateways = gatewaysFor({
      'claude-opus-5-5': [
        runner({}, (ctx) => {
          started();
          return untilAborted(ctx);
        }),
      ],
    });
    // A second "instance": the same store and ports, its own map of running runs.
    const here = new DispatchService(w.store, {
      access: accessFrom({ 'u_1:specification:sp_1': 'edit' }),
      ports: w.ports,
      pollMs: 10,
    });
    const result = here.dispatch(ACTOR, ask());
    await running;
    // The other instance's cascade: it wins the session's end, records and closes it.
    expect(await w.store.endSession('ws_1', 'exe_1', { outcome: 'stopped-by-parent', endedAt: '2026-10-09T09:00:30.000Z' })).toBe(true);
    const start = Date.now();
    await expect(result).resolves.toMatchObject({ outcome: 'stopped-by-parent' });
    expect(Date.now() - start).toBeLessThan(2_000);
  });

  it('a run nobody stopped is not aborted by the check', async () => {
    const w = await world();
    const here = new DispatchService(w.store, {
      access: accessFrom({ 'u_1:specification:sp_1': 'edit' }),
      ports: w.ports,
      pollMs: 5,
    });
    w.preferred.run = async () => {
      await new Promise((r) => setTimeout(r, 40));
      return { status: 'succeeded', outputs: ['test-report'] };
    };
    await expect(here.dispatch(ACTOR, ask())).resolves.toMatchObject({ outcome: 'succeeded' });
  });
});
