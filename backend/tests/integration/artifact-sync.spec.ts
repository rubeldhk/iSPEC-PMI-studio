/**
 * `T1633` (EPIC-045, `FR-ART-006`, `SC-ART-002`, `FR-ART-044`, `FR-ART-050`) —
 * the sync through the **real finish sequence** and a **real `pmi-studio`
 * server** against the composed `AppModule`.
 *
 * ## Written before the service it drives
 *
 * The `DEF-044-003` lesson. That defect was a unique-index race that every unit
 * test passed over, because the in-memory store tolerated what the database
 * refused. So the concurrent case here — two simultaneous syncs of the same
 * content and a third replaying the key — is written **before** the controller
 * exists, and stays red until the race is genuinely absent rather than
 * untested.
 *
 * ## Why the hook and not a hand-rolled request
 *
 * Since `EPIC-042` the finish hook of every governed command already calls
 * `pmi.artifacts.sync`; this Epic only makes the platform answer. Driving
 * `runFinish` proves the shipped call works, which a request this test composed
 * itself would not (`FR-ART-046`: the hooks are not changed).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPlatformClient, createServer } from '@pmi/mcp-server';
import { runBegin, runFinish } from '@pmi/workspace-bundle';
import { Client as PgClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;
let root: string;
let baseUrl = '';
let projectId = '';
let token = '';
let otherToken = '';
let projectDir = '';
/** The Epic the hook's `epic: '3'` resolves to. */
let epic3 = '';
const EPIC_DIR = 'specs/003-reports';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * The `system` comments on an execution. Read from the table rather than from
 * the events feed: `comment-added` carries the comment's id and type, not its
 * body, and the body is exactly what must be checked for what it does — and
 * does not — say (`FR-ART-053`).
 */
async function systemComments(executionId: string): Promise<{ body: string; authorId: string; authorType: string; commentType: string }[]> {
  const db = new PgClient({ connectionString: started.databaseUrl });
  await db.connect();
  try {
    const res = await db.query<{ body: string; authorId: string; authorType: string; commentType: string }>(
      `SELECT "body", "authorId", "authorType", "commentType" FROM "execution_comments" WHERE "executionId" = $1 ORDER BY "createdAt"`,
      [executionId],
    );
    return res.rows;
  } finally {
    await db.end();
  }
}

async function mcp(credential: string): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential }), { serverVersion: 'artifact-sync' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'artifact-sync', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

function seedProjectDir(dir: string, id: string, constitution: string): void {
  mkdirSync(join(dir, '.pmi'), { recursive: true });
  mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
  writeFileSync(
    join(dir, '.pmi', 'project.json'),
    JSON.stringify({ schemaVersion: 1, projectId: id, workspaceId: 'ws_art', projectName: 'Alpha', platformUrl: baseUrl, agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.14.3', bundleVersion: '0.2.0', provisionedBy: 'pmi-studio' }, null, 2),
  );
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), constitution, 'utf8');
  mkdirSync(join(dir, EPIC_DIR), { recursive: true });
}

/** Write the Epic's `spec.md` and run the shipped begin/finish pair over it. */
async function governedSpecify(content: string, opts: { command?: string; epic?: string } = {}): Promise<{ executionId: string; lines: string[] }> {
  const m = await mcp(token);
  try {
    const begun = await runBegin(m.client, projectDir, { command: opts.command ?? 'specify', epic: opts.epic ?? '3', epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
    expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
    writeFileSync(join(projectDir, EPIC_DIR, 'spec.md'), content, 'utf8');
    const finished = await runFinish(m.client, projectDir, EPIC_DIR);
    return { executionId: begun.executionId as string, lines: finished.lines };
  } finally {
    await m.close();
  }
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-art-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_art', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();

  const created = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha', scriptType: 'sh' }).expect(201);
  projectId = created.body.id;
  token = created.body.connectorCredential.value;

  // A second project, so "another project's credential" is a real credential
  // and not merely a malformed one (FR-ART-050).
  const other = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Beta', rootPath: 'beta', scriptType: 'sh' }).expect(201);
  otherToken = other.body.connectorCredential.value;

  // Three Epics, so the third is number 3 — the number the hook's `epic: '3'`
  // resolves through (R-045-2).
  for (const title of ['First', 'Second', 'Reports']) {
    const epic = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title }).expect(201);
    if (epic.body.number === 3) epic3 = epic.body.id;
  }
  expect(epic3, 'Epic 3 was not created').toMatch(/\S/);

  const constitution = await request(api).get(`/v1/projects/${projectId}/constitution`).set('Cookie', started.cookie).expect(200);
  projectDir = mkdtempSync(join(tmpdir(), 'pmi-art-dir-'));
  seedProjectDir(projectDir, projectId, constitution.body.content as string);
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1633 · a governed completion syncs the Epic\'s files (quickstart 1)', () => {
  it('the shipped finish sequence stores one version bound to the execution and the Epic', async () => {
    const { executionId } = await governedSpecify('# Reports\n');
    const api = started.app.getHttpServer();

    const tree = await request(api).get(`/v1/epics/${epic3}/artifacts`).set('Cookie', started.cookie).expect(200);
    expect(tree.body.epicId).toBe(epic3);
    const spec = (tree.body.files as { path: string; kind: string; versions: unknown[] }[]).find((f) => f.path === `${EPIC_DIR}/spec.md`);
    expect(spec, JSON.stringify(tree.body.files)).toBeDefined();
    expect(spec?.kind).toBe('spec');
    expect(spec?.versions).toHaveLength(1);

    const current = (spec as unknown as { current: { versionId: string; digest: string; sync: { executionId: string } } }).current;
    expect(current.digest).toBe(sha256('# Reports\n'));
    expect(current.sync.executionId).toBe(executionId);

    const content = await request(api).get(`/v1/artifacts/${current.versionId}`).set('Cookie', started.cookie).expect(200);
    expect(content.body.content).toBe('# Reports\n');
    expect(sha256(content.body.content as string)).toBe(content.body.digest);
  });

  it('prints no new line of its own — the finish prompt specifies none (FR-ART-046)', async () => {
    const { lines } = await governedSpecify('# Reports printed\n');
    expect(lines.some((l) => l.includes('not available until EPIC-045'))).toBe(false);
    expect(lines.filter((l) => l.includes('sync'))).toEqual([]);
  });
});

suite('T1633 · two at once and one retried (quickstart 3, FR-ART-006, SC-ART-002)', () => {
  it('answers 201 three times and leaves exactly ONE version and TWO sync records', async () => {
    // The race, driven through the real route. Written before the controller
    // existed and red until the unique index arbitrates it (DEF-044-003).
    const { executionId } = await governedSpecify('# Concurrency\n');
    const api = started.app.getHttpServer();
    const content = '# Raced content\n';
    const files = [{ path: `${EPIC_DIR}/plan.md`, digest: sha256(content), content }];

    const send = (key?: string): request.Test =>
      request(api)
        .post('/v1/projects/me/artifacts/sync')
        .set('Authorization', `Bearer ${token}`)
        .send({ executionId, files, ...(key ? { idempotencyKey: key } : {}) });

    const [a, b] = await Promise.all([send('race-a'), send('race-b')]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const replay = await send('race-a').expect(201);

    // One created, one reused — whichever won the race.
    expect(a.body.created + b.body.created).toBe(1);
    expect(a.body.reused + b.body.reused).toBe(1);
    // The replay returns the STORED answer, byte for byte.
    expect(replay.body).toEqual(a.body);

    const versions = await request(api).get(`/v1/epics/${epic3}/artifacts`).set('Cookie', started.cookie).expect(200);
    const plan = (versions.body.files as { path: string; versions: unknown[] }[]).find((f) => f.path === `${EPIC_DIR}/plan.md`);
    expect(plan?.versions, 'three 201s must leave one version').toHaveLength(1);

    // Two sync records for three requests: the replay wrote none.
    const syncIds = new Set([a.body.syncId, b.body.syncId, replay.body.syncId]);
    expect(syncIds.size).toBe(2);
  });

  it('derives the key when none is sent, so an unkeyed retry is still a replay (R-045-8)', async () => {
    const { executionId } = await governedSpecify('# Derived\n');
    const api = started.app.getHttpServer();
    const content = '# Derived key\n';
    const files = [{ path: `${EPIC_DIR}/research.md`, digest: sha256(content), content }];
    const send = (): request.Test => request(api).post('/v1/projects/me/artifacts/sync').set('Authorization', `Bearer ${token}`).send({ executionId, files });

    const first = await send().expect(201);
    const second = await send().expect(201);
    expect(second.body.syncId).toBe(first.body.syncId);
  });
});

suite('T1633 · a changed file makes a second version (quickstart 2, FR-ART-001)', () => {
  it('keeps the old version and makes the new one current', async () => {
    await governedSpecify('# Versioned one\n');
    const { executionId } = await governedSpecify('# Versioned two\n');
    const api = started.app.getHttpServer();
    const tree = await request(api).get(`/v1/epics/${epic3}/artifacts`).set('Cookie', started.cookie).expect(200);
    const spec = (tree.body.files as { path: string; current: { digest: string }; versions: { digest: string }[] }[]).find((f) => f.path === `${EPIC_DIR}/spec.md`);
    expect(spec?.current.digest).toBe(sha256('# Versioned two\n'));
    expect(spec?.versions.map((v) => v.digest)).toContain(sha256('# Versioned one\n'));
    // Newest first (data-model §5).
    expect(spec?.versions[0]?.digest).toBe(sha256('# Versioned two\n'));
    expect(executionId).toMatch(/\S/);
  });
});

suite('T1633 · one bad file among good ones (quickstart 4, FR-ART-004, FR-ART-044)', () => {
  it('stores the good file, refuses the bad one, and says so on the execution\'s timeline', async () => {
    const { executionId } = await governedSpecify('# Refusals\n');
    const api = started.app.getHttpServer();
    const good = '# Data model\n';
    const answer = await request(api)
      .post('/v1/projects/me/artifacts/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        executionId,
        files: [
          { path: `${EPIC_DIR}/data-model.md`, digest: sha256(good), content: good },
          { path: `${EPIC_DIR}/notes.txt`, digest: sha256('notes'), content: 'notes' },
        ],
      })
      .expect(201);

    expect(answer.body.created).toBe(1);
    expect(answer.body.refused).toEqual([{ path: `${EPIC_DIR}/notes.txt`, code: 'path_not_in_artifact_set' }]);

    const comments = await systemComments(executionId);
    const refusal = comments.find((c) => c.commentType === 'system' && c.authorId === 'platform:artifacts');
    expect(refusal, JSON.stringify(comments)).toBeDefined();
    expect(refusal?.authorType).toBe('service');
    expect(refusal?.body).toContain('path_not_in_artifact_set');
    expect(refusal?.body).toContain('notes.txt');
    // ONE comment for the sync, however many files it refused (R-045-3).
    expect(comments.filter((c) => c.authorId === 'platform:artifacts')).toHaveLength(1);
  });

  it('stores NOTHING for a file carrying a credential shape, and the comment names the shape only (FR-ART-053)', async () => {
    const { executionId } = await governedSpecify('# Credentials\n');
    const api = started.app.getHttpServer();
    const secret = `pmi_ct_${'a'.repeat(32)}`;
    const content = `# Quickstart\n\nRun with ${secret}\n`;
    const answer = await request(api)
      .post('/v1/projects/me/artifacts/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionId, files: [{ path: `${EPIC_DIR}/quickstart.md`, digest: sha256(content), content }] })
      .expect(201);

    expect(answer.body.created).toBe(0);
    expect(answer.body.refused).toEqual([{ path: `${EPIC_DIR}/quickstart.md`, code: 'credential_shape' }]);

    const tree = await request(api).get(`/v1/epics/${epic3}/artifacts`).set('Cookie', started.cookie).expect(200);
    const quickstart = (tree.body.files as { path: string }[]).find((f) => f.path === `${EPIC_DIR}/quickstart.md`);
    expect(quickstart, 'the refused file was stored anyway').toBeUndefined();

    const refusal = (await systemComments(executionId)).find((c) => c.authorId === 'platform:artifacts');
    expect(refusal).toBeDefined();
    expect(refusal?.body).toContain('credential_shape');
    expect(refusal?.body, 'the timeline carried the credential').not.toContain(secret);
  });
});

suite('T1633 · another project\'s credential is absent, not forbidden (quickstart 12, FR-ART-050)', () => {
  it('answers 404 to a sync naming this project\'s execution', async () => {
    const { executionId } = await governedSpecify('# Cross project\n');
    const api = started.app.getHttpServer();
    await request(api)
      .post('/v1/projects/me/artifacts/sync')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ executionId, files: [] })
      .expect(404);
  });

  it('answers 404 to a sync addressing this project by id', async () => {
    const { executionId } = await governedSpecify('# Cross project by id\n');
    const api = started.app.getHttpServer();
    await request(api)
      .post(`/v1/projects/${projectId}/artifacts/sync`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ executionId, files: [] })
      .expect(404);
  });

  it('answers 404 to an execution that does not exist', async () => {
    const api = started.app.getHttpServer();
    await request(api)
      .post('/v1/projects/me/artifacts/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionId: 'exec-does-not-exist', files: [] })
      .expect(404);
  });
});

suite('T1641 · the unbound case, through the composed application (quickstart 6, FR-ART-007)', () => {
  it('stores the sync with epicId null, lists it as unbound, and shows it under no Epic', async () => {
    // An execution bound to Epic 99, which this project does not have.
    const m = await mcp(token);
    let executionId = '';
    try {
      const begun = await runBegin(m.client, projectDir, { command: 'specify', epic: '99', epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
      expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
      executionId = begun.executionId as string;
      writeFileSync(join(projectDir, EPIC_DIR, 'spec.md'), '# Unbound\n', 'utf8');
      await runFinish(m.client, projectDir, EPIC_DIR);
    } finally {
      await m.close();
    }

    const api = started.app.getHttpServer();
    const unbound = await request(api).get(`/v1/projects/${projectId}/artifacts/unbound`).set('Cookie', started.cookie).expect(200);
    const entry = (unbound.body.syncs as { executionId: string; files: { path: string }[] }[]).find((s) => s.executionId === executionId);
    expect(entry, JSON.stringify(unbound.body)).toBeDefined();
    expect(entry?.files.some((f) => f.path === `${EPIC_DIR}/spec.md`)).toBe(true);

    // Absent from the Epic's tree: an unresolvable target is listed, never guessed.
    const tree = await request(api).get(`/v1/epics/${epic3}/artifacts`).set('Cookie', started.cookie).expect(200);
    const files = tree.body.files as { path: string; versions: { deliveredBy: { executionId: string }[] }[] }[];
    expect(files.flatMap((f) => f.versions.flatMap((v) => v.deliveredBy.map((d) => d.executionId)))).not.toContain(executionId);
  });
});

suite('T1641 · reported versus synced (quickstart 8, FR-ART-009)', () => {
  it('lists a digest the completion named that no sync stored, and one a sync stored that it did not name', async () => {
    // The mismatch is produced the way a real one arises — a client that syncs
    // one set and completes naming another — NOT by editing the binding
    // afterwards: `execution_target_bindings` is immutable by trigger
    // (`EPIC-037`), and that immutability is the reason the finding has to be
    // reported rather than repaired.
    const api = started.app.getHttpServer();
    const m = await mcp(token);
    const ghost = 'e'.repeat(64);
    const synced = '# Findings base\n';
    const syncedDigest = sha256(synced);
    let executionId = '';
    try {
      const begun = await runBegin(m.client, projectDir, { command: 'plan', epic: '3', epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
      expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
      executionId = begun.executionId as string;

      // Sync ONE file.
      await request(api)
        .post('/v1/projects/me/artifacts/sync')
        .set('Authorization', `Bearer ${token}`)
        .send({ executionId, files: [{ path: `${EPIC_DIR}/data-model.md`, digest: syncedDigest, content: synced }], idempotencyKey: `findings-${executionId}` })
        .expect(201);

      // Complete naming a DIFFERENT set: a digest nothing synced, and not the
      // one that was synced. Both halves of `FR-ART-009` from one execution.
      const done = await m.client.callTool({
        name: 'pmi.execution.complete',
        arguments: {
          executionId,
          outcome: 'completed',
          occurredAt: new Date().toISOString(),
          completionComment: 'Reported a digest that was never synced.',
          output: { generatedArtifactDigests: [ghost] },
          idempotencyKey: `findings-complete-${executionId}`,
        },
      });
      expect(done.isError, JSON.stringify(done.structuredContent)).toBeFalsy();
    } finally {
      await m.close();
    }

    const tree = await request(api).get(`/v1/epics/${epic3}/artifacts`).set('Cookie', started.cookie).expect(200);
    const findings = tree.body.findings as { reportedNotSynced: { executionId: string; digest: string }[]; syncedNotReported: { executionId: string; digest: string }[] };
    expect(findings.reportedNotSynced, JSON.stringify(findings)).toContainEqual({ executionId, digest: ghost });
    expect(findings.syncedNotReported, JSON.stringify(findings)).toContainEqual({ executionId, digest: syncedDigest });

    // Reported, never repaired: the version is still stored and still current.
    const entry = (tree.body.files as { path: string; current: { digest: string } | null }[]).find((f) => f.path === `${EPIC_DIR}/data-model.md`);
    expect(entry?.current?.digest).toBe(syncedDigest);
  });
});

suite('T1641 · a connector credential reads nothing (FR-ART-043)', () => {
  it('is refused on the tree, the content and the unbound list', async () => {
    const api = started.app.getHttpServer();
    const { executionId } = await governedSpecify('# Connector reads\n');
    expect(executionId).toMatch(/\S/);
    for (const path of [`/v1/epics/${epic3}/artifacts`, `/v1/projects/${projectId}/artifacts/unbound`, '/v1/artifacts/any']) {
      const answer = await request(api).get(path).set('Authorization', `Bearer ${token}`);
      // No session cookie, so no session: the read refuses rather than serving
      // content to a credential that may only write (contracts §2).
      expect([401, 404], `${path} answered ${answer.status}`).toContain(answer.status);
    }
  });
});

suite('T1656 · history is retrievable and the tree is fast (quickstart 9, SC-ART-005, SC-ART-006)', () => {
  it('ten syncs of a changing file produce ten versions, each content hashing to its stored digest', async () => {
    const api = started.app.getHttpServer();
    const { executionId } = await governedSpecify('# History base\n');
    const path = `${EPIC_DIR}/contracts/history.md`;

    for (let n = 1; n <= 10; n += 1) {
      const content = `# Research v${n}\n`;
      await request(api)
        .post('/v1/projects/me/artifacts/sync')
        .set('Authorization', `Bearer ${token}`)
        .send({ executionId, files: [{ path, digest: sha256(content), content }], idempotencyKey: `history-${n}` })
        .expect(201);
    }

    const tree = await request(api).get(`/v1/epics/${epic3}/artifacts`).set('Cookie', started.cookie).expect(200);
    const entry = (tree.body.files as { path: string; versions: { versionId: string; digest: string }[] }[]).find((f) => f.path === path);
    expect(entry?.versions).toHaveLength(10);

    // Every version is retrievable, and its CONTENT still hashes to the digest
    // the platform stored — the claim `SC-ART-005` actually makes.
    for (const v of entry?.versions ?? []) {
      const content = await request(api).get(`/v1/artifacts/${v.versionId}`).set('Cookie', started.cookie).expect(200);
      expect(sha256(content.body.content as string), `version ${v.versionId}`).toBe(v.digest);
    }
  });

  it('a file synced once and omitted later stays listed with the marker (FR-ART-014)', async () => {
    const api = started.app.getHttpServer();
    const { executionId } = await governedSpecify('# Omission base\n');
    const once = `${EPIC_DIR}/analysis.md`;
    const content = '# Analysis\n';
    await request(api)
      .post('/v1/projects/me/artifacts/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionId, files: [{ path: once, digest: sha256(content), content }], idempotencyKey: 'omit-1' })
      .expect(201);
    // A later sync of the same Epic that does not mention it.
    const other = '# Other\n';
    await request(api)
      .post('/v1/projects/me/artifacts/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionId, files: [{ path: `${EPIC_DIR}/tasks.md`, digest: sha256(other), content: other }], idempotencyKey: 'omit-2' })
      .expect(201);

    const tree = await request(api).get(`/v1/epics/${epic3}/artifacts`).set('Cookie', started.cookie).expect(200);
    const entry = (tree.body.files as { path: string; notInLatestSync: boolean; current: unknown }[]).find((f) => f.path === once);
    expect(entry, 'the omitted file vanished from the tree').toBeDefined();
    expect(entry?.notInLatestSync).toBe(true);
    expect(entry?.current, 'the omitted file is no longer openable').not.toBeNull();
  });

  it('a tree of 50 files x 20 versions answers in under 2 s, and the elapsed time is printed (SC-ART-006)', async () => {
    const api = started.app.getHttpServer();
    // Its own Epic, so the measurement is of this shape and not of whatever the
    // earlier scenarios happen to have left behind.
    const created = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Scale' }).expect(201);
    const scaleEpic = created.body.id as string;
    const m = await mcp(token);
    let executionId = '';
    try {
      const begun = await runBegin(m.client, projectDir, { command: 'plan', epic: String(created.body.number), epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
      expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
      executionId = begun.executionId as string;
    } finally {
      await m.close();
    }

    const paths = Array.from({ length: 50 }, (_, i) => `${EPIC_DIR}/contracts/c${String(i).padStart(2, '0')}.md`);
    for (let v = 1; v <= 20; v += 1) {
      const files = paths.map((p) => {
        const content = `# ${p} v${v}\n`;
        return { path: p, digest: sha256(content), content };
      });
      await request(api).post('/v1/projects/me/artifacts/sync').set('Authorization', `Bearer ${token}`).send({ executionId, files, idempotencyKey: `scale-${v}` }).expect(201);
    }

    const startedAt = Date.now();
    const tree = await request(api).get(`/v1/epics/${scaleEpic}/artifacts`).set('Cookie', started.cookie).expect(200);
    const elapsedMs = Date.now() - startedAt;
    // The figure quickstart §Results records (SC-ART-006): printed so a run of
    // this suite reports the measurement rather than only asserting the bound.
    console.log(`SC-ART-006 · tree of 50 files x 20 versions: ${elapsedMs} ms`);

    expect((tree.body.files as unknown[]).length).toBe(50);
    expect((tree.body.files as { versions: unknown[] }[])[0]?.versions).toHaveLength(20);
    expect(JSON.stringify(tree.body), 'the tree carried content').not.toContain('v20\n');
    expect(elapsedMs, `the tree took ${elapsedMs} ms`).toBeLessThan(2000);
  });
});

suite('T1658 · the synced spec.md is the Epic specification (quickstart 7, FR-ART-030 to FR-ART-034)', () => {
  async function specifyInto(epicNumber: string, content: string): Promise<void> {
    const m = await mcp(token);
    try {
      const begun = await runBegin(m.client, projectDir, { command: 'specify', epic: epicNumber, epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
      expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
      writeFileSync(join(projectDir, EPIC_DIR, 'spec.md'), content, 'utf8');
      await runFinish(m.client, projectDir, EPIC_DIR);
    } finally {
      await m.close();
    }
  }

  it('lists ONE specification under the Epic, with a second version only after a change', async () => {
    const api = started.app.getHttpServer();
    const created = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Specified' }).expect(201);
    const epicId = created.body.id as string;
    const epicNumber = String(created.body.number);

    await specifyInto(epicNumber, '# Specified one\n');
    const list = await request(api).get(`/v1/projects/${projectId}/specifications`).set('Cookie', started.cookie).expect(200);
    const rows = ((list.body.rows ?? list.body.items ?? list.body) as { id: string; epicId: string | null }[]).filter((r) => r.epicId === epicId);
    expect(rows, JSON.stringify(list.body)).toHaveLength(1);
    const specificationId = rows[0]?.id as string;

    // The same content again adds no version (`FR-ART-031`); a change adds one.
    await specifyInto(epicNumber, '# Specified one\n');
    await specifyInto(epicNumber, '# Specified two\n');

    const detail = await request(api).get(`/v1/specifications/${specificationId}`).set('Cookie', started.cookie).expect(200);
    expect(detail.body.sourcePath).toBe(`${EPIC_DIR}/spec.md`);
    expect(JSON.stringify(detail.body)).toContain('Specified two');

    // Still ONE specification for the Epic, however many commands synced.
    const again = await request(api).get(`/v1/projects/${projectId}/specifications`).set('Cookie', started.cookie).expect(200);
    expect(((again.body.rows ?? again.body.items ?? again.body) as { epicId: string | null }[]).filter((r) => r.epicId === epicId)).toHaveLength(1);
  });

  it('audits specification.create_from_sync and artifacts.sync (SC-ART-007, FR-ART-052)', async () => {
    const api = started.app.getHttpServer();
    const created = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Audited' }).expect(201);
    await specifyInto(String(created.body.number), '# Audited\n');

    const db = new PgClient({ connectionString: started.databaseUrl });
    await db.connect();
    try {
      const fromSync = await db.query(`SELECT 1 FROM "audit_entries" WHERE "detail"->>'kind' = 'specification.create_from_sync'`);
      expect(fromSync.rowCount, 'no specification.create_from_sync audit row').toBeGreaterThan(0);
      const sync = await db.query(`SELECT 1 FROM "audit_entries" WHERE "detail"->>'kind' = 'artifacts.sync'`);
      expect(sync.rowCount, 'no artifacts.sync audit row').toBeGreaterThan(0);
    } finally {
      await db.end();
    }
  });
});

suite('DEF-045-001 · a realistic Epic set fits in one sync; an oversized body is a coded 413', () => {
  it('accepts a 150 KB file - inside PMI_ARTIFACT_MAX_BYTES, far above the framework default body limit', async () => {
    const { executionId } = await governedSpecify('# Realistic size\n');
    const api = started.app.getHttpServer();
    const content = `# Big\n${'x'.repeat(150_000)}\n`;
    const res = await request(api)
      .post('/v1/projects/me/artifacts/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionId, files: [{ path: `${EPIC_DIR}/analysis.md`, digest: sha256(content), content }] });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.created).toBe(1);
  });

  it('refuses a body above PMI_ARTIFACT_SYNC_BODY_BYTES as 413 payload_too_large, never 500', async () => {
    const { executionId } = await governedSpecify('# Oversized body\n');
    const api = started.app.getHttpServer();
    // Above the 16 MiB default, split across files each inside the per-file limit.
    const piece = 'y'.repeat(900_000);
    const files = Array.from({ length: 20 }, (_, i) => ({ path: `${EPIC_DIR}/checklists/c${i}.md`, digest: sha256(piece), content: piece }));
    const res = await request(api).post('/v1/projects/me/artifacts/sync').set('Authorization', `Bearer ${token}`).send({ executionId, files });
    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ error: { code: 'payload_too_large' } });
  });
});

suite('DEF-045-002 · the specification step survives a race, and a reused key with a different payload is a conflict', () => {
  it('two simultaneous first syncs of a NEW Epic spec.md with different content both answer 201, leaving one specification with two versions', async () => {
    const api = started.app.getHttpServer();
    const epic = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Raced spec' }).expect(201);
    const dir = `specs/00${epic.body.number}-raced-spec`;
    mkdirSync(join(projectDir, dir), { recursive: true });
    const m = await mcp(token);
    let executionId = '';
    try {
      const begun = await runBegin(m.client, projectDir, { command: 'specify', epic: String(epic.body.number), epicDir: dir, toolkitVersion: 'v0.14.3' });
      expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
      executionId = begun.executionId as string;
    } finally {
      await m.close();
    }
    const send = (content: string, key: string): request.Test =>
      request(api).post('/v1/projects/me/artifacts/sync').set('Authorization', `Bearer ${token}`).send({ executionId, idempotencyKey: key, files: [{ path: `${dir}/spec.md`, digest: sha256(content), content }] });
    const [a, b] = await Promise.all([send('# Raced A\n', 'raced-spec-a'), send('# Raced B\n', 'raced-spec-b')]);
    expect([a.status, b.status], JSON.stringify([a.body, b.body])).toEqual([201, 201]);

    const list = await request(api).get(`/v1/projects/${projectId}/specifications`).set('Cookie', started.cookie).expect(200);
    const mine = ((list.body.rows ?? list.body) as { id: string; epicId: string | null }[]).filter((r) => r.epicId === epic.body.id);
    expect(mine, 'exactly one specification for the Epic').toHaveLength(1);
    const versions = await request(api).get(`/v1/specifications/${mine[0]?.id}/versions`).set('Cookie', started.cookie).expect(200);
    expect((versions.body as unknown[]).length, 'both contents became versions').toBe(2);
  });

  it('a caller-supplied key reused for a DIFFERENT sync is a coded conflict, not another request answer', async () => {
    const { executionId } = await governedSpecify('# Key reuse\n');
    const api = started.app.getHttpServer();
    const send = (content: string): request.Test =>
      request(api).post('/v1/projects/me/artifacts/sync').set('Authorization', `Bearer ${token}`).send({ executionId, idempotencyKey: 'reused-key', files: [{ path: `${EPIC_DIR}/quickstart.md`, digest: sha256(content), content }] });
    await send('# one\n').expect(201);
    const conflict = await send('# two\n');
    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({ error: { code: 'conflict', details: { code: 'idempotency_conflict' } } });
  });
});
