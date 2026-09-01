/**
 * `T1309` (EPIC-038) — where context packages live.
 *
 * `FR-002`, `FR-CTX-066`, `R-038-9`.
 *
 * Added 2026-08-31 after `T148` found `T1235` writing application source with
 * no paired test — Constitution V's own rule, caught by a check rather than by
 * reading, which is the argument analysis finding `E3` made for mechanising it.
 *
 * ## Retention is inherited, and the absence of a delete is how
 *
 * `FR-CTX-066` ties a package's life to the execution it fed. `R-038-9` records
 * why: two retention policies over one audit trail produce a window in which
 * the execution is inspectable and its context is gone — the state `BR-0096`
 * exists to prevent.
 *
 * Inheritance is implemented as a **foreign-key cascade**, not as a sweep this
 * store performs. So the store offers no delete at all, and this file asserts
 * the absence of the capability rather than trusting everyone to avoid it —
 * the same shape `EPIC-035`'s defect store took for `ADR-0016`'s never-delete
 * rule.
 *
 * ## And a package in another workspace is absent, not forbidden
 *
 * `FR-002`. `403` tells a caller the package exists; `404` tells them nothing.
 * Here the distinction matters more than usual: a context package's *existence*
 * leaks that somebody in another workspace asked a question, and the objective
 * is stored in the requester's own words.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { ContextPackage } from '../../src/modules/context/package.types.js';

const pkg = (over: Partial<ContextPackage> = {}): ContextPackage => ({
  id: 'cp_1',
  workspaceId: 'ws_1',
  projectId: 'pr_1',
  executionId: 'ex_1',
  objective: 'why does the booking notify twice',
  actorId: 'u_1',
  actorRole: 'engineer',
  budgetTokens: 12000,
  budgetCost: 40,
  state: 'assembled',
  refusalReason: null,
  embeddingModelId: 'model-a',
  assembledAt: new Date(),
  ...over,
});

describe('T1309 · a package and everything hanging off it round-trips', () => {
  it('stores and reads a package', async () => {
    const store = new InMemoryContextStore();
    await store.createPackage(pkg());
    expect((await store.findPackage('ws_1', 'cp_1'))?.objective).toMatch(/notify twice/);
  });

  it('with its items', async () => {
    const store = new InMemoryContextStore();
    await store.createPackage(pkg());
    await store.addItem({
      id: 'pi_1',
      packageId: 'cp_1',
      sourceType: 'requirement',
      sourceId: 'rq_1',
      sourceVersion: 'v3',
      authoritativeStatus: 'current',
      inclusionReason: 'objective term: notification',
      relevanceScore: 0.9,
      crossBoundary: false,
    });
    expect(await store.itemsFor('ws_1', 'cp_1')).toHaveLength(1);
  });

  it('and its exclusions, which are the half people actually ask about', async () => {
    const store = new InMemoryContextStore();
    await store.createPackage(pkg());
    await store.addExclusion({
      id: 'ex_1',
      packageId: 'cp_1',
      sourceType: 'specification',
      sourceId: 'sp_4',
      reason: 'budget',
      detail: 'excluded at 12,400 of a 12,000-token budget',
      wasEssential: false,
    });
    const exclusions = await store.exclusionsFor('ws_1', 'cp_1');
    expect(exclusions[0]?.detail).toMatch(/12,000/);
  });

  it('and index entries, which live per workspace', async () => {
    const store = new InMemoryContextStore();
    await store.upsertIndexEntry({
      id: 'ie_1',
      workspaceId: 'ws_1',
      sourceType: 'requirement',
      sourceId: 'rq_1',
      sourceVersion: 'v1',
      embeddingModelId: 'model-a',
      dimension: 3,
      indexedAt: new Date(),
    });
    expect(await store.indexEntriesFor('ws_1')).toHaveLength(1);
  });
});

describe('T1309 · another workspace is absent, not forbidden', () => {
  it('a package in another workspace reads as null', async () => {
    // `FR-002`. A `403` would confirm the package exists — and its existence
    // leaks that somebody elsewhere asked a question, in their own words.
    const store = new InMemoryContextStore();
    await store.createPackage(pkg());
    expect(await store.findPackage('ws_other', 'cp_1')).toBeNull();
  });

  it('and its items are unreadable from there too', async () => {
    const store = new InMemoryContextStore();
    await store.createPackage(pkg());
    await store.addItem({
      id: 'pi_1',
      packageId: 'cp_1',
      sourceType: 'requirement',
      sourceId: 'rq_1',
      sourceVersion: 'v3',
      authoritativeStatus: 'current',
      inclusionReason: 'objective term: notification',
      relevanceScore: 0.9,
      crossBoundary: false,
    });
    // The scoping must be on the read, not on the caller remembering to check.
    expect(await store.itemsFor('ws_other', 'cp_1')).toHaveLength(0);
  });

  it('and index entries never cross', async () => {
    const store = new InMemoryContextStore();
    for (const [id, ws] of [
      ['ie_a', 'ws_a'],
      ['ie_b', 'ws_b'],
    ] as const) {
      await store.upsertIndexEntry({
        id,
        workspaceId: ws,
        sourceType: 'requirement',
        sourceId: 'rq_1',
        sourceVersion: 'v1',
        embeddingModelId: 'model-a',
        dimension: 3,
        indexedAt: new Date(),
      });
    }
    expect((await store.indexEntriesFor('ws_a')).map((e) => e.id)).toEqual(['ie_a']);
  });

  it('the isolation check is not vacuous — both entries exist', async () => {
    const store = new InMemoryContextStore();
    await store.upsertIndexEntry({
      id: 'ie_a',
      workspaceId: 'ws_a',
      sourceType: 'requirement',
      sourceId: 'rq_1',
      sourceVersion: 'v1',
      embeddingModelId: 'model-a',
      dimension: 3,
      indexedAt: new Date(),
    });
    expect(await store.indexEntriesFor('ws_a')).toHaveLength(1);
  });
});

describe('T1309 · the store offers no way to delete a package', () => {
  it.each(['delete', 'remove', 'destroy', 'purge', 'drop', 'clear'])(
    'exposes no method starting with %s',
    (verb) => {
      // `FR-CTX-066`, `R-038-9`. Retention is inherited from the execution by
      // cascade, so the promise is kept by the absence of the capability rather
      // than by everyone remembering not to use it.
      const store = new InMemoryContextStore();
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
      expect(
        methods.some((name) => new RegExp(`^${verb}`, 'i').test(name)),
        `the store exposes ${verb}`,
      ).toBe(false);
    },
  );

  it('the delete check can fire', () => {
    expect(['deletePackage'].some((n) => /^delete/i.test(n))).toBe(true);
  });

  it('but re-indexing a changed source IS possible, so the absence is not paralysis', async () => {
    // `FR-CTX-018` — an entry is replaced in place when its source version
    // moves. Replacing an index entry is not deleting a package's history, and
    // conflating the two would make the corpus permanently stale.
    const store = new InMemoryContextStore();
    const base = {
      id: 'ie_1',
      workspaceId: 'ws_1',
      sourceType: 'requirement' as const,
      sourceId: 'rq_1',
      embeddingModelId: 'model-a',
      dimension: 3,
      indexedAt: new Date(),
    };
    await store.upsertIndexEntry({ ...base, sourceVersion: 'v1' });
    await store.upsertIndexEntry({ ...base, sourceVersion: 'v2' });

    const entries = await store.indexEntriesFor('ws_1');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.sourceVersion).toBe('v2');
  });
});
