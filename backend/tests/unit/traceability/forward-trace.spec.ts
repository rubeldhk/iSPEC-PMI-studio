/**
 * T125 — forward traversal: a requirement to ALL derived artifacts.
 * Written to FAIL before T130 exists (Constitution V).
 *
 * FR-030 / US7. Forward = requirement → specifications generated from it →
 * tasks generated from those specifications.
 */
import { describe, expect, it } from 'vitest';
import { buildTraceFixture } from './helpers.js';

describe('forward trace (FR-030)', () => {
  it('walks requirement → specifications → tasks', async () => {
    const { service } = await buildTraceFixture();
    const trace = await service.forwardTrace('ws_a', 'r1');
    expect(trace.requirementId).toBe('r1');
    expect(trace.specifications.map((s) => s.specificationId).sort()).toEqual(['s1', 's2']);
    const s1 = trace.specifications.find((s) => s.specificationId === 's1');
    expect(s1?.taskIds.sort()).toEqual(['t1', 't2']);
    const s2 = trace.specifications.find((s) => s.specificationId === 's2');
    expect(s2?.taskIds).toEqual([]);
  });

  it('a requirement nothing derives from traces to an empty forward set', async () => {
    const { service } = await buildTraceFixture();
    const trace = await service.forwardTrace('ws_a', 'r_uncovered');
    expect(trace.specifications).toEqual([]);
  });

  it('is workspace-scoped — another workspace sees nothing (FR-002)', async () => {
    const { service } = await buildTraceFixture();
    const trace = await service.forwardTrace('ws_b', 'r1');
    expect(trace.specifications).toEqual([]);
  });
});
