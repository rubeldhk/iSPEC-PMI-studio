/**
 * `T1637` (EPIC-045) — contract test for the artifact routes against
 * `specs/045-artifact-sync-markdown-viewer/contracts/artifacts-api.md` §1–§3.
 *
 * The route surface comes from the controllers' routing metadata (the `/v1`
 * prefix is global); the answer shapes and every per-file refusal code are
 * driven directly against in-memory stores, which is what lets one bad file per
 * code be asserted without a database or a container.
 *
 * The composed-application run of the same routes — through the real finish
 * sequence, concurrently — is `tests/integration/artifact-sync.spec.ts`.
 * Written to FAIL before `T1638`.
 */
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { NotFoundError, toErrorBody, toHttpStatus } from '../../src/core/errors.js';
import { InMemoryArtifactStore } from '../../src/modules/artifacts/artifact.store.js';
import { ArtifactReadService } from '../../src/modules/artifacts/artifact-read.service.js';
import { ArtifactSyncService, type ExecutionLookupRow, type ExecutionReader } from '../../src/modules/artifacts/artifact-sync.service.js';
import { ArtifactsController } from '../../src/modules/artifacts/artifacts.controller.js';
import { ArtifactsSyncController } from '../../src/modules/artifacts/artifacts-sync.controller.js';
import { InMemorySpecificationSyncPort } from '../../src/modules/artifacts/specification-sync.port.js';
import { CONNECTOR_SCOPE_KEY } from '../../src/modules/connector/connector-scope.js';
import type { ConnectorRequest } from '../../src/modules/connector/connector-auth.guard.js';

const PATH = 'path';
const METHOD = 'method';
const GUARDS = '__guards__';

function route(ctor: { prototype: object }, handler: string): { path: string; method: RequestMethod } {
  const fn = (ctor.prototype as Record<string, object>)[handler] as object;
  return { path: Reflect.getMetadata(PATH, fn) as string, method: Reflect.getMetadata(METHOD, fn) as RequestMethod };
}

const WS = 'ws_a';
const PROJECT = 'p_a';
const EPIC = 'epic_3';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function file(path: string, content: string): { path: string; digest: string; content: string } {
  return { path, digest: sha256(content), content };
}

const EXECUTION: ExecutionLookupRow = {
  executionId: 'exec_1',
  workspaceId: WS,
  projectId: PROJECT,
  command: 'specify',
  initiatorId: 'u_dev',
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
};

function harness(executions: ExecutionLookupRow[] = [EXECUTION]) {
  const store = new InMemoryArtifactStore();
  const reader: ExecutionReader = {
    async find(workspaceId, executionId) {
      return executions.find((e) => e.workspaceId === workspaceId && e.executionId === executionId) ?? null;
    },
    async forProject(workspaceId, projectId) {
      return executions.filter((e) => e.workspaceId === workspaceId && e.projectId === projectId);
    },
  };
  const sync = new ArtifactSyncService({
    store,
    executions: reader,
    epics: { list: async () => [{ id: EPIC, number: 3, parentNumber: null, splitSuffix: null, slug: 'reports' }] },
    specifications: new InMemorySpecificationSyncPort(),
    comments: { add: async () => ({ commentId: 'c1' }) },
    audit: { record: async () => {} },
    limits: () => ({ maxBytes: 64, maxFiles: 3 }),
  });
  const reads = new ArtifactReadService({ store, executions: reader });
  // The Epic gate, by shape: `locate` and `requireMember` are what the session
  // routes consult, and refusing them is what makes another workspace absent.
  const epics = {
    locate: async (workspaceId: string, eid: string) => {
      if (workspaceId !== WS || eid !== EPIC) throw new NotFoundError('Not found.');
      return { id: EPIC, projectId: PROJECT };
    },
    deps: { gate: { requireMember: async () => undefined } },
  };
  return {
    store,
    sync,
    reads,
    syncController: new ArtifactsSyncController(sync),
    readController: new ArtifactsController(reads, epics as never),
  };
}

function connectorRequest(overrides: Partial<{ workspaceId: string; projectId: string; credentialId: string }> = {}): ConnectorRequest {
  return {
    headers: {},
    connector: {
      credentialId: overrides.credentialId ?? 'cred_1',
      workspaceId: overrides.workspaceId ?? WS,
      projectId: overrides.projectId ?? PROJECT,
      principal: {} as never,
    },
  };
}

const session = (ctx: { workspaceId: string; userId: string }) => ctx as never;
const MEMBER = { workspaceId: WS, userId: 'u_member' };

describe('T1637 · route surface (artifacts-api.md §1–§2)', () => {
  it('the connector write is one POST under projects/', () => {
    expect(Reflect.getMetadata(PATH, ArtifactsSyncController)).toBe('projects');
    expect(route(ArtifactsSyncController, 'post')).toEqual({ path: ':projectId/artifacts/sync', method: RequestMethod.POST });
  });

  it('the write declares the scope artifacts.sync and answers 201', () => {
    expect(Reflect.getMetadata(CONNECTOR_SCOPE_KEY, ArtifactsSyncController.prototype.post)).toBe('artifacts.sync');
    expect(Reflect.getMetadata('__httpCode__', ArtifactsSyncController.prototype.post)).toBe(201);
  });

  it('the write is behind ConnectorAuthGuard — an unguarded connector route is the defect DEF-037-001 named', () => {
    const guards = (Reflect.getMetadata(GUARDS, ArtifactsSyncController) ?? []) as { name?: string }[];
    expect(guards.map((g) => g?.name ?? String(g))).toContain('ConnectorAuthGuard');
  });

  it.each([
    ['tree', 'epics/:eid/artifacts', RequestMethod.GET],
    ['content', 'artifacts/:vid', RequestMethod.GET],
    ['unbound', 'projects/:id/artifacts/unbound', RequestMethod.GET],
  ])('the session read %s → %s', (handler, path, method) => {
    expect(route(ArtifactsController, handler)).toEqual({ path, method });
  });

  it('NO session read is behind the connector guard, so a connector credential carries no session (FR-ART-043)', () => {
    expect(Reflect.getMetadata(GUARDS, ArtifactsController)).toBeUndefined();
    for (const handler of ['tree', 'content', 'unbound']) {
      expect(Reflect.getMetadata(GUARDS, (ArtifactsController.prototype as unknown as Record<string, object>)[handler] as object), handler).toBeUndefined();
    }
  });

  it('exposes no write beyond the sync — nothing edits, uploads, renames or deletes (FR-ART-010)', () => {
    for (const ctor of [ArtifactsController, ArtifactsSyncController]) {
      const handlers = Object.getOwnPropertyNames(ctor.prototype).filter((n) => n !== 'constructor');
      for (const handler of handlers) {
        const method = Reflect.getMetadata(METHOD, (ctor.prototype as unknown as Record<string, object>)[handler] as object) as RequestMethod;
        expect([RequestMethod.GET, RequestMethod.POST], `${ctor.name}.${handler}`).toContain(method);
      }
    }
    expect(Object.getOwnPropertyNames(ArtifactsController.prototype).sort()).toEqual(['constructor', 'content', 'tree', 'unbound']);
    expect(Object.getOwnPropertyNames(ArtifactsSyncController.prototype).sort()).toEqual(['constructor', 'post']);
  });
});

describe('T1637 · the sync answer shape (artifacts-api.md §1)', () => {
  it('answers { syncId, epicId, created, reused, refused }', async () => {
    const h = harness();
    const answer = await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files: [file('specs/003-reports/spec.md', '# R\n')] });
    expect(Object.keys(answer).sort()).toEqual(['created', 'epicId', 'refused', 'reused', 'syncId']);
    expect(answer).toMatchObject({ epicId: EPIC, created: 1, reused: 0, refused: [] });
  });

  it('tolerates epicNumber and ignores it (R-045-2)', async () => {
    const h = harness();
    const answer = await h.syncController.post(connectorRequest(), { executionId: 'exec_1', epicNumber: 99, files: [file('specs/003-reports/spec.md', '# R\n')] });
    expect(answer.epicId).toBe(EPIC);
  });

  it('refuses a body with no executionId as validation_failed, not a 500', async () => {
    const h = harness();
    const err = await h.syncController.post(connectorRequest(), { files: [] }).catch((e: unknown) => e);
    expect(toHttpStatus(err as Error)).toBe(400);
    expect(toErrorBody(err as Error)).toMatchObject({ error: { code: 'validation_failed' } });
  });

  it('refuses a malformed files array as validation_failed', async () => {
    const h = harness();
    for (const files of ['not-an-array', [{ path: 1 }], [{ path: 'p', digest: 'd' }]]) {
      const err = await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files }).catch((e: unknown) => e);
      expect(toHttpStatus(err as Error), JSON.stringify(files)).toBe(400);
    }
  });

  it('accepts an empty file — an empty spec.md is a fact, not a bad request', async () => {
    const h = harness();
    const answer = await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files: [file('specs/003-reports/spec.md', '')] });
    expect(answer.created).toBe(1);
  });
});

describe('T1637 · every per-file code, one bad file each (artifacts-api.md §1)', () => {
  const secret = `pmi_ct_${'a'.repeat(32)}`;
  it.each([
    ['digest_mismatch', [{ path: 'specs/003-reports/spec.md', digest: 'f'.repeat(64), content: '# R\n' }]],
    ['path_not_in_artifact_set', [file('specs/003-reports/notes.txt', 'x')]],
    ['path_escapes_epic', [file('specs/003-reports/../../etc/passwd', 'x')]],
    ['not_utf8', [file('specs/003-reports/spec.md', '# R \n')]],
    ['too_large', [file('specs/003-reports/spec.md', 'x'.repeat(65))]],
    ['credential_shape', [file('specs/003-reports/spec.md', secret)]],
    ['too_many_files', [file('specs/003-reports/spec.md', 'a'), file('specs/003-reports/plan.md', 'b'), file('specs/003-reports/tasks.md', 'c'), file('specs/003-reports/research.md', 'd')]],
  ])('%s', async (code, files) => {
    const h = harness();
    const answer = await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files });
    expect(answer.refused.map((r) => r.code)).toContain(code);
  });

  it('a refusal names the path and the code, and nothing else — no content, no matched credential', async () => {
    const h = harness();
    const answer = await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files: [file('specs/003-reports/spec.md', secret)] });
    expect(answer.refused).toEqual([{ path: 'specs/003-reports/spec.md', code: 'credential_shape' }]);
    expect(JSON.stringify(answer)).not.toContain(secret);
  });
});

describe('T1637 · the derived key and the replay (R-045-8)', () => {
  it('answers the same syncId for an unkeyed repeat of the same files', async () => {
    const h = harness();
    const files = [file('specs/003-reports/spec.md', '# R\n')];
    const first = await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files });
    const second = await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files });
    expect(second.syncId).toBe(first.syncId);
    expect(second).toEqual(first);
  });
});

describe('T1637 · the read shapes (artifacts-api.md §2)', () => {
  async function seeded() {
    const h = harness();
    await h.syncController.post(connectorRequest(), {
      executionId: 'exec_1',
      files: [file('specs/003-reports/spec.md', '# R\n'), file('specs/003-reports/notes.txt', 'x')],
    });
    return h;
  }

  it('the tree answers { epicId, files, refusals, findings } and carries NO content (SC-ART-006)', async () => {
    const h = await seeded();
    const tree = await h.readController.tree(session(MEMBER), EPIC);
    expect(Object.keys(tree).sort()).toEqual(['epicId', 'files', 'findings', 'refusals']);
    expect(tree.epicId).toBe(EPIC);
    expect(tree.files[0]).toMatchObject({ path: 'specs/003-reports/spec.md', kind: 'spec', notInLatestSync: false });
    expect(JSON.stringify(tree), 'the tree carried file content').not.toContain('# R\\n');
    expect(tree.refusals[0]).toMatchObject({ path: 'specs/003-reports/notes.txt', code: 'path_not_in_artifact_set', executionId: 'exec_1' });
    expect(Object.keys(tree.findings).sort()).toEqual(['reportedNotSynced', 'syncedNotReported']);
  });

  it('the content read answers the version with its content and deliveredBy', async () => {
    const h = await seeded();
    const tree = await h.readController.tree(session(MEMBER), EPIC);
    const versionId = tree.files[0]?.current?.versionId as string;
    const content = await h.readController.content(session(MEMBER), versionId);
    expect(Object.keys(content).sort()).toEqual(['content', 'deliveredBy', 'digest', 'firstSyncedAt', 'kind', 'path', 'sizeBytes', 'versionId']);
    expect(content.content).toBe('# R\n');
    expect(content.digest).toBe(sha256('# R\n'));
    expect(content.deliveredBy[0]).toMatchObject({ executionId: 'exec_1', command: 'specify', outcome: 'completed' });
  });

  it('the unbound read answers { projectId, syncs } (FR-ART-007)', async () => {
    const h = harness([{ ...EXECUTION, targetId: '99' }]);
    await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files: [file('specs/099-ghost/spec.md', '# G\n')] });
    const unbound = await h.readController.unbound(session(MEMBER), PROJECT);
    expect(Object.keys(unbound).sort()).toEqual(['projectId', 'syncs']);
    expect(unbound.syncs[0]).toMatchObject({ executionId: 'exec_1', command: 'specify', created: 1 });
    expect(unbound.syncs[0]?.files[0]).toMatchObject({ path: 'specs/099-ghost/spec.md', outcome: 'created' });
  });
});

describe('T1637 · another workspace is absent on every read (FR-ART-050)', () => {
  it('an Epic of another workspace is 404, not 403', async () => {
    const h = await harness();
    const err = await h.readController.tree(session({ workspaceId: 'ws_b', userId: 'u' }), EPIC).catch((e: unknown) => e);
    expect(toHttpStatus(err as Error)).toBe(404);
  });

  it('a version of another workspace is 404', async () => {
    const h = harness();
    await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files: [file('specs/003-reports/spec.md', '# R\n')] });
    const tree = await h.readController.tree(session(MEMBER), EPIC);
    const versionId = tree.files[0]?.current?.versionId as string;
    const err = await h.readController.content(session({ workspaceId: 'ws_b', userId: 'u' }), versionId).catch((e: unknown) => e);
    expect(toHttpStatus(err as Error)).toBe(404);
    expect(toErrorBody(err as Error)).toMatchObject({ error: { code: 'not_found' } });
  });

  it('a version that does not exist is 404', async () => {
    const h = harness();
    const err = await h.readController.content(session(MEMBER), 'no-such-version').catch((e: unknown) => e);
    expect(toHttpStatus(err as Error)).toBe(404);
  });

  it('a sync naming another project\'s execution is 404 with details.code execution_unknown', async () => {
    const h = harness([{ ...EXECUTION, projectId: 'p_b' }]);
    const err = await h.syncController.post(connectorRequest(), { executionId: 'exec_1', files: [] }).catch((e: unknown) => e);
    expect(toHttpStatus(err as Error)).toBe(404);
    expect(toErrorBody(err as Error)).toMatchObject({ error: { code: 'not_found', details: { code: 'execution_unknown' } } });
  });

  it('every refusal travels through toErrorBody with a class code (artifacts-api.md §3)', async () => {
    const h = harness();
    const err = await h.syncController.post(connectorRequest(), { executionId: 'nope', files: [] }).catch((e: unknown) => e);
    const body = toErrorBody(err as Error);
    expect(body.error.code).toBe('not_found');
    expect(typeof body.error.message).toBe('string');
  });
});
