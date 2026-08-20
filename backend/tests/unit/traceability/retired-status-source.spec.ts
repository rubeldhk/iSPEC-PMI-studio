/**
 * T859 — the requirement status source the composed application reads
 * (F2, **US7/AC4**).
 *
 * Written to FAIL before T860 exists (Constitution V).
 *
 * Found by `/speckit-converge EPIC-011`. `retired-flag.ts` was correct and
 * `T127` passed; the module wired it to `AllActiveRequirementStatusSource`,
 * which answers `active` for every id it is given. US7 scenario 4 — "the link
 * is still shown and marked as originating from a retired requirement" — was
 * therefore unreachable in the running application.
 *
 * A placeholder that answers confidently is worse than one that refuses.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryRequirementStore,
  type RequirementRecord,
} from '../../../src/modules/requirements/requirements.service.js';
import { LookupRequirementStatusSource } from '../../../src/modules/traceability/retired-flag.js';

const WS = 'ws_a';
const OTHER_WS = 'ws_b';
const PROJECT = 'proj_1';
const OTHER_PROJECT = 'proj_2';

const VALID = { description: 'The system shall settle.', type: 'functional', priority: 'p1' } as const;

async function register(): Promise<{ store: InMemoryRequirementStore; rows: RequirementRecord[] }> {
  const store = new InMemoryRequirementStore();
  const rows: RequirementRecord[] = [];
  for (const [i, projectId] of [PROJECT, PROJECT, OTHER_PROJECT].entries()) {
    rows.push(
      await store.create({
        id: `req_${i + 1}`,
        workspaceId: WS,
        projectId,
        reference: `REQ-00${i + 1}`,
        description: VALID.description,
        type: VALID.type,
        priority: VALID.priority,
        status: 'active',
        contentHash: `h${i}`,
        retiredAt: null,
      }),
    );
  }
  return { store, rows };
}

// ---------------------------------------------------------------- T859 · status

describe('LookupRequirementStatusSource reads the LIVE register (US7/AC4)', () => {
  it('reports an active requirement as active', async () => {
    const { store } = await register();
    const source = new LookupRequirementStatusSource(store);
    expect(await source.statusOf(WS, ['req_1'])).toEqual(new Map([['req_1', 'active']]));
  });

  it('reports a RETIRED requirement as retired — the case the placeholder could never reach', async () => {
    const { store } = await register();
    await store.update(WS, 'req_1', { status: 'retired', retiredAt: new Date() });

    const source = new LookupRequirementStatusSource(store);
    expect(await source.statusOf(WS, ['req_1'])).toEqual(new Map([['req_1', 'retired']]));
  });

  it('answers for a mixed set in one call', async () => {
    const { store } = await register();
    await store.update(WS, 'req_2', { status: 'retired', retiredAt: new Date() });

    const source = new LookupRequirementStatusSource(store);
    const statuses = await source.statusOf(WS, ['req_1', 'req_2']);
    expect(statuses.get('req_1')).toBe('active');
    expect(statuses.get('req_2')).toBe('retired');
  });

  it('does not report a requirement from another workspace at all (FR-002)', async () => {
    const { store } = await register();
    const source = new LookupRequirementStatusSource(store);
    // Absent from the map rather than reported active: claiming a status for a
    // row this workspace cannot see would be a disclosure AND a wrong answer.
    expect((await source.statusOf(OTHER_WS, ['req_1'])).has('req_1')).toBe(false);
  });

  it('omits an id that does not exist rather than inventing a status', async () => {
    const { store } = await register();
    const source = new LookupRequirementStatusSource(store);
    expect((await source.statusOf(WS, ['req_nowhere'])).has('req_nowhere')).toBe(false);
  });

  it('asks the register nothing for an empty set', async () => {
    let calls = 0;
    const source = new LookupRequirementStatusSource({
      findById: async () => {
        calls += 1;
        return null;
      },
    });
    expect(await source.statusOf(WS, [])).toEqual(new Map());
    expect(calls).toBe(0);
  });
});
