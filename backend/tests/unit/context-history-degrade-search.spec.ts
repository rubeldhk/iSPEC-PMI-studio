/**
 * `T1872` (EPIC-038 Convergence) — a failing history read degrades; it does not
 * refuse the index.
 *
 * The contract's port table: `ExecutionProjections` **degrades** — history
 * drops out and the package records that it did. But search asks every
 * candidate's current version first, and for execution history that is the
 * same `EPIC-037` read; its failure became a `503` refusing the whole assembly
 * and blaming the index, which was healthy. Execution history now carries
 * *unknown* staleness from search and is left to the history judge. A failing
 * read for a governed document still refuses: the document corpus is a
 * precondition, history is an addition.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import type { SourceVersionReader } from '../../src/modules/context/inspection.service.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { ContextIndexUnavailableError, SearchService } from '../../src/modules/context/retrieval/search.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

async function indexed(sourceType: string, sourceId: string): Promise<InMemoryVectorIndex> {
  const store = new InMemoryContextStore();
  await store.addSourceClass({
    id: 'sc', workspaceId: 'ws_1', sourceType, securityClassification: 'internal', indexable: true,
  });
  const vectors = new InMemoryVectorIndex();
  await new IndexService(store, vectors, fixtureEmbedding(), artifacts({ [`${sourceType}:${sourceId}@v1`]: 'booking notification' }))
    .reindex({ workspaceId: 'ws_1', sourceType, sourceId, sourceVersion: 'v1' });
  return vectors;
}

const failing: SourceVersionReader = {
  async currentVersion() {
    throw new Error('projection store unreachable');
  },
};

describe('T1872 · history reads degrade at search', () => {
  it('an execution-history candidate whose version read fails is returned with unknown staleness', async () => {
    const out = await new SearchService(await indexed('execution-history', 'ex_1'), fixtureEmbedding(), failing, { limit: 10 })
      .search({ workspaceId: 'ws_1', objective: 'booking' });
    expect(out.candidates.map((c) => c.sourceId)).toEqual(['ex_1']);
    expect(out.candidates[0]?.stalenessUnknown).toMatch(/projection store unreachable/);
  });

  it('the control: a governed document whose version read fails still refuses as the index unavailable', async () => {
    await expect(
      new SearchService(await indexed('requirement', 'rq_1'), fixtureEmbedding(), failing, { limit: 10 })
        .search({ workspaceId: 'ws_1', objective: 'booking' }),
    ).rejects.toBeInstanceOf(ContextIndexUnavailableError);
  });
});
