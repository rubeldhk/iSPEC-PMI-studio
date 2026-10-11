/**
 * `T2360` (EPIC-048, `FR-LRN-030`, US1 Edge Case *never decided*) — a candidate
 * nobody decides **expires**; its submitter may **withdraw** it. Neither is a
 * rejection, and both remain inspectable.
 *
 * - `learning.expire`, past the review window: a `pending-review` candidate's
 *   decision is refused through `LearningDecisions.refuse` with kind `expired`
 *   (`A-031-1`, the requesting automation closing its own request), so it leaves
 *   the Inbox; the candidate reads `expired`. A `proposed` one has no open
 *   decision and simply expires.
 * - `POST /learning/candidates/:id/withdraw` — the submitter only; reads
 *   `withdrawn`; `409` once terminal; `404` in another workspace.
 * - Until `A-031-1` exists (decision port unbound) a pending candidate cannot
 *   expire cleanly, and the job says so instead of pretending (`R-048-14`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLearningApp, type LearningApp } from '../helpers/learning-app.js';
import { DecisionRecorder } from '../helpers/learning-ports.js';
import { DbDecisionRecorder } from '../helpers/learning-decisions-db.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import type { LearningJobs } from '../../src/modules/learning/learning.jobs.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const DAY = 86_400_000;

let app: LearningApp;
let jobs: LearningJobs;
let decisions: DecisionRecorder;

async function latest(candidateId: string): Promise<{ state: string; reason: string | null; actorKind: string }> {
  const r = await app.db.query(`SELECT state, reason, "actorKind" FROM learning_candidate_transitions WHERE "candidateId" = $1 ORDER BY seq DESC LIMIT 1`, [candidateId]);
  return r.rows[0];
}

function personBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  const { executionId: _x, ...b } = app.body(over);
  return { ...b, projectId: app.projectId };
}

beforeAll(async () => {
  if (noRuntime) return;
  app = await startLearningApp({ workspaceId: 'ws_expire' });
  app.bindNotAnExpert();
  app.bindEvidence();
  // T2393 — decisions are written to policy_decisions, which the version trigger reads.
  decisions = new DbDecisionRecorder(app.db, 'ws_expire');
  app.ports.decisions = decisions;
  const { LearningJobs: Jobs } = await import('../../src/modules/learning/learning.jobs.js');
  jobs = app.started.app.get(Jobs, { strict: false });
}, 600_000);

afterAll(async () => {
  await app?.close();
}, 120_000);

suite('T2360 · learning.expire', () => {
  it('leaves a candidate inside the window alone', async () => {
    const res = await app.submit(app.body()).expect(201);
    await jobs.run('learning.expire', { workspaceId: 'ws_expire', asOf: new Date(Date.now() + 29 * DAY) });
    expect(await latest(res.body.candidateId)).toMatchObject({ state: 'pending-review' });
  });

  it('past the window: refuses its own decision as expired, and reads expired — not rejected', async () => {
    const res = await app.submit(app.body()).expect(201);
    const report = await jobs.run('learning.expire', { workspaceId: 'ws_expire', asOf: new Date(Date.now() + 31 * DAY) });
    expect(report.outcome).toBe('succeeded');
    expect(decisions.refusals.find((r) => r.decisionId === res.body.decisionId)).toMatchObject({ by: { kind: 'automation', id: 'learning-intake' }, kind: 'expired' });
    expect(await latest(res.body.candidateId)).toMatchObject({ state: 'expired', actorKind: 'platform' });
    const view = await app.api().get(`/v1/learning/candidates/${res.body.candidateId}`).set('Cookie', app.started.cookie).expect(200);
    expect(view.body.candidate.state).toBe('expired');
    expect(view.body.candidate.transitions.map((t: { state: string }) => t.state)).toEqual(['proposed', 'pending-review', 'expired']);
  });

  it('a proposed candidate past the window expires with no decision to close', async () => {
    decisions.next = 'refused';
    try {
      const res = await app.submit(app.body()).expect(201);
      const refusalsBefore = decisions.refusals.length;
      await jobs.run('learning.expire', { workspaceId: 'ws_expire', asOf: new Date(Date.now() + 31 * DAY) });
      expect(await latest(res.body.candidateId)).toMatchObject({ state: 'expired' });
      expect(decisions.refusals.length).toBe(refusalsBefore);
    } finally {
      decisions.next = 'pending';
    }
  });

  it('cannot expire a pending candidate cleanly while the decision path cannot refuse — says so, changes nothing (R-048-14)', async () => {
    const res = await app.submit(app.body()).expect(201);
    app.ports.decisions = { ...decisions, refuse: refusingPorts().decisions.refuse, decide: decisions.decide.bind(decisions), approve: decisions.approve.bind(decisions), resolutionOf: decisions.resolutionOf.bind(decisions) };
    try {
      const report = await jobs.run('learning.expire', { workspaceId: 'ws_expire', asOf: new Date(Date.now() + 31 * DAY) });
      expect(report.errors.join(' ')).toMatch(/LearningDecisions/);
      expect(await latest(res.body.candidateId)).toMatchObject({ state: 'pending-review' });
    } finally {
      app.ports.decisions = decisions;
    }
  });
});

suite('T2360 · POST /learning/candidates/:id/withdraw', () => {
  it('the submitter withdraws a pending candidate: its decision is closed, it reads withdrawn', async () => {
    const res = await app.api().post('/v1/learning/candidates').set('Cookie', app.started.cookie).send(personBody()).expect(201);
    expect(res.body.state).toBe('pending-review');
    const out = await app.api().post(`/v1/learning/candidates/${res.body.candidateId}/withdraw`).set('Cookie', app.started.cookie).expect(200);
    expect(out.body.state).toBe('withdrawn');
    expect(decisions.refusals.find((r) => r.decisionId === res.body.decisionId)).toMatchObject({ kind: 'withdrawn' });
    expect(await latest(res.body.candidateId)).toMatchObject({ state: 'withdrawn', actorKind: 'human' });
    const view = await app.api().get(`/v1/learning/candidates/${res.body.candidateId}`).set('Cookie', app.started.cookie).expect(200);
    expect(view.body.candidate.state).toBe('withdrawn');
  });

  it('anyone else is refused 403', async () => {
    const res = await app.api().post('/v1/learning/candidates').set('Cookie', app.started.cookie).send(personBody()).expect(201);
    await app.api().post(`/v1/learning/candidates/${res.body.candidateId}/withdraw`).set('Cookie', await app.cookieFor('u_rev')).expect(403);
  });

  it('an agent’s candidate is not a person’s to withdraw', async () => {
    const res = await app.submit(app.body()).expect(201);
    await app.api().post(`/v1/learning/candidates/${res.body.candidateId}/withdraw`).set('Cookie', app.started.cookie).expect(403);
  });

  it('409 once terminal; 404 in another workspace; 401 without a session', async () => {
    const res = await app.api().post('/v1/learning/candidates').set('Cookie', app.started.cookie).send(personBody()).expect(201);
    await app.api().post(`/v1/learning/candidates/${res.body.candidateId}/withdraw`).set('Cookie', app.started.cookie).expect(200);
    await app.api().post(`/v1/learning/candidates/${res.body.candidateId}/withdraw`).set('Cookie', app.started.cookie).expect(409);
    await app.api().post(`/v1/learning/candidates/${res.body.candidateId}/withdraw`).set('Cookie', await app.cookieFor('u_x', 'ws_other')).expect(404);
    await app.api().post(`/v1/learning/candidates/${res.body.candidateId}/withdraw`).expect(401);
  });
});
