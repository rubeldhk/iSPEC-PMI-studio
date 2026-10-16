/**
 * EPIC-048 — the composed application, ready for a learning scenario.
 *
 * `AppModule` + PostgreSQL + a session, a project with its connector credential,
 * registered executions, and the workspace's learning policy written through
 * `EPIC-019`'s own route. Everything on `main` is real. The unmerged ports are
 * left **refusing**; a test rebinds the ones it needs through `ports`, visibly.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { Client } from 'pg';
import { CONTRACT_VERSION } from '@pmi/execution-registry-contract';
import { startAuthenticatedApp, type AuthenticatedApp } from './authenticated-app.js';
import { DIGEST } from './learning-fixtures.js';
import { POLICY, verified } from './learning-ports.js';
import type { LearningPorts, ResolvedEvidence } from '../../src/modules/learning/learning.tokens.js';

export const HEADERS = { 'x-contract-version': CONTRACT_VERSION };

export interface LearningApp {
  readonly started: AuthenticatedApp;
  readonly db: Client;
  readonly projectId: string;
  readonly token: string;
  /** The connector credential's principal — an agent, as far as this Epic is concerned. */
  readonly agentPrincipalId: string;
  readonly executions: string[];
  readonly ports: LearningPorts;
  api(): ReturnType<typeof request>;
  /** A session cookie for another user of the workspace (seeded in `users`). */
  cookieFor(userId: string, workspaceId?: string): Promise<string>;
  register(key: string): Promise<string>;
  submit(body: Record<string, unknown>): request.Test;
  body(over?: Record<string, unknown>): Record<string, unknown>;
  bindNotAnExpert(): void;
  bindEvidence(ids?: readonly string[]): void;
  close(): Promise<void>;
}

export async function startLearningApp(options: { workspaceId: string; policy?: object; users?: readonly string[] }): Promise<LearningApp> {
  const ws = options.workspaceId;
  const root = mkdtempSync(join(tmpdir(), `pmi-${ws}-`));
  process.env['PMI_PROJECTS_ROOT'] = root;
  process.env['PMI_PROJECTS_ROOT_HOST'] = root;
  const started = await startAuthenticatedApp({
    workspaceId: ws,
    userId: 'u_owner',
    async seed(db, ids) {
      for (const u of options.users ?? ['u_rev', 'u_rev2']) {
        await db.query(`INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt") VALUES ($1,$2,$3,$1,'unused',now())`, [u, ids.workspaceId, `${u}@example.test`]);
      }
    },
  });
  const db = new Client({ connectionString: started.databaseUrl });
  await db.connect();
  const api = () => request(started.app.getHttpServer());

  const created = await api().post('/v1/projects').set('Cookie', started.cookie).send({ name: `P ${ws}`, rootPath: ws }).expect(201);
  const projectId = created.body.id as string;
  const token = created.body.connectorCredential.value as string;
  const cred = await db.query(`SELECT "principalId" FROM connector_credentials WHERE id = $1`, [created.body.connectorCredential.id]);
  const agentPrincipalId = String(cred.rows[0].principalId);

  await api().post('/v1/steering').set('Cookie', started.cookie).send({ subject: 'learning_policy', scopeType: 'workspace', scopeRef: ws, content: JSON.stringify(options.policy ?? POLICY) }).expect(201);

  const { LEARNING_PORTS_TOKEN } = await import('../../src/modules/learning/learning.tokens.js');
  const ports = started.app.get(LEARNING_PORTS_TOKEN, { strict: false }) as LearningPorts;

  const register = async (key: string): Promise<string> => {
    const reg = await api()
      .post('/v1/executions')
      .set({ Authorization: `Bearer ${token}`, ...HEADERS })
      .set('Idempotency-Key', key)
      .send({ command: 'specify', argsSanitized: { feature: key }, input: { targetType: 'project', targetId: projectId, targetVersion: 1 }, correlationId: `c_${key}`, idempotencyKey: key, contractVersion: CONTRACT_VERSION })
      .expect(201);
    return reg.body.executionId as string;
  };
  const executions = [await register(`reg_${ws}_1`)];

  const app: LearningApp = {
    started,
    db,
    projectId,
    token,
    agentPrincipalId,
    executions,
    ports,
    api,
    async cookieFor(userId, workspaceId = ws) {
      const { SessionService } = await import('../../src/modules/auth/sessions.js');
      const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
      const session = started.app.get(SessionService, { strict: false }).create({ userId, workspaceId, email: `${userId}@example.test`, displayName: userId });
      return `${SESSION_COOKIE}=${session.token}`;
    },
    register,
    submit: (body) => api().post(`/v1/projects/${projectId}/learning/candidates`).set({ Authorization: `Bearer ${token}` }).send(body),
    body: (over = {}) => ({
      schemaVersion: 1,
      executionId: executions[0],
      kind: 'new',
      statement: 'Integration tests need the local database started first.',
      category: 'architecture',
      subject: `subject ${Math.random().toString(36).slice(2)}`,
      evidence: [{ evidenceId: 'ev_1', digest: { sha256: DIGEST } }],
      confidence: { level: 'medium', basis: 'Three failing runs.' },
      claimedScope: { kind: 'project', projectIds: [projectId] },
      idempotencyKey: `idem_${Math.random().toString(36).slice(2)}`,
      correlationId: 'corr',
      ...over,
    }),
    bindNotAnExpert() {
      ports.experts = { async forExecution() { return null; } };
    },
    bindEvidence(ids = ['ev_1', 'ev_2']) {
      const known = new Map<string, ResolvedEvidence>(ids.map((id) => [id, verified(id, { attestedTarget: { type: 'project', id: projectId } })]));
      ports.evidence = {
        async resolve(w, list) {
          const out = new Map<string, ResolvedEvidence>();
          if (w === ws) for (const id of list) if (known.has(id)) out.set(id, known.get(id)!);
          return out;
        },
      };
    },
    async close() {
      await db.end();
      await started.close();
      rmSync(root, { recursive: true, force: true });
      delete process.env['PMI_PROJECTS_ROOT'];
      delete process.env['PMI_PROJECTS_ROOT_HOST'];
    },
  };
  return app;
}
