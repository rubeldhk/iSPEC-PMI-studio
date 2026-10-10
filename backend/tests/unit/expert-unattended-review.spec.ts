/**
 * `T1988` (EPIC-047) — unattended work enters review; it does not complete itself.
 *
 * `FR-EXP-063`, `BR-0061`, analysis finding C2. An unattended run is recorded
 * as requiring review, emits `review-required`, and its completion is
 * **proposed** through `EPIC-037` for the platform to adjudicate — never
 * applied by the Expert. So it cannot pass a release control on its own say-so.
 */
import { describe, expect, it } from 'vitest';
import { ACTOR, ask, world } from '../helpers/expert-dispatch.js';

describe('T1988 · unattended runs', () => {
  it('is recorded as unattended and requiring review, and proposes its completion', async () => {
    const w = await world();
    const result = await w.service.dispatch(ACTOR, ask({ unattended: true }));
    const session = await w.store.findSession('ws_1', result.executionId);
    expect([session?.unattended, session?.reviewRequired]).toEqual([true, true]);
    expect(w.executions.kindsFor(result.executionId)).toContain('review-required');
    expect(w.executions.proposed).toEqual([expect.objectContaining({ executionId: result.executionId })]);
    expect(w.executions.completed).toEqual([]);
    expect(result.reviewRequired).toBe(true);
  });

  it('an attended run completes as usual and requires no review', async () => {
    const w = await world();
    const result = await w.service.dispatch(ACTOR, ask());
    expect(result.reviewRequired).toBe(false);
    expect(w.executions.proposed).toEqual([]);
  });

  it('an unattended run that failed still records failure — review is for work, not for failures', async () => {
    const w = await world();
    w.preferred.run = async () => ({ status: 'failed', outputs: [] });
    const result = await w.service.dispatch(ACTOR, ask({ unattended: true }));
    expect(result.outcome).toBe('failed');
    expect(w.executions.completed[0]?.outcome).toBe('failed');
  });
});
