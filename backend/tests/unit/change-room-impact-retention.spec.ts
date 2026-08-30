/**
 * `T996p`, `T996q` (EPIC-034) — the view is retained with the change.
 *
 * `FR-CHR-035`: *"so the decision can later be read against what was known at
 * the time."* That sentence is the whole requirement, and it rules out the
 * obvious implementation. Storing **the** impact view against a change — one
 * row, overwritten each time it is recomputed — answers *what does the impact
 * look like now*, which nobody asked. The question a decision has to survive is
 * *what did the person deciding actually see*, and an overwritten row cannot
 * answer it.
 *
 * So a recomputation writes a **new** view and the old one stays. `R-034-5`'s
 * re-decision test — *has the impact changed since the decision?* — is then a
 * comparison between two stored snapshots rather than a recollection.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryChangeRoomStore } from '../../src/modules/change-room/change-room.store.js';
import {
  ImpactComposer,
  type ImpactPort,
  type TraversalPort,
} from '../../src/modules/change-room/impact.composer.js';
import type { ImpactView } from '../../src/modules/change-room/impact.types.js';

const traversal: TraversalPort = {
  async reachableFrom() {
    return ['a_1'];
  },
};

const portWith = (count: number): ImpactPort => ({
  async impactFor() {
    return new Map([['tests', { count, detail: `${count} suites` }] as const]);
  },
});

const at = (iso: string, id: string) => ({
  workspaceId: 'ws_1',
  changeRequestId: 'cr_1',
  changedArtifactId: 'art_1',
  traversalDepth: 25,
  now: new Date(iso),
  id,
});

async function composed(count: number, iso: string, id: string): Promise<ImpactView> {
  return new ImpactComposer(portWith(count), traversal).compose(at(iso, id));
}

describe('T996p · a view is stored against its change', () => {
  it('and read back by the change it belongs to', async () => {
    const store = new InMemoryChangeRoomStore();
    await store.saveImpactView(await composed(3, '2026-08-30T10:00:00Z', 'iv_1'));

    const latest = await store.latestImpactViewFor('ws_1', 'cr_1');
    expect(latest?.id).toBe('iv_1');
    expect(latest?.areas.tests.itemCount).toBe(3);
  });

  it('with the whole snapshot intact, not a summary of it', async () => {
    // All eight areas and the architecture panel, or the retained view answers
    // a narrower question than the one that was decided.
    const store = new InMemoryChangeRoomStore();
    await store.saveImpactView(await composed(3, '2026-08-30T10:00:00Z', 'iv_1'));

    const latest = await store.latestImpactViewFor('ws_1', 'cr_1');
    expect(Object.keys(latest!.areas)).toHaveLength(8);
    expect(latest!.architecture.violationCheck.status).toBe('not-run');
    expect(latest!.computedAt.toISOString()).toBe('2026-08-30T10:00:00.000Z');
    expect(latest!.traversalDepth).toBe(25);
  });

  it('a change with no view yet returns null, not an empty view', async () => {
    // An empty view would report eight clean areas nobody computed.
    const store = new InMemoryChangeRoomStore();
    expect(await store.latestImpactViewFor('ws_1', 'cr_none')).toBeNull();
  });

  it('a view in another workspace is absent', async () => {
    const store = new InMemoryChangeRoomStore();
    await store.saveImpactView(await composed(3, '2026-08-30T10:00:00Z', 'iv_1'));
    expect(await store.latestImpactViewFor('ws_other', 'cr_1')).toBeNull();
    expect(await store.findImpactView('ws_other', 'iv_1')).toBeNull();
  });
});

describe('T996p · recomputing does not erase what was known', () => {
  it('keeps both, and the later one is the latest', async () => {
    const store = new InMemoryChangeRoomStore();
    await store.saveImpactView(await composed(3, '2026-08-30T10:00:00Z', 'iv_1'));
    await store.saveImpactView(await composed(9, '2026-08-30T14:00:00Z', 'iv_2'));

    expect((await store.latestImpactViewFor('ws_1', 'cr_1'))?.id).toBe('iv_2');
    expect((await store.listImpactViewsFor('ws_1', 'cr_1')).map((v) => v.id)).toEqual([
      'iv_1',
      'iv_2',
    ]);
  });

  it('the earlier snapshot still says what it said', async () => {
    // `FR-CHR-035`, stated as a test: a decision taken at 10:00 was taken
    // against three affected suites, and it stays that way after 14:00 found
    // nine.
    const store = new InMemoryChangeRoomStore();
    await store.saveImpactView(await composed(3, '2026-08-30T10:00:00Z', 'iv_1'));
    await store.saveImpactView(await composed(9, '2026-08-30T14:00:00Z', 'iv_2'));

    const earlier = await store.findImpactView('ws_1', 'iv_1');
    expect(earlier?.areas.tests.itemCount).toBe(3);
  });

  it('so `has the impact changed since the decision?` is answerable', async () => {
    // `R-034-5`. Two stored snapshots, compared — not a recollection.
    const store = new InMemoryChangeRoomStore();
    await store.saveImpactView(await composed(3, '2026-08-30T10:00:00Z', 'iv_1'));
    await store.retainForDecision('ws_1', 'iv_1');
    await store.saveImpactView(await composed(9, '2026-08-30T14:00:00Z', 'iv_2'));

    const decided = await store.findImpactView('ws_1', 'iv_1');
    const now = await store.latestImpactViewFor('ws_1', 'cr_1');
    expect(decided!.areas.tests.itemCount).not.toBe(now!.areas.tests.itemCount);
  });
});

describe('T996p · retained means a decision referenced it', () => {
  it('a fresh view is not retained', async () => {
    // `FR-CHR-035` — set when a decision references it, not when it is made.
    const store = new InMemoryChangeRoomStore();
    await store.saveImpactView(await composed(3, '2026-08-30T10:00:00Z', 'iv_1'));
    expect((await store.findImpactView('ws_1', 'iv_1'))?.retainedForDecision).toBe(false);
  });

  it('referencing it sets the flag', async () => {
    const store = new InMemoryChangeRoomStore();
    await store.saveImpactView(await composed(3, '2026-08-30T10:00:00Z', 'iv_1'));
    const retained = await store.retainForDecision('ws_1', 'iv_1');
    expect(retained.retainedForDecision).toBe(true);
  });

  it('and changes nothing else about it', async () => {
    // Retention marks a view; it must not edit one. A snapshot that changed
    // when it was cited would be no snapshot.
    const store = new InMemoryChangeRoomStore();
    const original = await composed(3, '2026-08-30T10:00:00Z', 'iv_1');
    await store.saveImpactView(original);
    const retained = await store.retainForDecision('ws_1', 'iv_1');

    expect({ ...retained, retainedForDecision: false }).toEqual(original);
  });

  it('retaining a view that is not there is refused, not invented', async () => {
    const store = new InMemoryChangeRoomStore();
    await expect(store.retainForDecision('ws_1', 'iv_missing')).rejects.toThrow();
  });
});

describe('T996p · retention is structural', () => {
  it('the store offers no way to delete or overwrite a view', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(here, '..', '..', 'src', 'modules', 'change-room', 'change-room.store.ts'),
      'utf8',
    );

    for (const verb of ['delete', 'remove', 'destroy', 'purge', 'drop']) {
      expect(
        new RegExp(`\\b${verb}\\w*\\s*\\(`, 'i').test(source),
        `the store exposes ${verb}`,
      ).toBe(false);
    }
    // And no method that replaces a stored view in place.
    expect(/updateImpactView|replaceImpactView/.test(source)).toBe(false);
  });

  it('the matcher can fire', () => {
    expect(/\bdelete\w*\s*\(/i.test('  deleteImpactView(id: string): Promise<void>;')).toBe(true);
    expect(/updateImpactView|replaceImpactView/.test('  updateImpactView(v: X): void;')).toBe(true);
  });

  it('saving the same id twice is refused rather than silently replacing', async () => {
    // The overwrite this file exists to prevent, blocked where it would happen.
    const store = new InMemoryChangeRoomStore();
    await store.saveImpactView(await composed(3, '2026-08-30T10:00:00Z', 'iv_1'));
    await expect(
      store.saveImpactView(await composed(9, '2026-08-30T14:00:00Z', 'iv_1')),
    ).rejects.toThrow(/already/i);
  });
});
