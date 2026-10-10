/**
 * `T1277` (EPIC-038) — re-indexing is incremental.
 *
 * `FR-CTX-018`, `SC-CTX-010`, `R-038-6`. One changed source re-embeds one
 * entry and leaves every other entry untouched — `indexedAt` included, because
 * an implementation that rebuilt everything and wrote identical vectors back
 * would pass any test that only compared vectors.
 *
 * A corpus rebuild is an operation nobody runs, which is how an index becomes
 * permanently stale in practice. So the cheap path is the only path.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError, ValidationFailedError } from '../../src/core/errors.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

const TEXTS = {
  'requirement:rq_1@v1': 'booking notification is sent twice',
  'requirement:rq_1@v2': 'booking notification is sent once',
  'requirement:rq_2@v1': 'invoice totals round incorrectly',
  'requirement:rq_3@v1': 'password reset expires',
};

async function world(embedding = fixtureEmbedding()) {
  const store = new InMemoryContextStore();
  await store.addSourceClass({
    id: 'sc_1', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
  });
  await store.addSourceClass({
    id: 'sc_2', workspaceId: 'ws_1', sourceType: 'decision', securityClassification: 'restricted', indexable: false,
  });
  let tick = 0;
  const clock = (): Date => new Date(Date.UTC(2026, 9, 8, 9, 0, (tick += 1)));
  const index = new IndexService(store, new InMemoryVectorIndex(), embedding, artifacts(TEXTS), clock);
  return { store, index, embedding };
}

const ref = (sourceId: string, sourceVersion: string) => ({
  workspaceId: 'ws_1', sourceType: 'requirement', sourceId, sourceVersion,
});

describe('T1277 · one changed source re-embeds one entry', () => {
  it('leaves every other entry, and its indexedAt, untouched', async () => {
    const { store, index, embedding } = await world();
    for (const id of ['rq_1', 'rq_2', 'rq_3']) await index.reindex(ref(id, 'v1'));
    const before = new Map((await store.indexEntriesFor('ws_1')).map((e) => [e.sourceId, e.indexedAt.getTime()]));
    const callsBefore = embedding.calls;

    const out = await index.reindex(ref('rq_1', 'v2'));

    expect(out.status).toBe('indexed');
    expect(embedding.calls - callsBefore).toBe(1);
    const after = await store.indexEntriesFor('ws_1');
    expect(after).toHaveLength(3);
    for (const entry of after.filter((e) => e.sourceId !== 'rq_1')) {
      expect(entry.indexedAt.getTime()).toBe(before.get(entry.sourceId));
    }
    expect(after.find((e) => e.sourceId === 'rq_1')?.sourceVersion).toBe('v2');
  });

  it('an entry already current at that version is not re-embedded', async () => {
    const { index, embedding } = await world();
    await index.reindex(ref('rq_1', 'v1'));
    const calls = embedding.calls;
    expect((await index.reindex(ref('rq_1', 'v1'))).status).toBe('current');
    expect(embedding.calls).toBe(calls);
  });

  it('there is no rebuild-all operation', () => {
    const methods = Object.getOwnPropertyNames(IndexService.prototype);
    expect(methods.filter((m) => /rebuild|reindexAll|all/i.test(m))).toEqual([]);
  });
});

describe('T1277 · refusals', () => {
  it('a class marked not indexable is a 400 naming the class', async () => {
    const { index } = await world();
    const attempt = index.reindex({ workspaceId: 'ws_1', sourceType: 'decision', sourceId: 'd_1', sourceVersion: 'v1' });
    await expect(attempt).rejects.toBeInstanceOf(ValidationFailedError);
    await expect(
      index.reindex({ workspaceId: 'ws_1', sourceType: 'decision', sourceId: 'd_1', sourceVersion: 'v1' }),
    ).rejects.toThrow(/restricted/);
  });

  it('an unbound embedding port is a 503 naming the seam', async () => {
    const store = new InMemoryContextStore();
    await store.addSourceClass({
      id: 'sc_1', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
    });
    const index = new IndexService(store, new InMemoryVectorIndex(), null, artifacts(TEXTS));
    await expect(index.reindex(ref('rq_1', 'v1'))).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
    await expect(index.reindex(ref('rq_1', 'v1'))).rejects.toThrow(/EmbeddingPort/);
  });

  it('an unbound artifact source is a 503 naming the seam', async () => {
    const store = new InMemoryContextStore();
    await store.addSourceClass({
      id: 'sc_1', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
    });
    const index = new IndexService(store, new InMemoryVectorIndex(), fixtureEmbedding(), null);
    await expect(index.reindex(ref('rq_1', 'v1'))).rejects.toThrow(/ArtifactSource/);
  });

  it('a version that does not resolve is refused, and nothing is written', async () => {
    const { store, index } = await world();
    await expect(index.reindex(ref('rq_9', 'v1'))).rejects.toBeInstanceOf(ValidationFailedError);
    expect(await store.indexEntriesFor('ws_1')).toEqual([]);
  });
});
