/**
 * `T1811` (EPIC-038 Convergence) — the corpus, read from the modules that own
 * it. `FR-CTX-011`, `FR-CTX-015`, plan: the `ArtifactSource` port.
 *
 * Re-indexing needs one version of one source's text, and the project that owns
 * it (`FR-CTX-050`). With no `ArtifactSource` bound, re-indexing would refuse
 * even once an embedding provider exists. Requirements and specifications are
 * readable through their own modules' public services, so the port is filled
 * for those two types and answers `null` — does not resolve — for anything it
 * cannot read: another version, another workspace, or a type nobody serves.
 */
import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/core/errors.js';
import { governedSources, type GovernedSourceServices } from '../../src/modules/context/sources.adapter.js';

const services: GovernedSourceServices = {
  requirements: {
    async get(workspaceId, id) {
      if (workspaceId !== 'ws_1' || id !== 'rq_1') throw new NotFoundError('Not found.');
      return { id, projectId: 'pr_1', reference: 'REQ-1', description: 'notify once', contentHash: 'hash_a', retiredAt: null };
    },
  },
  specifications: {
    async get(workspaceId, id) {
      if (workspaceId !== 'ws_1' || id !== 'sp_1') throw new NotFoundError('Not found.');
      return { id, projectId: 'pr_7', title: 'Notifications', currentVersion: { versionNumber: 3, contentRaw: '# v3' } };
    },
    async versions() {
      return [{ versionNumber: 3, contentRaw: '# v3 text' }, { versionNumber: 2, contentRaw: '# v2 text' }];
    },
  },
};

describe('T1811 · the artifact source', () => {
  const source = governedSources(services);

  it('reads the current requirement, with its project', async () => {
    expect(await source.read('ws_1', 'requirement', 'rq_1', 'hash_a')).toEqual({
      text: 'REQ-1: notify once',
      projectId: 'pr_1',
    });
  });

  it('a requirement version other than the current one does not resolve', async () => {
    expect(await source.read('ws_1', 'requirement', 'rq_1', 'hash_old')).toBeNull();
  });

  it('reads any retained specification version, with its project', async () => {
    expect(await source.read('ws_1', 'specification', 'sp_1', 'v2')).toEqual({
      text: 'Notifications\n\n# v2 text',
      projectId: 'pr_7',
    });
  });

  it('another workspace, an unknown version, or an unserved type: null', async () => {
    expect(await source.read('ws_2', 'requirement', 'rq_1', 'hash_a')).toBeNull();
    expect(await source.read('ws_1', 'specification', 'sp_1', 'v9')).toBeNull();
    expect(await source.read('ws_1', 'decision', 'd_1', 'v1')).toBeNull();
  });
});
