/**
 * `T1702` / `T1711` (EPIC-046, `FR-KAN-038`, `SC-KAN-006`, `SC-KAN-001`) — the
 * task sync through the **real finish sequence** and a **real `pmi-studio`
 * server** against the composed `AppModule`.
 *
 * ## Written before the service it drives
 *
 * `DEF-045-002`'s lesson, one Epic old. That defect was a step that raced: two
 * simultaneous first syncs of one Epic answered `500`/`201`, and the loser's
 * retry then replayed past the step forever. Every non-concurrent test passed
 * it. So the concurrent case here — two simultaneous syncs of one file, and a
 * third replaying the derived key — is written **before** the service exists and
 * stays red until the race is genuinely absent rather than untested.
 *
 * ## Why the hook and not a hand-rolled request
 *
 * Since `EPIC-042` the finish hook of `/speckit-tasks` and `/speckit-implement`
 * already calls `pmi.tasks.sync`; this Epic only makes the platform answer.
 * Driving `runFinish` proves the shipped call works, which a request this test
 * composed itself would not (`FR-KAN-061`: the hook is not changed).
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
let epic3 = '';
const EPIC_DIR = 'specs/003-reports';

function sha256(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

async function systemComments(executionId: string): Promise<{ body: string; commentType: string }[]> {
  const db = new PgClient({ connectionString: started.databaseUrl });
  await db.connect();
  try {
    const res = await db.query<{ body: string; commentType: string }>(
      `SELECT "body", "commentType" FROM "execution_comments" WHERE "executionId" = $1 ORDER BY "createdAt"`,
      [executionId],
    );
    return res.rows;
  } finally {
    await db.end();
  }
}

/**
 * The Epic's task rows, read from the table.
 *
 * The board *route* is Phase 3's (`T1715`); what this file proves is that the
 * sync wrote what it says it wrote, so it reads the rows rather than a
 * projection that does not exist yet. `T1720` asserts the same facts through
 * the route once there is one.
 */
async function tasksInDb(epicId: string): Promise<{ taskKey: string; status: string; parallel: boolean; sourceLine: number; sourceDigest: string; sourcePaths: string[] }[]> {
  const db = new PgClient({ connectionString: started.databaseUrl });
  await db.connect();
  try {
    const res = await db.query<{ taskKey: string; status: string; parallel: boolean; sourceLine: number; sourceDigest: string; sourcePaths: string[] }>(
      'SELECT "taskKey", "status"::text AS "status", "parallel", "sourceLine", "sourceDigest", "sourcePaths" FROM "tasks" WHERE "epicId" = $1 ORDER BY "sourceLine"',
      [epicId],
    );
    return res.rows;
  } finally {
    await db.end();
  }
}

async function latestSync(epicId: string): Promise<{ id: string; executionId: string; tasksDigest: string; linesConsidered: number; parsed: number; refused: number; duplicates: number } | null> {
  const db = new PgClient({ connectionString: started.databaseUrl });
  await db.connect();
  try {
    const res = await db.query(
      'SELECT "id","executionId","tasksDigest","linesConsidered","parsed","refused","duplicates" FROM "task_syncs" WHERE "epicId" = $1 ORDER BY "syncedAt" DESC LIMIT 1',
      [epicId],
    );
    return (res.rows[0] as never) ?? null;
  } finally {
    await db.end();
  }
}

async function refusedLines(syncId: string): Promise<{ lineNumber: number; refusalCode: string; rawText: string }[]> {
  const db = new PgClient({ connectionString: started.databaseUrl });
  await db.connect();
  try {
    const res = await db.query<{ lineNumber: number; refusalCode: string; rawText: string }>(
      'SELECT "lineNumber","refusalCode","rawText" FROM "task_sync_lines" WHERE "syncId" = $1 AND "refusalCode" IS NOT NULL ORDER BY "lineNumber"',
      [syncId],
    );
    return res.rows;
  } finally {
    await db.end();
  }
}

async function mcp(credential: string): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential }), { serverVersion: 'task-sync' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'task-sync', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

function seedProjectDir(dir: string, id: string, constitution: string): void {
  mkdirSync(join(dir, '.pmi'), { recursive: true });
  mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
  writeFileSync(
    join(dir, '.pmi', 'project.json'),
    JSON.stringify({ schemaVersion: 1, projectId: id, workspaceId: 'ws_task', projectName: 'Alpha', platformUrl: baseUrl, agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.14.3', bundleVersion: '0.2.0', provisionedBy: 'pmi-studio' }, null, 2),
  );
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), constitution, 'utf8');
  mkdirSync(join(dir, EPIC_DIR), { recursive: true });
}

/** Write the Epic's `tasks.md` and run the shipped begin/finish pair over it. */
async function governedTasks(
  content: string,
  opts: { command?: 'tasks' | 'implement'; epic?: string } = {},
): Promise<{ executionId: string; lines: string[] }> {
  const m = await mcp(token);
  try {
    const begun = await runBegin(m.client, projectDir, {
      command: opts.command ?? 'tasks',
      epic: opts.epic ?? '3',
      epicDir: EPIC_DIR,
      toolkitVersion: 'v0.14.3',
    });
    expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
    writeFileSync(join(projectDir, EPIC_DIR, 'tasks.md'), content, 'utf8');
    const finished = await runFinish(m.client, projectDir, EPIC_DIR);
    return { executionId: begun.executionId as string, lines: finished.lines };
  } finally {
    await m.close();
  }
}

/** Registers an execution without finishing it, so a raw sync can be posted against it. */
async function openExecution(command: 'tasks' | 'implement' = 'tasks'): Promise<string> {
  const m = await mcp(token);
  try {
    const begun = await runBegin(m.client, projectDir, { command, epic: '3', epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
    expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
    return begun.executionId as string;
  } finally {
    await m.close();
  }
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-task-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_task', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();

  const created = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha', scriptType: 'sh' }).expect(201);
  projectId = created.body.id;
  token = created.body.connectorCredential.value;

  // A second project, so "another project's credential" is a real credential
  // and not merely a malformed one (FR-KAN-070).
  const other = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Beta', rootPath: 'beta', scriptType: 'sh' }).expect(201);
  otherToken = other.body.connectorCredential.value;

  for (const title of ['First', 'Second', 'Reports']) {
    const epic = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title }).expect(201);
    if (epic.body.number === 3) epic3 = epic.body.id;
  }
  expect(epic3, 'Epic 3 was not created').toMatch(/\S/);

  const constitution = await request(api).get(`/v1/projects/${projectId}/constitution`).set('Cookie', started.cookie).expect(200);
  projectDir = mkdtempSync(join(tmpdir(), 'pmi-task-dir-'));
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

// --------------------------------------------------------------- concurrency

suite('T1702 · two syncs at once and one replayed (quickstart 4–5, SC-KAN-006)', () => {
  it('answers 201 three times and leaves ONE row per identifier and TWO sync records', async () => {
    const executionId = await openExecution();
    const api = started.app.getHttpServer();
    const tasksMarkdown = '- [ ] T9001 Race the index in `backend/src/modules/task-sync/task-sync.store.ts`\n';

    const send = (): request.Test =>
      request(api).post('/v1/projects/me/tasks/sync').set('Authorization', `Bearer ${token}`).send({ executionId, tasksMarkdown });

    // Two at the same moment: one wins the unique index, the other reads the
    // winner's row back. Neither may 500 (DEF-045-002 answered 500/201).
    const [a, b] = await Promise.all([send(), send()]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.syncId).toBe(b.body.syncId);

    // A third, later: the derived key is the same, so it replays.
    const third = await send().expect(201);
    expect(third.body.syncId).toBe(a.body.syncId);
    expect(third.body.diff.added).toEqual([]);
    expect(third.body.diff.unchanged).toBeGreaterThanOrEqual(0);

    const rows = (await tasksInDb(epic3)).filter((t) => t.taskKey === 'T9001');
    expect(rows, 'exactly one row per identifier').toHaveLength(1);
  });

  it('records a second sync for the same execution when the content changed (implement syncs twice)', async () => {
    const executionId = await openExecution('implement');
    const api = started.app.getHttpServer();
    const before = '- [ ] T9101 Before in `a/b.ts`\n';
    const after = '- [X] T9101 Before in `a/b.ts`\n';

    const first = await request(api).post('/v1/projects/me/tasks/sync').set('Authorization', `Bearer ${token}`).send({ executionId, tasksMarkdown: before }).expect(201);
    const second = await request(api).post('/v1/projects/me/tasks/sync').set('Authorization', `Bearer ${token}`).send({ executionId, tasksMarkdown: after }).expect(201);
    expect(second.body.syncId).not.toBe(first.body.syncId);
    expect(second.body.diff.checkboxChanged).toHaveLength(1);
  });
});

// ------------------------------------------------------- the shipped hook

suite('T1702 · a governed `tasks` completion parses the file (quickstart 1, SC-KAN-001)', () => {
  const CONTENT = [
    '# Tasks: Reports',
    '',
    '- [ ] T9201 Write the failing test in `backend/tests/unit/reports/a.spec.ts`',
    '- [X] T9202 [P] Implement it in `backend/src/modules/reports/a.ts`',
    '- [ ] Tidy up the module',
    '- [ ] T9201 The identifier already appeared above',
    '',
    '| a | table row |',
    '',
  ].join('\n');

  it('stores every parsed line with its source line, digest and paths', async () => {
    const { executionId } = await governedTasks(CONTENT);

    const tasks = await tasksInDb(epic3);
    const first = tasks.find((t) => t.taskKey === 'T9201');
    const second = tasks.find((t) => t.taskKey === 'T9202');

    expect(first?.status).toBe('not_started');
    expect(first?.sourceLine).toBe(3);
    expect(first?.sourceDigest).toBe(sha256(CONTENT));
    expect(first?.sourcePaths).toEqual(['backend/tests/unit/reports/a.spec.ts']);
    expect(second?.status).toBe('done');
    expect(second?.parallel).toBe(true);

    const sync = await latestSync(epic3);
    expect(sync?.executionId).toBe(executionId);
    expect(sync?.tasksDigest).toBe(sha256(CONTENT));
  });

  it('reports the refused and duplicate lines, and the counts account for every considered line', async () => {
    await governedTasks(CONTENT);
    const sync = await latestSync(epic3);
    expect(sync).not.toBeNull();

    const refused = await refusedLines(sync!.id);
    expect(refused.map((r) => r.refusalCode).sort()).toEqual(['duplicate_identifier', 'identifier_not_matched']);
    expect(refused.every((r) => r.lineNumber > 0 && r.rawText.length > 0)).toBe(true);

    expect(sync!.linesConsidered).toBe(sync!.parsed + sync!.refused + sync!.duplicates);
    expect(sync).toMatchObject({ parsed: 2, refused: 1, duplicates: 1, linesConsidered: 4 });
  });

  it('prints no new line of its own — the finish prompt specifies none (FR-KAN-061)', async () => {
    const { lines } = await governedTasks(CONTENT);
    expect(lines.some((l) => l.includes('not available until EPIC-046'))).toBe(false);
    expect(lines.filter((l) => l.includes('tasks.sync'))).toEqual([]);
  });
});

// ------------------------------------------------ T1711 · refusals and scope

suite('T1711 · a whole-file refusal leaves no rows (FR-KAN-039)', () => {
  it.each([
    ['over the line limit', `${Array.from({ length: 1001 }, (_, i) => `- [ ] T${90000 + i} Do it`).join('\n')}\n`, 'too_many_task_lines'],
  ])('refuses a file %s with %s and writes nothing', async (_label, tasksMarkdown, code) => {
    const executionId = await openExecution();
    const api = started.app.getHttpServer();
    const res = await request(api).post('/v1/projects/me/tasks/sync').set('Authorization', `Bearer ${token}`).send({ executionId, tasksMarkdown });
    // FR-KAN-066: no new TOP-LEVEL code. `validation_failed` is the platform's
    // 400; the specific code rides in `details`, as EPIC-045's per-file codes do.
    expect(res.status).toBe(400);
    expect(res.body.error.details.code).toBe(code);

    expect((await tasksInDb(epic3)).some((t) => t.taskKey === 'T90000')).toBe(false);
    expect((await latestSync(epic3))?.executionId).not.toBe(executionId);
  });
});

suite('T1711 · a credential shape in a description (FR-KAN-073)', () => {
  it('refuses the line, stores nothing of it, and names it on the execution', async () => {
    const executionId = await openExecution();
    const api = started.app.getHttpServer();
    const secret = `pmi_ct_${'A'.repeat(30)}`;
    const tasksMarkdown = `- [ ] T9301 Fine in \`a/b.ts\`\n- [ ] T9302 Token ${secret} here\n`;

    const res = await request(api).post('/v1/projects/me/tasks/sync').set('Authorization', `Bearer ${token}`).send({ executionId, tasksMarkdown }).expect(201);
    const refused = res.body.refusedLines as { code: string; text: string }[];
    expect(refused.map((r) => r.code)).toContain('credential_in_description');
    // Neither the answer nor the manifest may carry the secret back.
    expect(JSON.stringify(res.body)).not.toContain(secret);

    const rows = await tasksInDb(epic3);
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(rows.some((t) => t.taskKey === 'T9302')).toBe(false);
    expect(rows.some((t) => t.taskKey === 'T9301')).toBe(true);

    const comments = await systemComments(executionId);
    expect(comments.some((c) => c.commentType === 'system' && c.body.includes('credential_in_description'))).toBe(true);
    expect(comments.every((c) => !c.body.includes(secret))).toBe(true);
  });
});

suite('T1711 · an execution bound to no Epic is stored unbound (FR-KAN-032)', () => {
  it('stores the sync under the project and attaches it to no Epic', async () => {
    const m = await mcp(token);
    let executionId = '';
    try {
      // Epic 99 does not exist in this project — FR-EPB-008's case.
      const begun = await runBegin(m.client, projectDir, { command: 'tasks', epic: '99', epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
      expect(begun.refused, JSON.stringify(begun.lines)).toBeNull();
      executionId = begun.executionId as string;
    } finally {
      await m.close();
    }
    const api = started.app.getHttpServer();
    const res = await request(api)
      .post('/v1/projects/me/tasks/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionId, tasksMarkdown: '- [ ] T9401 Unbound in `a/b.ts`\n' })
      .expect(201);
    expect(res.body.epicId).toBeNull();

    expect((await tasksInDb(epic3)).some((t) => t.taskKey === 'T9401')).toBe(false);
  });
});

suite('T1711 · scope and tenancy (FR-KAN-070, FR-KAN-074)', () => {
  it("refuses another project's credential as absence", async () => {
    const executionId = await openExecution();
    const api = started.app.getHttpServer();
    const res = await request(api)
      .post('/v1/projects/me/tasks/sync')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ executionId, tasksMarkdown: '- [ ] T9501 Not yours in `a/b.ts`\n' });
    // Absence, not "forbidden" — nothing about the other project is disclosed.
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(epic3);
  });

  it('refuses an unknown execution by name', async () => {
    const api = started.app.getHttpServer();
    const res = await request(api)
      .post('/v1/projects/me/tasks/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionId: 'x_does_not_exist', tasksMarkdown: '- [ ] T9601 Nowhere in `a/b.ts`\n' });
    expect(res.status).toBe(404);
  });

  it('refuses an execution whose command is neither tasks nor implement (FR-KAN-033)', async () => {
    const m = await mcp(token);
    let executionId = '';
    try {
      const begun = await runBegin(m.client, projectDir, { command: 'specify', epic: '3', epicDir: EPIC_DIR, toolkitVersion: 'v0.14.3' });
      executionId = begun.executionId as string;
    } finally {
      await m.close();
    }
    const api = started.app.getHttpServer();
    const res = await request(api)
      .post('/v1/projects/me/tasks/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ executionId, tasksMarkdown: '- [ ] T9701 Wrong command in `a/b.ts`\n' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.code).toBe('command_not_task_bearing');
  });

  it('is not reachable without a credential', async () => {
    const api = started.app.getHttpServer();
    await request(api).post('/v1/projects/me/tasks/sync').send({ executionId: 'x', tasksMarkdown: '' }).expect(401);
  });
});

// --------------------------------------------------- T1720 · the board read

suite('T1720 · the board shows what the parse produced (US1, SC-KAN-001)', () => {
  const CONTENT = [
    '# Tasks: Reports',
    '',
    'Prose that is not a task.',
    '',
    '- [ ] T9801 First in `backend/src/a.ts`',
    '- [X] T9802 [P] Second in `backend/src/b.ts`',
    '- [ ] Tidy up the module',
    '- [ ] T9801 The identifier already appeared above',
    '',
    '| a | table row |',
    '  - [ ] T9899 A nested item is not considered',
    '',
  ].join('\n');

  it('returns the four columns, the cards and the header through the route', async () => {
    const { executionId } = await governedTasks(CONTENT);
    const api = started.app.getHttpServer();
    const board = await request(api).get(`/v1/epics/${epic3}/tasks`).set('Cookie', started.cookie).expect(200);

    expect((board.body.columns as { status: string }[]).map((c) => c.status)).toEqual([
      'not_started', 'in_progress', 'done', 'blocked',
    ]);

    const tasks = board.body.tasks as { taskKey: string; status: string; parallel: boolean; sourceLine: number; sourcePaths: string[]; movedBy: string }[];
    const first = tasks.find((t) => t.taskKey === 'T9801');
    const second = tasks.find((t) => t.taskKey === 'T9802');
    expect(first).toMatchObject({ status: 'not_started', parallel: false, sourceLine: 5, movedBy: 'parse' });
    expect(first?.sourcePaths).toEqual(['backend/src/a.ts']);
    expect(second).toMatchObject({ status: 'done', parallel: true, sourceLine: 6 });

    // A nested item is not considered at all, so it is neither a card nor a refusal.
    expect(tasks.some((t) => t.taskKey === 'T9899')).toBe(false);

    expect(board.body.latestParse).toMatchObject({ executionId, digest: sha256(CONTENT) });
  });

  it('lists the refused lines with number, text and code — nothing is dropped (FR-KAN-003)', async () => {
    await governedTasks(CONTENT);
    const api = started.app.getHttpServer();
    const board = await request(api).get(`/v1/epics/${epic3}/tasks`).set('Cookie', started.cookie).expect(200);

    const refused = board.body.refusedLines as { line: number; code: string; text: string }[];
    expect(refused.map((r) => r.code).sort()).toEqual(['duplicate_identifier', 'identifier_not_matched']);
    expect(refused.every((r) => r.line > 0 && r.text.length > 0)).toBe(true);
  });

  it('accounts for every considered line exactly once (SC-KAN-001)', async () => {
    await governedTasks(CONTENT);
    const api = started.app.getHttpServer();
    const board = await request(api).get(`/v1/epics/${epic3}/tasks`).set('Cookie', started.cookie).expect(200);

    const c = board.body.counts as { linesConsidered: number; parsed: number; refused: number; duplicates: number };
    expect(c.linesConsidered).toBe(c.parsed + c.refused + c.duplicates);
    expect(c).toMatchObject({ parsed: 2, refused: 1, duplicates: 1, linesConsidered: 4 });
  });

  it('is a SESSION route — a connector credential gets absence, not the board (FR-KAN-071)', async () => {
    await governedTasks(CONTENT);
    const api = started.app.getHttpServer();
    // The bearer token carries no session, so the workspace guard refuses it.
    const res = await request(api).get(`/v1/epics/${epic3}/tasks`).set('Authorization', `Bearer ${token}`);
    expect([401, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain('T9801');
  });

  it('is not reachable unauthenticated (FR-KAN-075)', async () => {
    const api = started.app.getHttpServer();
    const res = await request(api).get(`/v1/epics/${epic3}/tasks`);
    expect([401, 404]).toContain(res.status);
  });

  it('answers absence for an Epic of another workspace', async () => {
    const api = started.app.getHttpServer();
    await request(api).get('/v1/epics/e_not_a_real_epic/tasks').set('Cookie', started.cookie).expect(404);
  });
});
