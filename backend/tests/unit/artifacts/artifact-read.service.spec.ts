/**
 * `T1642` (EPIC-045, `R-045-7`, data-model.md §5) — the four projections, over
 * in-memory stores.
 *
 * The tree, the content read, the unbound list and the reported-versus-synced
 * findings are all derived from the manifest; nothing here is stored, so what
 * is tested is the derivation and not a cache.
 *
 * The assertion most worth reading is the last one: the tree must select **no
 * content**. It is enforced with a spy rather than by inspecting the answer,
 * because an answer that happens not to include content today is not the same
 * as a query that cannot load it (`SC-ART-006`). Written to FAIL before
 * `T1643`.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryArtifactStore, type NewArtifactSyncFile } from '../../../src/modules/artifacts/artifact.store.js';
import { ArtifactReadService } from '../../../src/modules/artifacts/artifact-read.service.js';
import type { ExecutionLookupRow, ExecutionReader } from '../../../src/modules/artifacts/artifact-sync.service.js';

const WS = 'ws-1';
const PROJECT = 'proj-1';
const EPIC = 'epic-3';
const SPEC = 'specs/003-reports/spec.md';
const PLAN = 'specs/003-reports/plan.md';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function execution(over: Partial<ExecutionLookupRow> = {}): ExecutionLookupRow {
  return {
    executionId: 'exec-1',
    workspaceId: WS,
    projectId: PROJECT,
    command: 'specify',
    initiatorId: 'u-1',
    state: 'completed',
    registeredAt: '2026-09-05T10:00:00.000Z',
    completedAt: '2026-09-05T10:05:00.000Z',
    completionComment: null,
    targetType: 'epic',
    targetId: '3',
    outputArtifactDigests: [],
    agentAdapter: 'claude-code',
    agentVersion: '2.1.0',
    agentModel: 'claude-opus-5',
    ...over,
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

interface Seeded {
  readonly store: InMemoryArtifactStore;
  readonly reads: ArtifactReadService;
  sync(input: { executionId: string; epicId: string | null; files: { path: string; content?: string; refusalCode?: string }[] }): Promise<string>;
}

function harness(executions: ExecutionLookupRow[] = [execution()]): Seeded {
  const store = new InMemoryArtifactStore();
  const reads = new ArtifactReadService({ store, executions: reader(executions) });
  let n = 0;
  return {
    store,
    reads,
    async sync(input): Promise<string> {
      const manifest: NewArtifactSyncFile[] = [];
      let created = 0;
      let refused = 0;
      for (const file of input.files) {
        if (file.refusalCode !== undefined) {
          manifest.push({ path: file.path, digest: sha256(file.path), outcome: 'refused', versionId: null, refusalCode: file.refusalCode as never, refusalDetail: 'refused' });
          refused += 1;
          continue;
        }
        const content = file.content ?? '# x\n';
        const outcome = await store.createVersion({
          workspaceId: WS,
          projectId: PROJECT,
          path: file.path,
          kind: file.path.endsWith('plan.md') ? 'plan' : 'spec',
          digest: sha256(content),
          sizeBytes: Buffer.byteLength(content, 'utf8'),
          content,
          firstExecutionId: input.executionId,
        });
        manifest.push({ path: file.path, digest: sha256(content), outcome: outcome.created ? 'created' : 'reused', versionId: outcome.row.id, refusalCode: null, refusalDetail: null });
        if (outcome.created) created += 1;
      }
      // Distinct timestamps: `current` is decided by sync order, so two syncs
      // sharing a millisecond would make the test measure the tie-break rather
      // than the rule.
      await new Promise((resolve) => setTimeout(resolve, 2));
      const recorded = await store.recordSync(
        { workspaceId: WS, projectId: PROJECT, executionId: input.executionId, epicId: input.epicId, credentialId: 'cred-1', idempotencyKey: `k-${(n += 1)}`, createdCount: created, reusedCount: input.files.length - created - refused, refusedCount: refused },
        manifest,
      );
      return recorded.row.id;
    },
  };
}

describe('T1642 · the tree groups the Epic\'s manifest by path (data-model §5)', () => {
  it('lists one entry per path with its kind and its versions newest first', async () => {
    const h = harness();
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# one\n' }, { path: PLAN }] });
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# two\n' }, { path: PLAN }] });

    const tree = await h.reads.tree(WS, PROJECT, EPIC);
    expect(tree.files.map((f) => f.path)).toEqual([PLAN, SPEC]);
    const spec = tree.files.find((f) => f.path === SPEC);
    expect(spec?.kind).toBe('spec');
    expect(spec?.versions.map((v) => v.digest)).toEqual([sha256('# two\n'), sha256('# one\n')]);
  });

  it('current is the version of the NEWEST sync that included the path', async () => {
    const h = harness();
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# one\n' }] });
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# two\n' }] });
    const spec = (await h.reads.tree(WS, PROJECT, EPIC)).files[0];
    expect(spec?.current?.digest).toBe(sha256('# two\n'));
    expect(spec?.current?.sync).toMatchObject({ executionId: 'exec-1', command: 'specify', outcome: 'completed' });
  });

  it('an unchanged file keeps ONE version, delivered by every execution that sent it', async () => {
    const h = harness([execution(), execution({ executionId: 'exec-2', command: 'plan' })]);
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# same\n' }] });
    await h.sync({ executionId: 'exec-2', epicId: EPIC, files: [{ path: SPEC, content: '# same\n' }] });
    const spec = (await h.reads.tree(WS, PROJECT, EPIC)).files[0];
    expect(spec?.versions).toHaveLength(1);
    expect(spec?.versions[0]?.deliveredBy.map((d) => d.executionId).sort()).toEqual(['exec-1', 'exec-2']);
    expect(spec?.versions[0]?.deliveredBy.map((d) => d.command).sort()).toEqual(['plan', 'specify']);
  });

  it('marks notInLatestSync when the newest sync omitted the path (FR-ART-014)', async () => {
    const h = harness();
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC }, { path: PLAN }] });
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC }] });
    const tree = await h.reads.tree(WS, PROJECT, EPIC);
    expect(tree.files.find((f) => f.path === PLAN)?.notInLatestSync).toBe(true);
    expect(tree.files.find((f) => f.path === SPEC)?.notInLatestSync).toBe(false);
    // Still listed, and still openable — the marker is information, not removal.
    expect(tree.files.find((f) => f.path === PLAN)?.current).not.toBeNull();
  });

  it('lists refusals separately, never among the versions (data-model §5)', async () => {
    const h = harness();
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC }, { path: 'specs/003-reports/notes.txt', refusalCode: 'path_not_in_artifact_set' }] });
    const tree = await h.reads.tree(WS, PROJECT, EPIC);
    expect(tree.files.map((f) => f.path)).toEqual([SPEC]);
    expect(tree.refusals).toEqual([{ path: 'specs/003-reports/notes.txt', code: 'path_not_in_artifact_set', detail: 'refused', executionId: 'exec-1', at: expect.any(String) }]);
  });

  it('shows another Epic\'s files to nobody', async () => {
    const h = harness();
    await h.sync({ executionId: 'exec-1', epicId: 'epic-7', files: [{ path: SPEC }] });
    expect((await h.reads.tree(WS, PROJECT, EPIC)).files).toEqual([]);
  });

  it('answers an Epic with no syncs as an empty tree, not an error', async () => {
    const h = harness();
    const tree = await h.reads.tree(WS, PROJECT, EPIC);
    expect(tree).toMatchObject({ epicId: EPIC, files: [], refusals: [] });
  });

  it('NEVER loads content — proved with a spy, not by inspecting the answer (SC-ART-006)', async () => {
    const h = harness();
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# secret enough to notice\n' }] });
    const summaries = vi.spyOn(h.store, 'versionSummariesByIds');
    const withContent = vi.spyOn(h.store, 'versionsByIds');
    const tree = await h.reads.tree(WS, PROJECT, EPIC);
    expect(summaries).toHaveBeenCalled();
    expect(withContent, 'the tree read loaded content').not.toHaveBeenCalled();
    expect(JSON.stringify(tree)).not.toContain('secret enough to notice');
  });
});

describe('T1642 · the content read (data-model §5)', () => {
  it('returns the version with its content and every execution that delivered it', async () => {
    const h = harness([execution(), execution({ executionId: 'exec-2', command: 'plan' })]);
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# body\n' }] });
    await h.sync({ executionId: 'exec-2', epicId: EPIC, files: [{ path: SPEC, content: '# body\n' }] });
    const versionId = (await h.reads.tree(WS, PROJECT, EPIC)).files[0]?.current?.versionId as string;
    const content = await h.reads.content(WS, PROJECT, versionId);
    expect(content?.content).toBe('# body\n');
    expect(content?.digest).toBe(sha256('# body\n'));
    expect(content?.deliveredBy.map((d) => d.executionId).sort()).toEqual(['exec-1', 'exec-2']);
  });

  it('returns null for a version of another workspace or project', async () => {
    const h = harness();
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC }] });
    const versionId = (await h.reads.tree(WS, PROJECT, EPIC)).files[0]?.current?.versionId as string;
    expect(await h.reads.content('ws-2', PROJECT, versionId)).toBeNull();
    expect(await h.reads.content(WS, 'proj-2', versionId)).toBeNull();
    expect(await h.reads.locate('ws-2', versionId)).toBeNull();
    expect(await h.reads.locate(WS, versionId)).toEqual({ projectId: PROJECT });
  });

  it('returns null for a version that does not exist', async () => {
    expect(await harness().reads.content(WS, PROJECT, 'nope')).toBeNull();
  });
});

describe('T1642 · the unbound read (FR-ART-007)', () => {
  it('lists the syncs bound to no Epic, with what each stored', async () => {
    const h = harness([execution({ targetId: '99' })]);
    await h.sync({ executionId: 'exec-1', epicId: null, files: [{ path: SPEC }, { path: 'specs/099/notes.txt', refusalCode: 'path_not_in_artifact_set' }] });
    const unbound = await h.reads.unbound(WS, PROJECT);
    expect(unbound.syncs).toHaveLength(1);
    expect(unbound.syncs[0]).toMatchObject({ executionId: 'exec-1', command: 'specify', outcome: 'completed', created: 1, refused: 1 });
    expect(unbound.syncs[0]?.files.map((f) => f.outcome).sort()).toEqual(['created', 'refused']);
  });

  it('excludes bound syncs, and an Epic\'s tree excludes unbound ones', async () => {
    const h = harness();
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC }] });
    await h.sync({ executionId: 'exec-1', epicId: null, files: [{ path: PLAN }] });
    expect((await h.reads.unbound(WS, PROJECT)).syncs.map((s) => s.files[0]?.path)).toEqual([PLAN]);
    expect((await h.reads.tree(WS, PROJECT, EPIC)).files.map((f) => f.path)).toEqual([SPEC]);
  });
});

describe('T1642 · reported versus synced, never repaired (FR-ART-009)', () => {
  it('reports a digest the completion named that no sync stored', async () => {
    const h = harness([execution({ outputArtifactDigests: [sha256('# stored\n'), 'f'.repeat(64)] })]);
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# stored\n' }] });
    const findings = (await h.reads.tree(WS, PROJECT, EPIC)).findings;
    expect(findings.reportedNotSynced).toEqual([{ executionId: 'exec-1', digest: 'f'.repeat(64) }]);
    expect(findings.syncedNotReported).toEqual([]);
  });

  it('reports a digest a sync stored that the completion did not name', async () => {
    const h = harness([execution({ outputArtifactDigests: [sha256('# stored\n')] })]);
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# stored\n' }, { path: PLAN, content: '# extra\n' }] });
    const findings = (await h.reads.tree(WS, PROJECT, EPIC)).findings;
    expect(findings.syncedNotReported).toEqual([{ executionId: 'exec-1', digest: sha256('# extra\n') }]);
    expect(findings.reportedNotSynced).toEqual([]);
  });

  it('finds nothing when the two agree', async () => {
    const h = harness([execution({ outputArtifactDigests: [sha256('# agreed\n')] })]);
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# agreed\n' }] });
    expect((await h.reads.tree(WS, PROJECT, EPIC)).findings).toEqual({ reportedNotSynced: [], syncedNotReported: [] });
  });

  it('finds nothing for an execution with NO output binding — a failed run legitimately has none', async () => {
    // AC-EXR-17d: output identity is bound only to a completed execution.
    // Treating "no binding" as "reported nothing" would make every
    // partially-completed run a finding, which is noise, not evidence.
    const h = harness([execution({ state: 'partially-completed', outputArtifactDigests: [] })]);
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# x\n' }] });
    expect((await h.reads.tree(WS, PROJECT, EPIC)).findings).toEqual({ reportedNotSynced: [], syncedNotReported: [] });
  });

  it('never repairs — the disagreement stays in both records', async () => {
    const h = harness([execution({ outputArtifactDigests: ['f'.repeat(64)] })]);
    await h.sync({ executionId: 'exec-1', epicId: EPIC, files: [{ path: SPEC, content: '# stored\n' }] });
    await h.reads.tree(WS, PROJECT, EPIC);
    const again = await h.reads.tree(WS, PROJECT, EPIC);
    expect(again.findings.reportedNotSynced).toHaveLength(1);
    expect(again.files).toHaveLength(1);
  });
});
