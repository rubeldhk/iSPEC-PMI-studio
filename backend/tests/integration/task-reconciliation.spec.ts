/**
 * `T1753` / `T1754` (EPIC-046, `FR-KAN-021`, `FR-KAN-022`, `FR-KAN-025`,
 * `FR-KAN-031`) — the supersession sequence, end to end.
 *
 * This is `US5`'s independent test, and it is the one that proves the direction
 * of the reconciliation rule against a real database rather than a table:
 *
 *   1. sync a file; a task is `not_started`;
 *   2. a person proposes `in_progress` — the file cannot express that, so the
 *      status stands and is marked **ahead of the file**;
 *   3. someone ticks the line and it syncs again — the **file wins**, the card
 *      is `done` and marked **superseded by the file**;
 *   4. the proposal row is **still there, unamended** (`FR-KAN-022`).
 *
 * Step 4 is the point. A board that reconciled by deleting the losing record
 * would look tidier and would have destroyed the only evidence that a person
 * ever said something different.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPlatformClient, createServer } from '@pmi/mcp-server';
import { runBegin, runFinish } from '@pmi/workspace-bundle';
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

const OPEN = ['- [ ] T6001 First in `a/one.ts`', '- [ ] T6002 Second in `a/two.ts`', ''].join('\n');
const TICKED = ['- [X] T6001 First in `a/one.ts`', '- [ ] T6002 Second in `a/two.ts`', ''].join('\n');
const RENAMED = ['- [ ] T6001 First, described differently in `a/one.ts`', ''].join('\n');

async function mcp(): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential: token }), { serverVersion: 'task-recon' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'task-recon', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

async function governed(command: 'tasks' | 'implement', content: string): Promise<void> {
  const m = await mcp();
  try {
    const begun = await runBegin(m.client, projectDir, { command, epic: '3', epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
    expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
    writeFileSync(join(projectDir, EPIC_DIR, 'tasks.md'), content, 'utf8');
    await runFinish(m.client, projectDir, EPIC_DIR);
  } finally {
    await m.close();
  }
}

async function board(): Promise<{ tasks: { id: string; taskKey: string; description: string; status: string; movedBy: string; notInLatestParse: boolean }[] }> {
  const res = await request(started.app.getHttpServer()).get(`/v1/epics/${epic3}/tasks`).set('Cookie', started.cookie).expect(200);
  return res.body;
}

async function disagreements(): Promise<{
  aheadOfFile: { taskKey: string; status: string }[];
  notInLatestParse: { taskKey: string }[];
  total: number;
}> {
  const res = await request(started.app.getHttpServer()).get(`/v1/epics/${epic3}/tasks/disagreements`).set('Cookie', started.cookie).expect(200);
  return res.body;
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-recon-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_recon', userId: 'u_owner' });
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
  projectDir = mkdtempSync(join(tmpdir(), 'pmi-recon-dir-'));
  mkdirSync(join(projectDir, '.pmi'), { recursive: true });
  mkdirSync(join(projectDir, '.specify', 'memory'), { recursive: true });
  writeFileSync(
    join(projectDir, '.pmi', 'project.json'),
    JSON.stringify({ schemaVersion: 1, projectId, workspaceId: 'ws_recon', projectName: 'Alpha', platformUrl: baseUrl, agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.14.3', bundleVersion: '0.2.0', provisionedBy: 'pmi-studio' }, null, 2),
  );
  writeFileSync(join(projectDir, '.specify', 'memory', 'constitution.md'), constitution.body.content as string, 'utf8');
  mkdirSync(join(projectDir, EPIC_DIR), { recursive: true });

  await governed('tasks', OPEN);
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1753 · propose, re-sync, supersede (US5)', () => {
  it('a proposal-set status stands while the file is silent, and is marked ahead of it', async () => {
    const api = started.app.getHttpServer();
    const first = (await board()).tasks.find((t) => t.taskKey === 'T6001');
    await request(api)
      .post(`/v1/tasks/${first?.id}/status-proposals`)
      .set('Cookie', started.cookie)
      .send({ expectedCurrentStatus: 'not_started', requestedStatus: 'in_progress', reason: 'Started it this morning' })
      .expect(201);

    // A new governed command re-reads the SAME unchanged content.
    await governed('implement', OPEN);

    const card = (await board()).tasks.find((t) => t.taskKey === 'T6001');
    expect(card).toMatchObject({ status: 'in_progress', movedBy: 'proposal' });
    expect((await disagreements()).aheadOfFile).toEqual([{ taskKey: 'T6001', status: 'in_progress' }]);
  });

  it('the file wins the moment it speaks, and the proposal record survives (FR-KAN-022)', async () => {
    const api = started.app.getHttpServer();
    const before = (await board()).tasks.find((t) => t.taskKey === 'T6001');
    const history = await request(api).get(`/v1/tasks/${before?.id}/status-proposals`).set('Cookie', started.cookie).expect(200);
    expect(history.body).toHaveLength(1);

    await governed('implement', TICKED);

    const card = (await board()).tasks.find((t) => t.taskKey === 'T6001');
    expect(card?.status).toBe('done');
    expect((await disagreements()).aheadOfFile).toEqual([]);

    // The record of what a person said is untouched — not deleted, not amended.
    const after = await request(api).get(`/v1/tasks/${before?.id}/status-proposals`).set('Cookie', started.cookie).expect(200);
    expect(after.body).toEqual(history.body);
  });
});

suite('T1753 · a task removed from the file is kept and marked (FR-KAN-025)', () => {
  it('stays listed, out of the denominator, and never deleted', async () => {
    const api = started.app.getHttpServer();
    await governed('tasks', RENAMED);

    const cards = (await board()).tasks;
    const gone = cards.find((t) => t.taskKey === 'T6002');
    expect(gone, 'the task was deleted; it must be kept and marked').toBeDefined();
    expect(gone?.notInLatestParse).toBe(true);
    expect((await disagreements()).notInLatestParse).toEqual([{ taskKey: 'T6002' }]);

    // FR-KAN-058: excluded from the denominator, and the exclusion is visible.
    const progress = await request(api).get(`/v1/epics/${epic3}/tasks/progress`).set('Cookie', started.cookie).expect(200);
    expect(progress.body.total).toBe(1);
  });

  it('keeps the identifier and its history when the description changes (FR-KAN-031)', async () => {
    const card = (await board()).tasks.find((t) => t.taskKey === 'T6001');
    expect(card?.description).toBe('First, described differently in `a/one.ts`');
    // Same row: the identifier is the identity, so the proposal is still on it.
    const history = await request(started.app.getHttpServer())
      .get(`/v1/tasks/${card?.id}/status-proposals`)
      .set('Cookie', started.cookie)
      .expect(200);
    expect(history.body).toHaveLength(1);
  });
});

suite('T1753 · the board says what it does not know (FR-KAN-020)', () => {
  it('counts the open disagreements rather than leaving a reader to add them up', async () => {
    const found = await disagreements();
    expect(found.total).toBeGreaterThan(0);
    expect(found.total).toBe(found.aheadOfFile.length + found.notInLatestParse.length + (found as unknown as { refusedLines: unknown[] }).refusedLines.length + (found as unknown as { unmatchedProgress: unknown[] }).unmatchedProgress.length + ((found as unknown as { outOfBandEdit: boolean }).outOfBandEdit ? 1 : 0) + ((found as unknown as { digestMismatch: unknown }).digestMismatch === null ? 0 : 1));
  });
});
