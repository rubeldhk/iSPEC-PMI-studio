/**
 * `T1821` (EPIC-038 Convergence) — a version-reader outage is not "current".
 *
 * `SC-CTX-009`, `FR-CTX-017`: zero stale entries ranked as current. Search
 * caught a failing version read and treated the candidate as current, so
 * during an outage every stale entry ranked as current — the failure the rule
 * exists for, delivered by the error handling. It now refuses, as
 * `sources.adapter.ts` already says an outage must.
 *
 * And a candidate whose staleness is *unknown* (no reader, or a type nobody
 * serves) is counted on the package, so "not marked stale" and "nobody could
 * tell" do not read alike.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { ContextIndexUnavailableError, SearchService } from '../../src/modules/context/retrieval/search.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import type { SourceVersionReader } from '../../src/modules/context/inspection.service.js';
import { allow, classes, input, noAuthorisations } from '../helpers/context-fixtures.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

async function indexed(): Promise<InMemoryVectorIndex> {
  const store = new InMemoryContextStore();
  await store.addSourceClass({
    id: 'sc', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
  });
  const vectors = new InMemoryVectorIndex();
  const index = new IndexService(store, vectors, fixtureEmbedding(), artifacts({
    'requirement:rq_1@v1': 'booking notification sent twice',
    'requirement:rq_2@v1': 'booking confirmation email',
  }));
  for (const sourceId of ['rq_1', 'rq_2']) {
    await index.reindex({ workspaceId: 'ws_1', sourceType: 'requirement', sourceId, sourceVersion: 'v1' });
  }
  return vectors;
}

describe('T1821 · staleness under failure and ignorance', () => {
  it('a failing version reader refuses the search rather than ranking as current', async () => {
    const failing: SourceVersionReader = {
      async currentVersion() {
        throw new Error('register unreachable');
      },
    };
    await expect(
      new SearchService(await indexed(), fixtureEmbedding(), failing, { limit: 10 }).search({
        workspaceId: 'ws_1',
        objective: 'booking',
      }),
    ).rejects.toThrow(ContextIndexUnavailableError);
  });

  it('unknown staleness is marked on the candidate', async () => {
    const unknown: SourceVersionReader = {
      async currentVersion() {
        return { resolves: 'unknown', reason: 'nobody serves requirement versions here' };
      },
    };
    const out = await new SearchService(await indexed(), fixtureEmbedding(), unknown, { limit: 10 }).search({
      workspaceId: 'ws_1',
      objective: 'booking',
    });
    expect(out.candidates.every((c) => c.stalenessUnknown !== undefined)).toBe(true);
  });

  it('and the package counts the items whose staleness nobody could determine', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: new SearchService(await indexed(), fixtureEmbedding(), null, { limit: 10 }),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input({ objective: 'booking' }));
    expect((await store.findPackage('ws_1', result.packageId))?.stalenessUnknown).toBe(2);
  });
});
