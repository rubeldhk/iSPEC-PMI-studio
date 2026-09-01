/**
 * `T1245` (EPIC-038) — source classes are configuration, and an absent class is
 * not a permissive default.
 *
 * `FR-CTX-015`, `FR-CTX-034`, `FR-CTX-036`, `PP-014`.
 *
 * ## Two separate facts, and conflating them is the bug
 *
 * A source class carries a **security classification** (what handling the
 * material needs) and an **`indexable`** flag (whether it enters the corpus at
 * all). They answer different questions, and a design with only one of them
 * gets a predictable failure: either everything classified becomes searchable,
 * or nothing searchable can be classified.
 *
 * `indexable` defaults to **false** in the migration for the reason `FR-GEL-062`
 * gives — a registered-but-not-yet-reviewed source type should not silently
 * join the corpus because somebody created a row.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';

const store = (): InMemoryContextStore => new InMemoryContextStore();

const cls = (over: Record<string, unknown> = {}): Parameters<
  InMemoryContextStore['addSourceClass']
>[0] => ({
  id: 'sc_1',
  workspaceId: 'ws_1',
  sourceType: 'requirement',
  securityClassification: 'internal',
  indexable: true,
  ...over,
});

describe('T1245 · a registered class is read, not inferred', () => {
  it('classifies a registered type', async () => {
    const s = store();
    await s.addSourceClass(cls());
    const found = await s.classifySource('ws_1', 'requirement');
    expect(found?.securityClassification).toBe('internal');
  });

  it('and lists what is registered, so nobody has to read configuration files', async () => {
    // `GET /context/sources` exists for this: *"why is my document never
    // retrieved"* should be answerable without opening a repository.
    const s = store();
    await s.addSourceClass(cls());
    await s.addSourceClass(cls({ id: 'sc_2', sourceType: 'execution', indexable: false }));
    const all = await s.sourceClassesFor('ws_1');
    expect(all.map((c) => c.sourceType).sort()).toEqual(['execution', 'requirement']);
  });
});

describe('T1245 · an unregistered type is null, never a stand-in', () => {
  it('returns null rather than a default class', async () => {
    // `FR-CTX-034`. A default here would be the permissive default one layer
    // down from where `T1239` catches it — and this is the layer that decides.
    const s = store();
    await s.addSourceClass(cls());
    expect(await s.classifySource('ws_1', 'imported-doc')).toBeNull();
  });

  it('and null in one workspace even when the type is registered in another', async () => {
    // Configuration is per workspace. A class registered by one tenant must not
    // classify another's material — that would be a boundary crossing dressed
    // as a lookup.
    const s = store();
    await s.addSourceClass(cls({ workspaceId: 'ws_other' }));
    expect(await s.classifySource('ws_1', 'requirement')).toBeNull();
  });

  it('the control: it IS found in its own workspace', async () => {
    const s = store();
    await s.addSourceClass(cls({ workspaceId: 'ws_other' }));
    expect(await s.classifySource('ws_other', 'requirement')).not.toBeNull();
  });
});

describe('T1245 · classification and indexability are separate facts', () => {
  it('a classified type may still be excluded from the corpus', async () => {
    // `FR-CTX-015`. Classified says how to handle it; indexable says whether it
    // is searchable at all. A design with one flag makes everything classified
    // searchable, which is the wrong direction to be wrong in.
    const s = store();
    await s.addSourceClass(cls({ sourceType: 'incident-note', indexable: false }));
    const found = await s.classifySource('ws_1', 'incident-note');
    expect(found?.securityClassification).toBe('internal');
    expect(found?.indexable).toBe(false);
  });

  it('and the two flags are independent, so the check is not vacuous', async () => {
    const s = store();
    await s.addSourceClass(cls({ sourceType: 'a', securityClassification: 'public', indexable: false }));
    await s.addSourceClass(cls({ id: 'sc_2', sourceType: 'b', securityClassification: 'secret', indexable: true }));
    const a = await s.classifySource('ws_1', 'a');
    const b = await s.classifySource('ws_1', 'b');
    expect([a?.indexable, b?.indexable]).toEqual([false, true]);
    expect([a?.securityClassification, b?.securityClassification]).toEqual(['public', 'secret']);
  });
});
