/**
 * `T2520`–`T2523` (EPIC-038, amendment `A-038-1`, approved 2026-10-09 for
 * `EPIC-048` Governed Learning) — `knowledge-entry` is an approved source class.
 *
 * `FR-CTX-015` as amended. The class is admitted by the type system and by
 * configuration, so `EPIC-048` can register and index it without reopening
 * this Epic's requirement. Until `EPIC-048` exists **nothing produces such
 * items**: the production sources adapter serves no knowledge entry, and an
 * assembly handed one anyway excludes it, because the admission port that
 * would judge it (`KnowledgeAdmission`, `A-038-2`) is not bound. An unbound
 * port fails closed — `learning-contract.md` section 3.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  APPROVED_SOURCE_TYPES,
  IndexService,
  KNOWLEDGE_ENTRY_SOURCE_TYPE,
  type ApprovedSourceType,
} from '../../src/modules/context/retrieval/index.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { governedSources, type GovernedSourceServices } from '../../src/modules/context/sources.adapter.js';
import { allow, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

describe('T2520 · the type system admits knowledge-entry', () => {
  it('is a member of the approved set and of ApprovedSourceType', () => {
    expect(KNOWLEDGE_ENTRY_SOURCE_TYPE).toBe('knowledge-entry');
    expect(APPROVED_SOURCE_TYPES.has(KNOWLEDGE_ENTRY_SOURCE_TYPE)).toBe(true);
    expectTypeOf<ApprovedSourceType>().toEqualTypeOf<
      'specification' | 'requirement' | 'baseline' | 'decision' | 'execution-history' | 'knowledge-entry'
    >();
  });
});

describe('T2521 · configuration decides whether a workspace indexes it', () => {
  const build = (store: InMemoryContextStore) =>
    new IndexService(
      store,
      new InMemoryVectorIndex(),
      fixtureEmbedding(),
      artifacts({ 'knowledge-entry:ke_1@kv_1': 'retry the notifier once, never twice' }),
    );
  const request = { workspaceId: 'ws_1', sourceType: 'knowledge-entry', sourceId: 'ke_1', sourceVersion: 'kv_1' };

  it('passes the approved-set gate once a workspace registers an indexable class', async () => {
    const store = new InMemoryContextStore();
    await store.addSourceClass({
      id: 'sc_k', workspaceId: 'ws_1', sourceType: 'knowledge-entry', securityClassification: 'internal', indexable: true,
    });
    const out = await build(store).reindex(request);
    expect(out.status).toBe('indexed');
    expect(out.entry.sourceType).toBe('knowledge-entry');
  });

  it('is still refused where no class is registered — the absence of a class is not a permissive default', async () => {
    const store = new InMemoryContextStore();
    await expect(build(store).reindex(request)).rejects.toThrow(/FR-CTX-034/);
    expect(await store.indexEntriesFor('ws_1')).toEqual([]);
  });

  it('is still refused where the class is registered not indexable', async () => {
    const store = new InMemoryContextStore();
    await store.addSourceClass({
      id: 'sc_k', workspaceId: 'ws_1', sourceType: 'knowledge-entry', securityClassification: 'restricted', indexable: false,
    });
    await expect(build(store).reindex(request)).rejects.toBeInstanceOf(ValidationFailedError);
    expect(await store.indexEntriesFor('ws_1')).toEqual([]);
  });
});

describe('T2522 · nothing produces a knowledge entry until EPIC-048 exists', () => {
  const services: GovernedSourceServices = {
    requirements: { async get() { throw new Error('unused'); } },
    specifications: { async get() { throw new Error('unused'); }, async versions() { return []; } },
  };

  it('the production sources adapter serves no knowledge-entry text or version', async () => {
    const sources = governedSources(services);
    expect(await sources.read('ws_1', 'knowledge-entry', 'ke_1', 'kv_1')).toBeNull();
    expect(await sources.currentVersion('ws_1', 'knowledge-entry', 'ke_1')).toMatchObject({ resolves: 'unknown' });
  });

  it('so re-indexing one through it indexes nothing, even with a class registered', async () => {
    const store = new InMemoryContextStore();
    await store.addSourceClass({
      id: 'sc_k', workspaceId: 'ws_1', sourceType: 'knowledge-entry', securityClassification: 'internal', indexable: true,
    });
    const index = new IndexService(store, new InMemoryVectorIndex(), fixtureEmbedding(), governedSources(services));
    await expect(
      index.reindex({ workspaceId: 'ws_1', sourceType: 'knowledge-entry', sourceId: 'ke_1', sourceVersion: 'kv_1' }),
    ).rejects.toThrow(/does not resolve/);
    expect(await store.indexEntriesFor('ws_1')).toEqual([]);
  });
});

describe('T2523 · assembly never admits a knowledge entry while its admission port is unbound', () => {
  it('excludes it as permission, admission port unbound, and assembles the rest as before', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval([
        { sourceType: 'knowledge-entry', sourceId: 'ke_1', sourceVersion: 'kv_1', relevanceScore: 0.99, workspaceId: 'ws_1' },
        { sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1', relevanceScore: 0.5, workspaceId: 'ws_1' },
      ]),
      access: allow(),
      sourceClasses: classes(['knowledge-entry', 'requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input());

    expect((await store.itemsFor('ws_1', result.packageId)).map((i) => i.sourceId)).toEqual(['rq_1']);
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]?.sourceId).toBe('ke_1');
    expect(exclusions[0]?.reason).toBe('permission');
    expect(exclusions[0]?.detail).toMatch(/^admission port unbound/);
  });
});
