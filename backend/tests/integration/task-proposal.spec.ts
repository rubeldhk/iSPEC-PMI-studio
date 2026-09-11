/**
 * `T1743` / `T1744` (EPIC-046, `FR-KAN-010` to `FR-KAN-016`, `SC-KAN-004`) — a
 * manual move against the composed application.
 *
 * ## The byte-comparison is the point
 *
 * `SC-KAN-004` asks for **zero** writes to the project directory by any route,
 * tool or screen of this Epic. Structural checks — "this module imports no
 * `fs`" — are cheap and can be true of a module that calls something that does.
 * So this suite digests **every file under the Epic's directory** before and
 * after a full board session including a move, and compares them.
 *
 * If a later change makes something write `tasks.md`, this is what says so.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
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
let projectDir = '';
let epic3 = '';
const EPIC_DIR = 'specs/003-reports';

const TASKS = [
  '- [ ] T8001 First in `a/one.ts`',
  '- [ ] T8002 Second in `a/two.ts`',
  '',
].join('\n');

/** Every file under a directory, as `relative path → sha256`. */
function digestTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[relative(dir, full).split('\\').join('/')] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  if (statSync(dir, { throwIfNoEntry: false }) !== undefined) walk(dir);
  return out;
}

async function mcp(credential: string): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential }), { serverVersion: 'task-proposal' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'task-proposal', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

async function board(): Promise<{ tasks: { id: string; taskKey: string; status: string; movedBy: string; movedByActorId: string | null }[] }> {
  const res = await request(started.app.getHttpServer())
    .get(`/v1/epics/${epic3}/tasks`)
    .set('Cookie', started.cookie)
    .expect(200);
  return res.body;
}

async function setApprovalPolicy(required: boolean): Promise<void> {
  const db = new PgClient({ connectionString: started.databaseUrl });
  await db.connect();
  try {
    await db.query('UPDATE "projects" SET "taskMoveRequiresApproval" = $1 WHERE "id" = $2', [required, projectId]);
  } finally {
    await db.end();
  }
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-prop-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_prop', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();

  const created = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha', scriptType: 'sh' }).expect(201);
  projectId = created.body.id;
  token = created.body.connectorCredential.value;

  for (const title of ['First', 'Second', 'Reports']) {
    const epic = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title }).expect(201);
    if (epic.body.number === 3) epic3 = epic.body.id;
  }

  const constitution = await request(api).get(`/v1/projects/${projectId}/constitution`).set('Cookie', started.cookie).expect(200);
  projectDir = mkdtempSync(join(tmpdir(), 'pmi-prop-dir-'));
  mkdirSync(join(projectDir, '.pmi'), { recursive: true });
  mkdirSync(join(projectDir, '.specify', 'memory'), { recursive: true });
  writeFileSync(
    join(projectDir, '.pmi', 'project.json'),
    JSON.stringify({ schemaVersion: 1, projectId, workspaceId: 'ws_prop', projectName: 'Alpha', platformUrl: baseUrl, agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.14.3', bundleVersion: '0.2.0', provisionedBy: 'pmi-studio' }, null, 2),
  );
  writeFileSync(join(projectDir, '.specify', 'memory', 'constitution.md'), constitution.body.content as string, 'utf8');
  mkdirSync(join(projectDir, EPIC_DIR), { recursive: true });

  const m = await mcp(token);
  try {
    const begun = await runBegin(m.client, projectDir, { command: 'tasks', epic: '3', epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
    expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
    writeFileSync(join(projectDir, EPIC_DIR, 'tasks.md'), TASKS, 'utf8');
    await runFinish(m.client, projectDir, EPIC_DIR);
  } finally {
    await m.close();
  }
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1743 · a move applies at once and writes NO file (SC-KAN-004)', () => {
  it('leaves the Epic directory byte-identical after a full board session', async () => {
    const api = started.app.getHttpServer();
    const before = digestTree(join(projectDir, EPIC_DIR));
    expect(Object.keys(before), 'the fixture directory is empty; the comparison would prove nothing').not.toHaveLength(0);

    const first = (await board()).tasks.find((t) => t.taskKey === 'T8001');
    const res = await request(api)
      .post(`/v1/tasks/${first?.id}/status-proposals`)
      .set('Cookie', started.cookie)
      .send({ expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started it this morning' })
      .expect(201);

    expect(res.body.verdict).toBe('applied');
    const moved = (await board()).tasks.find((t) => t.taskKey === 'T8001');
    expect(moved).toMatchObject({ status: 'in_progress', movedBy: 'proposal' });
    expect(moved?.movedByActorId).toBeTruthy();

    // The whole point: the card moved and the file did not.
    expect(digestTree(join(projectDir, EPIC_DIR))).toEqual(before);
  });

  it('records the proposal, its reason and its verdict', async () => {
    const api = started.app.getHttpServer();
    const first = (await board()).tasks.find((t) => t.taskKey === 'T8001');
    const history = await request(api).get(`/v1/tasks/${first?.id}/status-proposals`).set('Cookie', started.cookie).expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ requestedStatus: 'in_progress', reason: 'Started it this morning', proposerType: 'user' });
    // R-037-5: the ROW is the request. No verdict column exists on it.
    expect(Object.keys(history.body[0] as object)).not.toContain('verdict');
  });
});

suite('T1743 · the refusals a move can meet', () => {
  it('refuses a move with no reason, before a proposal exists (FR-KAN-011)', async () => {
    const api = started.app.getHttpServer();
    const second = (await board()).tasks.find((t) => t.taskKey === 'T8002');
    const res = await request(api)
      .post(`/v1/tasks/${second?.id}/status-proposals`)
      .set('Cookie', started.cookie)
      .send({ expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.code).toBe('reason_required');

    const history = await request(api).get(`/v1/tasks/${second?.id}/status-proposals`).set('Cookie', started.cookie).expect(200);
    expect(history.body).toEqual([]);
  });

  it('answers `inconsistent` for a stale move rather than overwriting (FR-KAN-016)', async () => {
    const api = started.app.getHttpServer();
    const first = (await board()).tasks.find((t) => t.taskKey === 'T8001');
    // It is `in_progress` by now; this move still believes it is `not_started`.
    const res = await request(api)
      .post(`/v1/tasks/${first?.id}/status-proposals`)
      .set('Cookie', started.cookie)
      .send({ expectedCurrentStatus: 'not_started', requestedStatus: 'blocked', reason: 'A stale click' })
      .expect(201);
    expect(res.body.verdict).toBe('inconsistent');
    expect((await board()).tasks.find((t) => t.taskKey === 'T8001')?.status).toBe('in_progress');
  });

  it('waits for a second person when the project policy requires one', async () => {
    const api = started.app.getHttpServer();
    await setApprovalPolicy(true);
    try {
      const second = (await board()).tasks.find((t) => t.taskKey === 'T8002');
      const res = await request(api)
        .post(`/v1/tasks/${second?.id}/status-proposals`)
        .set('Cookie', started.cookie)
        .send({ expectedCurrentStatus: 'not_started', requestedStatus: 'blocked', reason: 'Waiting on an answer' })
        .expect(201);
      expect(res.body.verdict).toBe('approval_required');
      expect((await board()).tasks.find((t) => t.taskKey === 'T8002')?.status).toBe('not_started');
    } finally {
      await setApprovalPolicy(false);
    }
  });

  it('is not reachable by a connector credential (FR-KAN-071)', async () => {
    const api = started.app.getHttpServer();
    const second = (await board()).tasks.find((t) => t.taskKey === 'T8002');
    const res = await request(api)
      .post(`/v1/tasks/${second?.id}/status-proposals`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedCurrentStatus: 'not_started', requestedStatus: 'blocked', reason: 'A connector should not be here' });
    expect([401, 404]).toContain(res.status);
  });

  it('refuses the direct PATCH on a synced task, naming the proposal route (FR-KAN-017)', async () => {
    const api = started.app.getHttpServer();
    const second = (await board()).tasks.find((t) => t.taskKey === 'T8002');
    const res = await request(api)
      .patch(`/v1/tasks/${second?.id}`)
      .set('Cookie', started.cookie)
      .send({ status: 'done' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.code).toBe('task_is_proposal_gated');
    expect((await board()).tasks.find((t) => t.taskKey === 'T8002')?.status).toBe('not_started');
  });
});
