/**
 * `T1351` (EPIC-041) — provisioning through the real routes, against the real
 * application, into a real directory.
 *
 * Constitution XI Tier 1. `SC-LPW-002`, `SC-LPW-005`, quickstart Scenarios 1, 2,
 * 3 and 6 — and the worker's half, finalised through the barrel the worker uses
 * (`finaliseInitialisation`), because this test has no `uv` and pretends to
 * none: it records what a worker would have recorded and asserts the project
 * reads *provisioned* afterwards.
 *
 * Written to FAIL before `T1350` exists.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;
let root: string;

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-route-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_prov', userId: 'u_prov' });
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
}, 120_000);

suite('T1351 · provisioning through the routes', () => {
  it('Scenario 1 — a project with a root path becomes a prepared directory', async () => {
    const api = started.app.getHttpServer();
    const res = await request(api)
      .post('/v1/projects')
      .set('Cookie', started.cookie)
      .send({ name: 'Alpha', rootPath: 'alpha', agentIntegration: 'claude', scriptType: 'sh' })
      .expect(201);
    expect(res.body.provisioningState).toBe('prepared');
    expect(res.body.rootPath).toBe(join(root, 'alpha'));

    const dir = join(root, 'alpha');
    for (const f of ['.git', '.pmi/project.json', '.mcp.json', '.claude/skills/setup-PMIStudio/SKILL.md']) {
      expect(existsSync(join(dir, f)), `${f} missing`).toBe(true);
    }
    const projectJson = JSON.parse(readFileSync(join(dir, '.pmi', 'project.json'), 'utf8'));
    expect(projectJson).toMatchObject({ schemaVersion: 1, projectId: res.body.id, platformUrl: 'http://localhost:3000', agentIntegration: 'claude' });
    const mcp = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
    expect(mcp.mcpServers['pmi-studio'].env.PMI_STUDIO_TOKEN).toBe('${PMI_STUDIO_TOKEN}');

    // FR-033 — the action and its audit entry both exist. The first run of this
    // test found the writer unbound: every audited action under a database was 500.
    const { prismaClient } = await import('../../src/persistence/prisma.js');
    const audited = await prismaClient().auditEntry.findMany({ where: { workspaceId: 'ws_prov', targetType: 'project', targetId: res.body.id } });
    expect(audited.map((a) => (a.detail as { kind?: string } | null)?.kind)).toContain('provision');

    const history = await request(api).get(`/v1/projects/${res.body.id}/provisioning`).set('Cookie', started.cookie).expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ outcome: 'succeeded', failedStep: null });
    expect(history.body[0].stepsCompleted).toContain('queue_initialise');
  });

  it('Scenario 2 — a path outside the root is refused naming the root, with no row and no file', async () => {
    const api = started.app.getHttpServer();
    const before = (await request(api).get('/v1/projects').set('Cookie', started.cookie)).body.length;
    const res = await request(api)
      .post('/v1/projects')
      .set('Cookie', started.cookie)
      .send({ name: 'Elsewhere', rootPath: '/tmp/elsewhere-pmi' })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/outside the projects root/);
    expect(existsSync('/tmp/elsewhere-pmi')).toBe(false);
    const after = (await request(api).get('/v1/projects').set('Cookie', started.cookie)).body.length;
    expect(after).toBe(before);
  });

  it('Scenario 3 — a non-empty directory is refused by name; an empty git repository is adopted', async () => {
    const api = started.app.getHttpServer();
    mkdirSync(join(root, 'busy'));
    writeFileSync(join(root, 'busy', 'README.md'), 'hi');
    const refused = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Busy', rootPath: 'busy' }).expect(400);
    expect(JSON.stringify(refused.body)).toMatch(/busy/);
    expect(readdirSync(join(root, 'busy'))).toEqual(['README.md']);

    mkdirSync(join(root, 'empty-repo', '.git'), { recursive: true });
    const adopted = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Adopted', rootPath: 'empty-repo' }).expect(201);
    expect(adopted.body.provisioningState).toBe('prepared');
  });

  it('Scenario 6 — re-provisioning a prepared project writes nothing', async () => {
    const api = started.app.getHttpServer();
    const created = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Twice', rootPath: 'twice' }).expect(201);
    const before = readFileSync(join(root, 'twice', '.pmi', 'project.json'), 'utf8');
    const again = await request(api).post(`/v1/projects/${created.body.id}/provision`).set('Cookie', started.cookie).send({ rootPath: 'twice' }).expect(200);
    expect(again.body.record.outcome).toBe('no_change');
    expect(again.body.record.filesWritten).toEqual([]);
    expect(readFileSync(join(root, 'twice', '.pmi', 'project.json'), 'utf8')).toBe(before);
  });

  it('the worker\'s half, finalised through the barrel, moves the project to provisioned (SC-LPW-002)', async () => {
    const api = started.app.getHttpServer();
    const created = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Finalised', rootPath: 'finalised' }).expect(201);
    const jobs = await request(api).get(`/v1/projects/${created.body.id}/jobs`).set('Cookie', started.cookie).expect(200);
    const job = (jobs.body as { id: string; kind: string }[]).find((j) => j.kind === 'initialise_workspace');
    expect(job, 'the initialise job was not queued').toBeDefined();

    const { finaliseInitialisation } = await import('../../src/worker-api.js');
    await finaliseInitialisation(job!.id, {
      ok: true,
      stepsCompleted: ['run_engine_init', 'copy_extension', 'register_hooks', 'verify_structure'],
      filesWritten: ['.specify/extensions/pmi/extension.yml'],
      engineTag: 'v0.16.4',
      bundleVersion: '0.1.0',
    });

    const after = await request(api).get(`/v1/projects/${created.body.id}`).set('Cookie', started.cookie).expect(200);
    expect(after.body.provisioningState).toBe('provisioned');
    expect(after.body.provisionedAt).toBeTruthy();
    expect(after.body.latestProvisioning).toMatchObject({ outcome: 'succeeded', engineTag: 'v0.16.4' });
    expect(after.body.latestProvisioning.stepsCompleted).toContain('verify_structure');
  });

  it('a failed worker half names its step and leaves the project failed', async () => {
    const api = started.app.getHttpServer();
    const created = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Broken', rootPath: 'broken' }).expect(201);
    const jobs = await request(api).get(`/v1/projects/${created.body.id}/jobs`).set('Cookie', started.cookie).expect(200);
    const job = (jobs.body as { id: string; kind: string }[]).find((j) => j.kind === 'initialise_workspace')!;
    const { finaliseInitialisation } = await import('../../src/worker-api.js');
    await finaliseInitialisation(job.id, {
      ok: false, failedStep: 'run_engine_init', reason: 'initialiser_unavailable: uv is not on PATH',
      stepsCompleted: [], filesWritten: [], engineTag: 'v0.16.4', bundleVersion: '0.1.0',
    });
    const after = await request(api).get(`/v1/projects/${created.body.id}`).set('Cookie', started.cookie).expect(200);
    expect(after.body.provisioningState).toBe('failed');
    expect(after.body.latestProvisioning).toMatchObject({ outcome: 'failed', failedStep: 'run_engine_init' });
  });
});
