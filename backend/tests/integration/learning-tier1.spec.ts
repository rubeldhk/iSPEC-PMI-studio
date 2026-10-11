/**
 * `T2402` (EPIC-048, Constitution XI **Tier 1**) — quickstart Q1–Q27 through the
 * real entry points of the composed `AppModule`, with the **real** owners bound.
 *
 * Entry points: the session routes, the connector route through
 * `ConnectorAuthGuard`, `EPIC-031`'s own `POST /decisions/:id/approve`, the
 * learning jobs through `LearningJobs.run`, and `EPIC-038`'s assembly and
 * inspection. Owners, all real: `EPIC-031`'s `DecisionEngine` (configured
 * through its own steering subject `risk-classification` and its own
 * `POST /decision-policies`), `EPIC-032`'s Evidence Store (evidence contributed
 * through `POST /evidence`, `approval/v1` attested into it), `EPIC-038`'s
 * context store, vector index, sources and knowledge slot, `EPIC-047`'s
 * provenance over its own tables, `EPIC-024` access, `EPIC-019` steering,
 * `EPIC-004` audit, `EPIC-037` executions.
 *
 * ## In-test bindings — each visible below, each for a gap no Epic owns
 *
 * 1. **The embedding provider** (`R-048-13`, `FR-CTX-013`). Nobody owns one, so
 *    the composed `IndexService` and `SearchService` refuse. Q15 asserts that
 *    refusal as the composed application gives it. From Q20 on, a deterministic
 *    in-test `EmbeddingPort` (`fixtureEmbedding`) is handed to a real
 *    `IndexService`/`SearchService` over the composed pgvector index, sources and
 *    store, and that is the only stand-in: `AssemblyService` is otherwise built
 *    from the composed module's own parts, exactly as `context.module.ts` builds
 *    it.
 * 2. **Q3's unbound `EvidenceReads`** — the scenario *is* the unbound port.
 * 3. **Q26's provisional execution** — `EPIC-037` cannot register one on `main`
 *    (`POST /executions` always records `governed`; `/executions/sync` is
 *    `NotAvailableUntilError`, `FR-PIC-034`), so the real `Executions` port is
 *    wrapped for one execution.
 *
 * ## Order matters
 *
 * Scenarios share one workspace and build on each other (Q15's entry is
 * superseded in Q19, widened in Q22). Q12a runs before the tenant policy exists;
 * Q18 runs last because the expiry sweep closes every candidate still pending.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { startLearningApp, type LearningApp } from '../helpers/learning-app.js';
import { DIGEST } from '../helpers/learning-fixtures.js';
import { POLICY } from '../helpers/learning-ports.js';
import { fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';
import { contract } from '../helpers/expert-fixtures.js';
import { refusingPorts } from '../../src/modules/learning/learning.tokens.js';
import type { LearningJobs } from '../../src/modules/learning/learning.jobs.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_tier1';
const OTHER_WS = 'ws_tier1_other';

let app: LearningApp;
let jobs: LearningJobs;
let evidenceId = '';
let secondProject = '';
let reviewer = '';
let reviewer2 = '';

/** What one scenario hands the next. */
const shared: { q6?: { candidateId: string; decisionId: string }; q15?: { candidateId: string; entryId: string; v1: string }; v2?: string; packageBefore?: string } = {};

interface Assembly {
  assemble(over: { projectId: string; workspaceId?: string; actorId?: string; executionId?: string; objective?: string }): Promise<{ packageId: string }>;
  reindexAll(): Promise<void>;
  /** The real IndexService over the composed parts (in-test binding 1). */
  readonly index: { reindex(request: { workspaceId: string; sourceType: string; sourceId: string; sourceVersion?: string }): Promise<unknown> };
}
let context: Assembly;

const review = (id: string, cookie: string, body: Record<string, unknown>) => app.api().post(`/v1/learning/candidates/${id}/review`).set('Cookie', cookie).send(body);
const view = (id: string) => app.api().get(`/v1/learning/candidates/${id}`).set('Cookie', app.started.cookie).expect(200);
const inspect = (packageId: string) => app.api().get(`/v1/context/packages/${packageId}`).set('Cookie', app.started.cookie).expect(200);

async function latest(candidateId: string): Promise<{ state: string; reason: string | null; decisionId: string | null }> {
  const r = await app.db.query(`SELECT state, reason, "decisionId" FROM learning_candidate_transitions WHERE "candidateId" = $1 ORDER BY seq DESC LIMIT 1`, [candidateId]);
  return r.rows[0];
}

async function versionsOf(candidateId: string): Promise<Record<string, unknown>[]> {
  return (await app.db.query(`SELECT * FROM knowledge_entry_versions WHERE "candidateId" = $1`, [candidateId])).rows;
}

async function inbox(cookie: string): Promise<string[]> {
  const res = await app.api().get('/v1/inbox').set('Cookie', cookie).expect(200);
  return (res.body.entries as { decisionId: string; kind: string }[]).filter((e) => e.kind === 'approval').map((e) => e.decisionId);
}

/** The learning events on an execution: EPIC-037's history route lists them; their payloads are read from its table. */
async function history(executionId: string): Promise<{ type: string; payload?: { kind?: string; candidateId?: string } }[]> {
  const { HEADERS } = await import('../helpers/learning-app.js');
  const listed = await app.api().get(`/v1/executions/${executionId}/history`).set({ Authorization: `Bearer ${app.token}`, ...HEADERS }).expect(200);
  const rows = await app.db.query(`SELECT type, payload FROM execution_events WHERE "executionId" = $1 ORDER BY sequence`, [executionId]);
  expect(rows.rows.map((r: { type: string }) => r.type)).toEqual((listed.body as { type: string }[]).map((e) => e.type));
  return rows.rows;
}

/** A real EPIC-032 evidence item in the project: stored, integrity valid, subject digest = the citation's. */
async function contributeEvidence(projectId: string): Promise<string> {
  const res = await app
    .api()
    .post('/v1/evidence')
    .set('Cookie', app.started.cookie)
    .send({
      attestation: {
        _type: 'https://in-toto.io/Statement/v1',
        subject: [{ name: 'tests/integration.log', digest: { sha256: DIGEST } }],
        predicateType: predicateTypeFor('test-result'),
        predicate: { result: 'PASSED' },
      },
      attestedArtifact: { id: projectId, version: 1 },
      // FR-EVS-004: evidence attaches to an artifact, task, decision or outcome.
      attachedTo: { type: 'artifact', id: `${projectId}:tests/integration.log` },
      producedAt: new Date().toISOString(),
      source: { uri: 'pmi:qa-suite' },
      projectId,
    });
  if (res.status !== 201) throw new Error(`POST /evidence answered ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

/** A candidate citing the real evidence item. */
function body(over: Record<string, unknown> = {}): Record<string, unknown> {
  return app.body({ evidence: [{ evidenceId, digest: { sha256: DIGEST } }], ...over });
}

async function setPolicy(policy: object): Promise<void> {
  const docs = await app.api().get('/v1/steering').set('Cookie', app.started.cookie).expect(200);
  const doc = (docs.body as { id: string; subject: string }[]).find((d) => d.subject === 'learning_policy')!;
  await app.api().patch(`/v1/steering/${doc.id}`).set('Cookie', app.started.cookie).send({ content: JSON.stringify(policy) }).expect(200);
}

/**
 * `EPIC-038`'s `AssemblyService`, built from the composed module's own parts as
 * `context.module.ts` builds it — store, pgvector index, governed sources,
 * `EPIC-024` access, the knowledge slot `LearningModule` filled — except that
 * retrieval and indexing are handed an in-test `EmbeddingPort` (in-test binding 1).
 */
async function contextOverComposedParts(): Promise<Assembly> {
  const tokens = await import('../../src/modules/context/context.tokens.js');
  const { AssemblyService } = await import('../../src/modules/context/assembly.service.js');
  const { SearchService } = await import('../../src/modules/context/retrieval/search.service.js');
  const { IndexService } = await import('../../src/modules/context/retrieval/index.service.js');
  const { accessPolicyFromEpic024 } = await import('../../src/modules/context/access.adapter.js');
  const { WorkspaceBoundaryService } = await import('../../src/modules/access/workspace-boundary.service.js');
  const { AccessInheritanceService } = await import('../../src/modules/access/access-inheritance.service.js');
  const { ExecutionRegistryFacade } = await import('../../src/modules/executions/execution-registry.facade.js');
  const { ProjectsService } = await import('../../src/modules/projects/projects.service.js');
  const { NotFoundError } = await import('../../src/core/errors.js');
  const { knowledgeIndexAdapter } = await import('../../src/modules/learning/adapters/context.adapter.js');
  const get = <T>(token: unknown): T => app.started.app.get(token as never, { strict: false }) as T;

  type Store = ConstructorParameters<typeof AssemblyService>[0];
  const store = get<Store>(tokens.CONTEXT_STORE);
  const vectors = get<ConstructorParameters<typeof SearchService>[0]>(tokens.CONTEXT_VECTOR_INDEX);
  const sources = get<ConstructorParameters<typeof SearchService>[2] & ConstructorParameters<typeof IndexService>[3]>(tokens.CONTEXT_SOURCES);
  const knowledge = get<Parameters<typeof tokens.withKnowledgeSupply>[1]>(tokens.CONTEXT_KNOWLEDGE);
  const registry = get<InstanceType<typeof ExecutionRegistryFacade>>(ExecutionRegistryFacade);
  const projects = get<InstanceType<typeof ProjectsService>>(ProjectsService);
  const embedding = fixtureEmbedding();
  const index = new IndexService(store as never, vectors, embedding, sources);

  // The learning module's KnowledgeIndex now reaches a real IndexService that
  // can embed — what EPIC-038 will do once an embedding provider is owned.
  app.ports.index = knowledgeIndexAdapter(index);

  const assembly = new AssemblyService(
    store,
    tokens.withKnowledgeSupply(
      {
        retrieval: new SearchService(vectors, embedding, sources, {}, store as never),
        projects: {
          async inWorkspace(workspaceId: string, projectId: string) {
            try {
              await projects.get(workspaceId, projectId);
              return true;
            } catch (error) {
              if (error instanceof NotFoundError) return false;
              throw error;
            }
          },
        },
        budgetPolicy: store,
        executions: {
          async projectedVersion(workspaceId: string, executionId: string) {
            const snapshot = await registry.snapshot(workspaceId, executionId);
            return snapshot === null ? null : String(snapshot.projectedThroughSequence);
          },
        },
        liveState: null,
        provenance: null,
        access: accessPolicyFromEpic024(get(WorkspaceBoundaryService), get(AccessInheritanceService)),
        sourceClasses: { classify: (workspaceId: string, sourceType: string) => (store as never as { classifySource(w: string, t: string): Promise<never> }).classifySource(workspaceId, sourceType) },
        authorisations: store as never,
      } as never,
      knowledge,
    ),
  );

  return {
    index: index as never,
    async assemble(over) {
      return assembly.assemble({
        workspaceId: over.workspaceId ?? WS,
        projectId: over.projectId,
        executionId: over.executionId,
        objective: over.objective ?? 'start the local database before the integration suite',
        actorId: over.actorId ?? 'u_owner',
        actorRole: 'engineer',
        budgetTokens: 12000,
        budgetCost: 40,
        essentialSources: [],
      } as never);
    },
    async reindexAll() {
      const report = await jobs.run('learning.retrievability', { workspaceId: WS });
      expect(report.outcome).toBe('succeeded');
    },
  };
}

beforeAll(async () => {
  if (noRuntime) return;
  app = await startLearningApp({ workspaceId: WS });
  const { LearningJobs: Jobs } = await import('../../src/modules/learning/learning.jobs.js');
  jobs = app.started.app.get(Jobs, { strict: false });
  reviewer = await app.cookieFor('u_rev');
  reviewer2 = await app.cookieFor('u_rev2');
  const second = await app.api().post('/v1/projects').set('Cookie', app.started.cookie).send({ name: 'Second', rootPath: 'tier1_second' }).expect(201);
  secondProject = second.body.id;
  evidenceId = await contributeEvidence(app.projectId);

  await app.db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'other',now())`, [OTHER_WS]);
  // EPIC-038 configuration, as an operator supplies it (FR-CTX-015, FR-CTX-036).
  await app.db.query(
    `INSERT INTO "context_source_classes" ("id","workspaceId","sourceType","securityClassification","indexable") VALUES ('sc_t1_ke',$1,'knowledge-entry','internal',true), ('sc_t1o_ke',$2,'knowledge-entry','internal',true)`,
    [WS, OTHER_WS],
  );
  await app.db.query(
    `INSERT INTO "context_budget_policies" ("id","workspaceId","retrievalLimit","tokensPerCandidate","costPerThousandTokens") VALUES ('bp_t1',$1,40,500,0), ('bp_t1o',$2,40,500,0)`,
    [WS, OTHER_WS],
  );
  // Another workspace, with a member and a project of its own (Q24).
  await app.db.query(`INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt") VALUES ('u_other',$1,'u_other@example.test','u_other','unused',now())`, [OTHER_WS]);
  await app.db.query(`INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ('p_other',$1,'Other','u_other',now())`, [OTHER_WS]);
  context = await contextOverComposedParts();
}, 600_000);

afterAll(async () => {
  await app?.close();
}, 120_000);

suite('T2402 · Tier 1 — Governed Learning through the composed application', () => {
  it('every port is bound to its real owner — nothing below is a recorder unless it says so', async () => {
    const { LEARNING_PORTS } = await import('../../src/modules/learning/learning.tokens.js');
    const refusing = refusingPorts();
    for (const name of Object.keys(refusing) as (keyof typeof refusing)[]) {
      if (name === 'index') continue; // rebound visibly in setup: in-test binding 1
      expect(app.ports[name], `${name} is still the refusing default`).not.toBe(refusing[name]);
    }
    expect(LEARNING_PORTS.length).toBeGreaterThan(0);
    const resolved = await (await import('../../src/modules/evidence/evidence.service.js')).EvidenceService;
    const evidence = app.started.app.get(resolved, { strict: false });
    const map = await evidence.resolve(WS, [evidenceId]);
    expect(map.get(evidenceId)).toMatchObject({ integrity: 'valid', resolution: 'resolved', attestedTarget: { type: 'artifact', id: `${app.projectId}:tests/integration.log` } });
  });

  it('Q12a · with no tenant policy at all, EPIC-031 refuses the automated request: proposed, never approved (SC-LRN-008)', async () => {
    const res = await app.submit(body({ category: 'test-setup' })).expect(201);
    expect(res.body.state).toBe('proposed');
    expect(await latest(res.body.candidateId)).toMatchObject({ state: 'proposed', reason: 'decision-refused-by-policy' });
    expect(await versionsOf(res.body.candidateId)).toEqual([]);
    const row = await app.db.query(`SELECT outcome FROM policy_decisions WHERE "targetId" = $1`, [res.body.candidateId]);
    expect(row.rows.map((r: { outcome: string }) => r.outcome)).toEqual(['refused']);
  });

  it('EPIC-031 tenant policy: learning.* may be requested by the intake rule (quickstart prerequisite)', async () => {
    const res = await app
      .api()
      .post('/v1/decision-policies')
      .set('Cookie', app.started.cookie)
      .send({
        bandTreatment: { low: 'auto-execute', medium: 'gates-required', high: 'human-approval' },
        selfApprovalAllowed: [],
        automatedActions: [{ actionPattern: 'learning.*', ruleId: 'learning.candidate-submitted' }],
      })
      .expect(201);
    expect(res.body.version).toBe(1);
  });

  it('Q1 · no evidence, confidence or scope: 400 naming all three; refused on the execution', async () => {
    const { evidence: _e, confidence: _c, claimedScope: _s, ...partial } = body();
    const res = await app.submit(partial).expect(400);
    expect([...res.body.error.details.missing].sort()).toEqual(['confidence', 'evidence', 'scope']);
    expect((await history(app.executions[0]!)).some((e) => e.payload?.kind === 'refused')).toBe(true);
  });

  it('Q2 · an execution that is not registered: 400, nothing stored', async () => {
    const before = (await app.db.query(`SELECT count(*)::int AS n FROM learning_candidates`)).rows[0].n;
    await app.submit(body({ executionId: 'exe_unregistered' })).expect(400);
    expect((await app.db.query(`SELECT count(*)::int AS n FROM learning_candidates`)).rows[0].n).toBe(before);
  });

  it('Q3 · while EvidenceReads is unbound: 503 naming the port, nothing stored (in-test binding 2)', async () => {
    const real = app.ports.evidence;
    app.ports.evidence = refusingPorts().evidence;
    try {
      const res = await app.submit(body({ idempotencyKey: 'q3_unbound' })).expect(503);
      expect(JSON.stringify(res.body)).toContain('EvidenceReads');
    } finally {
      app.ports.evidence = real;
    }
    expect((await app.db.query(`SELECT 1 FROM learning_candidates WHERE "idempotencyKey" = 'q3_unbound'`)).rowCount).toBe(0);
  });

  it('Q4 · a GitHub token: 400 naming rule and field; no row anywhere', async () => {
    const res = await app.submit(body({ idempotencyKey: 'q4', statement: `export ghp_${'Z'.repeat(36)} first` })).expect(400);
    expect(res.body.error.details).toEqual({ rule: 'github-token', field: 'statement' });
    expect((await app.db.query(`SELECT 1 FROM learning_candidates WHERE "idempotencyKey" = 'q4'`)).rowCount).toBe(0);
  });

  it('Q6 · a complete architecture candidate: 201 pending-review, a submitted event, in every human’s Inbox but the submitter’s', async () => {
    const res = await app.submit(body()).expect(201);
    expect(res.body).toMatchObject({ state: 'pending-review', decisionId: expect.any(String), eligibleForAutomatic: false });
    shared.q6 = { candidateId: res.body.candidateId, decisionId: res.body.decisionId };
    const events = await history(app.executions[0]!);
    expect(events.some((e) => e.payload?.kind === 'submitted' && e.payload.candidateId === res.body.candidateId)).toBe(true);
    // The submitter is the connector's agent principal — no human is excluded.
    for (const cookie of [app.started.cookie, reviewer, reviewer2]) expect(await inbox(cookie)).toContain(res.body.decisionId);
    // A person's submission is not in their own Inbox.
    const { executionId: _x, ...personBody } = body();
    const mine = await app.api().post('/v1/learning/candidates').set('Cookie', reviewer2).send({ ...personBody, projectId: app.projectId }).expect(201);
    expect(mine.body.state).toBe('pending-review');
    expect(await inbox(reviewer2)).not.toContain(mine.body.decisionId);
    expect(await inbox(reviewer)).toContain(mine.body.decisionId);
  });

  it('Q5 · a retry with the same idempotencyKey: 200, the same candidate, one row', async () => {
    const once = body({ idempotencyKey: 'q5' });
    const first = await app.submit(once).expect(201);
    const again = await app.submit(once).expect(200);
    expect(again.body.candidateId).toBe(first.body.candidateId);
    expect((await app.db.query(`SELECT count(*)::int AS n FROM learning_candidates WHERE "idempotencyKey" = 'q5'`)).rows[0].n).toBe(1);
  });

  it('Q7 · while Q6 is pending, nothing can make it a source: EPIC-038 refuses to index a candidate, and there is no knowledge to assemble (FR-LRN-002)', async () => {
    await expect(context.index.reindex({ workspaceId: WS, sourceType: 'learning-candidate', sourceId: shared.q6!.candidateId, sourceVersion: '1' })).rejects.toThrow(/outside the approved source set/);
    // Nothing is indexed at all yet, so EPIC-038 refuses to assemble rather than
    // supply an unranked package (FR-CTX-012) — no knowledge reaches anyone.
    await expect(context.assemble({ projectId: app.projectId })).rejects.toThrow(/never been built/);
    // Once approved knowledge is indexed, Q6 is still absent: asserted below, after Q15.
  });

  it('Q8 · the same subject from a second execution: 200 corroboration, still one candidate', async () => {
    const subject = 'the shared subject of Q8';
    const first = await app.submit(body({ subject })).expect(201);
    const second = await app.register('reg_tier1_q8');
    const res = await app.submit(body({ subject, executionId: second })).expect(200);
    expect(res.body.candidateId).toBe(first.body.candidateId);
    const rows = await app.db.query(`SELECT count(*)::int AS n FROM learning_corroborations WHERE "candidateId" = $1`, [first.body.candidateId]);
    expect(rows.rows[0].n).toBe(1);
  });

  it('Q12 · with the tenant policy but no classification rule (unclassified ⇒ high): pending-review (SC-LRN-008)', async () => {
    const res = await app.submit(body({ category: 'test-setup' })).expect(201);
    expect(res.body.state).toBe('pending-review');
    expect(await versionsOf(res.body.candidateId)).toEqual([]);
  });

  it('EPIC-031 classification: learning.approve.test-setup is low, learning.review.* high (quickstart prerequisite)', async () => {
    await app
      .api()
      .post('/v1/steering')
      .set('Cookie', app.started.cookie)
      .send({
        subject: 'risk-classification',
        scopeType: 'workspace',
        scopeRef: WS,
        content: JSON.stringify({ rules: [{ actionPattern: 'learning.approve.test-setup', band: 'low' }, { actionPattern: 'learning.review.*', band: 'high' }] }),
      })
      .expect(201);
  });

  it('Q9 · test-setup, project scope, verified evidence: auto-executed; approvedByKind policy; approval/v1 in the Evidence Store; explained', async () => {
    const res = await app.submit(body({ category: 'test-setup' })).expect(201);
    expect(res.body).toMatchObject({ state: 'approved', eligibleForAutomatic: true });
    const decision = await app.db.query(`SELECT outcome, "actionType", "effectiveClass" FROM policy_decisions WHERE id = $1`, [res.body.decisionId]);
    expect(decision.rows[0]).toEqual({ outcome: 'auto-executed', actionType: 'learning.approve.test-setup', effectiveClass: 'low' });
    const [v] = await versionsOf(res.body.candidateId);
    expect(v).toMatchObject({ approvedByKind: 'policy', decisionId: res.body.decisionId });
    const attested = await app.db.query(`SELECT source, "attachedToType", "attachedToId" FROM evidence_items WHERE "subjectName" = $1`, [`knowledge-entry:${v!['entryId']}@1`]);
    expect(attested.rows).toEqual([{ source: 'pmi:learning', attachedToType: expect.any(String), attachedToId: expect.any(String) }]);
    const shown = await view(res.body.candidateId);
    expect(JSON.stringify(shown.body.decision.explanation)).toMatch(/learning\.approve\.test-setup/);
  });

  it('Q10 · the same with a workspace claim waits for a human; eligibility names scope (US3-6)', async () => {
    const res = await app.submit(body({ category: 'test-setup', claimedScope: { kind: 'workspace', projectIds: [] } })).expect(201);
    expect(res.body.state).toBe('pending-review');
    expect((await view(res.body.candidateId)).body.eligibility.failedConditions).toEqual(['scope-not-source-project']);
  });

  it('Q11 · the policy stops declaring test-setup low-risk while EPIC-031 still classifies it low: pending-review (MP-2)', async () => {
    await setPolicy({ ...POLICY, categories: POLICY.categories.map((c) => ({ ...c, lowRisk: false })) });
    try {
      const res = await app.submit(body({ category: 'test-setup' })).expect(201);
      expect(res.body.state).toBe('pending-review');
      expect(res.body.reasonIfNot).toContain('category-not-declared-low-risk');
      const decision = await app.db.query(`SELECT outcome, "actionType" FROM policy_decisions WHERE id = $1`, [res.body.decisionId]);
      expect(decision.rows[0]).toEqual({ outcome: 'pending', actionType: 'learning.review.candidate' });
      expect(await versionsOf(res.body.candidateId)).toEqual([]);
    } finally {
      await setPolicy(POLICY);
    }
  });

  it('Q13 · approving through the review route as the submitting agent’s principal: 403, audited, still pending', async () => {
    const res = await app.submit(body()).expect(201);
    await review(res.body.candidateId, await app.cookieFor(app.agentPrincipalId), { decision: 'approve' }).expect(403);
    const audit = await app.db.query(`SELECT 1 FROM audit_entries WHERE action = 'access_refused' AND "targetId" = $1`, [res.body.candidateId]);
    expect(audit.rowCount).toBe(1);
    const decision = await app.db.query(`SELECT outcome FROM policy_decisions WHERE "resolvesDecisionId" = $1`, [res.body.decisionId]);
    expect(decision.rows).toEqual([]);
    expect((await view(res.body.candidateId)).body.candidate.state).toBe('pending-review');
  });

  it('Q14 · an agent approves through EPIC-031’s own route; 031 records it human; the sweep does not accept it (MP-3)', async () => {
    // Another project's connector principal: an agent of this workspace that is
    // NOT the candidate's source, so only the principal-kind check can refuse.
    const other = await app.api().post('/v1/projects').set('Cookie', app.started.cookie).send({ name: 'Agent two', rootPath: 'tier1_agent_two' }).expect(201);
    const cred = await app.db.query(`SELECT "principalId" FROM connector_credentials WHERE id = $1`, [other.body.connectorCredential.id]);
    const agent = String(cred.rows[0].principalId);
    const res = await app.submit(body()).expect(201);
    const approved = await app.api().post(`/v1/decisions/${res.body.decisionId}/approve`).set('Cookie', await app.cookieFor(agent)).expect(200);
    expect(approved.body.outcome).toBe('approved');
    const recorded = await app.db.query(`SELECT "actorKind", "actorId" FROM policy_decisions WHERE "resolvesDecisionId" = $1`, [res.body.decisionId]);
    expect(recorded.rows).toEqual([{ actorKind: 'human', actorId: agent }]);
    await jobs.run('learning.resolve-decisions', { workspaceId: WS });
    expect(await latest(res.body.candidateId)).toMatchObject({ state: 'proposed', reason: 'decision-not-accepted' });
    expect(await versionsOf(res.body.candidateId)).toEqual([]);
    const flags = await app.db.query(`SELECT kind FROM knowledge_flags WHERE "candidateId" = $1`, [res.body.candidateId]);
    expect(flags.rows.map((r: { kind: string }) => r.kind)).toEqual(['decision-not-accepted']);
  });

  it('Q15 · another human approves, narrowing scope and editing the statement: v1 holds both forms; not yet retrievable, naming the embedding port', async () => {
    // Before in-test binding 1 reaches retrievability: the composed index refuses.
    const { IndexService } = await import('../../src/modules/context/retrieval/index.service.js');
    const { knowledgeIndexAdapter } = await import('../../src/modules/learning/adapters/context.adapter.js');
    const bound = app.ports.index;
    app.ports.index = knowledgeIndexAdapter(app.started.app.get(IndexService, { strict: false }));
    try {
      const sub = await app.submit(body({ subject: 'the database starts first', claimedScope: { kind: 'projects', projectIds: [app.projectId, secondProject] } })).expect(201);
      const out = await review(sub.body.candidateId, reviewer, {
        decision: 'approve',
        statement: 'Start the database before the integration suite.',
        scope: { kind: 'project', projectIds: [app.projectId] },
      }).expect(200);
      expect(out.body).toMatchObject({ state: 'approved', version: 1, entryId: expect.any(String) });
      expect(out.body.retrievability).toMatchObject({ outcome: 'not-yet-retrievable' });
      expect(JSON.stringify(out.body.retrievability)).toMatch(/EmbeddingPort|embedding/i);
      const [v] = await versionsOf(sub.body.candidateId);
      expect(v).toMatchObject({
        statement: 'Start the database before the integration suite.',
        proposedStatement: 'Integration tests need the local database started first.',
        scope: { kind: 'project', projectIds: [app.projectId] },
        proposedScope: { kind: 'projects', projectIds: [app.projectId, secondProject] },
        approvedByKind: 'human',
        approvedBy: 'u_rev',
      });
      const resolving = await app.db.query(`SELECT outcome, "actorKind", "actorId" FROM policy_decisions WHERE id = $1`, [v!['resolvingDecisionId']]);
      expect(resolving.rows[0]).toEqual({ outcome: 'approved', actorKind: 'human', actorId: 'u_rev' });
      shared.q15 = { candidateId: sub.body.candidateId, entryId: out.body.entryId, v1: String(v!['id']) };
    } finally {
      app.ports.index = bound;
    }
  });

  it('Q16 · approving with a scope wider than claimed: 400, nothing decided', async () => {
    const res = await app.submit(body()).expect(201);
    await review(res.body.candidateId, reviewer, { decision: 'approve', scope: { kind: 'workspace', projectIds: [] } }).expect(400);
    expect((await app.db.query(`SELECT 1 FROM policy_decisions WHERE "resolvesDecisionId" = $1`, [res.body.decisionId])).rowCount).toBe(0);
  });

  it('Q17 · rejected with a reason: readable, closed in EPIC-031, nothing deleted (FR-LRN-029, A-031-1)', async () => {
    const res = await app.submit(body()).expect(201);
    const out = await review(res.body.candidateId, reviewer, { decision: 'reject', reason: 'Only true on one laptop.' }).expect(200);
    expect(out.body.state).toBe('rejected');
    const shown = await view(res.body.candidateId);
    expect(shown.body.candidate.transitions.at(-1)).toMatchObject({ state: 'rejected', reason: 'Only true on one laptop.', actorId: 'u_rev' });
    const closure = await app.db.query(`SELECT outcome FROM policy_decisions WHERE "resolvesDecisionId" = $1`, [res.body.decisionId]);
    expect(closure.rows).toEqual([{ outcome: 'refused' }]);
    expect(await inbox(reviewer)).not.toContain(res.body.decisionId);
  });

  it('retrievability: once an embedding exists, the sweep indexes v1 (in-test binding 1 from here on)', async () => {
    await context.reindexAll();
    const r = await app.db.query(`SELECT outcome FROM knowledge_retrievability WHERE "versionId" = $1 ORDER BY "attemptedAt" DESC LIMIT 1`, [shared.q15!.v1]);
    expect(r.rows[0]).toEqual({ outcome: 'retrievable' });
  });

  it('assembly in the entry’s project includes v1, marked approved knowledge (FR-LRN-050)', async () => {
    const { packageId } = await context.assemble({ projectId: app.projectId });
    shared.packageBefore = packageId;
    const shown = await inspect(packageId);
    const item = (shown.body.items as { sourceType: string; sourceId: string; sourceVersion: string; inclusionReason: string }[]).find((i) => i.sourceType === 'knowledge-entry');
    expect(item).toMatchObject({ sourceId: shared.q15!.entryId, sourceVersion: shared.q15!.v1 });
    expect(item!.inclusionReason.startsWith('approved knowledge —')).toBe(true);
    // Q7, the second half: the pending Q6 candidate is in neither list, and the
    // only knowledge supplied is approved entries.
    const all = [...shown.body.items, ...shown.body.exclusions] as { sourceType: string; sourceId: string }[];
    expect(all.map((x) => x.sourceId)).not.toContain(shared.q6!.candidateId);
    const entries = (await app.db.query(`SELECT id FROM knowledge_entries WHERE "workspaceId" = $1`, [WS])).rows.map((r: { id: string }) => r.id);
    for (const x of all.filter((y) => y.sourceType === 'knowledge-entry')) expect(entries).toContain(x.sourceId);
    expect(all.filter((x) => !['knowledge-entry'].includes(x.sourceType))).toEqual([]);
  });

  it('Q21 · assembly for another project: excluded, boundary, scope (FR-LRN-041, -045)', async () => {
    const { packageId } = await context.assemble({ projectId: secondProject });
    const shown = await inspect(packageId);
    const ex = (shown.body.exclusions as { sourceId: string; reason: string; detail: string }[]).find((e) => e.sourceId === shared.q15!.entryId);
    expect(ex).toMatchObject({ reason: 'boundary', detail: expect.stringMatching(/^scope: /) });
    expect((shown.body.items as { sourceId: string }[]).map((i) => i.sourceId)).not.toContain(shared.q15!.entryId);
  });

  it('Q19 · a supersession in a low-risk category waits for a human regardless; after approval v1 reads superseded naming v2', async () => {
    const res = await app.submit(body({ subject: 'the database starts first', category: 'test-setup', kind: 'supersede', targetVersionId: shared.q15!.v1, statement: 'Start the database, migrate, then test.' })).expect(201);
    expect(res.body.state).toBe('pending-review');
    const decision = await app.db.query(`SELECT outcome, "actionType" FROM policy_decisions WHERE id = $1`, [res.body.decisionId]);
    expect(decision.rows[0]).toEqual({ outcome: 'pending', actionType: 'learning.review.supersede' });
    const out = await review(res.body.candidateId, reviewer2, { decision: 'approve' }).expect(200);
    expect(out.body).toMatchObject({ entryId: shared.q15!.entryId, version: 2 });
    const [v2] = await versionsOf(res.body.candidateId);
    shared.v2 = String(v2!['id']);
    const superseded = await app.api().get('/v1/learning/knowledge?status=superseded').set('Cookie', reviewer).expect(200);
    expect(superseded.body.items.map((i: { versionId: string; successorVersionId: string }) => [i.versionId, i.successorVersionId])).toEqual([[shared.q15!.v1, shared.v2]]);
  });

  it('Q20 · the package assembled before Q19 still shows v1 as supplied, with a drift note naming v2 (FR-LRN-054)', async () => {
    const shown = await inspect(shared.packageBefore!);
    const item = (shown.body.items as { sourceId: string; sourceVersion: string; drift: { kind: string; currentVersion?: string } }[]).find((i) => i.sourceId === shared.q15!.entryId);
    expect(item).toMatchObject({ sourceVersion: shared.q15!.v1, drift: { kind: 'moved', currentVersion: shared.v2 } });
    // A new assembly supplies v2, never v1.
    await context.reindexAll();
    const fresh = await inspect((await context.assemble({ projectId: app.projectId })).packageId);
    const supplied = (fresh.body.items as { sourceId: string; sourceVersion: string }[]).filter((i) => i.sourceId === shared.q15!.entryId).map((i) => i.sourceVersion);
    expect(supplied).toEqual([shared.v2]);
  });

  it('Q22 · widened to workspace scope through a decision, it reaches another project that permits its classification (US5-2)', async () => {
    const res = await app.submit(body({ subject: 'the database starts first', category: 'test-setup', kind: 'widen-scope', targetVersionId: shared.v2, claimedScope: { kind: 'workspace', projectIds: [] } })).expect(201);
    expect(res.body.state).toBe('pending-review');
    const out = await review(res.body.candidateId, reviewer, { decision: 'approve' }).expect(200);
    expect(out.body.version).toBe(3);
    await context.reindexAll();
    const shown = await inspect((await context.assemble({ projectId: secondProject })).packageId);
    const item = (shown.body.items as { sourceId: string; inclusionReason: string }[]).find((i) => i.sourceId === shared.q15!.entryId);
    expect(item?.inclusionReason).toMatch(/^approved knowledge — /);
    expect(item?.inclusionReason).toMatch(/v3/);
    expect(item?.inclusionReason).toMatch(/workspace/);
  });

  it('Q23 · the same, where the receiving project does not permit the classification: excluded, classification (US5-3)', async () => {
    await setPolicy({ ...POLICY, reuse: { ...POLICY.reuse, permittedClassifications: { default: ['internal'], byProject: { [secondProject]: ['public'] } } } });
    try {
      const shown = await inspect((await context.assemble({ projectId: secondProject })).packageId);
      const ex = (shown.body.exclusions as { sourceId: string; reason: string; detail: string }[]).find((e) => e.sourceId === shared.q15!.entryId);
      expect(ex).toMatchObject({ reason: 'classification', detail: expect.stringContaining('internal') });
    } finally {
      await setPolicy(POLICY);
    }
  });

  it('Q24 · another workspace never reaches the entry, and a reusable authorisation for it is refused by the CHECK (FR-LRN-043)', async () => {
    // The entry is indexed in its own workspace's partition only; the other
    // workspace's search cannot reach it, so its assembly has nothing to rank.
    const partitions = await app.db.query(`SELECT DISTINCT "workspaceId" FROM context_index_entries WHERE "sourceId" = $1`, [shared.q15!.entryId]);
    expect(partitions.rows).toEqual([{ workspaceId: WS }]);
    await expect(context.assemble({ workspaceId: OTHER_WS, projectId: 'p_other', actorId: 'u_other' })).rejects.toThrow(/never been built/);
    await expect(
      app.db.query(
        `INSERT INTO context_reusable_authorisations ("id","sourceType","sourceId","workspaceId","toWorkspaceId","authorisedBy","rationale") VALUES ('cra_t1','knowledge-entry',$1,$2,$3,'u_owner','share it')`,
        [shared.q15!.entryId, WS, OTHER_WS],
      ),
    ).rejects.toThrow(/no_cross_workspace_knowledge/);
  });

  it('Q25 · an Expert whose contract declares memoryPolicy none: 400, memory-policy-refused; its packages carry no knowledge (SC-LRN-009)', async () => {
    const executionId = await app.register('reg_tier1_expert');
    // EPIC-047's own tables, as its registry writes them (expert-constraints.spec.ts).
    await app.db.query(`INSERT INTO engineering_experts (id,"workspaceId",key,name,status,"registeredBy") VALUES ('ex_t1',$1,'test-engineer','Test Engineer','active','u_owner')`, [WS]);
    await app.db.query(`INSERT INTO expert_contract_versions (id,"workspaceId","expertId",version,contract,"createdBy") VALUES ('ecv_t1',$1,'ex_t1',1,$2,'u_owner')`, [WS, JSON.stringify(contract({ memoryPolicy: 'none' }))]);
    await app.db.query(
      `INSERT INTO expert_sessions ("executionId","workspaceId","expertId","contractVersionId","actorId",depth,model,"usedFallback","effectiveAuthority","toolObservation",unattended,"reviewRequired") VALUES ($1,$2,'ex_t1','ecv_t1','u_owner',0,'claude-opus-5-5',false,'{}','unobserved',false,false)`,
      [executionId, WS],
    );
    const res = await app.submit(body({ executionId })).expect(400);
    expect(JSON.stringify(res.body)).toMatch(/memory/i);
    expect((await history(executionId)).some((e) => e.payload?.kind === 'memory-policy-refused')).toBe(true);
    const shown = await inspect((await context.assemble({ projectId: app.projectId, executionId })).packageId);
    expect((shown.body.items as { sourceType: string }[]).filter((i) => i.sourceType === 'knowledge-entry')).toEqual([]);
    const ex = (shown.body.exclusions as { sourceId: string; reason: string; detail: string }[]).find((e) => e.sourceId === shared.q15!.entryId);
    expect(ex).toMatchObject({ reason: 'permission', detail: expect.stringMatching(/^memory-policy: /) });
  });

  it('Q26 · a provisional execution’s candidate stays proposed and asks EPIC-031 for nothing (FR-LRN-063; in-test binding 3)', async () => {
    const real = app.ports.executions;
    app.ports.executions = {
      ...real,
      async describe(ws, id) {
        const facts = await real.describe(ws, id);
        return facts === null ? null : { ...facts, governanceState: 'provisional' };
      },
    };
    try {
      const res = await app.submit(body()).expect(201);
      expect(res.body).toMatchObject({ state: 'proposed', provisional: true, reasonIfNot: ['execution-not-governed'] });
      expect((await app.db.query(`SELECT 1 FROM policy_decisions WHERE "targetId" = $1`, [res.body.candidateId])).rowCount).toBe(0);
    } finally {
      app.ports.executions = real;
    }
  });

  it('Q27 · a version naming a pending decision is refused by the trigger; any UPDATE by reject_mutation (FR-LRN-031)', async () => {
    const { candidateId, decisionId } = shared.q6!;
    await expect(
      app.db.query(
        `INSERT INTO knowledge_entry_versions (id,"workspaceId","entryId",version,statement,"proposedStatement",scope,"proposedScope",classification,"candidateId","decisionId","approvedByKind","approvedBy","approvedAt")
         VALUES ('kv_forged',$1,$2,9,'forged','forged','{"kind":"workspace","projectIds":[]}','{"kind":"workspace","projectIds":[]}','internal',$3,$4,'policy','policy:v1',now())`,
        [WS, shared.q15!.entryId, candidateId, decisionId],
      ),
    ).rejects.toThrow(/knowledge_versions_require_decision/);
    await expect(app.db.query(`UPDATE knowledge_entry_versions SET statement = 'edited' WHERE id = $1`, [shared.q15!.v1])).rejects.toThrow(/append-only/);
  });

  it('Q18 · past the review window: expired, not rejected; closed in EPIC-031 and gone from the Inbox (A-031-1)', async () => {
    const { candidateId, decisionId } = shared.q6!;
    expect(await inbox(reviewer)).toContain(decisionId);
    const report = await jobs.run('learning.expire', { workspaceId: WS, asOf: new Date(Date.now() + 31 * 86_400_000) });
    expect(report.outcome).toBe('succeeded');
    expect(await latest(candidateId)).toMatchObject({ state: 'expired' });
    const closure = await app.db.query(`SELECT outcome, "actorKind" FROM policy_decisions WHERE "resolvesDecisionId" = $1`, [decisionId]);
    expect(closure.rows).toEqual([{ outcome: 'refused', actorKind: 'automation' }]);
    expect(await inbox(reviewer)).not.toContain(decisionId);
  });
});
