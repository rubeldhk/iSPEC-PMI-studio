/**
 * `T1572` (EPIC-044, `contracts/epics-api.md` §1, `FR-EPB-020`–`FR-EPB-029`) —
 * the Epic routes through the composed `AppModule` with a real session and a
 * real database: numbers allocated and never reused, concurrent creates
 * distinct, assignment rules, the owner gate against a second member, the
 * requirement list carrying its Epic, audit rows. Written to FAIL before `T1573`.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let started: AuthenticatedApp;
let root: string;
let projectId = '';
let writerCookie = '';
const refs: Record<string, string> = {};

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-epics-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  process.env['PMI_PUBLIC_URL'] = 'http://localhost:3000';
  started = await startAuthenticatedApp({ workspaceId: 'ws_epics', userId: 'u_owner' });
  const api = started.app.getHttpServer();
  const p = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha', scriptType: 'sh' }).expect(201);
  projectId = p.body.id;
  for (const reference of ['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004']) {
    const r = await request(api).post(`/v1/projects/${projectId}/requirements`).set('Cookie', started.cookie).send({ reference, description: `${reference} shall`, type: 'functional', priority: 'p1' }).expect(201);
    refs[reference] = r.body.id;
  }
  // A second member of the workspace with no grant on the project.
  const db = new Client({ connectionString: started.databaseUrl });
  await db.connect();
  await db.query(`INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt") VALUES ($1,$2,$3,'Writer','unused',now())`, ['u_writer', 'ws_epics', 'u_writer@example.test']);
  await db.end();
  const { SessionService } = await import('../../src/modules/auth/sessions.js');
  const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
  const session = started.app.get(SessionService, { strict: false }).create({ userId: 'u_writer', workspaceId: 'ws_epics', email: 'u_writer@example.test', displayName: 'Writer' });
  writerCookie = `${SESSION_COOKIE}=${session.token}`;
}, 600_000);

afterAll(async () => {
  await started?.close();
  rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
  delete process.env['PMI_PUBLIC_URL'];
}, 120_000);

suite('T1572 · Epics through the composed application', () => {
  const epics: Record<string, string> = {};
  /**
   * The number each Epic actually received, recorded rather than assumed.
   *
   * 2026-10-01 — the first test creates two Epics **in parallel on purpose**
   * (`FR-EPB-021`: concurrent creates receive distinct numbers), so which of
   * them gets 2 and which gets 3 is decided by the race. Every later assertion
   * hardcoded `Review` as 2 and `Reports` as 3, which held only while `Review`
   * happened to win. When `Reports` won, the requirement counts came back
   * `[[1,1],[2,0],[3,1]]`, the close assertion missed, and the fourth Epic was
   * never created — so the owner-gate test failed too, on a cascade.
   *
   * It read as load sensitivity (it fails in a full run and passes alone, which
   * is `DEF-030-002`'s shape) and it is not: the premise is nondeterministic and
   * the expectation was fixed. Load only changes how often the race goes the
   * other way. The first CI run ever to reach the Integration step failed on it.
   *
   * What the Epic requires is that the two numbers are distinct and that the
   * list is ordered by number — both still asserted, neither dependent on who
   * won.
   */
  const numberOf: Record<string, number> = {};

  it('creates three Epics numbered 1, 2, 3 with derived slugs; two parallel creates receive distinct numbers', async () => {
    const api = started.app.getHttpServer();
    const a = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Intake & Triage', description: 'First.' }).expect(201);
    expect(a.body).toMatchObject({ number: 1, slug: 'intake-triage', status: 'active' });
    epics['a'] = a.body.id;
    numberOf['a'] = a.body.number;
    const [b, c] = await Promise.all([
      request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Review' }),
      request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Reports' }),
    ]);
    expect([b.status, c.status]).toEqual([201, 201]);
    expect([b.body.number, c.body.number].sort()).toEqual([2, 3]);
    const review = b.body.title === 'Review' ? b.body : c.body;
    const reports = b.body.title === 'Reports' ? b.body : c.body;
    epics['b'] = review.id;
    epics['c'] = reports.id;
    numberOf['b'] = review.number;
    numberOf['c'] = reports.number;
  });

  it('assigns, moves and unassigns a requirement; the requirement list carries the Epic; unassigned are listed', async () => {
    const api = started.app.getHttpServer();
    await request(api).put(`/v1/requirements/${refs['REQ-001']}/epic`).set('Cookie', started.cookie).send({ epicId: epics['a'] }).expect(200);
    await request(api).put(`/v1/requirements/${refs['REQ-002']}/epic`).set('Cookie', started.cookie).send({ epicId: epics['a'] }).expect(200);
    await request(api).put(`/v1/requirements/${refs['REQ-002']}/epic`).set('Cookie', started.cookie).send({ epicId: epics['b'] }).expect(200);
    const list = await request(api).get(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).expect(200);
    // Ordered by number, and one requirement on `a`, one on `b`, none on `c` —
    // whichever of the two raced creates took which number.
    expect(list.body.epics.map((e: { number: number }) => e.number)).toEqual([1, 2, 3]);
    const counts = Object.fromEntries(
      (list.body.epics as { number: number; requirementCount: number }[]).map((e) => [e.number, e.requirementCount]),
    ) as Record<number, number>;
    expect(counts[numberOf['a']!]).toBe(1);
    expect(counts[numberOf['b']!]).toBe(1);
    expect(counts[numberOf['c']!]).toBe(0);
    expect(list.body.unassigned.map((r: { reference: string }) => r.reference)).toEqual(['REQ-003', 'REQ-004']);
    const requirements = await request(api).get(`/v1/projects/${projectId}/requirements`).set('Cookie', started.cookie).expect(200);
    const byRef = Object.fromEntries((requirements.body as { reference: string; epicId: string | null; epicNumber: number | null; epicTitle: string | null }[]).map((r) => [r.reference, r]));
    expect(byRef['REQ-002']).toMatchObject({ epicId: epics['b'], epicNumber: numberOf['b'], epicTitle: 'Review' });
    expect(byRef['REQ-003']).toMatchObject({ epicId: null, epicNumber: null, epicTitle: null });
    await request(api).put(`/v1/requirements/${refs['REQ-001']}/epic`).set('Cookie', started.cookie).send({ epicId: null }).expect(200);
    const detail = await request(api).get(`/v1/epics/${epics['a']}`).set('Cookie', started.cookie).expect(200);
    expect(detail.body.requirements).toEqual([]);
  });

  it('a closed Epic keeps its number, refuses assignment with epic_not_active, and the next number is 4', async () => {
    const api = started.app.getHttpServer();
    const closed = await request(api).post(`/v1/epics/${epics['c']}/close`).set('Cookie', started.cookie).expect(200);
    expect(closed.body).toMatchObject({ number: numberOf['c'], status: 'closed' });
    expect(closed.body.closedAt).toBeTruthy();
    const refused = await request(api).put(`/v1/requirements/${refs['REQ-003']}/epic`).set('Cookie', started.cookie).send({ epicId: epics['c'] }).expect(409);
    expect(refused.body.error.details.code).toBe('epic_not_active');
    const d = await request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', started.cookie).send({ title: 'Later' }).expect(201);
    expect(d.body.number).toBe(4);
    const filtered = await request(api).get(`/v1/projects/${projectId}/epics?status=closed`).set('Cookie', started.cookie).expect(200);
    expect(filtered.body.epics.map((e: { number: number }) => e.number)).toEqual([numberOf['c']]);
  });

  it('a member without the grant reads everything and is refused every write with owner_grant_required', async () => {
    const api = started.app.getHttpServer();
    const list = await request(api).get(`/v1/projects/${projectId}/epics`).set('Cookie', writerCookie).expect(200);
    expect(list.body.epics.length).toBeGreaterThanOrEqual(4);
    await request(api).get(`/v1/epics/${epics['a']}`).set('Cookie', writerCookie).expect(200);
    await request(api).get(`/v1/projects/${projectId}/epics/stages`).set('Cookie', writerCookie).expect(200);
    // Sequential on purpose: supertest binds the ephemeral port per request, and four
    // concurrent binds on one server race the address (ECONNREFUSED).
    const attempts = [
      (): request.Test => request(api).post(`/v1/projects/${projectId}/epics`).set('Cookie', writerCookie).send({ title: 'Nope' }),
      (): request.Test => request(api).patch(`/v1/epics/${epics['a']}`).set('Cookie', writerCookie).send({ title: 'Nope' }),
      (): request.Test => request(api).post(`/v1/epics/${epics['a']}/close`).set('Cookie', writerCookie),
      (): request.Test => request(api).put(`/v1/requirements/${refs['REQ-003']}/epic`).set('Cookie', writerCookie).send({ epicId: epics['a'] }),
    ];
    for (const attempt of attempts) {
      const res = await attempt();
      expect(res.status).toBe(403);
      expect(res.body.error.details.code).toBe('owner_grant_required');
    }
  });

  it('edit keeps the number and follows the title with the slug; every write is audited', async () => {
    const api = started.app.getHttpServer();
    const edited = await request(api).patch(`/v1/epics/${epics['a']}`).set('Cookie', started.cookie).send({ title: 'Intake and triage' }).expect(200);
    expect(edited.body).toMatchObject({ number: 1, slug: 'intake-and-triage' });
    const db = new Client({ connectionString: started.databaseUrl });
    await db.connect();
    const audits = await db.query<{ detail: { operation?: string } }>(`SELECT "detail" FROM "audit_entries" WHERE "workspaceId" = $1`, ['ws_epics']);
    await db.end();
    const operations = audits.rows.map((r) => r.detail?.operation).filter(Boolean);
    for (const op of ['epic.create', 'epic.update', 'epic.close', 'requirement.assign_epic']) expect(operations, op).toContain(op);
  });
});
