/**
 * `T1725` (EPIC-046, `FR-KAN-040` to `FR-KAN-047`, `SC-KAN-003`) — the board
 * moves itself, through the **shipped** `runProgress` and `runFinish` against a
 * real `pmi-studio` server and the composed `AppModule`.
 *
 * This is milestone `M4`'s mechanism proved end to end. It drives the real hook
 * sequences rather than posting events this file composed, because what must be
 * true is that *the events the shipped hook sends* move the board — a hand-made
 * event would prove only that the platform accepts what this test invented.
 *
 * The deliberate consequence recorded in `R-046-1` is asserted here: the hook's
 * `tickedTasks` takes *the first token after a ticked checkbox* and is more
 * permissive than the platform's identifier pattern, so a hook can report a
 * token the grammar rejects. That is `FR-KAN-042`'s unmatched report, and the
 * two rules meet without either side knowing the other's.
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

async function mcp(credential: string): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential }), { serverVersion: 'task-progress' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'task-progress', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

function seedProjectDir(dir: string, id: string, constitution: string): void {
  mkdirSync(join(dir, '.pmi'), { recursive: true });
  mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
  writeFileSync(
    join(dir, '.pmi', 'project.json'),
    JSON.stringify({ schemaVersion: 1, projectId: id, workspaceId: 'ws_prog', projectName: 'Alpha', platformUrl: baseUrl, agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.14.3', bundleVersion: '0.2.0', provisionedBy: 'pmi-studio' }, null, 2),
  );
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), constitution, 'utf8');
  mkdirSync(join(dir, EPIC_DIR), { recursive: true });
}

/** One governed command over a `tasks.md`, through the shipped begin/finish pair. */
async function governed(command: 'tasks' | 'implement', content: string): Promise<{ executionId: string; lines: string[] }> {
  const m = await mcp(token);
  try {
    const begun = await runBegin(m.client, projectDir, { command, epic: '3', epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
    expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
    writeFileSync(join(projectDir, EPIC_DIR, 'tasks.md'), content, 'utf8');
    const finished = await runFinish(m.client, projectDir, EPIC_DIR);
    return { executionId: begun.executionId as string, lines: finished.lines };
  } finally {
    await m.close();
  }
}

async function board(): Promise<{
  tasks: { taskKey: string; status: string; movedBy: string; movedAt: string | null }[];
  remainingUnchecked: number;
  unmatchedProgress: { taskId: string }[];
}> {
  const res = await request(started.app.getHttpServer())
    .get(`/v1/epics/${epic3}/tasks`)
    .set('Cookie', started.cookie)
    .expect(200);
  return res.body;
}

const THREE_OPEN = [
  '- [ ] T7001 First in `a/one.ts`',
  '- [ ] T7002 Second in `a/two.ts`',
  '- [ ] T7003 Third in `a/three.ts`',
  '- [ ] T7004 Fourth in `a/four.ts`',
  '',
].join('\n');

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-prog-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_prog', userId: 'u_owner' });
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
  expect(epic3, 'Epic 3 was not created').toMatch(/\S/);

  const constitution = await request(api).get(`/v1/projects/${projectId}/constitution`).set('Cookie', started.cookie).expect(200);
  projectDir = mkdtempSync(join(tmpdir(), 'pmi-prog-dir-'));
  seedProjectDir(projectDir, projectId, constitution.body.content as string);

  // The board starts from a `tasks` run, as a real Epic does.
  await governed('tasks', THREE_OPEN);
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1725 · the board moves itself (M4, SC-KAN-003)', () => {
  it('starts with four cards, none of them done', async () => {
    const before = await board();
    expect(before.tasks).toHaveLength(4);
    expect(before.tasks.every((t) => t.status === 'not_started')).toBe(true);
    expect(before.remainingUnchecked).toBe(4);
  });

  it('an implement run that ticks three tasks puts three cards in Done, with no human action', async () => {
    const ticked = [
      '- [X] T7001 First in `a/one.ts`',
      '- [X] T7002 Second in `a/two.ts`',
      '- [X] T7003 Third in `a/three.ts`',
      '- [ ] T7004 Fourth in `a/four.ts`',
      '',
    ].join('\n');
    await governed('implement', ticked);

    const after = await board();
    const done = after.tasks.filter((t) => t.status === 'done');
    expect(done.map((t) => t.taskKey).sort()).toEqual(['T7001', 'T7002', 'T7003']);
    expect(after.tasks.find((t) => t.taskKey === 'T7004')?.status).toBe('not_started');
    expect(after.remainingUnchecked).toBe(1);
  });

  it('attributes each move to the implement event that reported it, not to a person', async () => {
    const after = await board();
    for (const key of ['T7001', 'T7002', 'T7003']) {
      const card = after.tasks.find((t) => t.taskKey === key);
      // `event` — the shipped `runProgress` appended it; `parse` would mean the
      // checkbox alone moved it, and `proposal` would mean a person did.
      expect(card?.movedBy, key).toBe('event');
      expect(card?.movedAt, key).not.toBeNull();
    }
  });

  it('is idempotent — a second implement run over the same file changes nothing', async () => {
    const before = await board();
    const same = [
      '- [X] T7001 First in `a/one.ts`',
      '- [X] T7002 Second in `a/two.ts`',
      '- [X] T7003 Third in `a/three.ts`',
      '- [ ] T7004 Fourth in `a/four.ts`',
      '',
    ].join('\n');
    await governed('implement', same);
    const after = await board();
    expect(after.tasks.map((t) => `${t.taskKey}:${t.status}:${t.movedAt ?? ''}`).sort()).toEqual(
      before.tasks.map((t) => `${t.taskKey}:${t.status}:${t.movedAt ?? ''}`).sort(),
    );
  });
});

suite('T1725 · a report the grammar cannot match creates nothing (FR-KAN-042, R-046-1)', () => {
  it('lists it as unmatched rather than inventing a task', async () => {
    // The hook ticks a line whose first token is not an identifier the platform
    // accepts. `tickedTasks` reports the token; the grammar refuses the line.
    // Neither side is wrong, and this is where they meet.
    const odd = [
      '- [X] T7001 First in `a/one.ts`',
      '- [X] T7002 Second in `a/two.ts`',
      '- [X] T7003 Third in `a/three.ts`',
      '- [ ] T7004 Fourth in `a/four.ts`',
      '- [X] tidy-up Something the grammar will not accept',
      '',
    ].join('\n');
    await governed('implement', odd);

    const after = await board();
    expect(after.tasks.some((t) => t.taskKey === 'tidy-up')).toBe(false);
    expect(after.unmatchedProgress.map((u) => u.taskId)).toContain('tidy-up');
    // The four real tasks are untouched by it.
    expect(after.tasks).toHaveLength(4);
  });
});

suite('T1725 · the hook is not edited (FR-KAN-061)', () => {
  it('prints no line of its own for the task sync or the progress events', async () => {
    const { lines } = await governed('implement', THREE_OPEN);
    expect(lines.some((l) => l.includes('not available until EPIC-046'))).toBe(false);
    expect(lines.filter((l) => l.includes('tasks.sync'))).toEqual([]);
  });
});
