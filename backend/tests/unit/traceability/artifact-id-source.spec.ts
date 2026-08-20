/**
 * T861 — the artifact id source coverage iterates (F3, **FR-031**, **SC-010**).
 *
 * Written to FAIL before T862 exists (Constitution V).
 *
 * Found by `/speckit-converge EPIC-011`. `CoverageService` was correct and
 * `T128` passed; the module wired it to `EmptyArtifactIdSource`, whose two
 * methods both return `[]`. Coverage therefore iterated nothing and reported
 * nothing, so SC-010's "identify every uncovered requirement in a single view"
 * was true only of a blank view — an empty report and a clean report are
 * indistinguishable.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryRequirementStore,
  type RequirementRecord,
} from '../../../src/modules/requirements/requirements.service.js';
import { LookupArtifactIdSource } from '../../../src/modules/traceability/coverage.service.js';
import { InMemorySpecificationStore } from '../../../src/modules/specifications/specifications-read.service.js';

const WS = 'ws_a';
const OTHER_WS = 'ws_b';
const PROJECT = 'proj_1';
const OTHER_PROJECT = 'proj_2';

const VALID = { description: 'The system shall settle.', type: 'functional', priority: 'p1' } as const;

async function register(): Promise<{ store: InMemoryRequirementStore; rows: RequirementRecord[] }> {
  const store = new InMemoryRequirementStore();
  const rows: RequirementRecord[] = [];
  for (const [i, projectId] of [PROJECT, PROJECT, OTHER_PROJECT].entries()) {
    rows.push(
      await store.create({
        id: `req_${i + 1}`,
        workspaceId: WS,
        projectId,
        reference: `REQ-00${i + 1}`,
        description: VALID.description,
        type: VALID.type,
        priority: VALID.priority,
        status: 'active',
        contentHash: `h${i}`,
        retiredAt: null,
      }),
    );
  }
  return { store, rows };
}

// -------------------------------------------------------------- T861 · artifacts

describe('LookupArtifactIdSource lists the project’s real artifacts (SC-010)', () => {
  async function sourceWith(): Promise<{
    source: LookupArtifactIdSource;
    specifications: InMemorySpecificationStore;
  }> {
    const { store } = await register();
    const specifications = new InMemorySpecificationStore();
    await specifications.commitGeneration({
      specification: {
        id: 'spec_1',
        workspaceId: WS,
        projectId: PROJECT,
        title: 'Payments',
        lifecycleState: 'draft',
        currentVersionId: 'ver_1',
        engineName: 'stub',
        engineVersion: '1.0.0',
        generatedAt: new Date('2026-08-20T10:00:00.000Z'),
        isOutOfDate: false,
        createdById: 'u1',
        updatedById: 'u1',
      },
      version: {
        id: 'ver_1',
        workspaceId: WS,
        specificationId: 'spec_1',
        versionNumber: 1,
        contentRaw: '# Payments',
        contentParsed: { a: 1 },
        lifecycleStateAtCreation: 'draft',
        authoredById: 'u1',
      },
      links: [],
      job: { id: 'job_1', state: 'succeeded', resultRef: 'spec_1' },
    });
    // The adapters are the seam: coverage needs IDS, and neither store's own
    // read method is shaped that way. Written here exactly as the module wires
    // them, so this test exercises the composed shape rather than a convenient
    // one.
    return {
      specifications,
      source: new LookupArtifactIdSource(
        {
          listIdsForProject: async (ws, projectId) =>
            (await store.list(ws, projectId, { sortBy: 'createdAt', sortDir: 'asc' })).map(
              (r) => r.id,
            ),
        },
        {
          listIdsForProject: async (ws, projectId) =>
            (await specifications.listForProject(ws, projectId, { offset: 0, limit: 1_000 })).rows.map(
              (r) => r.id,
            ),
        },
      ),
    };
  }

  it('lists the project’s requirements — not an empty universe', async () => {
    const { source } = await sourceWith();
    expect((await source.listRequirementIds(WS, PROJECT)).sort()).toEqual(['req_1', 'req_2']);
  });

  it('scopes to the project — another project’s requirements are not counted', async () => {
    const { source } = await sourceWith();
    expect(await source.listRequirementIds(WS, OTHER_PROJECT)).toEqual(['req_3']);
  });

  it('scopes to the workspace', async () => {
    const { source } = await sourceWith();
    expect(await source.listRequirementIds(OTHER_WS, PROJECT)).toEqual([]);
  });

  it('lists the project’s specifications', async () => {
    const { source } = await sourceWith();
    expect(await source.listSpecificationIds(WS, PROJECT)).toEqual(['spec_1']);
  });

  it('a project with no artifacts is distinguishable from an unwired source', async () => {
    // Both answer `[]`. The difference is that this one asked: a project that
    // genuinely has nothing reports nothing, and so does a project whose
    // requirements exist — which was the bug.
    const { source } = await sourceWith();
    expect(await source.listSpecificationIds(WS, OTHER_PROJECT)).toEqual([]);
    expect(await source.listRequirementIds(WS, OTHER_PROJECT)).not.toEqual([]);
  });
});
