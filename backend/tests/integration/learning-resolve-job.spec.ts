/**
 * `T2358` (EPIC-048, `R-048-7`, `FR-LRN-063`, `R-048-6` as amended for `I1`) —
 * the sweeps, driven through the job runner against the composed application.
 *
 * - `learning.resolve-decisions` reads `resolutionOf` for `pending-review`
 *   candidates and materialises, returns or closes each — the path a decision
 *   taken in `EPIC-031`'s own Inbox reaches knowledge by;
 * - `learning.request-pending` requests decisions after an outage and after a
 *   provisional execution is reconciled, and asks again for a candidate the
 *   approver guard returned — at most three decisions in all.
 *
 * `LearningDecisions` is a recorder bound visibly below (`EPIC-031` is unmerged);
 * it resolves decisions the way `EPIC-031`'s Inbox would, including recording an
 * agent's approval as `human` (`R-048-6`). Everything else is real: the store,
 * the writer, the triggers, audit, principals.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLearningApp, type LearningApp } from '../helpers/learning-app.js';
import { DecisionRecorder } from '../helpers/learning-ports.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import type { LearningJobs } from '../../src/modules/learning/learning.jobs.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let app: LearningApp;
let jobs: LearningJobs;
let decisions: DecisionRecorder;

async function state(candidateId: string): Promise<{ state: string; reason: string | null; decisionId: string | null }> {
  const r = await app.db.query(`SELECT state, reason, "decisionId" FROM learning_candidate_transitions WHERE "candidateId" = $1 ORDER BY seq DESC LIMIT 1`, [candidateId]);
  return r.rows[0];
}

beforeAll(async () => {
  if (noRuntime) return;
  app = await startLearningApp({ workspaceId: 'ws_jobs' });
  app.bindNotAnExpert();
  app.bindEvidence();
  decisions = new DecisionRecorder();
  app.ports.decisions = decisions;
  const { LearningJobs: Jobs } = await import('../../src/modules/learning/learning.jobs.js');
  jobs = app.started.app.get(Jobs, { strict: false });
}, 600_000);

afterAll(async () => {
  await app?.close();
}, 120_000);

suite('T2358 · learning.resolve-decisions', () => {
  it('materialises a decision a human approved in EPIC-031’s Inbox', async () => {
    const res = await app.submit(app.body()).expect(201);
    expect(res.body.state).toBe('pending-review');
    decisions.resolveAs(res.body.decisionId, { outcome: 'approved', actorKind: 'human', decidedBy: 'u_rev' });
    const report = await jobs.run('learning.resolve-decisions', { workspaceId: 'ws_jobs' });
    expect(report.outcome).toBe('succeeded');
    expect(await state(res.body.candidateId)).toMatchObject({ state: 'approved' });
    const v = await app.db.query(`SELECT "approvedByKind", "approvedBy" FROM knowledge_entry_versions WHERE "candidateId" = $1`, [res.body.candidateId]);
    expect(v.rows[0]).toEqual({ approvedByKind: 'human', approvedBy: 'u_rev' });
    const audit = await app.db.query(`SELECT count(*)::int AS n FROM audit_entries WHERE "targetType" = 'knowledge_entry_version' AND detail->>'candidateId' = $1`, [res.body.candidateId]);
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('Q14 · an agent’s approval, recorded by EPIC-031 as human, is not accepted: no entry, flagged, back to proposed (I1)', async () => {
    const res = await app.submit(app.body()).expect(201);
    decisions.resolveAs(res.body.decisionId, { outcome: 'approved', actorKind: 'human', decidedBy: app.agentPrincipalId });
    await jobs.run('learning.resolve-decisions', { workspaceId: 'ws_jobs' });
    expect(await state(res.body.candidateId)).toMatchObject({ state: 'proposed', reason: 'decision-not-accepted' });
    const v = await app.db.query(`SELECT 1 FROM knowledge_entry_versions WHERE "candidateId" = $1`, [res.body.candidateId]);
    expect(v.rowCount).toBe(0);
    const f = await app.db.query(`SELECT kind FROM knowledge_flags WHERE "candidateId" = $1`, [res.body.candidateId]);
    expect(f.rows.map((r: { kind: string }) => r.kind)).toEqual(['decision-not-accepted']);
  });

  it('a rejection closes the candidate as rejected, with the reviewer and reason', async () => {
    const res = await app.submit(app.body()).expect(201);
    decisions.resolveAs(res.body.decisionId, { outcome: 'refused', actorKind: 'human', decidedBy: 'u_rev', closure: { kind: 'rejected', reason: 'Not true here.' } });
    await jobs.run('learning.resolve-decisions', { workspaceId: 'ws_jobs' });
    expect(await state(res.body.candidateId)).toMatchObject({ state: 'rejected', reason: 'Not true here.' });
  });

  it('a still-pending decision is left alone', async () => {
    const res = await app.submit(app.body()).expect(201);
    await jobs.run('learning.resolve-decisions', { workspaceId: 'ws_jobs' });
    expect(await state(res.body.candidateId)).toMatchObject({ state: 'pending-review' });
  });

  it('reports a failure without throwing — one unreadable decision does not stop the sweep', async () => {
    const res = await app.submit(app.body()).expect(201);
    const real = app.ports.decisions;
    app.ports.decisions = { ...real, resolutionOf: refusingPorts().decisions.resolutionOf };
    try {
      const report = await jobs.run('learning.resolve-decisions', { workspaceId: 'ws_jobs' });
      expect(report.outcome).toBe('succeeded');
      expect(report.errors.join(' ')).toMatch(/LearningDecisions/);
    } finally {
      app.ports.decisions = real;
    }
    expect(await state(res.body.candidateId)).toMatchObject({ state: 'pending-review' });
  });
});

suite('T2358 · learning.request-pending', () => {
  it('after an outage — a candidate recorded while the decision path was down is asked for', async () => {
    app.ports.decisions = refusingPorts().decisions;
    const res = await app.submit(app.body()).expect(201);
    expect(res.body.state).toBe('proposed');
    expect(await state(res.body.candidateId)).toMatchObject({ reason: 'decision-path-unavailable' });
    // A second sweep while still down appends nothing new.
    await jobs.run('learning.request-pending', { workspaceId: 'ws_jobs' });
    const rows = await app.db.query(`SELECT count(*)::int AS n FROM learning_candidate_transitions WHERE "candidateId" = $1`, [res.body.candidateId]);
    expect(rows.rows[0].n).toBe(2);
    app.ports.decisions = decisions;
    await jobs.run('learning.request-pending', { workspaceId: 'ws_jobs' });
    expect(await state(res.body.candidateId)).toMatchObject({ state: 'pending-review' });
  });

  it('after reconciliation — a provisional execution’s candidate is asked for once it is governed (FR-LRN-063)', async () => {
    const real = app.ports.executions;
    let governed = false;
    app.ports.executions = {
      ...real,
      async describe(ws, id) {
        const f = await real.describe(ws, id);
        return f === null ? null : { ...f, governanceState: governed ? 'governed' : 'provisional' };
      },
    };
    try {
      const res = await app.submit(app.body()).expect(201);
      expect(res.body).toMatchObject({ state: 'proposed', provisional: true });
      const before = decisions.requests.length;
      await jobs.run('learning.request-pending', { workspaceId: 'ws_jobs' });
      expect(decisions.requests.length).toBe(before);
      governed = true;
      await jobs.run('learning.request-pending', { workspaceId: 'ws_jobs' });
      expect(decisions.requests.length).toBe(before + 1);
      expect(await state(res.body.candidateId)).toMatchObject({ state: 'pending-review' });
    } finally {
      app.ports.executions = real;
    }
  });

  it('I1 · a candidate the guard returned is asked for again — and no more than three decisions in all', async () => {
    const res = await app.submit(app.body()).expect(201);
    let decisionId = res.body.decisionId as string;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      decisions.resolveAs(decisionId, { outcome: 'approved', actorKind: 'human', decidedBy: app.agentPrincipalId });
      await jobs.run('learning.resolve-decisions', { workspaceId: 'ws_jobs' });
      expect(await state(res.body.candidateId)).toMatchObject({ state: 'proposed', reason: 'decision-not-accepted' });
      await jobs.run('learning.request-pending', { workspaceId: 'ws_jobs' });
      const now = await state(res.body.candidateId);
      if (attempt < 3) {
        expect(now).toMatchObject({ state: 'pending-review' });
        expect(now.decisionId).not.toBe(decisionId);
        decisionId = now.decisionId!;
      } else {
        // The third unaccepted decision is the last: it stays proposed, flagged, until it expires.
        expect(now).toMatchObject({ state: 'proposed', reason: 'decision-not-accepted' });
      }
    }
    const distinct = await app.db.query(`SELECT count(DISTINCT "decisionId")::int AS n FROM learning_candidate_transitions WHERE "candidateId" = $1`, [res.body.candidateId]);
    expect(distinct.rows[0].n).toBe(3);
  });

  it('a policy refusal is not asked again — the workspace has to change its policy', async () => {
    decisions.next = 'refused';
    try {
      const res = await app.submit(app.body()).expect(201);
      const before = decisions.requests.length;
      await jobs.run('learning.request-pending', { workspaceId: 'ws_jobs' });
      expect(decisions.requests.length).toBe(before);
      expect(await state(res.body.candidateId)).toMatchObject({ state: 'proposed', reason: 'decision-refused-by-policy' });
    } finally {
      decisions.next = 'pending';
    }
  });

  it('an unknown job name is refused, naming the jobs that exist', async () => {
    await expect(jobs.run('learning.nope' as never, {})).rejects.toThrow(/learning\.resolve-decisions/);
  });
});
