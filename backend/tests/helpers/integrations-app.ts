/**
 * EPIC-039 — the composed application, configured for the Integration Hub's
 * route tests the way an operator configures it: a keyring from
 * `PMI_INTEGRATION_KEYS` (a test key generated here, never a real secret), the
 * health job handler on the MANUAL ticker so a test drives it, two projects
 * created through the real route (so each carries a real `pmi_ct_` connector
 * credential), and a project in another workspace.
 *
 * `CapabilityPolicy` is NOT bound here: it stays refusing until a test binds a
 * recording policy itself, visibly (`R-039-13`).
 */
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import request from 'supertest';
import { CapabilityPolicySeam, INTEGRATIONS_TICKER, type CapabilityPolicy, type PolicyStatusView } from '../../src/modules/integrations/integrations.tokens.js';
import type { ManualTicker } from '../../src/modules/integrations/health/ticker.js';
import { HUB } from '../../src/modules/integrations/hub.token.js';
import type { Hub } from '../../src/modules/integrations/hub.js';
import { startAuthenticatedApp, type AuthenticatedApp } from './authenticated-app.js';

export interface IntegrationsApp extends AuthenticatedApp {
  readonly api: ReturnType<AuthenticatedApp['app']['getHttpServer']>;
  readonly projectA: string;
  readonly projectB: string;
  readonly tokenA: string;
  readonly foreignProject: string;
  readonly hub: Hub;
  readonly key: string;
  tick(): Promise<void>;
  bindPolicy(policy?: RecordingPolicy): RecordingPolicy;
  register(key: string): Promise<string>;
  configure(projectId: string, capability: string, adapters: { registryEntryId: string; preference?: number; binding?: Record<string, unknown> }[], extra?: Record<string, unknown>): request.Test;
  /** Run SQL against the test database (seeding a backdated row, reading a table). */
  sql<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<R[]>;
  /** A session cookie for another user of the same workspace, created here with no grant. */
  asUser(userId: string): Promise<string>;
  stop(): Promise<void>;
}

export interface RecordingPolicy extends CapabilityPolicy {
  readonly calls: { method: string; args: unknown }[];
  set(status: PolicyStatusView['status']): void;
}

export function recordingPolicy(): RecordingPolicy {
  let status: PolicyStatusView['status'] = 'permitted';
  const calls: { method: string; args: unknown }[] = [];
  let n = 0;
  return {
    calls,
    set: (s) => {
      status = s;
    },
    requestDecision: async (args) => {
      calls.push({ method: 'requestDecision', args });
      return { decisionId: `route_dec_${(n += 1)}` };
    },
    statusOf: async (workspaceId, decisionId) => {
      calls.push({ method: 'statusOf', args: { workspaceId, decisionId } });
      return { status, explanation: { policyVersion: 'in-test', matchedRule: 'recording policy bound by the test', riskClass: 'low', authorityApplied: 'auto-execute' } };
    },
  };
}

export async function startIntegrationsApp(ids: { workspaceId: string; userId: string }, env: Record<string, string> = {}): Promise<IntegrationsApp> {
  const root = mkdtempSync(join(tmpdir(), 'pmi-hub-root-'));
  const key = randomBytes(32).toString('base64');
  const vars: Record<string, string> = {
    PMI_PROJECTS_ROOT: root,
    PMI_PROJECTS_ROOT_HOST: root,
    PMI_PUBLIC_URL: 'http://localhost:3000',
    PMI_INTEGRATION_SCHEDULER: 'manual',
    PMI_INTEGRATION_KEYS: JSON.stringify({ k1: key }),
    PMI_INTEGRATION_ACTIVE_KEY: 'k1',
    ...env,
  };
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k];
    process.env[k] = v;
  }
  const started = await startAuthenticatedApp({
    ...ids,
    seed: async (db) => {
      await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('ws_foreign','foreign',now())`);
      await db.query(`INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt") VALUES ('u_foreign','ws_foreign','foreign@example.test','F','x',now())`);
      await db.query(`INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ('pr_foreign','ws_foreign','Foreign','u_foreign',now())`);
    },
  });
  const api = started.app.getHttpServer();
  const a = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Alpha', rootPath: 'alpha' }).expect(201);
  const b = await request(api).post('/v1/projects').set('Cookie', started.cookie).send({ name: 'Beta', rootPath: 'beta' }).expect(201);
  const hub = started.app.get<Hub>(HUB, { strict: false });
  const ticker = started.app.get<ManualTicker>(INTEGRATIONS_TICKER, { strict: false });
  const seam = started.app.get(CapabilityPolicySeam, { strict: false });
  return {
    ...started,
    api,
    projectA: a.body.id,
    projectB: b.body.id,
    tokenA: a.body.connectorCredential.value,
    foreignProject: 'pr_foreign',
    hub,
    key,
    tick: () => ticker.advance(),
    bindPolicy: (policy = recordingPolicy()) => {
      seam.bind(policy);
      return policy;
    },
    register: async (k) => (await request(api).post('/v1/integrations/registry').set('Cookie', started.cookie).send({ key: k }).expect(201)).body.id,
    configure: (projectId, capability, adapters, extra = {}) =>
      request(api)
        .put(`/v1/projects/${projectId}/integrations/configuration/${capability}`)
        .set('Cookie', started.cookie)
        .send({ adapters: adapters.map((x, i) => ({ preference: i + 1, ...x })), ...extra }),
    sql: async (text, values = []) => {
      const db = new Client({ connectionString: started.databaseUrl });
      await db.connect();
      try {
        return (await db.query(text, values)).rows;
      } finally {
        await db.end();
      }
    },
    asUser: async (userId) => {
      const db = new Client({ connectionString: started.databaseUrl });
      await db.connect();
      try {
        await db.query(`INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt") VALUES ($1,$2,$3,'Other','unused',now()) ON CONFLICT DO NOTHING`, [userId, ids.workspaceId, `${userId}@example.test`]);
      } finally {
        await db.end();
      }
      const { SessionService } = await import('../../src/modules/auth/sessions.js');
      const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
      const session = started.app.get(SessionService, { strict: false }).create({ userId, workspaceId: ids.workspaceId, email: `${userId}@example.test`, displayName: 'Other' });
      return `${SESSION_COOKIE}=${session.token}`;
    },
    stop: async () => {
      await started.close();
      rmSync(root, { recursive: true, force: true });
      for (const [k, v] of Object.entries(previous)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    },
  };
}
