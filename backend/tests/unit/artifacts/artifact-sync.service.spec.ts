/**
 * `T1632` (EPIC-045, data-model.md §6, `FR-ART-001` to `FR-ART-009`,
 * `FR-ART-052`, `FR-ART-053`) — the sync, step by step, over in-memory stores.
 *
 * Every step of data-model.md §6 has an assertion here: the execution lookup,
 * the Epic resolved from the execution's binding (never from the path), the
 * derived idempotency key and its replay, per-file refusal beside per-file
 * acceptance, the single `system` comment refusals produce, and the audit row.
 *
 * The concurrency proof lives one layer down (`artifact.store.spec.ts`) and one
 * layer up (`artifact-sync.spec.ts`, through the real HTTP route); what is
 * asserted here is that the service **lets the store arbitrate** rather than
 * reading-then-writing on its own. Written to FAIL before `T1634`.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryArtifactStore } from '../../../src/modules/artifacts/artifact.store.js';
import { ArtifactSyncService, type ExecutionLookupRow, type ExecutionReader } from '../../../src/modules/artifacts/artifact-sync.service.js';
import { InMemorySpecificationSyncPort } from '../../../src/modules/artifacts/specification-sync.port.js';

const WS = 'ws-1';
const PROJECT = 'proj-1';
const CREDENTIAL = 'cred-1';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function file(path: string, content: string): { path: string; digest: string; content: string } {
  return { path, digest: sha256(content), content };
}

const EPICS = [
  { id: 'epic-3', number: 3, parentNumber: null, splitSuffix: null, slug: 'reports' },
  { id: 'epic-7', number: 7, parentNumber: null, splitSuffix: null, slug: 'intake' },
  { id: 'epic-7a', number: 8, parentNumber: 7, splitSuffix: 'a', slug: 'intake-a' },
];

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
    agentAdapter: 'claude-code',
    agentVersion: '2.1.0',
    agentModel: 'claude-opus-5',
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

interface Harness {
  readonly service: ArtifactSyncService;
  readonly store: InMemoryArtifactStore;
  readonly specifications: InMemorySpecificationSyncPort;
  readonly comments: { calls: Record<string, unknown>[] };
  readonly audit: { calls: Record<string, unknown>[] };
}

function harness(rows: ExecutionLookupRow[] = [execution()]): Harness {
  const store = new InMemoryArtifactStore();
  const specifications = new InMemorySpecificationSyncPort();
  const comments = { calls: [] as Record<string, unknown>[] };
  const audit = { calls: [] as Record<string, unknown>[] };
  const service = new ArtifactSyncService({
    store,
    executions: reader(rows),
    epics: { list: async () => EPICS },
    specifications,
    comments: {
      add: async (input) => {
        comments.calls.push(input as unknown as Record<string, unknown>);
        return { commentId: `comment-${comments.calls.length}` };
      },
    },
    audit: {
      record: async (row) => {
        audit.calls.push(row as unknown as Record<string, unknown>);
      },
    },
    limits: () => ({ maxBytes: 1024 * 1024, maxFiles: 200 }),
  });
  return { service, store, specifications, comments, audit };
}

const ctx = { workspaceId: WS, projectId: PROJECT, credentialId: CREDENTIAL };

describe('T1632 · step 2 — the execution must be this project\'s (data-model §6)', () => {
  it('refuses an unknown execution with execution_unknown', async () => {
    const { service } = harness();
    await expect(service.sync(ctx, { executionId: 'nope', files: [] })).rejects.toMatchObject({ code: 'not_found', details: { code: 'execution_unknown' } });
  });

  it('refuses an execution of another project — absence, not a different message (FR-ART-050)', async () => {
    const { service } = harness([execution({ projectId: 'proj-2' })]);
    await expect(service.sync(ctx, { executionId: 'exec-1', files: [] })).rejects.toMatchObject({ code: 'not_found', details: { code: 'execution_unknown' } });
  });

  it('refuses an execution of another workspace', async () => {
    const { service } = harness([execution({ workspaceId: 'ws-2' })]);
    await expect(service.sync(ctx, { executionId: 'exec-1', files: [] })).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('T1632 · step 4 — the Epic comes from the execution\'s binding, never from the path (R-045-2, FR-ART-003)', () => {
  it('resolves a numeric target through the Epic\'s number', async () => {
    const { service } = harness();
    const answer = await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports\n')] });
    expect(answer.epicId).toBe('epic-3');
  });

  it('resolves a `7a` child through its parent\'s number and its split suffix', async () => {
    const { service } = harness([execution({ targetId: '7a' })]);
    const answer = await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/007a-intake/spec.md', '# Intake\n')] });
    expect(answer.epicId).toBe('epic-7a');
  });

  it('leaves epicId null when the target names no Epic of the project (FR-ART-007)', async () => {
    const { service, store } = harness([execution({ targetId: '99' })]);
    const answer = await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/099-ghost/spec.md', '# Ghost\n')] });
    expect(answer.epicId).toBeNull();
    // The sync is still stored — an unbound sync is listed, not dropped.
    expect(await store.unboundSyncs(WS, PROJECT)).toHaveLength(1);
  });

  it('leaves epicId null for a project-targeted execution', async () => {
    const { service } = harness([execution({ targetType: 'project', targetId: PROJECT })]);
    const answer = await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports\n')] });
    expect(answer.epicId).toBeNull();
  });

  it('IGNORES the path when resolving the Epic — a file under 007 synced by an execution bound to 3 belongs to 3', async () => {
    // The rule the spec is most emphatic about: a directory name is not
    // authority. Trusting the path would let a mis-typed directory silently
    // re-parent a whole Epic's files.
    const { service } = harness();
    const answer = await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/007-intake/spec.md', '# Intake\n')] });
    expect(answer.epicId).toBe('epic-3');
  });
});

describe('T1632 · step 5 — versions are created once and reused thereafter (FR-ART-001, FR-ART-031)', () => {
  it('creates a version for each good file on the first sync', async () => {
    const { service } = harness();
    const answer = await service.sync(ctx, {
      executionId: 'exec-1',
      files: [file('specs/003-reports/spec.md', '# Reports\n'), file('specs/003-reports/plan.md', '# Plan\n')],
    });
    expect(answer.created).toBe(2);
    expect(answer.reused).toBe(0);
    expect(answer.refused).toEqual([]);
  });

  it('reuses the version when the same content is synced again, and writes no second version', async () => {
    const { service, store } = harness();
    const files = [file('specs/003-reports/spec.md', '# Reports\n')];
    await service.sync(ctx, { executionId: 'exec-1', files });
    const again = await service.sync(ctx, { executionId: 'exec-1', files, idempotencyKey: 'second' });
    expect(again.reused).toBe(1);
    expect(again.created).toBe(0);
    const manifests = await store.manifestsFor((await store.syncsForEpic(WS, 'epic-3')).map((s) => s.id));
    expect(new Set(manifests.map((m) => m.versionId)).size, 'two syncs, one version').toBe(1);
  });

  it('makes a second version when the content changes', async () => {
    const { service, store } = harness();
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports\n')] });
    const changed = await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports v2\n')] });
    expect(changed.created).toBe(1);
    const manifests = await store.manifestsFor((await store.syncsForEpic(WS, 'epic-3')).map((s) => s.id));
    expect(new Set(manifests.map((m) => m.versionId)).size).toBe(2);
  });

  it('records the manifest with the outcome of every file, accepted and refused alike', async () => {
    const { service, store } = harness();
    const answer = await service.sync(ctx, {
      executionId: 'exec-1',
      files: [file('specs/003-reports/plan.md', '# Plan\n'), file('specs/003-reports/notes.txt', 'notes')],
    });
    const manifest = await store.manifestFor(answer.syncId);
    expect(manifest).toHaveLength(2);
    expect(manifest.find((m) => m.path.endsWith('plan.md'))).toMatchObject({ outcome: 'created', refusalCode: null });
    expect(manifest.find((m) => m.path.endsWith('notes.txt'))).toMatchObject({ outcome: 'refused', versionId: null, refusalCode: 'path_not_in_artifact_set' });
  });

  it('lets the STORE arbitrate rather than reading first — createVersion is what decides created vs reused', async () => {
    // The read-then-write shape is the race. Asserting the call, not the
    // outcome, is what keeps a future refactor from reintroducing it.
    const { service, store } = harness();
    const spy = vi.spyOn(store, 'createVersion');
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports\n')] });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('T1632 · one bad file among good ones (FR-ART-004)', () => {
  it('stores the good files and refuses only the bad one', async () => {
    const { service, store } = harness();
    const answer = await service.sync(ctx, {
      executionId: 'exec-1',
      files: [file('specs/003-reports/plan.md', '# Plan\n'), file('specs/003-reports/notes.txt', 'notes'), file('specs/003-reports/tasks.md', '# Tasks\n')],
    });
    expect(answer.created).toBe(2);
    expect(answer.refused).toEqual([{ path: 'specs/003-reports/notes.txt', code: 'path_not_in_artifact_set' }]);
    const manifest = await store.manifestFor(answer.syncId);
    expect(manifest.filter((m) => m.outcome === 'created')).toHaveLength(2);
  });

  it('stores NOTHING for a file carrying a credential shape, and the answer names the code (FR-ART-053)', async () => {
    const { service, store } = harness();
    const secret = `pmi_ct_${'a'.repeat(32)}`;
    const answer = await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', `# Reports\n${secret}\n`)] });
    expect(answer.created).toBe(0);
    expect(answer.refused).toEqual([{ path: 'specs/003-reports/spec.md', code: 'credential_shape' }]);
    const manifest = await store.manifestFor(answer.syncId);
    expect(manifest[0]?.versionId).toBeNull();
    expect(manifest[0]?.refusalDetail, 'the manifest kept the credential').not.toContain(secret);
  });

  it('refuses a digest that does not match the content', async () => {
    const { service } = harness();
    const answer = await service.sync(ctx, { executionId: 'exec-1', files: [{ path: 'specs/003-reports/spec.md', digest: 'f'.repeat(64), content: '# Reports\n' }] });
    expect(answer.refused).toEqual([{ path: 'specs/003-reports/spec.md', code: 'digest_mismatch' }]);
  });

  it('records a sync even when every file was refused (data-model §8)', async () => {
    const { service, store } = harness();
    const answer = await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/notes.txt', 'x')] });
    expect(await store.findSync(answer.syncId)).not.toBeNull();
    expect((await store.findSync(answer.syncId))?.refusedCount).toBe(1);
  });
});

describe('T1632 · step 3 — the idempotency key, derived and replayed (R-045-8)', () => {
  const files = [file('specs/003-reports/spec.md', '# Reports\n'), file('specs/003-reports/plan.md', '# Plan\n')];

  it('derives `artifacts:<executionId>:<sha256 of sorted path=digest>` when none is sent', async () => {
    const { service, store } = harness();
    const answer = await service.sync(ctx, { executionId: 'exec-1', files });
    const expected = `artifacts:exec-1:${sha256([...files].map((f) => `${f.path}=${f.digest}`).sort().join('\n'))}`;
    expect((await store.findSync(answer.syncId))?.idempotencyKey).toBe(expected);
  });

  it('derives the SAME key however the files are ordered — the sort is what makes a replay recognisable', async () => {
    const { service, store } = harness();
    const a = await service.sync(ctx, { executionId: 'exec-1', files });
    const b = await service.sync(ctx, { executionId: 'exec-1', files: [...files].reverse() });
    expect(b.syncId).toBe(a.syncId);
    expect((await store.syncsForEpic(WS, 'epic-3')).length, 'the replay wrote a second sync').toBe(1);
  });

  it('returns the STORED answer on a replay of the SAME request and writes nothing', async () => {
    // A replay is the same request again (review finding 4): the same key with a
    // different payload is a conflict, covered in `review-fixes.spec.ts`.
    const { service, store } = harness();
    const first = await service.sync(ctx, { executionId: 'exec-1', files, idempotencyKey: 'k-1' });
    const replay = await service.sync(ctx, { executionId: 'exec-1', files: [...files].reverse(), idempotencyKey: 'k-1' });
    expect(replay.syncId).toBe(first.syncId);
    expect(replay.created).toBe(first.created);
    expect((await store.syncsForEpic(WS, 'epic-3')).length, 'the replay wrote a second sync').toBe(1);
    expect((await store.manifestFor(first.syncId)).map((m) => m.path).sort()).toEqual(files.map((f) => f.path).sort());
  });

  it('honours a key the hook sent instead of deriving one', async () => {
    const { service, store } = harness();
    const answer = await service.sync(ctx, { executionId: 'exec-1', files, idempotencyKey: 'from-the-hook' });
    expect((await store.findSync(answer.syncId))?.idempotencyKey).toBe('from-the-hook');
  });
});

describe('T1632 · step 8 — refusals produce ONE system comment on the execution (R-045-3, FR-ART-044)', () => {
  it('writes exactly one comment naming every refused path and code', async () => {
    const { service, comments } = harness();
    await service.sync(ctx, {
      executionId: 'exec-1',
      files: [file('specs/003-reports/notes.txt', 'x'), file('specs/003-reports/other.txt', 'y'), file('specs/003-reports/spec.md', '# Reports\n')],
    });
    expect(comments.calls).toHaveLength(1);
    const body = String(comments.calls[0]?.['body']);
    expect(body).toContain('specs/003-reports/notes.txt');
    expect(body).toContain('specs/003-reports/other.txt');
    expect(body).toContain('path_not_in_artifact_set');
  });

  it('uses the existing `system` type and a `service` author — no new comment type (R-045-3)', async () => {
    const { service, comments } = harness();
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/notes.txt', 'x')] });
    expect(comments.calls[0]).toMatchObject({ commentType: 'system', authorType: 'service', authorId: 'platform:artifacts' });
  });

  it('never puts content or a matched credential in the comment (FR-ART-053)', async () => {
    const { service, comments } = harness();
    const secret = `pmi_ct_${'a'.repeat(32)}`;
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', `# Reports\n${secret}\n`)] });
    const body = String(comments.calls[0]?.['body']);
    expect(body, 'the comment carried the credential').not.toContain(secret);
    expect(body).toContain('credential_shape');
  });

  it('writes NO comment when nothing was refused — a clean sync is not news on the timeline', async () => {
    const { service, comments } = harness();
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports\n')] });
    expect(comments.calls).toEqual([]);
  });

  it('completes the sync even when the comment fails — a timeline write is not worth losing the content over', async () => {
    const { store, specifications } = harness();
    const service = new ArtifactSyncService({
      store,
      executions: reader([execution()]),
      epics: { list: async () => EPICS },
      specifications,
      comments: { add: async () => { throw new Error('timeline unavailable'); } },
      audit: { record: async () => {} },
    });
    const answer = await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/notes.txt', 'x'), file('specs/003-reports/spec.md', '# Reports\n')] });
    expect(answer.created).toBe(1);
    expect(answer.refused).toHaveLength(1);
  });
});

describe('T1632 · step 8 — every sync is audited (FR-ART-052)', () => {
  it('records artifacts.sync with the counts and the digests', async () => {
    const { service, audit } = harness();
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports\n'), file('specs/003-reports/notes.txt', 'x')] });
    const row = audit.calls.find((c) => (c['detail'] as { kind?: string })?.kind === 'artifacts.sync');
    expect(row, JSON.stringify(audit.calls)).toBeDefined();
    const detail = row?.['detail'] as Record<string, unknown>;
    expect(detail).toMatchObject({ executionId: 'exec-1', epicId: 'epic-3', credentialId: CREDENTIAL, created: 1, refused: ['path_not_in_artifact_set'] });
    expect(detail['digests']).toEqual([sha256('# Reports\n')]);
  });

  it('audits a sync whose files were all refused', async () => {
    const { service, audit } = harness();
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/notes.txt', 'x')] });
    expect(audit.calls.some((c) => (c['detail'] as { kind?: string })?.kind === 'artifacts.sync')).toBe(true);
  });
});

describe('T1632 · step 7 — the Epic\'s spec.md becomes its specification (FR-ART-030)', () => {
  it('creates the specification for an Epic-bound spec.md', async () => {
    const { service, specifications } = harness();
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports\n')] });
    const created = await specifications.findByEpicSource(WS, 'epic-3', 'specs/003-reports/spec.md');
    expect(created).not.toBeNull();
    expect(created?.sourcePath).toBe('specs/003-reports/spec.md');
  });

  it('does not create one for an unbound sync — there is no Epic to own it', async () => {
    const { service, specifications } = harness([execution({ targetId: '99' })]);
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/099-ghost/spec.md', '# Ghost\n')] });
    expect(specifications.all()).toHaveLength(0);
  });

  it('does not create one for plan.md or tasks.md — only spec.md is the specification', async () => {
    const { service, specifications } = harness();
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/plan.md', '# Plan\n'), file('specs/003-reports/tasks.md', '# Tasks\n')] });
    expect(specifications.all()).toHaveLength(0);
  });

  it('appends a version when the content changes and none when it does not (FR-ART-031)', async () => {
    const { service, specifications } = harness();
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports\n')] });
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports\n')], idempotencyKey: 'k2' });
    expect(specifications.versionsOf(specifications.all()[0]!.id)).toHaveLength(1);
    await service.sync(ctx, { executionId: 'exec-1', files: [file('specs/003-reports/spec.md', '# Reports v2\n')] });
    expect(specifications.versionsOf(specifications.all()[0]!.id)).toHaveLength(2);
  });

  it('does not create one for a REFUSED spec.md — nothing was stored to be a specification of', async () => {
    const { service, specifications } = harness();
    await service.sync(ctx, { executionId: 'exec-1', files: [{ path: 'specs/003-reports/spec.md', digest: 'f'.repeat(64), content: '# Reports\n' }] });
    expect(specifications.all()).toHaveLength(0);
  });
});
