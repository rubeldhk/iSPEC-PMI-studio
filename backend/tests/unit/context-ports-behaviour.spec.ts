/**
 * `T1300` (EPIC-038 Phase Z) — the five ports behave as declared.
 *
 * `CONTEXT_PORTS` declares three that refuse and two that degrade
 * (`context-ports.spec.ts` asserts the declaration). This file asserts the
 * **behaviour**: each absence, exercised, does what the declaration says — and
 * each refusal names what is missing and who owes it.
 */
import { describe, expect, it } from 'vitest';
import { GovernanceSeamUnboundError, ProviderUnavailableError } from '../../src/core/errors.js';
import { accessPolicyFromEpic024 } from '../../src/modules/context/access.adapter.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { CONTEXT_PORTS } from '../../src/modules/context/context.tokens.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import { InMemoryVectorIndex } from '../../src/modules/context/retrieval/vector.index.js';
import { allow, candidates, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';
import { fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

const declared = (name: string) => CONTEXT_PORTS.find((p) => p.name === name)?.absent;

async function storeWithRequirements(): Promise<InMemoryContextStore> {
  const store = new InMemoryContextStore();
  await store.addSourceClass({
    id: 'sc', workspaceId: 'ws_1', sourceType: 'requirement', securityClassification: 'internal', indexable: true,
  });
  return store;
}

describe('T1300 · the three that refuse', () => {
  it('EmbeddingPort — declared refuse; assembly and re-indexing both refuse, naming it', async () => {
    expect(declared('EmbeddingPort')).toBe('refuse');
    const search = new SearchService(new InMemoryVectorIndex(), null, null, { limit: 10 });
    await expect(search.search({ workspaceId: 'ws_1', objective: 'x' })).rejects.toThrow(/EmbeddingPort[\s\S]*FR-CTX-013/);
    const index = new IndexService(await storeWithRequirements(), new InMemoryVectorIndex(), null, null);
    await expect(
      index.reindex({ workspaceId: 'ws_1', sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1' }),
    ).rejects.toBeInstanceOf(GovernanceSeamUnboundError);
  });

  it('AccessPolicy — declared refuse; an adjudicator that cannot answer stops assembly rather than admitting', async () => {
    expect(declared('AccessPolicy')).toBe('refuse');
    const access = accessPolicyFromEpic024(
      {
        async requireWithinWorkspace() {
          throw new ProviderUnavailableError('Actor directory unavailable: connection refused');
        },
      },
      { async effectivelyReadable() { return true; } },
    );
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: retrieval(candidates(['rq_1'])),
        access,
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input()),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    // `T1877`, `FR-CTX-065` — nothing is admitted, and the refusal is recorded.
    const recorded = await store.packagesForExecution('ws_1', 'ex_1');
    expect(recorded.map((p) => p.state)).toEqual(['refused']);
    expect(await store.itemsFor('ws_1', recorded[0]!.id)).toEqual([]);
  });

  it('ArtifactSource — declared refuse; re-indexing refuses, naming it and its owners', async () => {
    expect(declared('ArtifactSource')).toBe('refuse');
    const index = new IndexService(await storeWithRequirements(), new InMemoryVectorIndex(), fixtureEmbedding(), null);
    await expect(
      index.reindex({ workspaceId: 'ws_1', sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1' }),
    ).rejects.toThrow(/ArtifactSource[\s\S]*EPIC-033[\s\S]*EPIC-032/);
  });
});

describe('T1300 · the two that degrade', () => {
  async function assembled(opts: { includeLiveState: boolean }) {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval(candidates(['rq_1'])),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
      liveState: null,
      executions: null,
    }).assemble(input({ includeLiveState: opts.includeLiveState }));
    return { result, pkg: await store.findPackage('ws_1', result.packageId) };
  }

  it('ExecutionProjections — declared degrade; the package assembles and records history unavailable, naming EPIC-037', async () => {
    expect(declared('ExecutionProjections')).toBe('degrade');
    const { result, pkg } = await assembled({ includeLiveState: false });
    expect(result.itemCount).toBe(1);
    expect(pkg?.executionHistory).toBe('unavailable');
    expect(pkg?.executionHistoryReason).toMatch(/EPIC-037/);
  });

  it('LiveStateReader — declared degrade; the package assembles and records live state unavailable, with why', async () => {
    expect(declared('LiveStateReader')).toBe('degrade');
    const { result, pkg } = await assembled({ includeLiveState: true });
    expect(result.itemCount).toBe(1);
    expect(pkg?.liveState).toBe('unavailable');
    expect(pkg?.liveStateReason).toMatch(/LiveStateReader/);
  });
});
