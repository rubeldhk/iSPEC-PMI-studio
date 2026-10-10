/**
 * `T1308` (EPIC-038) — every candidate carries the score that ranked it.
 *
 * `FR-CTX-014`. And a candidate with **no** score is refused rather than
 * defaulted: zero is a real value meaning *unrelated*, so a default would rank
 * an unscored item as a poor match instead of as an unknown one, and the package
 * would describe a judgement nobody made.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { ContextIndexUnavailableError, SearchService } from '../../src/modules/context/retrieval/search.service.js';
import {
  InMemoryVectorIndex,
  type NearestRow,
  type VectorIndex,
} from '../../src/modules/context/retrieval/vector.index.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

const TEXTS = {
  'requirement:rq_1@v1': 'booking notification is sent twice',
  'requirement:rq_2@v1': 'invoice totals round incorrectly',
};

async function indexed(): Promise<InMemoryVectorIndex> {
  const store = new InMemoryContextStore();
  await store.addSourceClass({
    id: 'sc_1', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
  });
  const vectors = new InMemoryVectorIndex();
  const index = new IndexService(store, vectors, fixtureEmbedding(), artifacts(TEXTS));
  for (const sourceId of ['rq_1', 'rq_2']) {
    await index.reindex({ workspaceId: 'ws_1', sourceType: 'requirement', sourceId, sourceVersion: 'v1' });
  }
  return vectors;
}

describe('T1308 · candidate scores', () => {
  it('every candidate carries a finite score, best first', async () => {
    const out = await new SearchService(await indexed(), fixtureEmbedding(), null, { limit: 10 }).search({
      workspaceId: 'ws_1',
      objective: 'booking notification',
    });
    expect(out.candidates).toHaveLength(2);
    for (const c of out.candidates) expect(Number.isFinite(c.relevanceScore)).toBe(true);
    expect(out.candidates[0]!.relevanceScore).toBeGreaterThan(out.candidates[1]!.relevanceScore);
  });

  it('reports what it was asked for and what it returned', async () => {
    const out = await new SearchService(await indexed(), fixtureEmbedding(), null, { limit: 10 }).search({
      workspaceId: 'ws_1',
      objective: 'booking',
    });
    expect([out.requested, out.returned]).toEqual([10, 2]);
  });

  it.each([null, Number.NaN])('a row with distance %s is refused, not defaulted', async (distance) => {
    const real = await indexed();
    const broken: VectorIndex = {
      prepare: (ws, d) => real.prepare(ws, d),
      attach: (e, v) => real.attach(e, v),
      isEmbedded: (w, t, id) => real.isEmbedded(w, t, id),
      modelsIn: (ws) => real.modelsIn(ws),
      async nearest(q): Promise<NearestRow[]> {
        const rows = await real.nearest(q);
        return rows.map((r, i) => (i === 0 ? { ...r, distance } : r));
      },
    };
    await expect(
      new SearchService(broken, fixtureEmbedding(), null, { limit: 10 }).search({
        workspaceId: 'ws_1',
        objective: 'booking',
      }),
    ).rejects.toBeInstanceOf(ContextIndexUnavailableError);
  });
});
