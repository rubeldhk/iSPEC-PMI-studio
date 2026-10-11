/**
 * `T2362` (EPIC-048, US3) — the gate, through the composed application:
 * quickstart Q6, Q9–Q17.
 *
 * Bound in-test, visibly: `LearningDecisions` (a recorder doing what `EPIC-031`
 * does with a request — and nothing about who approves, which is this Epic's
 * check), `EvidenceReads`, `ExpertProvenance` (not an Expert session) and
 * `ApprovalAttestations` (a recorder). Real: the session, the connector route,
 * `EPIC-019` steering (the learning policy is edited through its own route for
 * Q11), `EPIC-028` principals (the agent in Q13 is the credential's own
 * principal), audit, the store, the writer and its triggers.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLearningApp, type LearningApp } from '../helpers/learning-app.js';
import { DecisionRecorder, POLICY } from '../helpers/learning-ports.js';
import { DbDecisionRecorder } from '../helpers/learning-decisions-db.js';
import { refusingPorts, type ApprovalAttestationInput } from '../../src/modules/learning/learning.tokens.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let app: LearningApp;
let decisions: DecisionRecorder;
const attestations: ApprovalAttestationInput[] = [];

const review = (id: string, cookie: string, body: Record<string, unknown>) => app.api().post(`/v1/learning/candidates/${id}/review`).set('Cookie', cookie).send(body);
const view = (id: string) => app.api().get(`/v1/learning/candidates/${id}`).set('Cookie', app.started.cookie).expect(200);

beforeAll(async () => {
  if (noRuntime) return;
  app = await startLearningApp({ workspaceId: 'ws_review' });
  app.bindNotAnExpert();
  app.bindEvidence();
  // T2393 — decisions are written to policy_decisions, which the version trigger reads.
  decisions = new DbDecisionRecorder(app.db, 'ws_review');
  app.ports.decisions = decisions;
  app.ports.attestations = { async contribute(input) { attestations.push(input); return { evidenceId: `att_${attestations.length}` }; } };
}, 600_000);

afterAll(async () => {
  await app?.close();
}, 120_000);

suite('T2362 · the review gate through the real routes', () => {
  describe('while EPIC-031 is unmerged', () => {
    it('the review route answers 503 naming LearningDecisions', async () => {
      const res = await app.submit(app.body()).expect(201);
      app.ports.decisions = refusingPorts().decisions;
      try {
        // The candidate was recorded while the path was bound; deciding it now cannot happen.
        const out = await review(res.body.candidateId, await app.cookieFor('u_rev'), { decision: 'approve' }).expect(503);
        expect(out.body.error.message).toContain('LearningDecisions');
      } finally {
        app.ports.decisions = decisions;
      }
    });
  });

  it('Q6 · a complete candidate in architecture waits for a human: pending-review, a review request, a submitted event', async () => {
    const res = await app.submit(app.body()).expect(201);
    expect(res.body).toMatchObject({ state: 'pending-review', decisionId: expect.any(String), eligibleForAutomatic: false });
    expect(decisions.requests.at(-1)).toMatchObject({ actionType: 'learning.review.candidate', target: { type: 'learning-candidate', id: res.body.candidateId }, actor: { kind: 'automation', id: 'learning-intake' } });
  });

  it('Q9 · test-setup, project scope, verified evidence → auto-executed, approvedByKind policy, attested, explained', async () => {
    decisions.next = 'auto-executed';
    try {
      const res = await app.submit(app.body({ category: 'test-setup' })).expect(201);
      expect(res.body).toMatchObject({ state: 'approved', eligibleForAutomatic: true });
      expect(decisions.requests.at(-1)!.actionType).toBe('learning.approve.test-setup');
      const v = await app.db.query(`SELECT "approvedByKind", "approvedBy", "decisionId" FROM knowledge_entry_versions WHERE "candidateId" = $1`, [res.body.candidateId]);
      expect(v.rows[0]).toMatchObject({ approvedByKind: 'policy', approvedBy: 'policy:v3', decisionId: res.body.decisionId });
      expect(attestations.at(-1)).toMatchObject({ outcome: 'auto-executed', approvedByKind: 'policy', candidateId: res.body.candidateId, sourceUri: 'pmi:learning' });
      const shown = await view(res.body.candidateId);
      expect(shown.body.decision.explanation.matchedRule).toBe('rule:learning.approve.test-setup');
    } finally {
      decisions.next = 'pending';
    }
  });

  it('Q10 · the same with a workspace claim waits for a human; eligibility names scope (US3-6)', async () => {
    const res = await app.submit(app.body({ category: 'test-setup', claimedScope: { kind: 'workspace', projectIds: [] } })).expect(201);
    expect(res.body.state).toBe('pending-review');
    expect(res.body.reasonIfNot).toContain('scope-not-source-project');
    expect((await view(res.body.candidateId)).body.eligibility.failedConditions).toEqual(['scope-not-source-project']);
  });

  it('Q12 · with EPIC-031 classifying nothing (unclassified ⇒ high), it waits for a human (SC-LRN-008)', async () => {
    const res = await app.submit(app.body({ category: 'test-setup' })).expect(201);
    expect(res.body.state).toBe('pending-review');
  });

  it('Q13 · approving as the submitting agent’s principal is 403, audited, and the decision stays pending', async () => {
    const res = await app.submit(app.body()).expect(201);
    const approvals = decisions.approvals.length;
    await review(res.body.candidateId, await app.cookieFor(app.agentPrincipalId), { decision: 'approve' }).expect(403);
    expect(decisions.approvals.length).toBe(approvals);
    const audit = await app.db.query(`SELECT 1 FROM audit_entries WHERE action = 'access_refused' AND "targetId" = $1`, [res.body.candidateId]);
    expect(audit.rowCount).toBe(1);
    expect((await view(res.body.candidateId)).body.candidate.state).toBe('pending-review');
  });

  it('Q15 · another human approves, narrowing the scope and editing the statement: v1 keeps both forms', async () => {
    const res = await app.submit(app.body({ claimedScope: { kind: 'projects', projectIds: [app.projectId, app.projectId + '_x'] } })).expect(400);
    expect(res.body.error.message).toMatch(/not in this workspace/);
    const second = await app.api().post('/v1/projects').set('Cookie', app.started.cookie).send({ name: 'Second' }).expect(201);
    const sub = await app.submit(app.body({ claimedScope: { kind: 'projects', projectIds: [app.projectId, second.body.id] } })).expect(201);
    const out = await review(sub.body.candidateId, await app.cookieFor('u_rev'), {
      decision: 'approve',
      statement: 'Start the database before the integration suite.',
      scope: { kind: 'project', projectIds: [app.projectId] },
    }).expect(200);
    expect(out.body).toMatchObject({ state: 'approved', version: 1, entryId: expect.any(String) });
    expect(out.body.retrievability).toMatchObject({ outcome: 'not-yet-retrievable' });
    const v = await app.db.query(`SELECT statement, "proposedStatement", scope, "proposedScope", "approvedBy" FROM knowledge_entry_versions WHERE "candidateId" = $1`, [sub.body.candidateId]);
    expect(v.rows[0]).toMatchObject({
      statement: 'Start the database before the integration suite.',
      proposedStatement: 'Integration tests need the local database started first.',
      scope: { kind: 'project', projectIds: [app.projectId] },
      proposedScope: { kind: 'projects', projectIds: [app.projectId, second.body.id] },
      approvedBy: 'u_rev',
    });
  });

  it('Q16 · a scope wider than claimed is 400 — nothing approved', async () => {
    const res = await app.submit(app.body()).expect(201);
    const approvals = decisions.approvals.length;
    await review(res.body.candidateId, await app.cookieFor('u_rev'), { decision: 'approve', scope: { kind: 'workspace', projectIds: [] } }).expect(400);
    expect(decisions.approvals.length).toBe(approvals);
  });

  it('Q17 · rejected with a reason: readable, nothing deleted (FR-LRN-029)', async () => {
    const res = await app.submit(app.body()).expect(201);
    const out = await review(res.body.candidateId, await app.cookieFor('u_rev'), { decision: 'reject', reason: 'Only true on one laptop.' }).expect(200);
    expect(out.body.state).toBe('rejected');
    const shown = await view(res.body.candidateId);
    expect(shown.body.candidate.state).toBe('rejected');
    expect(shown.body.candidate.transitions.at(-1)).toMatchObject({ state: 'rejected', reason: 'Only true on one laptop.', actorId: 'u_rev' });
  });

  it('a reject without a reason is 400; a second decision is 409', async () => {
    const res = await app.submit(app.body()).expect(201);
    const cookie = await app.cookieFor('u_rev');
    await review(res.body.candidateId, cookie, { decision: 'reject' }).expect(400);
    await review(res.body.candidateId, cookie, { decision: 'reject', reason: 'no' }).expect(200);
    await review(res.body.candidateId, cookie, { decision: 'approve' }).expect(409);
  });

  it('Q11 · once the policy no longer declares test-setup low-risk, it waits for a human even if EPIC-031 would auto-execute (MP-2)', async () => {
    const docs = await app.api().get('/v1/steering').set('Cookie', app.started.cookie).expect(200);
    const policyDoc = (docs.body as { id: string; subject: string }[]).find((d) => d.subject === 'learning_policy')!;
    const notLowRisk = { ...POLICY, categories: POLICY.categories.map((c) => ({ ...c, lowRisk: false })) };
    await app.api().patch(`/v1/steering/${policyDoc.id}`).set('Cookie', app.started.cookie).send({ content: JSON.stringify(notLowRisk) }).expect(200);
    decisions.next = 'auto-executed';
    try {
      const res = await app.submit(app.body({ category: 'test-setup' })).expect(201);
      expect(decisions.requests.at(-1)!.actionType).toBe('learning.review.candidate');
      expect(res.body.reasonIfNot).toContain('category-not-declared-low-risk');
      // The recorder auto-executed the *review* action; the guard does not accept it (RK-5).
      expect(res.body.state).toBe('proposed');
      const v = await app.db.query(`SELECT 1 FROM knowledge_entry_versions WHERE "candidateId" = $1`, [res.body.candidateId]);
      expect(v.rowCount).toBe(0);
    } finally {
      decisions.next = 'pending';
    }
  });

  it('the review route is not reachable through the connector guard', async () => {
    const res = await app.submit(app.body()).expect(201);
    const approvals = decisions.approvals.length;
    const out = await app.api().post(`/v1/projects/${app.projectId}/learning/candidates/${res.body.candidateId}/review`).set({ Authorization: `Bearer ${app.token}` }).send({ decision: 'approve' });
    expect([200, 201]).not.toContain(out.status);
    const bearerOnSession = await app.api().post(`/v1/learning/candidates/${res.body.candidateId}/review`).set({ Authorization: `Bearer ${app.token}` }).send({ decision: 'approve' });
    expect(bearerOnSession.status).toBe(401);
    expect(decisions.approvals.length).toBe(approvals);
  });
});
