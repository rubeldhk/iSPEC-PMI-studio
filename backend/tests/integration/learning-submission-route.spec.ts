/**
 * `T2334` (EPIC-048, US1) — submission through the real routes of the composed
 * application (Constitution XI Tier 1).
 *
 * - `POST /learning/candidates` — a person, through the session;
 * - `POST /projects/:projectId/learning/candidates` — an agent, through
 *   `ConnectorAuthGuard` with scope `learning.submit`;
 * - quickstart Q1, Q2, Q3, Q4, Q5, Q26;
 * - identity fields in a body are ignored; no session is `401`.
 *
 * ## What is real and what is bound in-test
 *
 * Real: `AppModule`, PostgreSQL, the session, the connector credential, the
 * execution registry (`EPIC-037`), steering (`EPIC-019`), audit, the store. The
 * unmerged `EPIC-047` and `EPIC-032` ports (`ExpertProvenance`, `EvidenceReads`) are first asserted **refusing** —
 * that is Q3 — and only then bound by a recorder, visibly, below. The module
 * default stays refusing. Q26 needs a provisional execution, which nothing on
 * `main` can register yet (`EPIC-037`'s provisional intake is reserved,
 * `FR-PIC-034`), so the real `Executions` port is wrapped for one id, visibly.
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

const WS = 'ws_lrn';
const HEADERS = { 'x-contract-version': CONTRACT_VERSION };

let started: AuthenticatedApp;
let db: Client;
let root: string;
let projectId = '';
let token = '';
let executionId = '';
let ports: LearningPorts;

function api(): ReturnType<typeof request> {
  return request(started.app.getHttpServer());
}

function body(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    executionId,
    kind: 'new',
    statement: 'Integration tests need the local database started first.',
    category: 'architecture',
    subject: `prerequisites ${Math.random().toString(36).slice(2)}`,
    evidence: [{ evidenceId: 'ev_1', digest: { sha256: DIGEST } }],
    confidence: { level: 'medium', basis: 'Observed three failing runs without it.' },
    claimedScope: { kind: 'project', projectIds: [projectId] },
    idempotencyKey: `idem_${Math.random().toString(36).slice(2)}`,
    correlationId: 'corr_route',
    ...over,
  };
}

function asAgent(path = `/v1/projects/${projectId}/learning/candidates`) {
  return api().post(path).set({ Authorization: `Bearer ${token}` });
}

async function count(table: string, where = 'true', params: unknown[] = []): Promise<number> {
  const r = await db.query(`SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`, params);
  return Number(r.rows[0].n);
}

async function history(id: string): Promise<{ type: string; payload?: Record<string, unknown> }[]> {
  const res = await api().get(`/v1/executions/${id}/history`).set({ Authorization: `Bearer ${token}`, ...HEADERS }).expect(200);
  return res.body as { type: string }[];
}

beforeAll(async () => {
  if (noRuntime) return;
  root = mkdtempSync(join(tmpdir(), 'pmi-learning-root-'));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  started = await startAuthenticatedApp({ workspaceId: WS, userId: 'u_owner' });
  db = new Client({ connectionString: started.databaseUrl });
  await db.connect();

  const created = await api().post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Learning', rootPath: 'learning' }).expect(201);
  projectId = created.body.id;
  token = created.body.connectorCredential.value;

  const reg = await api()
    .post('/v1/executions')
    .set({ Authorization: `Bearer ${token}`, ...HEADERS })
    .set('Idempotency-Key', 'reg_learning')
    .send({ command: 'specify', argsSanitized: { feature: 'Learning' }, input: { targetType: 'project', targetId: projectId, targetVersion: 1 }, correlationId: 'corr_reg', idempotencyKey: 'reg_learning', contractVersion: CONTRACT_VERSION })
    .expect(201);
  executionId = reg.body.executionId;

  // The workspace's learning policy, through EPIC-019's own route.
  await api()
    .post('/v1/steering')
    .set('Cookie', started.cookie)
    .send({ subject: 'learning_policy', scopeType: 'workspace', scopeRef: WS, content: JSON.stringify(POLICY) })
    .expect(201);

  const { LEARNING_PORTS_TOKEN } = await import('../../src/modules/learning/learning.tokens.js');
  ports = started.app.get(LEARNING_PORTS_TOKEN, { strict: false }) as LearningPorts;
}, 600_000);

afterAll(async () => {
  await db?.end();
  await started?.close();
  if (root) rmSync(root, { recursive: true, force: true });
  delete process.env['PMI_PROJECTS_ROOT'];
  delete process.env['PMI_PROJECTS_ROOT_HOST'];
}, 120_000);

suite('T2334 · submission through the composed application', () => {
  /**
   * Phase 9 (`T2395`, `T2401`) — EPIC-047 and EPIC-032 are on main and bound.
   * These two cases first asserted the 503s those ports gave while unbound;
   * they now assert what the real owners answer.
   */
  describe('the default bindings — EPIC-047 and EPIC-032 answer for real', () => {
    it('an execution that is no Expert session is not refused for want of ExpertProvenance (R-048-10)', async () => {
      const res = await asAgent().send(body({ idempotencyKey: 'real-047' }));
      expect(res.status).not.toBe(503);
      expect(JSON.stringify(res.body)).not.toContain('ExpertProvenance');
    });

    it('Q3 · evidence EPIC-032 does not hold is refused 400 naming it, storing nothing (FR-LRN-012)', async () => {
      const res = await asAgent().send(body({ idempotencyKey: 'q3' })).expect(400);
      expect(res.body.error.details.unresolvable).toEqual(['ev_1']);
      expect(await count('learning_candidates')).toBe(0);
    });
  });

  describe('with EvidenceReads bound by a recorder (visible, in-test)', () => {
    const asked: string[][] = [];

    beforeAll(() => {
      if (noRuntime) return;
      const known = new Map<string, ResolvedEvidence>([['ev_1', verified('ev_1', { attestedTarget: { type: 'project', id: projectId } })]]);
      ports.evidence = {
        async resolve(workspaceId, ids) {
          asked.push([...ids]);
          const out = new Map<string, ResolvedEvidence>();
          if (workspaceId === WS) for (const id of ids) if (known.has(id)) out.set(id, known.get(id)!);
          return out;
        },
      };
    });

    it('an agent submits through the connector route: 201, proposed, an event on its execution', async () => {
      const res = await asAgent().send(body()).expect(201);
      expect(res.body).toMatchObject({ state: 'proposed', late: false, provisional: false });
      const row = await db.query(`SELECT * FROM learning_candidates WHERE id = $1`, [res.body.candidateId]);
      expect(row.rows[0]).toMatchObject({ workspaceId: WS, projectId, sourceKind: 'execution', executionId });
      const events = await history(executionId);
      expect(events.some((e) => e.type === 'learning-candidate-recorded')).toBe(true);
      expect(asked.length).toBeGreaterThan(0);
    });

    it('a person submits through the session route, as themselves (FR-LRN-006)', async () => {
      const { executionId: _x, ...personBody } = body();
      const res = await api().post('/v1/learning/candidates').set('Cookie', started.cookie).send({ ...personBody, projectId }).expect(201);
      const row = await db.query(`SELECT "sourceKind", "sourcePrincipalId", "executionId" FROM learning_candidates WHERE id = $1`, [res.body.candidateId]);
      expect(row.rows[0]).toEqual({ sourceKind: 'person', sourcePrincipalId: 'u_owner', executionId: null });
    });

    it('Q1 · names every missing element, and records refused on the execution', async () => {
      const { evidence: _e, confidence: _c, claimedScope: _s, ...partial } = body({ idempotencyKey: 'q1' });
      const res = await asAgent().send(partial).expect(400);
      expect([...res.body.error.details.missing].sort()).toEqual(['confidence', 'evidence', 'scope']);
      const events = await history(executionId);
      expect(events.filter((e) => e.type === 'learning-candidate-recorded').length).toBeGreaterThanOrEqual(2);
    });

    it('Q2 · an execution that is not registered is refused; nothing stored', async () => {
      const before = await count('learning_candidates');
      const res = await asAgent().send(body({ executionId: 'exe_not_registered' })).expect(400);
      expect(res.body.error.message).toMatch(/not registered/);
      expect(await count('learning_candidates')).toBe(before);
    });

    it('Q4 · a GitHub token is refused naming the rule and the field; no row anywhere', async () => {
      const res = await asAgent().send(body({ idempotencyKey: 'q4', statement: `use ghp_${'Q'.repeat(36)} in CI` })).expect(400);
      expect(res.body.error.details).toEqual({ rule: 'github-token', field: 'statement' });
      expect(JSON.stringify(res.body)).not.toContain('QQQQ');
      expect(await count('learning_candidates', `"idempotencyKey" = 'q4'`)).toBe(0);
    });

    it('Q5 · a retry with the same idempotencyKey returns the original; one row', async () => {
      const once = body({ idempotencyKey: 'q5' });
      const first = await asAgent().send(once).expect(201);
      const again = await asAgent().send(once).expect(200);
      expect(again.body.candidateId).toBe(first.body.candidateId);
      expect(await count('learning_candidates', `"idempotencyKey" = 'q5'`)).toBe(1);
    });

    it('Q26 · a provisional execution’s candidate stays proposed and asks for no decision', async () => {
      // EPIC-037 cannot register a provisional execution on main (FR-PIC-034), so
      // the real port is wrapped for this one id — visibly, here.
      const real = ports.executions;
      ports.executions = {
        ...real,
        async describe(ws, id) {
          return id === 'exe_offline' ? { ...(await real.describe(ws, executionId))!, executionId: 'exe_offline', governanceState: 'provisional' } : real.describe(ws, id);
        },
        async appendLearningEvent() {},
      };
      try {
        const res = await asAgent().send(body({ executionId: 'exe_offline' })).expect(201);
        expect(res.body).toMatchObject({ state: 'proposed', provisional: true, reasonIfNot: ['execution-not-governed'] });
      } finally {
        ports.executions = real;
      }
    });

    it('T2687 · concurrent submissions from one execution on different subjects stop at the bound, in PostgreSQL too (FR-LRN-007)', async () => {
      const reg = await api()
        .post('/v1/executions')
        .set({ Authorization: `Bearer ${token}`, ...HEADERS })
        .set('Idempotency-Key', 'reg_bound')
        .send({ command: 'specify', argsSanitized: { feature: 'bound' }, input: { targetType: 'project', targetId: projectId, targetVersion: 1 }, correlationId: 'corr_bound', idempotencyKey: 'reg_bound', contractVersion: CONTRACT_VERSION })
        .expect(201);
      const exe = reg.body.executionId as string;
      const statuses = await Promise.all(
        Array.from({ length: POLICY.maxCandidatesPerExecution + 4 }, (_, i) => asAgent().send(body({ executionId: exe, subject: `bound race ${i}` })).then((r) => r.status)),
      );
      expect(statuses.filter((s) => s === 201)).toHaveLength(POLICY.maxCandidatesPerExecution);
      expect(statuses.filter((s) => s === 400)).toHaveLength(4);
      expect(await count('learning_candidates', `"executionId" = $1`, [exe])).toBe(POLICY.maxCandidatesPerExecution);
    });

    it('identity fields in the body are ignored — the credential and the session decide', async () => {
      const res = await asAgent()
        .send(body({ workspaceId: 'ws_other', sourcePrincipalId: 'u_forged', actor: { kind: 'human', id: 'u_forged' }, requestedBy: 'u_forged' }))
        .expect(201);
      const row = await db.query(`SELECT "workspaceId", "sourcePrincipalId" FROM learning_candidates WHERE id = $1`, [res.body.candidateId]);
      expect(row.rows[0].workspaceId).toBe(WS);
      expect(row.rows[0].sourcePrincipalId).not.toBe('u_forged');
    });
  });

  describe('who may call (spec Assumption 11, analysis U1)', () => {
    it('no session → 401 on the session route', async () => {
      await api().post('/v1/learning/candidates').send(body()).expect(401);
    });

    it('no credential → 401 on the connector route', async () => {
      await api().post(`/v1/projects/${projectId}/learning/candidates`).send(body()).expect(401);
    });

    it('another project’s path → 404 — existence is not disclosed', async () => {
      await asAgent('/v1/projects/p_somebody_else/learning/candidates').send(body()).expect(404);
    });
  });
});
