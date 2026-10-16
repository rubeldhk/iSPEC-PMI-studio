/**
 * `T2408` (EPIC-048, `R-048-22`, `PP-018`; analysis `C4`) — the performance
 * targets, measured on the composed application against PostgreSQL.
 *
 * | Operation | Target (p95) |
 * |---|---|
 * | Submit (incl. the decision request) | < 800 ms; < 400 ms without it |
 * | Candidate detail (5 citations, 20 corroborations, a superseded entry) | < 500 ms |
 * | Review → materialised | < 600 ms |
 * | One resolve sweep → materialised (so ≤ 60 s from `EPIC-031`'s Inbox at a 30 s interval) | < 600 ms |
 * | Approval → reindex attempted | < 5 s |
 * | Admission, 200 knowledge candidates | < 25 ms |
 * | Knowledge browser page at 5,000 entries | < 1 s |
 * | History at 50 versions | < 300 ms |
 *
 * Measured, not asserted from a design: the numbers are logged as well as
 * checked, so a regression shows its size. Timings are per-request wall clock in
 * a container on a shared machine — the targets carry their own headroom.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLearningApp, type LearningApp } from '../helpers/learning-app.js';
import { DecisionRecorder, POLICY } from '../helpers/learning-ports.js';
import { DbDecisionRecorder } from '../helpers/learning-decisions-db.js';
import { DIGEST } from '../helpers/learning-fixtures.js';
import type { LearningJobs } from '../../src/modules/learning/learning.jobs.js';
import type { KnowledgeGate } from '../../src/modules/learning/supply.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const WS = 'ws_perf';

let app: LearningApp;
let decisions: DecisionRecorder;
let reviewer = '';
const reindexAt: number[] = [];

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const out = await fn();
  return [out, performance.now() - t0];
}

beforeAll(async () => {
  if (noRuntime) return;
  app = await startLearningApp({ workspaceId: WS, policy: { ...POLICY, maxCandidatesPerExecution: 500 } });
  app.bindNotAnExpert();
  app.bindEvidence(['ev_1', 'ev_2', 'ev_3', 'ev_4', 'ev_5']);
  // T2393 — decisions are written to policy_decisions, which the version trigger reads.
  decisions = new DbDecisionRecorder(app.db, 'ws_perf');
  app.ports.decisions = decisions;
  app.ports.attestations = { async contribute() { return { evidenceId: 'att' }; } };
  app.ports.readerAccess = { async canRead() { return true; } };
  app.ports.index = { async reindex() { reindexAt.push(performance.now()); return { outcome: 'indexed' }; } };
  reviewer = await app.cookieFor('u_rev');
}, 600_000);

afterAll(async () => {
  await app?.close();
}, 120_000);

suite('T2408 · R-048-22 targets', () => {
  it('submission p95 < 800 ms with the decision request, < 400 ms without it', async () => {
    const withDecision: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const [, ms] = await timed(() => app.submit(app.body({ subject: `perf ${i}` })).expect(201));
      withDecision.push(ms);
    }
    const real = app.ports.decisions;
    app.ports.decisions = { ...real, decide: async () => { throw new Error('measuring without the decision request'); } };
    const without: number[] = [];
    try {
      for (let i = 0; i < 25; i += 1) {
        const [, ms] = await timed(() => app.submit(app.body({ subject: `perf-no-decision ${i}` })).expect(201));
        without.push(ms);
      }
    } finally {
      app.ports.decisions = real;
    }
    console.log(`R-048-22 submit p95: ${p95(withDecision).toFixed(1)} ms with decision, ${p95(without).toFixed(1)} ms without`);
    expect(p95(withDecision)).toBeLessThan(800);
    expect(p95(without)).toBeLessThan(400);
  });

  it('candidate detail < 500 ms with 5 citations, 20 corroborations and a superseded entry', async () => {
    const evidence = ['ev_1', 'ev_2', 'ev_3', 'ev_4', 'ev_5'].map((evidenceId) => ({ evidenceId, digest: { sha256: DIGEST } }));
    const base = await app.submit(app.body({ subject: 'detail base' })).expect(201);
    const approved = await app.api().post(`/v1/learning/candidates/${base.body.candidateId}/review`).set('Cookie', reviewer).send({ decision: 'approve' }).expect(200);
    const sup = await app.submit(app.body({ subject: 'detail base', kind: 'supersede', targetVersionId: approved.body.versionId, evidence })).expect(201);
    for (let i = 0; i < 20; i += 1) {
      const exe = await app.register(`reg_corr_${i}`);
      await app.submit(app.body({ executionId: exe, subject: 'detail base', kind: 'supersede', targetVersionId: approved.body.versionId, statement: `corroboration ${i}` })).expect(200);
    }
    const samples: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const [res, ms] = await timed(() => app.api().get(`/v1/learning/candidates/${sup.body.candidateId}`).set('Cookie', app.started.cookie).expect(200));
      expect(res.body.corroborations).toHaveLength(20);
      samples.push(ms);
    }
    console.log(`R-048-22 candidate detail p95: ${p95(samples).toFixed(1)} ms`);
    expect(p95(samples)).toBeLessThan(500);
  });

  it('review → materialised < 600 ms, and the reindex is attempted < 5 s after (C4)', async () => {
    const samples: number[] = [];
    const lags: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const sub = await app.submit(app.body({ subject: `review ${i}` })).expect(201);
      const before = reindexAt.length;
      const t0 = performance.now();
      await app.api().post(`/v1/learning/candidates/${sub.body.candidateId}/review`).set('Cookie', reviewer).send({ decision: 'approve' }).expect(200);
      samples.push(performance.now() - t0);
      expect(reindexAt.length).toBe(before + 1);
      lags.push(reindexAt[before]! - t0);
    }
    console.log(`R-048-22 review→materialised p95: ${p95(samples).toFixed(1)} ms; approval→reindex max ${Math.max(...lags).toFixed(1)} ms`);
    expect(p95(samples)).toBeLessThan(600);
    expect(Math.max(...lags)).toBeLessThan(5_000);
  });

  it('one resolve sweep materialises a decision taken in EPIC-031’s Inbox < 600 ms (≤ 60 s end to end at 30 s) (C4)', async () => {
    const { LearningJobs: Jobs } = await import('../../src/modules/learning/learning.jobs.js');
    const jobs = app.started.app.get(Jobs, { strict: false }) as LearningJobs;
    await jobs.run('learning.resolve-decisions', { workspaceId: WS }); // settle anything pending
    const sub = await app.submit(app.body({ subject: 'inbox decided' })).expect(201);
    decisions.resolveAs(sub.body.decisionId, { outcome: 'approved', actorKind: 'human', decidedBy: 'u_rev' });
    const [report, ms] = await timed(() => jobs.run('learning.resolve-decisions', { workspaceId: WS }));
    console.log(`R-048-22 resolve sweep (${report.examined} examined): ${ms.toFixed(1)} ms`);
    expect(report.changed).toBeGreaterThanOrEqual(1);
    expect(ms).toBeLessThan(600);
  });

  it('history < 300 ms at 50 versions', async () => {
    const first = await app.submit(app.body({ subject: 'long history' })).expect(201);
    let version = (await app.api().post(`/v1/learning/candidates/${first.body.candidateId}/review`).set('Cookie', reviewer).send({ decision: 'approve' }).expect(200)).body;
    for (let i = 2; i <= 50; i += 1) {
      const sup = await app.submit(app.body({ subject: 'long history', kind: 'supersede', targetVersionId: version.versionId, statement: `revision ${i}` })).expect(201);
      version = (await app.api().post(`/v1/learning/candidates/${sup.body.candidateId}/review`).set('Cookie', reviewer).send({ decision: 'approve' }).expect(200)).body;
    }
    expect(version.version).toBe(50);
    const samples: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const [res, ms] = await timed(() => app.api().get(`/v1/learning/knowledge/${version.entryId}/history`).set('Cookie', app.started.cookie).expect(200));
      expect(res.body.versions).toHaveLength(50);
      samples.push(ms);
    }
    console.log(`R-048-22 history@50 p95: ${p95(samples).toFixed(1)} ms`);
    expect(p95(samples)).toBeLessThan(300);
  }, 300_000);

  it('the knowledge browser page < 1 s at 5,000 entries', async () => {
    // 5,000 approved entries, written in bulk around the services (setup only).
    await app.db.query('BEGIN');
    await app.db.query(
      `INSERT INTO learning_candidates (id,"workspaceId","projectId",kind,statement,category,subject,"subjectKey","sourceKind","sourcePrincipalId","confidenceLevel","confidenceBasis","claimedScope","policyVersion","objectDigest","idempotencyKey","correlationId","submittedAt")
       SELECT 'blk_c_'||g, $1, $2, 'new', 'bulk statement '||g, 'architecture', 'bulk '||g, 'architecture:bulk '||g, 'person', 'u_owner', 'low', 'bulk', $3::jsonb, 1, $4, 'blk_i_'||g, 'blk', now()
         FROM generate_series(1,5000) g`,
      [WS, app.projectId, JSON.stringify({ kind: 'project', projectIds: [app.projectId] }), 'c'.repeat(64)],
    );
    await app.db.query(`INSERT INTO learning_candidate_evidence (id,"workspaceId","candidateId","evidenceId","digestAlgorithm",digest) SELECT 'blk_e_'||g, $1, 'blk_c_'||g, 'ev_1', 'sha256', $2 FROM generate_series(1,5000) g`, [WS, DIGEST]);
    await app.db.query(`INSERT INTO knowledge_entries (id,"workspaceId",category,"subjectKey","originProjectId") SELECT 'blk_k_'||g, $1, 'architecture', 'architecture:bulk '||g, $2 FROM generate_series(1,5000) g`, [WS, app.projectId]);
    // T2393 — each version names an EPIC-031 decision approving its own candidate.
    await app.db.query(`INSERT INTO decision_explanations (id,"workspaceId","policyVersion","riskClass","authorityApplied") SELECT 'blk_x_'||g, $1, '1', 'high', 'bulk setup' FROM generate_series(1,5000) g`, [WS]);
    await app.db.query(
      `INSERT INTO policy_decisions (id,"workspaceId","projectId","actionType","targetType","targetId","effectiveClass",outcome,"decidedBy","authorityBasis","objectVersion","decidedAt","actorKind","actorId","steeringVersions","policyVersion","requiredGates","gateOutcomes","explanationId")
       SELECT 'blk_d_'||g, $1, $2, 'learning.review.new', 'learning-candidate', 'blk_c_'||g, 'high', 'approved', 'u_rev', 'bulk setup', '1', now(), 'human', 'u_rev', '{}', 1, '[]', '[]', 'blk_x_'||g FROM generate_series(1,5000) g`,
      [WS, app.projectId],
    );
    await app.db.query(
      `INSERT INTO knowledge_entry_versions (id,"workspaceId","entryId",version,statement,"proposedStatement",scope,"proposedScope",classification,"candidateId","decisionId","approvedByKind","approvedBy","approvedAt")
       SELECT 'blk_v_'||g, $1, 'blk_k_'||g, 1, 'bulk statement '||g, 'bulk statement '||g, $2::jsonb, $2::jsonb, 'internal', 'blk_c_'||g, 'blk_d_'||g, 'human', 'u_rev', now() - (g || ' seconds')::interval
         FROM generate_series(1,5000) g`,
      [WS, JSON.stringify({ kind: 'project', projectIds: [app.projectId] })],
    );
    // T2690 — a status event names a decision EPIC-031 recorded, too: each version's own.
    await app.db.query(`INSERT INTO knowledge_version_status_events (id,"workspaceId","versionId",status,"actorId","decisionId",at) SELECT 'blk_s_'||g, $1, 'blk_v_'||g, 'current', 'u_rev', 'blk_d_'||g, now() FROM generate_series(1,5000) g`, [WS]);
    await app.db.query('COMMIT');
    await app.db.query('ANALYZE');

    const samples: number[] = [];
    for (const query of ['', '?status=current', `?projectId=${app.projectId}`, '?category=architecture', '?scope=project&status=current']) {
      for (let i = 0; i < 4; i += 1) {
        const [res, ms] = await timed(() => app.api().get(`/v1/learning/knowledge${query}`).set('Cookie', app.started.cookie).expect(200));
        expect(res.body.items.length).toBeGreaterThan(0);
        samples.push(ms);
      }
    }
    console.log(`R-048-22 browser page@5000 p95: ${p95(samples).toFixed(1)} ms`);
    expect(p95(samples)).toBeLessThan(1_000);
  }, 300_000);

  it('admission < 25 ms for 200 knowledge candidates, in one read', async () => {
    const { KnowledgeGate: Gate } = await import('../../src/modules/learning/supply.js');
    const gate = app.started.app.get(Gate, { strict: false }) as KnowledgeGate;
    const candidates = Array.from({ length: 200 }, (_, i) => ({ sourceId: `blk_k_${i + 1}`, sourceVersion: `blk_v_${i + 1}` }));
    await gate.admit(candidates, { workspaceId: WS, projectId: app.projectId }); // warm
    const samples: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const [verdicts, ms] = await timed(() => gate.admit(candidates, { workspaceId: WS, projectId: app.projectId }));
      expect(verdicts.every((v) => v.admitted)).toBe(true);
      samples.push(ms);
    }
    console.log(`R-048-22 admission@200 p95: ${p95(samples).toFixed(1)} ms`);
    expect(p95(samples)).toBeLessThan(25);
  });
});
