/**
 * `T1807` (EPIC-038 Convergence) — the project boundary.
 *
 * `FR-CTX-050`, `SC-CTX-003`, `US3`: context from one tenant **or project**
 * must not appear in another's package. The boundary first built was the
 * workspace alone, so another project's material in the same workspace was
 * admitted as the requester's own — the half of the requirement a workspace
 * test can never catch, because both projects are inside the partition.
 *
 * Same rule as the tenant boundary: refused by default, permitted only by a
 * named, one-way authorisation (`FR-CTX-051`–`FR-CTX-053`).
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { judgeBoundary } from '../../src/modules/context/isolation.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { allow, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const fromProject = (sourceId: string, projectId: string | null): Candidate => ({
  sourceType: 'requirement',
  sourceId,
  sourceVersion: 'v1',
  relevanceScore: 0.9,
  workspaceId: 'ws_1',
  projectId,
});

describe('T1807 · judgeBoundary sees projects', () => {
  it('same workspace, same project: own material, not a crossing', async () => {
    const verdict = await judgeBoundary(fromProject('rq_1', 'pr_1'), 'ws_1', noAuthorisations(), 'pr_1');
    expect(verdict).toEqual({ allowed: true, crossBoundary: false });
  });

  it('same workspace, another project, no authorisation: refused, naming both projects', async () => {
    const verdict = await judgeBoundary(fromProject('rq_9', 'pr_2'), 'ws_1', noAuthorisations(), 'pr_1');
    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false ? verdict.reason : '').toMatch(/pr_2[\s\S]*pr_1/);
  });

  it('an authorisation naming both projects, one way, permits the crossing and is cited', async () => {
    const store = new InMemoryContextStore();
    await store.addAuthorisation({
      id: 'rka_p', sourceType: 'requirement', sourceId: 'rq_9', workspaceId: 'ws_1', toWorkspaceId: 'ws_1',
      fromProjectId: 'pr_2', toProjectId: 'pr_1', authorisedBy: 'u_owner', rationale: 'shared NFR',
    });
    expect(await judgeBoundary(fromProject('rq_9', 'pr_2'), 'ws_1', store, 'pr_1')).toEqual({
      allowed: true, crossBoundary: true, authorisationRef: 'rka_p',
    });
    // One way: the grant to pr_1 does not let pr_2 read pr_1's copy.
    expect((await judgeBoundary(fromProject('rq_9', 'pr_1'), 'ws_1', store, 'pr_2')).allowed).toBe(false);
  });

  it('workspace-wide material (no owning project) is not a project crossing', async () => {
    const verdict = await judgeBoundary(fromProject('dec_1', null), 'ws_1', noAuthorisations(), 'pr_1');
    expect(verdict).toEqual({ allowed: true, crossBoundary: false });
  });
});

describe('T1807 · assembly applies it', () => {
  it("another project's requirement is excluded as boundary", async () => {
    const store = new InMemoryContextStore();
    const result = await new AssemblyService(store, {
      retrieval: retrieval([fromProject('rq_1', 'pr_1'), fromProject('rq_9', 'pr_2')]),
      access: allow(),
      sourceClasses: classes(['requirement']),
      authorisations: noAuthorisations(),
    }).assemble(input({ projectId: 'pr_1' }));
    expect((await store.itemsFor('ws_1', result.packageId)).map((i) => i.sourceId)).toEqual(['rq_1']);
    const [exclusion] = await store.exclusionsFor('ws_1', result.packageId);
    expect([exclusion?.sourceId, exclusion?.reason]).toEqual(['rq_9', 'boundary']);
  });

  it('a blank projectId is refused before anything is read', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: retrieval([]),
        access: allow(),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
      }).assemble(input({ projectId: '  ' })),
    ).rejects.toThrow(/projectId[\s\S]*FR-CTX-050/);
  });

  it('a projectId outside the workspace is refused, without saying whether it exists elsewhere', async () => {
    const store = new InMemoryContextStore();
    await expect(
      new AssemblyService(store, {
        retrieval: retrieval([]),
        access: allow(),
        sourceClasses: classes(['requirement']),
        authorisations: noAuthorisations(),
        projects: { async inWorkspace(_ws, projectId) { return projectId === 'pr_1'; } },
      }).assemble(input({ projectId: 'pr_elsewhere' })),
    ).rejects.toThrow(/no project pr_elsewhere in this workspace/);
  });
});
