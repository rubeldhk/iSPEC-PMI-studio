/**
 * `T1500`, `T1502`, `T1509`, `T1531` (EPIC-042, US1, US2, US5 — `R-042-12`) —
 * the hook sequences, executed by the harness through a real `pmi-studio`
 * server against the composed `AppModule`:
 *
 * - a `plan` round trip: registered with input digests, completed with output
 *   digests and a comment; the reserved sync refusal does not prevent
 *   completion (`FR-EXT-016`);
 * - an execution left non-terminal is found by the next begin and completed as
 *   `failed` (`FR-EXT-018`);
 * - a first run over three Epics with one confirmed split (Phase 4);
 * - strict refusal and a provisional record when unreachable (Phase 7).
 *
 * Written to FAIL before the harness (`T1501`) exists.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPlatformClient, createServer } from '@pmi/mcp-server';
import { readLastExecution, runBegin, runFinish, runFirstRun, tickedTasks, validateProvisionalRecord } from '@pmi/workspace-bundle';
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

async function mcp(credential: string, base = baseUrl): Promise<{ client: Client; close(): Promise<void> }> {
  const server = createServer(createPlatformClient({ baseUrl: base, credential }), { serverVersion: 'roundtrip' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'roundtrip', version: '1.0.0' });
  await server.connect(st);
  await client.connect(ct);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

/** A directory shaped like the one provisioning leaves behind, minus the toolkit. */
function seedProjectDir(dir: string, id: string, constitution: string): void {
  mkdirSync(join(dir, '.pmi'), { recursive: true });
  mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
  writeFileSync(join(dir, '.pmi', 'project.json'), JSON.stringify({ schemaVersion: 1, projectId: id, workspaceId: 'ws_rt', projectName: 'Alpha', platformUrl: baseUrl, agentIntegration: 'claude', scriptType: 'sh', engineTag: 'v0.14.3', bundleVersion: '0.2.0', provisionedBy: 'pmi-studio' }, null, 2));
  writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), constitution, 'utf8');
  mkdirSync(join(dir, 'specs', '007-intake'), { recursive: true });
  writeFileSync(join(dir, 'specs', '007-intake', 'spec.md'), '# Intake\n', 'utf8');
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-rt-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_rt', userId: 'u_owner' });
  await started.app.listen(0);
  baseUrl = await started.app.getUrl();
  const api = started.app.getHttpServer();
  const a = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha', scriptType: 'sh' }).expect(201);
  projectId = a.body.id;
  token = a.body.connectorCredential.value;
  const constitution = await request(api).get(`/v1/projects/${projectId}/constitution`).set('Cookie', started.cookie).expect(200);
  projectDir = mkdtempSync(join(tmpdir(), 'pmi-rt-dir-'));
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

suite('T1500 · a plan round trip through the hooks', () => {
  it('begin registers with the input digests; finish completes with the output digests and a comment; the reserved sync does not block', async () => {
    const m = await mcp(token);
    try {
      const begun = await runBegin(m.client, projectDir, { command: 'plan', epic: '7', epicDir: 'specs/007-intake', toolkitVersion: 'v0.14.3' });
      expect(begun.refused).toBeNull();
      expect(begun.executionId).toMatch(/\S/);
      expect(begun.lines).toContain('PMI · constitution current');
      expect(begun.lines.at(-1)).toBe(`PMI · registered ${begun.executionId} (plan, 7)`);
      expect(readLastExecution(projectDir)?.executionId).toBe(begun.executionId);

      // The stock command writes plan.md.
      writeFileSync(join(projectDir, 'specs', '007-intake', 'plan.md'), '# Plan\n', 'utf8');
      const finished = await runFinish(m.client, projectDir, 'specs/007-intake');
      expect(finished.outcome).toBe('completed');
      expect(finished.added).toEqual(['specs/007-intake/plan.md']);
      // 2026-09-19 — `pmi.artifacts.sync` is live (EPIC-045), so the finish
      // hook no longer reports the reservation this line used to expect; it
      // syncs and says nothing. What the title still promises is that the sync
      // step does not block completion: no unavailability, no refusal.
      expect(finished.lines.filter((l) => /PMI · (sync not available|refused)/.test(l))).toEqual([]);
      expect(finished.lines.at(-1)).toBe(`PMI · completed ${begun.executionId} (completed)`);
      expect(readLastExecution(projectDir)).toBeNull();

      const api = started.app.getHttpServer();
      const timeline = await request(api).get(`/v1/projects/${projectId}/executions`).set('Cookie', started.cookie).expect(200);
      const entry = (timeline.body.items as { executionId: string; command: string; surface: string; state: string }[]).find((e) => e.executionId === begun.executionId);
      expect(entry).toMatchObject({ command: 'plan', surface: 'mcp-client', state: 'completed' });
      const history = await m.client.callTool({ name: 'pmi.execution.history', arguments: { executionId: begun.executionId } });
      const text = JSON.stringify(history.structuredContent);
      expect(text).toMatch(/"command":"plan"/);
      expect(entry?.state).toBe('completed');
    } finally {
      await m.close();
    }
  });

  it('T1502 · an execution left open is found by the next begin and completed as failed before registering (FR-EXT-018)', async () => {
    const m = await mcp(token);
    try {
      const first = await runBegin(m.client, projectDir, { command: 'tasks', epic: '7', epicDir: 'specs/007-intake' });
      expect(first.executionId).toMatch(/\S/);
      // The stock command was interrupted: finish never ran; last-execution remains.
      const second = await runBegin(m.client, projectDir, { command: 'analyze', epic: '7', epicDir: 'specs/007-intake' });
      expect(second.lines.some((l) => l.startsWith(`PMI · left open ${first.executionId} from`))).toBe(true);
      expect(second.lines).toContain(`PMI · completed ${first.executionId} (failed)`);
      expect(second.executionId).not.toBe(first.executionId);
      const history = await m.client.callTool({ name: 'pmi.execution.history', arguments: { executionId: first.executionId } });
      expect(JSON.stringify(history.structuredContent)).toMatch(/"(lifecycleState|state)":"failed"/);
      // A terminal one is not touched: finish the second, then a third begin finds nothing open.
      await runFinish(m.client, projectDir, 'specs/007-intake');
      const third = await runBegin(m.client, projectDir, { command: 'converge', epic: '7', epicDir: 'specs/007-intake' });
      expect(third.lines.some((l) => l.startsWith('PMI · left open'))).toBe(false);
      await runFinish(m.client, projectDir, 'specs/007-intake');
    } finally {
      await m.close();
    }
  });

  it('a directory without .pmi/project.json refuses and registers nothing', async () => {
    const m = await mcp(token);
    const bare = mkdtempSync(join(tmpdir(), 'pmi-rt-bare-'));
    try {
      const begun = await runBegin(m.client, bare, { command: 'plan' });
      expect(begun.refused?.code).toBe('not_provisioned');
      expect(begun.lines[0]).toMatch(/^PMI · refused not_provisioned: /);
    } finally {
      await m.close();
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it('implement: tasks ticked during the run become progress events and the outcome is partially-completed while tasks remain', async () => {
    const m = await mcp(token);
    try {
      const tasksPath = join(projectDir, 'specs', '007-intake', 'tasks.md');
      writeFileSync(tasksPath, '- [X] T001 done before\n- [ ] T002 to do\n- [ ] T003 to do\n', 'utf8');
      const begun = await runBegin(m.client, projectDir, { command: 'implement', epic: '7', epicDir: 'specs/007-intake' });
      expect(readLastExecution(projectDir)?.tickedTasks).toEqual(['T001']);
      writeFileSync(tasksPath, '- [X] T001 done before\n- [X] T002 done now\n- [ ] T003 to do\n', 'utf8');
      expect(tickedTasks(readFileSync(tasksPath, 'utf8'))).toEqual(['T001', 'T002']);
      const finished = await runFinish(m.client, projectDir, 'specs/007-intake');
      expect(finished.progressEvents, finished.lines.join(' | ')).toEqual(['T002']);
      expect(finished.outcome, finished.lines.join(' | ')).toBe('partially-completed');
      const history = await m.client.callTool({ name: 'pmi.execution.history', arguments: { executionId: begun.executionId as string } });
      const text = JSON.stringify(history.structuredContent);
      expect(text).toContain('progress-reported');
      expect(finished.progressEvents).toEqual(['T002']);
    } finally {
      await m.close();
    }
  });
});

suite('T1531 · unreachable platform: strict refuses, provisional queues (US5)', () => {
  it('strict: the begin refuses naming the address and the mode; nothing is written', async () => {
    rmSync(join(projectDir, '.pmi', 'last-execution'), { force: true });
    const m = await mcp(token, 'http://127.0.0.1:9');
    try {
      const before = existsSync(join(projectDir, '.pmi', 'provisional')) ? readdirSync(join(projectDir, '.pmi', 'provisional')).length : 0;
      const begun = await runBegin(m.client, projectDir, { command: 'clarify', epic: '7', epicDir: 'specs/007-intake' });
      expect(begun.refused?.code).toBe('platform_unreachable');
      expect(begun.lines[0]).toMatch(/offline mode is strict/);
      expect(begun.lines[0]).toContain(baseUrl);
      const after = existsSync(join(projectDir, '.pmi', 'provisional')) ? readdirSync(join(projectDir, '.pmi', 'provisional')).length : 0;
      expect(after).toBe(before);
      expect(readLastExecution(projectDir)).toBeNull();
    } finally {
      await m.close();
    }
  });

  it('provisional: a record with a client-generated id and the queued event exists before the command runs; every line says not governed; on reconnect the queue is offered and the reserved refusal reported once', async () => {
    const api = started.app.getHttpServer();
    await request(api).put(`/v1/projects/${projectId}/policy`).set('Cookie', started.cookie).send({ oneSpecPerEpic: true, taskCeiling: 50, splitRequiresConfirmation: true, offlineMode: 'provisional' }).expect(200);
    const online = await mcp(token);
    try {
      // Refresh the file so its Governed Execution section says provisional.
      const refreshed = await runBegin(online.client, projectDir, { command: 'checklist', epic: '7', epicDir: 'specs/007-intake' });
      expect(refreshed.lines, refreshed.lines.join(' | ')).toContain('PMI · constitution stale→refreshed');
      await runFinish(online.client, projectDir, 'specs/007-intake');
    } finally {
      await online.close();
    }
    expect(readFileSync(join(projectDir, '.specify', 'memory', 'constitution.md'), 'utf8')).toContain('Offline mode: provisional');

    const offline = await mcp(token, 'http://127.0.0.1:9');
    try {
      const begun = await runBegin(offline.client, projectDir, { command: 'clarify', epic: '7', epicDir: 'specs/007-intake' });
      expect(begun.provisional).toBe(true);
      expect(begun.executionId).toMatch(/^prov_/);
      expect(begun.lines.at(-1)).toBe(`PMI · queued ${begun.executionId} (not governed)`);
      const file = join(projectDir, '.pmi', 'provisional', `${begun.executionId}.json`);
      const record = JSON.parse(readFileSync(file, 'utf8')) as { events: { type: string }[]; governed: boolean };
      expect(validateProvisionalRecord(record)).toEqual({ ok: true });
      expect(record.events[0]?.type).toBe('execution-sync-queued');
      expect(record.governed).toBe(false);
      const finished = await runFinish(offline.client, projectDir, 'specs/007-intake');
      expect(finished.lines.at(-1)).toBe(`PMI · completed ${begun.executionId} (completed) (not governed)`);
      expect((JSON.parse(readFileSync(file, 'utf8')) as { events: { type: string }[] }).events.map((e) => e.type)).toEqual(['execution-sync-queued', 'lifecycle.completed']);
    } finally {
      await offline.close();
    }

    const back = await mcp(token);
    try {
      const begun = await runBegin(back.client, projectDir, { command: 'plan', epic: '7', epicDir: 'specs/007-intake' });
      expect(begun.lines.filter((l) => l.startsWith('PMI · sync not available until'))).toEqual(['PMI · sync not available until EPIC-037']);
      expect(readdirSync(join(projectDir, '.pmi', 'provisional'))).toHaveLength(1);
      await runFinish(back.client, projectDir, 'specs/007-intake');
    } finally {
      await back.close();
    }
  });
});

suite('T1544 · two sessions: the first-run loop refuses while another first-run execution is open (Phase 9)', () => {
  it('registers nothing, keeps the marker and names the open execution; after it completes the loop may start', async () => {
    rmSync(join(projectDir, '.pmi', 'last-execution'), { force: true });
    writeFileSync(join(projectDir, '.pmi', 'first-run'), '2026-09-05T00:00:00Z corr\n', 'utf8');
    const other = await mcp(token);
    const mine = await mcp(token);
    try {
      // Session A registers a specify and does not finish it.
      const open = await runBegin(other.client, projectDir, { command: 'specify', epic: '7', epicDir: 'specs/007-intake' });
      expect(open.executionId).toMatch(/\S/);
      const sessionA = readFileSync(join(projectDir, '.pmi', 'last-execution'), 'utf8');
      rmSync(join(projectDir, '.pmi', 'last-execution'), { force: true }); // session B has no record of A's registration
      // Session B starts a first run.
      const refused = await runFirstRun(mine.client, projectDir, { estimate: () => 1, decide: () => ({ decision: 'confirmed' }), runStock: async () => undefined, decidedBy: 'u_owner' });
      expect(refused.executions).toEqual([]);
      expect(refused.lines).toEqual([`PMI · refused first_run_in_progress: ${open.executionId} is still open — complete it or wait, then run the first specify again`]);
      expect(existsSync(join(projectDir, '.pmi', 'first-run'))).toBe(true);
      // Session A completes through its own finish hook; B's next attempt is no longer refused for that reason.
      writeFileSync(join(projectDir, '.pmi', 'last-execution'), sessionA, 'utf8');
      const completed = await runFinish(other.client, projectDir, 'specs/007-intake');
      expect(completed.outcome).toBe('completed');
      const again = await runFirstRun(mine.client, projectDir, { estimate: () => 1, decide: () => ({ decision: 'confirmed' }), runStock: async () => undefined, decidedBy: 'u_owner' });
      expect(again.lines.some((l) => l.startsWith('PMI · refused first_run_in_progress'))).toBe(false);
    } finally {
      await other.close();
      await mine.close();
      rmSync(join(projectDir, '.pmi', 'first-run'), { force: true });
    }
  });
});
