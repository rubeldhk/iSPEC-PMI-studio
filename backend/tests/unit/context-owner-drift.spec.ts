/**
 * `T1838` (EPIC-038 Convergence) — material is asked about where it lives.
 *
 * `FR-CTX-040`, `FR-CTX-017`, `US4/AC2`. An item that crossed from another
 * workspace was checked for drift in the *requester's* workspace, where it does
 * not exist — so inspection said it "no longer resolves" about a source that
 * was fine. Authorised execution history from another workspace was judged
 * against the requester's projections, so it was always stale. The item now
 * records the workspace that owns its source, and both checks ask there.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { InspectionService, type SourceVersionReader } from '../../src/modules/context/inspection.service.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { allow, authorisedCrossing, classes, input, retrieval } from '../helpers/context-fixtures.js';

const crossing = (sourceType: string, sourceId: string): Candidate => ({
  sourceType,
  sourceId,
  sourceVersion: 'v1',
  relevanceScore: 0.9,
  workspaceId: 'ws_other',
});

describe('T1838 · drift and history are read in the owning workspace', () => {
  it('records the owning workspace on the item', async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval([crossing('requirement', 'rq_x')]),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: authorisedCrossing('rq_x', 'ws_other', 'ws_1'),
    }).assemble(input());
    const [item] = await store.itemsFor('ws_1', result.packageId);
    expect(item?.sourceWorkspaceId).toBe('ws_other');
  });

  it("inspection asks the owner's workspace, and so does not report a healthy source as gone", async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval([crossing('requirement', 'rq_x')]),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: authorisedCrossing('rq_x', 'ws_other', 'ws_1'),
    }).assemble(input());
    const asked: string[] = [];
    const versions: SourceVersionReader = {
      async currentVersion(workspaceId) {
        asked.push(workspaceId);
        return workspaceId === 'ws_other' ? { resolves: true, version: 'v1' } : { resolves: false };
      },
    };
    const seen = await new InspectionService(store, versions, null).inspect('ws_1', result.packageId);
    expect(asked).toEqual(['ws_other']);
    expect(seen?.items[0]?.drift).toEqual({ kind: 'unchanged' });
  });

  it("authorised execution history is judged against its owner's projection", async () => {
    const store = new InMemoryContextStore();
    const asked: string[] = [];
    const result = await new AssemblyService(store, {
      retrieval: retrieval([crossing('execution-history', 'ex_x')]),
      access: allow(),
      sourceClasses: classes(['execution-history']),
      authorisations: authorisedCrossing('ex_x', 'ws_other', 'ws_1'),
      executions: {
        async projectedVersion(workspaceId) {
          asked.push(workspaceId);
          return workspaceId === 'ws_other' ? 'v1' : null;
        },
      },
    }).assemble(input({ executionId: undefined }));
    expect(asked).toEqual(['ws_other']);
    expect(result.itemCount).toBe(1);
  });
});
