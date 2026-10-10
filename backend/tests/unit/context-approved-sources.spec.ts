/**
 * `T1274` (EPIC-038) — the approved source set.
 *
 * `FR-CTX-015`. Governed documents — specifications, requirements, baselines
 * and decisions — and execution history. Source code and imported external
 * documents are never candidates.
 *
 * Enforced in three places, because each is bypassed differently: the index
 * refuses to build an entry, the ranker filters, and **assembly excludes
 * regardless of what the ranker returned** — a ranker is one implementation of
 * a port, and the rule must not depend on every implementation remembering it.
 */
import { describe, expect, it } from 'vitest';
import { ValidationFailedError } from '../../src/core/errors.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  APPROVED_SOURCE_TYPES,
  IndexService,
} from '../../src/modules/context/retrieval/index.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { allow, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

describe('T1274 · the approved set is exactly FR-CTX-015', () => {
  it('names governed documents and execution history, and nothing else', () => {
    expect([...APPROVED_SOURCE_TYPES].sort()).toEqual(
      ['baseline', 'decision', 'execution-history', 'requirement', 'specification'].sort(),
    );
  });
});

describe('T1274 · the index refuses an unapproved source', () => {
  it.each(['source-code', 'imported-document'])('refuses %s even when classified indexable', async (type) => {
    const store = new InMemoryContextStore();
    // An operator classified it indexable. The rule still holds: classification
    // is configuration, and FR-CTX-015 is not configurable.
    await store.addSourceClass({
      id: 'sc_x', workspaceId: 'ws_1', sourceType: type, securityClassification: 'internal', indexable: true,
    });
    const index = new IndexService(
      store,
      new InMemoryVectorIndex(),
      fixtureEmbedding(),
      artifacts({ [`${type}:s_1@v1`]: 'function notify() {}' }),
    );
    await expect(
      index.reindex({ workspaceId: 'ws_1', sourceType: type, sourceId: 's_1', sourceVersion: 'v1' }),
    ).rejects.toBeInstanceOf(ValidationFailedError);
    expect(await store.indexEntriesFor('ws_1')).toEqual([]);
  });
});

describe('T1274 · assembly excludes it even when a ranker returns it', () => {
  it('records the exclusion as classification, naming FR-CTX-015', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval([
        { sourceType: 'source-code', sourceId: 'src_1', sourceVersion: 'v1', relevanceScore: 0.99, workspaceId: 'ws_1' },
        { sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1', relevanceScore: 0.5, workspaceId: 'ws_1' },
      ]),
      access: allow(),
      sourceClasses: classes(['source-code', 'requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input());

    expect((await store.itemsFor('ws_1', result.packageId)).map((i) => i.sourceId)).toEqual(['rq_1']);
    const [exclusion] = await store.exclusionsFor('ws_1', result.packageId);
    expect(exclusion?.reason).toBe('classification');
    expect(exclusion?.detail).toMatch(/FR-CTX-015/);
  });
});
