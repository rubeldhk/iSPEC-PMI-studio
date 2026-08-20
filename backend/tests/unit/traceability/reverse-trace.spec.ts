/**
 * T126 — reverse traversal: a task back through its specification to the
 * originating requirements. Written to FAIL before T130 exists (Constitution V).
 *
 * FR-030 / US7 / SC-003: every task resolves back to ≥1 requirement.
 */
import { describe, expect, it } from 'vitest';
import { buildTraceFixture } from './helpers.js';

describe('reverse trace (FR-030)', () => {
  it('walks task → specification → requirements', async () => {
    const { service } = await buildTraceFixture();
    const trace = await service.reverseTrace('ws_a', 't1');
    expect(trace.taskId).toBe('t1');
    expect(trace.specifications.map((s) => s.specificationId)).toEqual(['s1']);
    // r_retired is INCLUDED: links to retired requirements are returned, never
    // omitted (FR-006, US7/4) — flagging them is T131's decorator, not a filter.
    expect(trace.specifications[0]?.requirementIds.sort()).toEqual(['r1', 'r2', 'r_retired']);
  });

  it('a task with no links traces to an empty reverse set — an SC-003 red flag the caller can see', async () => {
    const { service } = await buildTraceFixture();
    const trace = await service.reverseTrace('ws_a', 't_orphan');
    expect(trace.specifications).toEqual([]);
  });

  it('is workspace-scoped (FR-002)', async () => {
    const { service } = await buildTraceFixture();
    const trace = await service.reverseTrace('ws_b', 't1');
    expect(trace.specifications).toEqual([]);
  });
});
