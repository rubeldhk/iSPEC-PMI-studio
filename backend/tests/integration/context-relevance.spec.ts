/**
 * `T1282` (EPIC-038) — ranking by meaning, not by wording.
 *
 * `BR-0091`, `FR-CTX-010`, `US5`. An objective whose wording matches no source
 * verbatim must still retrieve the semantically nearest material. This is the
 * only test that would fail if embeddings were replaced by keyword matching —
 * and so it is the only one that cannot run against a fixture: the letter-bag
 * embedding in `context-retrieval-fixtures.ts` is deliberately not semantic,
 * and a test that passed against it would prove nothing about meaning.
 *
 * ## Not runnable in this programme yet, and said so
 *
 * No embedding provider exists anywhere in the programme (`R-038-1`,
 * `FR-CTX-013`). This file runs when one is supplied:
 *
 *     CONTEXT_EMBEDDING_MODULE=/abs/path/to/provider.mjs
 *
 * whose default export is a function returning an `EmbeddingPort`. Without it
 * the suite is **skipped, never passed** — `T1282` stays open in `tasks.md`,
 * and quickstart Scenario 14 records it as not runnable.
 */
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { EmbeddingPort } from '../../src/modules/context/retrieval/embedding.port.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { artifacts } from '../helpers/context-retrieval-fixtures.js';

const MODULE = process.env['CONTEXT_EMBEDDING_MODULE'];

/** Each pair shares meaning and no content word with its objective. */
const SOURCES = {
  'requirement:rq_dup@v1': 'Customers receive two identical confirmation emails after they reserve a table.',
  'requirement:rq_tax@v1': 'Invoice totals must include value-added tax rounded to the nearest cent.',
  'requirement:rq_pwd@v1': 'A credential recovery link stops working after fifteen minutes.',
};

describe.skipIf(MODULE === undefined)('T1282 · semantic retrieval against a real provider', () => {
  async function search(): Promise<SearchService> {
    const factory = (await import(pathToFileURL(MODULE!).href)) as { default: () => EmbeddingPort };
    const embedding = factory.default();
    const store = new InMemoryContextStore();
    await store.addSourceClass({
      id: 'sc_1', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
    });
    const vectors = new InMemoryVectorIndex();
    const index = new IndexService(store, vectors, embedding, artifacts(SOURCES));
    for (const sourceId of ['rq_dup', 'rq_tax', 'rq_pwd']) {
      await index.reindex({ workspaceId: 'ws_1', sourceType: 'requirement', sourceId, sourceVersion: 'v1' });
    }
    return new SearchService(vectors, embedding, null, { limit: 3 });
  }

  it.each([
    ['why does the booking notify twice', 'rq_dup'],
    ['the bill is a penny off once VAT is applied', 'rq_tax'],
    ['reset-password URL expires too quickly', 'rq_pwd'],
  ])('"%s" ranks %s first', async (objective, expected) => {
    const out = await (await search()).search({ workspaceId: 'ws_1', objective });
    expect(out.candidates[0]?.sourceId).toBe(expected);
  });
});
