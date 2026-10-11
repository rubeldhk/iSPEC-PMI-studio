/**
 * `T2370` (EPIC-048, US4, `FR-LRN-031`, `-035`, `-042`, `-073`) — the knowledge
 * routes through the composed application, and the absence of any route that
 * writes knowledge.
 *
 * - `GET /learning/knowledge`, `/:entryId`, `/:entryId/history`;
 * - **no** `PUT`, `PATCH` or `DELETE` under `/learning/knowledge`;
 * - Q19: a supersession in a low-risk category still waits for a human, and once
 *   approved v1 reads `superseded`, naming v2;
 * - Q29: filter by `superseded`, open the history — every version, candidate and
 *   decision in order;
 * - no session is `401`; another workspace's entry is `404` (analysis `U1`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLearningApp, type LearningApp } from '../helpers/learning-app.js';
import { DecisionRecorder } from '../helpers/learning-ports.js';
import { DbDecisionRecorder } from '../helpers/learning-decisions-db.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let app: LearningApp;
let decisions: DecisionRecorder;
let reviewer = '';
const ids: { entryId: string; v1: string; v2: string } = { entryId: '', v1: '', v2: '' };

const get = (path: string, cookie = app.started.cookie) => app.api().get(`/v1/learning/knowledge${path}`).set('Cookie', cookie);

beforeAll(async () => {
  if (noRuntime) return;
  app = await startLearningApp({ workspaceId: 'ws_know' });
  app.bindNotAnExpert();
  app.bindEvidence();
  // T2393 — decisions are written to policy_decisions, which the version trigger reads.
  decisions = new DbDecisionRecorder(app.db, 'ws_know');
  app.ports.decisions = decisions;
  app.ports.attestations = { async contribute() { return { evidenceId: 'att' }; } };
  reviewer = await app.cookieFor('u_rev');
}, 600_000);

afterAll(async () => {
  await app?.close();
}, 120_000);

suite('T2370 · knowledge through the real routes', () => {
  it('v1: a candidate approved by a human through the review route', async () => {
    const res = await app.submit(app.body({ subject: 'the database starts first' })).expect(201);
    const out = await app.api().post(`/v1/learning/candidates/${res.body.candidateId}/review`).set('Cookie', reviewer).send({ decision: 'approve' }).expect(200);
    ids.entryId = out.body.entryId;
    ids.v1 = out.body.versionId;
    expect(out.body.version).toBe(1);
  });

  it('Q19 · a supersession in a low-risk category waits for a human regardless (FR-LRN-034) — then v1 reads superseded naming v2', async () => {
    decisions.next = 'auto-executed';
    let pending;
    try {
      pending = await app.submit(app.body({ subject: 'the database starts first', category: 'test-setup', kind: 'supersede', targetVersionId: ids.v1, statement: 'Start the database, then migrate, then test.' })).expect(201);
    } finally {
      decisions.next = 'pending';
    }
    expect(decisions.requests.at(-1)!.actionType).toBe('learning.review.supersede');
    // EPIC-031 auto-executed a review action; the guard refused it and asked again.
    expect(pending.body.state).toBe('proposed');
    const { LearningJobs } = await import('../../src/modules/learning/learning.jobs.js');
    await app.started.app.get(LearningJobs, { strict: false }).run('learning.request-pending', { workspaceId: 'ws_know' });
    const again = await app.api().get(`/v1/learning/candidates/${pending.body.candidateId}`).set('Cookie', reviewer).expect(200);
    expect(again.body.candidate.state).toBe('pending-review');
    expect(again.body.supersedes).toMatchObject({ versionId: ids.v1, statement: 'Integration tests need the local database started first.' });

    const out = await app.api().post(`/v1/learning/candidates/${pending.body.candidateId}/review`).set('Cookie', reviewer).send({ decision: 'approve' }).expect(200);
    ids.v2 = out.body.versionId;
    expect(out.body).toMatchObject({ entryId: ids.entryId, version: 2 });

    const entry = await get(`/${ids.entryId}`).expect(200);
    expect(entry.body.current).toMatchObject({ id: ids.v2, version: 2 });
    expect(entry.body.provenance.replaces).toMatchObject({ versionId: ids.v1, version: 1 });
    const superseded = await get('?status=superseded').expect(200);
    expect(superseded.body.items.map((i: { versionId: string; successorVersionId: string }) => [i.versionId, i.successorVersionId])).toEqual([[ids.v1, ids.v2]]);
  });

  it('Q29 · history: every version, the candidate and decision behind each, every status change, in order', async () => {
    const res = await get(`/${ids.entryId}/history`).expect(200);
    expect(res.body.versions.map((v: { version: number }) => v.version)).toEqual([1, 2]);
    expect(res.body.versions[0].candidate).toMatchObject({ kind: 'new', sourceKind: 'execution' });
    expect(res.body.versions[1].candidate).toMatchObject({ kind: 'supersede' });
    expect(res.body.versions[1].decision).toMatchObject({ approvedByKind: 'human', approvedBy: 'u_rev' });
    expect(res.body.events.map((e: { type: string }) => e.type)).toEqual(['approved', 'current', 'approved', 'current', 'superseded']);
  });

  it('browse filters by project, scope, category and status (FR-LRN-073)', async () => {
    expect((await get(`?projectId=${app.projectId}`).expect(200)).body.items).toHaveLength(2);
    expect((await get('?projectId=p_none').expect(200)).body.items).toEqual([]);
    expect((await get('?scope=project&status=current').expect(200)).body.items.map((i: { versionId: string }) => i.versionId)).toEqual([ids.v2]);
    // The category is the entry's (its first candidate's): both versions are architecture knowledge.
    expect((await get('?category=architecture').expect(200)).body.items).toHaveLength(2);
    expect((await get('?category=test-setup').expect(200)).body.items).toEqual([]);
    await get('?status=archived').expect(400);
  });

  describe('there is no route that writes knowledge (FR-LRN-031, FR-LRN-042, SC-LRN-001)', () => {
    it.each(['put', 'patch', 'delete'] as const)('%s /learning/knowledge/:entryId writes nothing', async (verb) => {
      const before = await app.db.query(`SELECT count(*)::int AS n FROM knowledge_entry_versions`);
      const res = await app.api()[verb](`/v1/learning/knowledge/${ids.entryId}`).set('Cookie', app.started.cookie).send({ statement: 'edited', scope: { kind: 'workspace' } });
      expect([200, 201, 204]).not.toContain(res.status);
      const after = await app.db.query(`SELECT count(*)::int AS n FROM knowledge_entry_versions`);
      expect(after.rows[0].n).toBe(before.rows[0].n);
    });

    it('the composed application maps no write verb to any knowledge path (MP-1a’s route half)', () => {
      // Enumerated from the router the application actually built — not from source
      // text — so a route added by any module, under any controller, is seen.
      const instance = app.started.app.getHttpAdapter().getInstance() as { _router?: { stack: unknown[] }; router?: { stack: unknown[] } };
      const stack = (instance._router ?? instance.router)?.stack ?? [];
      const routes = (stack as { route?: { path: string; methods: Record<string, boolean> } }[])
        .filter((l) => l.route !== undefined)
        .flatMap((l) => Object.keys(l.route!.methods).map((m) => `${m.toUpperCase()} ${l.route!.path}`));
      expect(routes.some((r) => r.startsWith('GET /v1/learning/knowledge'))).toBe(true);
      expect(routes.filter((r) => /knowledge/i.test(r) && !r.startsWith('GET '))).toEqual([]);
    });

    it('post /learning/knowledge writes nothing', async () => {
      const res = await app.api().post('/v1/learning/knowledge').set('Cookie', app.started.cookie).send({ statement: 'direct' });
      expect([200, 201]).not.toContain(res.status);
    });
  });

  describe('who may read (U1)', () => {
    it('no session → 401', async () => {
      await app.api().get('/v1/learning/knowledge').expect(401);
      await app.api().get(`/v1/learning/knowledge/${ids.entryId}`).expect(401);
      await app.api().get(`/v1/learning/knowledge/${ids.entryId}/history`).expect(401);
    });

    it('another workspace’s entry → 404, and its browse is empty', async () => {
      const elsewhere = await app.cookieFor('u_x', 'ws_other');
      await get(`/${ids.entryId}`, elsewhere).expect(404);
      await get(`/${ids.entryId}/history`, elsewhere).expect(404);
      expect((await get('', elsewhere).expect(200)).body.items).toEqual([]);
    });
  });
});
