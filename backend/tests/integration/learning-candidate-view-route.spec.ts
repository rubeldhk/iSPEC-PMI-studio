/**
 * `T2344` (EPIC-048, US2, `FR-LRN-071`, `FR-LRN-072`) — `GET /learning/candidates/:id`
 * returns everything a reviewer needs in one response, through the composed
 * application.
 *
 * Statement, category, source session, evidence with its state, confidence and
 * basis, claimed scope, corroborations (Q8 through the real routes), any entry
 * it supersedes — side by side — or conflicts with. Another workspace's
 * candidate is `404`, never `403` (analysis `U1`).
 *
 * Bound in-test, visibly: `ExpertProvenance` (not an Expert session),
 * `EvidenceReads` (a recorder), and — in one case only — `ReaderAccess`, to show
 * the default withholds and a grant reveals. The approved entry a supersession
 * targets is written with raw SQL in setup: approving one needs `EPIC-031`
 * (`T2362` drives that path with a recording decision port).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { DIGEST } from '../helpers/learning-fixtures.js';
import { POLICY, verified } from '../helpers/learning-ports.js';
import type { LearningPorts, ResolvedEvidence } from '../../src/modules/learning/learning.tokens.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_view';
const HEADERS = { 'x-contract-version': CONTRACT_VERSION };

let started: AuthenticatedApp;
let db: Client;
let root: string;
let projectId = '';
let token = '';
const executions: string[] = [];
let ports: LearningPorts;

const api = () => request(started.app.getHttpServer());

function body(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    executionId: executions[0],
    kind: 'new',
    statement: 'Integration tests need the local database started first.',
    category: 'architecture',
    subject: 'database before integration tests',
    evidence: [{ evidenceId: 'ev_1', digest: { sha256: DIGEST } }],
    confidence: { level: 'medium', basis: 'Three failing runs.' },
    claimedScope: { kind: 'project', projectIds: [projectId] },
    idempotencyKey: `idem_${Math.random().toString(36).slice(2)}`,
    correlationId: 'corr_view',
    ...over,
  };
}

const asAgent = () => api().post(`/v1/projects/${projectId}/learning/candidates`).set({ Authorization: `Bearer ${token}` });
const view = (id: string, cookie = started.cookie) => api().get(`/v1/learning/candidates/${id}`).set('Cookie', cookie);

async function register(key: string): Promise<string> {
  const reg = await api()
    .post('/v1/executions')
    .set({ Authorization: `Bearer ${token}`, ...HEADERS })
    .set('Idempotency-Key', key)
    .send({ command: 'specify', argsSanitized: { feature: key }, input: { targetType: 'project', targetId: projectId, targetVersion: 1 }, correlationId: `c_${key}`, idempotencyKey: key, contractVersion: CONTRACT_VERSION })
    .expect(201);
  return reg.body.executionId as string;
}

/** An approved entry, written as the writer would — setup only. */
async function approvedEntry(candidateId: string): Promise<{ entryId: string; versionId: string }> {
  const entryId = `ke_${candidateId}`;
  const versionId = `kv_${candidateId}`;
  await db.query('BEGIN');
  await db.query(`INSERT INTO knowledge_entries (id,"workspaceId",category,"subjectKey","originProjectId") VALUES ($1,$2,'architecture','architecture:old fact',$3)`, [entryId, WS, projectId]);
  await db.query(
    `INSERT INTO knowledge_entry_versions (id,"workspaceId","entryId",version,statement,"proposedStatement",scope,"proposedScope",classification,"candidateId","decisionId","approvedByKind","approvedBy","approvedAt")
     VALUES ($1,$2,$3,1,'The old fact.','The old fact.',$4::jsonb,$4::jsonb,'internal',$5,'dec_setup','human','u_owner',now())`,
    [versionId, WS, entryId, JSON.stringify({ kind: 'project', projectIds: [projectId] }), candidateId],
  );
  await db.query(`INSERT INTO knowledge_version_status_events (id,"workspaceId","versionId",status,"actorId","decisionId","candidateId",at) VALUES ($1,$2,$3,'current','u_owner','dec_setup',$4,now())`, [`se_${versionId}`, WS, versionId, candidateId]);
  // The next sequence, whatever the intake already appended (since T2349 a decision is requested on submit).
  await db.query(
    `INSERT INTO learning_candidate_transitions (id,"workspaceId","candidateId",seq,state,"decisionId","actorKind","actorId",at)
     SELECT $1,$2,$3, max(seq) + 1,'approved','dec_setup','human','u_owner',now() FROM learning_candidate_transitions WHERE "candidateId" = $3`,
    [`lct_${candidateId}`, WS, candidateId],
  );
  await db.query('COMMIT');
  return { entryId, versionId };
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-learning-view-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  started = await startAuthenticatedApp({ workspaceId: WS, userId: 'u_owner' });
  db = new Client({ connectionString: started.databaseUrl });
  await db.connect();
  const created = await api().post('/v1/projects').set('Cookie', started.cookie).send({ name: 'View', rootPath: 'view' }).expect(201);
  projectId = created.body.id;
  token = created.body.connectorCredential.value;
  executions.push(await register('reg_view_1'), await register('reg_view_2'));
  await api().post('/v1/steering').set('Cookie', started.cookie).send({ subject: 'learning_policy', scopeType: 'workspace', scopeRef: WS, content: JSON.stringify(POLICY) }).expect(201);

  const { LEARNING_PORTS_TOKEN } = await import('../../src/modules/learning/learning.tokens.js');
  ports = started.app.get(LEARNING_PORTS_TOKEN, { strict: false }) as LearningPorts;
  // In-test bindings, visible: not an Expert session; EPIC-032's resolve.
  ports.experts = { async forExecution() { return null; } };
  const known = new Map<string, ResolvedEvidence>([
    ['ev_1', verified('ev_1', { attestedTarget: { type: 'project', id: projectId } })],
    ['ev_2', verified('ev_2', { attestedTarget: { type: 'project', id: projectId } })],
  ]);
  ports.evidence = {
    async resolve(ws, ids) {
      const out = new Map<string, ResolvedEvidence>();
      if (ws === WS) for (const id of ids) if (known.has(id)) out.set(id, known.get(id)!);
      return out;
    },
  };
}, 600_000);

afterAll(async () => {
  await db?.end();
  await started?.close();
  if (root) rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
}, 120_000);

suite('T2344 · GET /learning/candidates/:id', () => {
  let candidateId = '';

  it('Q8 · the same subject from a second execution is a corroboration; still one candidate', async () => {
    const first = await asAgent().send(body()).expect(201);
    candidateId = first.body.candidateId;
    const second = await asAgent()
      .send(body({ executionId: executions[1], subject: 'Database before integration-tests!', statement: 'Start Postgres first.', evidence: [{ evidenceId: 'ev_2', digest: { sha256: DIGEST } }] }))
      .expect(200);
    expect(second.body).toMatchObject({ candidateId, corroborationId: expect.any(String) });
    const n = await db.query(`SELECT count(*)::int AS n FROM learning_candidates WHERE "subjectKey" = 'architecture:database before integration tests'`);
    expect(n.rows[0].n).toBe(1);
  });

  it('returns everything FR-LRN-071 lists in one response', async () => {
    const res = await view(candidateId).expect(200);
    expect(res.body.candidate).toMatchObject({
      id: candidateId,
      statement: 'Integration tests need the local database started first.',
      category: 'architecture',
      confidenceLevel: 'medium',
      confidenceBasis: 'Three failing runs.',
      claimedScope: { kind: 'project', projectIds: [projectId] },
      state: 'proposed',
    });
    expect(res.body.candidate.transitions[0]).toMatchObject({ seq: 1, state: 'proposed' });
    expect(res.body.source).toMatchObject({ kind: 'execution', executionId: executions[0] });
    expect(res.body.corroborations).toHaveLength(1);
    expect(res.body.corroborations[0]).toMatchObject({ executionId: executions[1], statement: 'Start Postgres first.' });
    expect(Array.isArray(res.body.evidence)).toBe(true);
    expect(res.body).toHaveProperty('withheldEvidenceCount');
  });

  it('withholds evidence from a reader the access policy does not grant — EPIC-032’s policy over EPIC-024, which grants this reader nothing on the project (FR-LRN-016)', async () => {
    const res = await view(candidateId).expect(200);
    expect(res.body.evidence).toEqual([{ state: 'withheld' }]);
    expect(res.body.corroborations[0].evidence).toEqual([{ state: 'withheld' }]);
    // The count covers every citation the reader cannot see — the candidate's own and its corroborations'.
    expect(res.body.withheldEvidenceCount).toBe(2);
  });

  it('shows the state of each citation to a reader who may see it', async () => {
    const real = ports.readerAccess;
    ports.readerAccess = { async canRead(_r, target) { return target.id === projectId; } };
    try {
      const res = await view(candidateId).expect(200);
      expect(res.body.evidence[0]).toMatchObject({ state: 'verified', evidenceId: 'ev_1', digest: DIGEST });
      expect(res.body.corroborations[0].evidence[0]).toMatchObject({ state: 'verified', evidenceId: 'ev_2' });
      expect(res.body.withheldEvidenceCount).toBe(0);
    } finally {
      ports.readerAccess = real;
    }
  });

  it('a superseding candidate shows the entry it replaces side by side (FR-LRN-072)', async () => {
    const seed = await asAgent().send(body({ subject: 'old fact' })).expect(201);
    const { entryId, versionId } = await approvedEntry(seed.body.candidateId);
    const sup = await asAgent().send(body({ subject: 'old fact', kind: 'supersede', targetVersionId: versionId, statement: 'The new fact.' })).expect(201);
    const res = await view(sup.body.candidateId).expect(200);
    expect(res.body.supersedes).toMatchObject({ entryId, versionId, version: 1, statement: 'The old fact.', scope: { kind: 'project' }, classification: 'internal' });
    expect(res.body.candidate.statement).toBe('The new fact.');
  });

  it('a new candidate on an approved subject names the entry it conflicts with (FR-LRN-036)', async () => {
    const res0 = await asAgent().send(body({ subject: 'old fact', statement: 'The opposite of the old fact.', executionId: executions[1] })).expect(201);
    const res = await view(res0.body.candidateId).expect(200);
    expect(res.body.conflictsWith).toMatchObject({ statement: 'The old fact.', version: 1 });
  });

  it('another workspace’s candidate is 404, not 403 (FR-LRN-008, U1)', async () => {
    const { SessionService } = await import('../../src/modules/auth/sessions.js');
    const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
    const session = started.app.get(SessionService, { strict: false }).create({ userId: 'u_elsewhere', workspaceId: 'ws_elsewhere', email: 'e@example.test', displayName: 'Elsewhere' });
    const res = await view(candidateId, `${SESSION_COOKIE}=${session.token}`).expect(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('no session is 401', async () => {
    await api().get(`/v1/learning/candidates/${candidateId}`).expect(401);
  });
});
