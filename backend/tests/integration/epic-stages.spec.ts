/**
 * `T1582` (EPIC-044, `FR-EPB-001`–`FR-EPB-009`, `FR-EPB-063`, `SC-EPB-005`,
 * `SC-EPB-007`) — the stage reads over executions registered and completed
 * through a REAL `pmi-studio` server via the sequence harness, against Epics of
 * the composed application. Nothing here writes a stage; every card below is
 * derived from what the hooks recorded. Written to FAIL before `T1583`.
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
const epicIds: Record<number, string> = {};

interface Card {
  epicId: string;
  number: number;
  stage: string;
  next: string | null;
  missing: string[];
  last: { command: string; outcome: string } | null;
  running: { executionId: string } | null;
  readiness: { verdict: string; note?: string };
}

async function mcp(): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl, credential: token }), { serverVersion: 'stages' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'stages', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

/** Register and complete one governed command for an Epic, with the outcome and comment given. */
async function run(client: Client, epic: number, command: string, opts: { outcome?: 'completed' | 'failed'; comment?: string; finish?: boolean } = {}): Promise<string> {
  const epicDir = `specs/${String(epic).padStart(3, '0')}-epic-${epic}`;
  mkdirSync(join(projectDir, epicDir), { recursive: true });
  const begun = await runBegin(client, projectDir, { command, epic: String(epic), epicDir });
  expect(begun.executionId, begun.lines.join(' | ')).toMatch(/\S/);
  if (opts.finish !== false) {
    const finished = await runFinish(client, projectDir, epicDir, { ...(opts.outcome ? { outcome: opts.outcome } : {}), ...(opts.comment ? { completionComment: opts.comment } : {}) });
    expect(finished.outcome, finished.lines.join(' | ')).toBe(opts.outcome ?? 'completed');
  }
  return begun.executionId as string;
}

async function board(): Promise<{ epics: Card[]; unbound: { targetId: string }[]; columns: string[]; packageVersion: string }> {
  const res = await request(started.app.getHttpServer()).get(`/v1/projects/${projectId}/epics/stages`).set('Cookie', started.cookie).expect(200);
  return res.body;
}

const card = (b: { epics: Card[] }, number: number): Card => b.epics.find((e) => e.number === number)!;

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-stages-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_st', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();
  const p = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha', scriptType: 'sh' }).expect(201);
  projectId = p.body.id;
  token = p.body.connectorCredential.value;
  for (const title of ['Intake', 'Review', 'Reports', 'Deep']) {
    const e = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title }).expect(201);
    epicIds[e.body.number as number] = e.body.id;
  }
  projectDir = mkdtempSync(join(tmpdir(), 'pmi-stages-dir-'));
  mkdirSync(join(projectDir, '.pmi'), { recursive: true });
  writeFileSync(join(projectDir, '.pmi', 'project.json'), JSON.stringify({ schemaVersion: 1, projectId, workspaceId: 'ws_st', projectName: 'Alpha', platformUrl: baseUrl, agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.14.3', bundleVersion: '0.2.0', provisionedBy: 'pmi-studio' }, null, 2));
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1582 · the board over executions the hooks recorded', () => {
  it('Not started / Specified / Planned with last and next; the stage route agrees; the columns and the package version are stated', async () => {
    const m = await mcp();
    try {
      await run(m.client, 1, 'specify');
      for (const c of ['specify', 'clarify', 'checklist', 'plan']) await run(m.client, 2, c);
    } finally {
      await m.close();
    }
    const b = await board();
    expect(card(b, 1)).toMatchObject({ stage: 'Specified', next: '/speckit-clarify', last: { command: 'specify', outcome: 'completed' } });
    expect(card(b, 2)).toMatchObject({ stage: 'Planned', next: '/speckit-tasks' });
    expect(card(b, 3)).toMatchObject({ stage: 'Not started', next: '/speckit-specify', last: null });
    expect(b.columns[0]).toBe('Not started');
    expect(b.packageVersion).toMatch(/^\d+\.\d+\.\d+$/);
    const one = await request(started.app.getHttpServer()).get(`/v1/epics/${epicIds[2]}/stage`).set('Cookie', started.cookie).expect(200);
    expect(one.body).toMatchObject({ stage: 'Planned', derivedFrom: 'executions' });
  }, 300_000);

  it('a failed plan after a completed clarify leaves Clarified and is the last execution; a running implement shows as running', async () => {
    const m = await mcp();
    try {
      await run(m.client, 3, 'specify');
      await run(m.client, 3, 'clarify');
      await run(m.client, 3, 'plan', { outcome: 'failed' });
      // Epic 4 walks the six steps, then starts an implement it never finishes.
      for (const c of ['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze']) await run(m.client, 4, c);
      await run(m.client, 4, 'implement', { finish: false });
    } finally {
      await m.close();
    }
    const b = await board();
    expect(card(b, 3)).toMatchObject({ stage: 'Clarified', next: '/speckit-checklist', last: { command: 'plan', outcome: 'failed' }, running: null });
    expect(card(b, 4)).toMatchObject({ stage: 'Implementing', next: '/speckit-converge' });
    expect(card(b, 4).running).not.toBeNull();
  }, 300_000);

  it('a converge naming tasks.md leaves the stage; one that does not moves to Converged; a later implement returns to Implementing (FR-EPB-005)', async () => {
    const m = await mcp();
    try {
      // Complete the open implement left by the previous test, then converge twice.
      const epicDir = 'specs/004-epic-4';
      const finished = await runFinish(m.client, projectDir, epicDir, {});
      expect(finished.outcome).toBe('completed');
      await run(m.client, 4, 'converge', { comment: 'Changed: specs/004-epic-4/tasks.md. New: none.' });
      expect(card(await board(), 4)).toMatchObject({ stage: 'Implementing', next: '/speckit-converge' });
      await run(m.client, 4, 'converge', { comment: 'Nothing changed.' });
      expect(card(await board(), 4)).toMatchObject({ stage: 'Converged', next: null });
      await run(m.client, 4, 'implement', { finish: false });
      expect(card(await board(), 4)).toMatchObject({ stage: 'Implementing' });
      await runFinish(m.client, projectDir, epicDir, {});
    } finally {
      await m.close();
    }
  }, 300_000);

  it('an execution bound to an Epic number the project does not have is listed unbound, never attached (FR-EPB-008)', async () => {
    const m = await mcp();
    try {
      await run(m.client, 99, 'specify');
    } finally {
      await m.close();
    }
    const b = await board();
    expect(b.unbound.map((u) => u.targetId)).toEqual(['99']);
    expect(b.epics.map((e) => e.number).sort()).toEqual([1, 2, 3, 4]);
  }, 120_000);

  it('a queued provisional record moves nothing: only governed executions are evidence (FR-EPB-002, SC-EPB-007)', async () => {
    const before = await board();
    mkdirSync(join(projectDir, '.pmi', 'provisional'), { recursive: true });
    writeFileSync(join(projectDir, '.pmi', 'provisional', 'prov_1.json'), JSON.stringify({ registration: { executionId: 'prov_1', command: 'clarify', input: { targetType: 'epic', targetId: '1' } }, events: [{ type: 'execution-sync-queued' }], governed: false }), 'utf8');
    const after = await board();
    expect(after.epics).toEqual(before.epics);
    expect(card(after, 1).stage).toBe('Specified');
  });

  it('answers a project with many Epics and executions in under 2 s (SC-EPB-005 — 50 Epics, 100 governed executions here; the 500-row derivation is timed in the package)', async () => {
    const api = started.app.getHttpServer();
    const numbers: number[] = [];
    for (let i = 0; i < 46; i += 1) {
      const e = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: `Bulk ${i}` }).expect(201);
      numbers.push(e.body.number as number);
    }
    const m = await mcp();
    try {
      for (const n of numbers) {
        await run(m.client, n, 'specify');
        await run(m.client, n, 'clarify');
      }
    } finally {
      await m.close();
    }
    const start = performance.now();
    const b = await board();
    const elapsed = performance.now() - start;
    expect(b.epics).toHaveLength(50);
    expect(elapsed).toBeLessThan(2000);
    // 46 bulk Epics plus Epic 3, whose failed plan left it at Clarified in an earlier case.
    expect(b.epics.filter((e) => e.stage === 'Clarified').length).toBeGreaterThanOrEqual(46);
  }, 600_000);
});
