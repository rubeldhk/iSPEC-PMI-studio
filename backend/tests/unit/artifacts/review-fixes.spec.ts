/**
 * Review of `epic/045-artifact-sync-markdown-viewer` (2026-09-05) — the
 * findings fixed on the branch, each observed red first:
 *
 * - `DEF-045-002`: the specification step raced (two first syncs of one Epic's
 *   `spec.md` → one `500`) and was not retry-safe; the in-memory port tolerated
 *   what the database refused.
 * - finding 4: a caller-supplied idempotency key reused for a different payload
 *   returned another request's answer.
 * - finding 3: the content read fanned out one query per execution of the
 *   project.
 * - finding 6: the store gains `manifestsForVersion` and `syncsByIds`.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryArtifactStore } from '../../../src/modules/artifacts/artifact.store.js';
import { ArtifactReadService } from '../../../src/modules/artifacts/artifact-read.service.js';
import { ArtifactSyncService, type ExecutionLookupRow, type ExecutionReader } from '../../../src/modules/artifacts/artifact-sync.service.js';
import { InMemorySpecificationSyncPort } from '../../../src/modules/artifacts/specification-sync.port.js';

const WS = 'ws-1';
const PROJECT = 'proj-1';
const SPEC = 'specs/003-reports/spec.md';
const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const file = (path: string, content: string): { path: string; digest: string; content: string } => ({ path, digest: sha256(content), content });

const EPICS = [{ id: 'epic-3', number: 3, parentNumber: null, splitSuffix: null, slug: 'reports' }];

function execution(overrides: Partial<ExecutionLookupRow> = {}): ExecutionLookupRow {
  return {
    executionId: 'exec-1',
    workspaceId: WS,
    projectId: PROJECT,
    command: 'specify',
    initiatorId: 'user-1',
    state: 'completed',
    registeredAt: '2026-09-05T10:00:00.000Z',
    completedAt: '2026-09-05T10:05:00.000Z',
    completionComment: null,
    targetType: 'epic',
    targetId: '3',
    outputArtifactDigests: [],
    agentAdapter: 'adapter-x',
    agentVersion: '1.0.0',
    agentModel: 'model-x',
    ...overrides,
  };
}

function reader(rows: ExecutionLookupRow[]): ExecutionReader {
  return {
    async find(workspaceId, executionId) {
      return rows.find((r) => r.workspaceId === workspaceId && r.executionId === executionId) ?? null;
    },
    async forProject(workspaceId, projectId) {
      return rows.filter((r) => r.workspaceId === workspaceId && r.projectId === projectId);
    },
  };
}

function harness(rows: ExecutionLookupRow[] = [execution()]) {
  const store = new InMemoryArtifactStore();
  const specifications = new InMemorySpecificationSyncPort();
  const service = new ArtifactSyncService({
    store,
    executions: reader(rows),
    epics: { list: async () => EPICS },
    specifications,
    comments: { add: async () => ({ commentId: 'c' }) },
    audit: { record: async () => undefined },
    limits: () => ({ maxBytes: 1024 * 1024, maxFiles: 200 }),
  });
  const reads = new ArtifactReadService({ store, executions: reader(rows) });
  return { service, store, specifications, reads };
}

const ctx = { workspaceId: WS, projectId: PROJECT, credentialId: 'cred-1' };

describe('DEF-045-002 · the specification step under concurrency', () => {
  it('two concurrent first syncs of an Epic spec.md with different content both succeed and leave ONE specification with TWO versions', async () => {
    const h = harness();
    await Promise.all([
      h.service.sync(ctx, { executionId: 'exec-1', idempotencyKey: 'k-a', files: [file(SPEC, '# A\n')] }),
      h.service.sync(ctx, { executionId: 'exec-1', idempotencyKey: 'k-b', files: [file(SPEC, '# B\n')] }),
    ]);
    const specs = h.specifications.all().filter((s) => s.epicId === 'epic-3');
    expect(specs).toHaveLength(1);
    expect(h.specifications.versionsOf(specs[0]!.id).map((v) => v.contentRaw).sort()).toEqual(['# A\n', '# B\n']);
  });

  it('the in-memory port refuses a second specification for the same (epicId, sourcePath) with a P2002-shaped error, like the database', async () => {
    const port = new InMemorySpecificationSyncPort();
    const base = { workspaceId: WS, projectId: PROJECT, epicId: 'epic-3', sourcePath: SPEC, title: 'T', contentRaw: '# x\n', createdById: 'u', ownerUserId: 'o', provenance: { engineName: 'e', engineVersion: '1' } };
    await port.createFromSync(base);
    await expect(port.createFromSync(base)).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('review finding 4 · a reused idempotency key with a different payload', () => {
  it('is refused as idempotency_conflict for a different manifest and for a different execution; the same payload is still a replay', async () => {
    const h = harness([execution(), execution({ executionId: 'exec-2' })]);
    await h.service.sync(ctx, { executionId: 'exec-1', idempotencyKey: 'same-key', files: [file('specs/003-reports/plan.md', '# p1\n')] });
    await expect(h.service.sync(ctx, { executionId: 'exec-1', idempotencyKey: 'same-key', files: [file('specs/003-reports/plan.md', '# p2\n')] })).rejects.toMatchObject({ details: { code: 'idempotency_conflict' } });
    await expect(h.service.sync(ctx, { executionId: 'exec-2', idempotencyKey: 'same-key', files: [file('specs/003-reports/plan.md', '# p1\n')] })).rejects.toMatchObject({ details: { code: 'idempotency_conflict' } });
    const replay = await h.service.sync(ctx, { executionId: 'exec-1', idempotencyKey: 'same-key', files: [file('specs/003-reports/plan.md', '# p1\n')] });
    expect(replay.created).toBe(1);
  });
});

describe('review finding 3 · the content read does not fan out over the project executions', () => {
  it('reads the version own manifest rows and their syncs - never one query per execution', async () => {
    const h = harness([execution(), execution({ executionId: 'exec-2', command: 'plan' }), execution({ executionId: 'exec-3', command: 'tasks' })]);
    await h.service.sync(ctx, { executionId: 'exec-1', idempotencyKey: 'k1', files: [file(SPEC, '# same\n')] });
    await h.service.sync(ctx, { executionId: 'exec-2', idempotencyKey: 'k2', files: [file(SPEC, '# same\n')] });
    const versionId = (await h.reads.tree(WS, PROJECT, 'epic-3')).files[0]?.current?.versionId as string;
    const perExecution = vi.spyOn(h.store, 'syncsForExecution');
    const byVersion = vi.spyOn(h.store, 'manifestsForVersion');
    const content = await h.reads.content(WS, PROJECT, versionId);
    expect(content?.deliveredBy.map((d) => d.executionId).sort()).toEqual(['exec-1', 'exec-2']);
    expect(perExecution).not.toHaveBeenCalled();
    expect(byVersion).toHaveBeenCalledTimes(1);
  });
});

describe('review finding 3 · manifestsForVersion and syncsByIds', () => {
  it('returns the manifest rows that reference a version, and the syncs by id, in one call each', async () => {
    const store = new InMemoryArtifactStore();
    const v = await store.createVersion({ workspaceId: 'ws', projectId: 'p', path: 'specs/001-a/spec.md', kind: 'spec', digest: 'd1', sizeBytes: 3, content: '# a', firstExecutionId: 'e1' });
    const s1 = await store.recordSync({ workspaceId: 'ws', projectId: 'p', executionId: 'e1', epicId: 'epic', credentialId: 'c', idempotencyKey: 'k1', createdCount: 1, reusedCount: 0, refusedCount: 0 }, [{ path: 'specs/001-a/spec.md', digest: 'd1', outcome: 'created', versionId: v.row.id, refusalCode: null, refusalDetail: null }]);
    const s2 = await store.recordSync({ workspaceId: 'ws', projectId: 'p', executionId: 'e2', epicId: null, credentialId: 'c', idempotencyKey: 'k2', createdCount: 0, reusedCount: 1, refusedCount: 0 }, [{ path: 'specs/001-a/spec.md', digest: 'd1', outcome: 'reused', versionId: v.row.id, refusalCode: null, refusalDetail: null }]);
    const rows = await store.manifestsForVersion(v.row.id);
    expect(rows.map((r) => r.syncId).sort()).toEqual([s1.row.id, s2.row.id].sort());
    const syncs = await store.syncsByIds([s1.row.id, s2.row.id, 'missing']);
    expect(syncs.map((s) => s.executionId).sort()).toEqual(['e1', 'e2']);
  });
});
