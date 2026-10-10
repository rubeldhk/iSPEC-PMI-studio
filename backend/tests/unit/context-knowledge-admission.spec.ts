/**
 * `T2396` (EPIC-048 Phase 9, amendment `A-038-2`, asserted in `EPIC-038`'s
 * suite) — approved knowledge enters context assembly through one additive
 * seam (`R-048-11` items 1–5).
 *
 * `A-038-1` (merged) admitted `knowledge-entry` to `FR-CTX-015` and made
 * assembly exclude it while no admission port judges it. This is the seam:
 *
 * - the sources adapter serves `knowledge-entry` through a
 *   `KnowledgeSourceReader` (`learning-contract`), workspace-wide in the index
 *   (`projectId: null`) because scope is admission's job, not the partition's;
 * - provenance reads a knowledge item `current` or `superseded` naming its
 *   successor (`FR-LRN-052`);
 * - `AssemblyPorts.admission` is consulted **after** `judgeBoundary` and
 *   **before** `access.mayRead`; its refusals become exclusions with the
 *   existing reasons, and an admitted item's inclusion reason begins
 *   `approved knowledge —`;
 * - an absent admission port still excludes knowledge with `permission`.
 *
 * Every other source type is untouched.
 */
import { describe, expect, it } from 'vitest';
import type { AdmissionVerdict, KnowledgeAdmission, KnowledgeSourceReader } from '@pmi/learning-contract';
import { AssemblyService, type AssemblyPorts } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { ProvenanceService, resolveKnowledgeProvenance } from '../../src/modules/context/provenance.service.js';
import { APPROVED_SOURCE_TYPES } from '../../src/modules/context/retrieval/index.service.js';
import { governedSources, type GovernedSourceServices } from '../../src/modules/context/sources.adapter.js';
import { baselines, classes, input, noAuthorisations, retrieval } from '../helpers/context-fixtures.js';

const services: GovernedSourceServices = {
  requirements: { async get() { throw new Error('unused'); } },
  specifications: { async get() { throw new Error('unused'); }, async versions() { return []; } },
};

/** A reader over two entries: ke_1 at kv_2 (kv_1 superseded by it), ke_old deprecated. */
function reader(): KnowledgeSourceReader {
  return {
    async currentVersion(_ws, entryId) {
      if (entryId === 'ke_1') return { resolves: true, version: 'kv_2' };
      return { resolves: false, reason: `${entryId} is deprecated` };
    },
    async read(_ws, entryId, versionId) {
      return entryId === 'ke_1' && versionId === 'kv_2' ? { text: 'retry the notifier once', projectId: null } : null;
    },
    async status(_ws, entryId, versionId) {
      if (entryId === 'ke_old') return { status: 'deprecated', reason: 'no longer true' };
      return versionId === 'kv_1' ? { status: 'superseded', supersededBy: 'kv_2' } : { status: 'current' };
    },
  };
}

const knowledge = (sourceId: string, sourceVersion: string, over: Record<string, unknown> = {}) => ({
  sourceType: 'knowledge-entry', sourceId, sourceVersion, relevanceScore: 0.9, workspaceId: 'ws_1', ...over,
});

describe('T2396 · knowledge-entry is approved, and the sources adapter serves it', () => {
  it('is in APPROVED_SOURCE_TYPES', () => {
    expect(APPROVED_SOURCE_TYPES.has('knowledge-entry')).toBe(true);
  });

  it('serves current version and text through the KnowledgeSourceReader, workspace-wide in the index', async () => {
    const sources = governedSources({ ...services, knowledge: () => reader() });
    expect(await sources.currentVersion('ws_1', 'knowledge-entry', 'ke_1')).toEqual({ resolves: true, version: 'kv_2' });
    expect(await sources.currentVersion('ws_1', 'knowledge-entry', 'ke_old')).toEqual({ resolves: false });
    expect(await sources.read('ws_1', 'knowledge-entry', 'ke_1', 'kv_2')).toEqual({ text: 'retry the notifier once', projectId: null });
    expect(await sources.read('ws_1', 'knowledge-entry', 'ke_1', 'kv_1')).toBeNull();
  });

  it('with no reader bound, serves nothing — as before A-038-2', async () => {
    const sources = governedSources({ ...services, knowledge: () => null });
    expect(await sources.currentVersion('ws_1', 'knowledge-entry', 'ke_1')).toMatchObject({ resolves: 'unknown' });
    expect(await sources.read('ws_1', 'knowledge-entry', 'ke_1', 'kv_2')).toBeNull();
  });
});

describe('T2396 · provenance reads current or superseded for a knowledge item (FR-LRN-052)', () => {
  const source = (sourceId: string, sourceVersion: string) => ({ sourceType: 'knowledge-entry', sourceId, sourceVersion });

  it('current, superseded naming the successor, and deprecated as undetermined with the reason', async () => {
    await expect(resolveKnowledgeProvenance(reader(), 'ws_1', source('ke_1', 'kv_2'))).resolves.toMatchObject({ authoritativeStatus: 'current' });
    await expect(resolveKnowledgeProvenance(reader(), 'ws_1', source('ke_1', 'kv_1'))).resolves.toMatchObject({ authoritativeStatus: 'superseded', supersededBy: 'kv_2' });
    await expect(resolveKnowledgeProvenance(reader(), 'ws_1', source('ke_old', 'kv_9'))).resolves.toMatchObject({
      authoritativeStatus: 'undetermined', undeterminedReason: expect.stringMatching(/deprecated: no longer true/),
    });
  });

  it('ProvenanceService answers knowledge from the reader and everything else from baselines, as before', async () => {
    const service = new ProvenanceService(baselines({ 'rq_1@v1': { status: 'current' } }), reader());
    await expect(service.resolve('ws_1', source('ke_1', 'kv_1'))).resolves.toMatchObject({ authoritativeStatus: 'superseded', supersededBy: 'kv_2' });
    await expect(service.resolve('ws_1', { sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1' })).resolves.toMatchObject({ authoritativeStatus: 'current' });
  });
});

describe('T2396 · AssemblyPorts.admission — after the boundary, before access', () => {
  function assembly(order: string[], verdicts: Record<string, AdmissionVerdict>, extra: Partial<AssemblyPorts> = {}) {
    const store = new InMemoryContextStore();
    const admission: KnowledgeAdmission = {
      async admit(candidates, target) {
        order.push(`admit:${candidates.map((c) => c.sourceId).join(',')}:${target.projectId}:${target.executionId ?? '-'}`);
        return candidates.map((c) => verdicts[c.sourceId]!);
      },
    };
    const service = new AssemblyService(store, {
      retrieval: retrieval([
        knowledge('ke_1', 'kv_2'),
        knowledge('ke_scope', 'kv_1'),
        knowledge('ke_stale', 'kv_1'),
        // Another workspace's entry, with no authorisation: the boundary refuses it first.
        knowledge('ke_foreign', 'kv_1', { workspaceId: 'ws_2' }),
        { sourceType: 'requirement', sourceId: 'rq_1', sourceVersion: 'v1', relevanceScore: 0.5, workspaceId: 'ws_1' },
      ]),
      access: { async mayRead(_actor, source) { order.push(`access:${source.sourceId}`); return true; } },
      sourceClasses: classes(['knowledge-entry', 'requirement']),
      authorisations: noAuthorisations(),
      admission: new Map([['knowledge-entry', admission]]),
      knowledge: reader(),
      ...extra,
    });
    return { store, service };
  }

  const verdicts: Record<string, AdmissionVerdict> = {
    ke_1: { admitted: true, inclusionNote: 'architecture, approved for every project' },
    ke_scope: { admitted: false, reason: 'boundary', detail: 'scope: approved for p_other only' },
    ke_stale: { admitted: false, reason: 'stale', detail: 'superseded: kv_1 by kv_2' },
  };

  it('is asked only of what passed the boundary, and before the actor’s permission', async () => {
    const order: string[] = [];
    await assembly(order, verdicts).service.assemble(input());
    expect(order).toEqual([
      'admit:ke_1:pr_1:ex_1',
      'access:ke_1',
      'admit:ke_scope:pr_1:ex_1',
      'admit:ke_stale:pr_1:ex_1',
      'access:rq_1',
    ]);
  });

  it('its refusals are exclusions with the existing reasons; the boundary’s own refusal is unchanged', async () => {
    const { store, service } = assembly([], verdicts);
    const result = await service.assemble(input());
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    const by = Object.fromEntries(exclusions.map((e) => [e.sourceId, e]));
    expect(by['ke_scope']).toMatchObject({ reason: 'boundary', detail: 'scope: approved for p_other only' });
    expect(by['ke_stale']).toMatchObject({ reason: 'stale', detail: 'superseded: kv_1 by kv_2' });
    expect(by['ke_foreign']).toMatchObject({ reason: 'boundary' });
    expect(by['ke_foreign']!.detail).not.toMatch(/^(scope|workspace):/);
  });

  it('an admitted item says it is approved knowledge, and carries its provenance', async () => {
    const { store, service } = assembly([], verdicts);
    const result = await service.assemble(input());
    const items = await store.itemsFor('ws_1', result.packageId);
    const item = items.find((i) => i.sourceId === 'ke_1')!;
    expect(item.inclusionReason).toBe('approved knowledge — architecture, approved for every project');
    expect(item.authoritativeStatus).toBe('current');
    // Other types keep their own reason.
    expect(items.find((i) => i.sourceId === 'rq_1')!.inclusionReason).toMatch(/^objective relevance/);
  });

  it('an absent admission port excludes every knowledge item with permission — never admitted by default', async () => {
    const { store, service } = assembly([], verdicts, { admission: null });
    const result = await service.assemble(input());
    const exclusions = await store.exclusionsFor('ws_1', result.packageId);
    for (const id of ['ke_1', 'ke_scope', 'ke_stale']) {
      const e = exclusions.find((x) => x.sourceId === id)!;
      expect(e.reason).toBe('permission');
      expect(e.detail).toMatch(/^admission port unbound/);
    }
  });

  it('an admission port that answers nothing for a candidate excludes it — a missing verdict is not an admission', async () => {
    const { store, service } = assembly([], { ke_scope: verdicts['ke_scope']!, ke_stale: verdicts['ke_stale']! } as never);
    const result = await service.assemble(input());
    const e = (await store.exclusionsFor('ws_1', result.packageId)).find((x) => x.sourceId === 'ke_1')!;
    expect(e).toMatchObject({ reason: 'permission' });
  });
});
