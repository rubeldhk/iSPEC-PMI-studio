/**
 * `T1925` (EPIC-047) — the registry through its real routes.
 *
 * Constitution XI Tier 1: the composed application, a real session, a real
 * database. Since Phase 9 the two ports are bound to their owners —
 * `EvidenceContracts` to `EPIC-032`'s catalog, `ContractApprovals` to
 * `EPIC-031`'s engine — and are shown working **as composed**, first and last.
 * In between, in-test bindings that record every call (`R-047-13`, analysis
 * finding I1) drive the registry's own behaviour — visibly, here, never in the
 * module.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import { EXPERT_PORTS, type ExpertPorts } from '../../src/modules/experts/experts.tokens.js';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { contract, evidenceKnowing, recordingApprovals, type RecordingApprovals } from '../helpers/expert-fixtures.js';

const PREFIX = 'v1';
const WS = 'ws_experts';
const AUTHOR = 'u_author';
const READER = 'u_reader';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;
let readerCookie = '';
let approvals: RecordingApprovals;
/** The composed bindings, kept before any test replaces them. */
let composed: Pick<ExpertPorts, 'approvals' | 'evidence'>;

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: AUTHOR,
    async seed(db, ids) {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$3,'Reader','unused',now())`,
        [READER, ids.workspaceId, `${READER}@example.test`],
      );
      // FR-EXP-009 — authority is an EPIC-024 grant on the workspace's registry.
      await db.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_author',$1,'expert-registry',$1,$2,'edit',$2),
                ('g_reader',$1,'expert-registry',$1,$3,'read',$2)`,
        [ids.workspaceId, ids.userId, READER],
      );
    },
  });
  app = harness.app;
  const { SessionService } = await import('../../src/modules/auth/sessions.js');
  const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');
  const session = app.get(SessionService, { strict: false }).create({
    userId: READER,
    workspaceId: WS,
    email: `${READER}@example.test`,
    displayName: 'Reader',
  });
  readerCookie = `${SESSION_COOKIE}=${session.token}`;
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const api = () => request(app.getHttpServer());
const body = { key: 'test-engineer', name: 'Test Engineer', contract: contract() };

suite('T1925 · the registry routes', () => {
  it('refuses with no session', async () => {
    expect((await api().get(`/${PREFIX}/experts`)).status).toBe(401);
  });

  it("as composed, EPIC-032's catalog refuses a contract naming an Evidence Contract it does not hold (FR-EXP-022)", async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    composed = { approvals: ports.approvals, evidence: ports.evidence };
    // The fixture names `implementation@1`, which EPIC-032 does not ship.
    const res = await api().post(`/${PREFIX}/experts`).set('Cookie', harness.cookie).send(body);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/Evidence Contract implementation@1 does not exist in EPIC-032/);
  });

  it('with in-test bindings: register, list, read', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    ports.evidence = evidenceKnowing('implementation@1');
    approvals = recordingApprovals();
    ports.approvals = approvals;

    const created = await api().post(`/${PREFIX}/experts`).set('Cookie', harness.cookie).send(body);
    expect(created.status).toBe(201);
    const id = created.body.expert.id as string;

    const list = await api().get(`/${PREFIX}/experts`).set('Cookie', harness.cookie);
    expect(list.status).toBe(200);
    expect(list.body).toEqual([expect.objectContaining({ key: 'test-engineer', effectiveVersion: null, latestVersion: 1 })]);
    const one = await api().get(`/${PREFIX}/experts/${id}`).set('Cookie', harness.cookie);
    expect(one.body.versions.map((v: { status: string }) => v.status)).toEqual(['draft']);
  });

  it('an incomplete contract is refused 400 naming every gap', async () => {
    const { rolePurpose: _r, budget: _b, ...partial } = contract();
    const res = await api()
      .post(`/${PREFIX}/experts`)
      .set('Cookie', harness.cookie)
      .send({ key: 'partial', name: 'Partial', contract: partial });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/role and purpose/);
    expect(JSON.stringify(res.body)).toMatch(/budget/);
  });

  it('a duplicate key is 409', async () => {
    const res = await api().post(`/${PREFIX}/experts`).set('Cookie', harness.cookie).send(body);
    expect(res.status).toBe(409);
  });

  it('version, submit, approve, compare and retire', async () => {
    const [summary] = (await api().get(`/${PREFIX}/experts`).set('Cookie', harness.cookie)).body as { id: string }[];
    const id = summary!.id;
    const v2 = await api()
      .post(`/${PREFIX}/experts/${id}/contract-versions`)
      .set('Cookie', harness.cookie)
      .send({ contract: contract({ riskClass: 'high' }) });
    expect([v2.status, v2.body.version]).toEqual([201, 2]);

    const submitted = await api().post(`/${PREFIX}/experts/${id}/contract-versions/1/submit`).set('Cookie', harness.cookie);
    expect([submitted.status, submitted.body.status]).toEqual([201, 'submitted']);
    expect(approvals.submitted).toHaveLength(1);
    const again = await api().post(`/${PREFIX}/experts/${id}/contract-versions/1/submit`).set('Cookie', harness.cookie);
    expect(again.status).toBe(409);

    approvals.resolve('d_1', 'approved');
    const read = await api().get(`/${PREFIX}/experts/${id}`).set('Cookie', harness.cookie);
    expect(read.body.effectiveVersion.version).toBe(1);

    const diff = await api().get(`/${PREFIX}/experts/${id}/contract-versions/compare?from=1&to=2`).set('Cookie', harness.cookie);
    expect(diff.status).toBe(200);
    expect(diff.body).toHaveLength(12);
    expect(diff.body.filter((d: { changed: boolean }) => d.changed).map((d: { element: string }) => d.element)).toEqual([
      'risk class',
    ]);

    const retired = await api().post(`/${PREFIX}/experts/${id}/retire`).set('Cookie', harness.cookie);
    expect([retired.status, retired.body.status]).toEqual([201, 'retired']);
  });

  it('a reader reads but cannot author (US1/AC6, FR-EXP-009)', async () => {
    expect((await api().get(`/${PREFIX}/experts`).set('Cookie', readerCookie)).status).toBe(200);
    const res = await api().post(`/${PREFIX}/experts`).set('Cookie', readerCookie).send({ ...body, key: 'by-reader' });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toMatch(/FR-EXP-009/);
  });

  it('an Expert in another workspace is not found (FR-EXP-008)', async () => {
    const res = await api().get(`/${PREFIX}/experts/does-not-exist`).set('Cookie', harness.cookie);
    expect(res.status).toBe(404);
  });

  it('Phase 9 · through the composed EPIC-032 and EPIC-031 bindings: registered, submitted, decided and read back', async () => {
    const ports = app.get<ExpertPorts>(EXPERT_PORTS, { strict: false });
    ports.evidence = composed.evidence;
    ports.approvals = composed.approvals;

    // T1980 — a contract naming an Evidence Contract EPIC-032 ships is accepted.
    const created = await api()
      .post(`/${PREFIX}/experts`)
      .set('Cookie', harness.cookie)
      .send({
        key: 'composed-reviewer',
        name: 'Composed Reviewer',
        contract: contract({ evidenceContract: { workClass: 'task-completion', contractVersion: 1 } }),
      });
    expect(created.status).toBe(201);
    const id = created.body.expert.id as string;

    // T1978 — submitting asks EPIC-031 to decide. No steering rule classifies
    // the action, so it takes the most restrictive band and waits for a human
    // (FR-DPE-004, FR-DPE-010): submitted, not approved.
    const submitted = await api().post(`/${PREFIX}/experts/${id}/contract-versions/1/submit`).set('Cookie', harness.cookie);
    expect([submitted.status, submitted.body.status]).toEqual([201, 'submitted']);

    const db = new Client({ connectionString: harness.databaseUrl });
    await db.connect();
    try {
      const { rows } = await db.query(
        `SELECT "projectId","targetType","targetId","objectVersion","proposedClass","effectiveClass","outcome","requestedBy"
           FROM "policy_decisions" WHERE "workspaceId" = $1 AND "actionType" = 'expert-contract.approve'`,
        [WS],
      );
      expect(rows).toEqual([
        {
          projectId: `workspace:${WS}`,
          targetType: 'expert-contract-version',
          targetId: submitted.body.id,
          objectVersion: '1',
          proposedClass: 'medium',
          effectiveClass: 'high',
          outcome: 'pending',
          requestedBy: AUTHOR,
        },
      ]);
    } finally {
      await db.end();
    }

    // Read back on every request, never cached: submitted, and nothing yet approved.
    const read = await api().get(`/${PREFIX}/experts/${id}`).set('Cookie', harness.cookie);
    expect(read.body.versions.map((v: { status: string }) => v.status)).toEqual(['submitted']);
    expect(read.body.effectiveVersion).toBeNull();
  });
});
