/**
 * `T1850` (EPIC-038 Convergence) — a fault reading the index is the index
 * being unavailable.
 *
 * `FR-CTX-012`, contract: *index unavailable — 503*. A database fault inside the
 * vector index surfaced as a raw error — a `500` — so "the index could not be
 * read" looked like a bug in this module, and the refusal it caused carried no
 * package id. It is now the same `503` as an index never built, and the
 * refusal row is named.
 */
import { describe, expect, it } from 'vitest';
import { toHttpStatus } from '../../src/core/errors.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import type { VectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { allow, classes, input, noAuthorisations } from '../helpers/context-fixtures.js';
import { fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

function failing(where: 'modelsIn' | 'nearest'): VectorIndex {
  return {
    async prepare() {},
    async attach() {},
    async isEmbedded() {
      return true;
    },
    async modelsIn() {
      if (where === 'modelsIn') throw new Error('connection reset by peer');
      return [{ modelId: 'fixture-letters', dimension: 27, count: 1 }];
    },
    async nearest() {
      throw new Error('connection reset by peer');
    },
  };
}

async function refusalOf(where: 'modelsIn' | 'nearest') {
  const store = new InMemoryContextStore();
  try {
    await new AssemblyService(store, {
      retrieval: new SearchService(failing(where), fixtureEmbedding(), null, { limit: 10 }),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input({ executionId: undefined }));
  } catch (error) {
    return { error, store };
  }
  throw new Error('expected a refusal');
}

describe('T1850 · index read faults are 503, and named', () => {
  it.each(['modelsIn', 'nearest'] as const)('a fault in %s is a 503 saying the index could not be read', async (where) => {
    const { error } = await refusalOf(where);
    expect(toHttpStatus(error)).toBe(503);
    expect((error as Error).message).toMatch(/index could not be read[\s\S]*connection reset/);
  });

  it('and the refusal carries the id of its row', async () => {
    const { error, store } = await refusalOf('nearest');
    const id = (error as { details?: { packageId?: string } }).details?.packageId;
    expect((await store.findPackage('ws_1', id!))?.state).toBe('refused');
  });
});
