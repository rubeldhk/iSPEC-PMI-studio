/**
 * T127 — links from retired requirements are returned and FLAGGED, never
 * omitted. Written to FAIL before T131 exists (Constitution V).
 *
 * FR-029 / US7 scenario 4: retirement is not deletion (FR-006), and a trace
 * that silently dropped retired sources would claim a derivation history that
 * never happened.
 */
import { describe, expect, it, vi } from 'vitest';
import { flagRetiredLinks, type RequirementStatusSource } from '../../../src/modules/traceability/retired-flag.js';

const LINKS = [
  { targetType: 'requirement' as const, targetId: 'r_active' },
  { targetType: 'requirement' as const, targetId: 'r_retired' },
];

function statuses(): RequirementStatusSource {
  return {
    statusOf: vi.fn(async (_ws: string, ids: string[]) => {
      const map = new Map<string, 'active' | 'retired'>();
      for (const id of ids) map.set(id, id.includes('retired') ? 'retired' : 'active');
      return map;
    }),
  };
}

describe('retired-requirement flagging (US7 scenario 4)', () => {
  it('returns EVERY link, flagging the retired ones', async () => {
    const out = await flagRetiredLinks('ws_a', LINKS, statuses());
    expect(out).toHaveLength(2);
    expect(out.find((l) => l.targetId === 'r_active')?.retired).toBe(false);
    expect(out.find((l) => l.targetId === 'r_retired')?.retired).toBe(true);
  });

  it('omits nothing — the retired link is present, not filtered', async () => {
    const out = await flagRetiredLinks('ws_a', LINKS, statuses());
    expect(out.map((l) => l.targetId).sort()).toEqual(['r_active', 'r_retired']);
  });

  it('looks statuses up in ONE batched call, not per link', async () => {
    const source = statuses();
    await flagRetiredLinks('ws_a', LINKS, source);
    expect(source.statusOf).toHaveBeenCalledTimes(1);
    expect(source.statusOf).toHaveBeenCalledWith('ws_a', ['r_active', 'r_retired']);
  });

  it('non-requirement targets pass through unflagged', async () => {
    const out = await flagRetiredLinks(
      'ws_a',
      [{ targetType: 'specification' as const, targetId: 's1' }],
      statuses(),
    );
    expect(out[0]?.retired).toBe(false);
  });
});
