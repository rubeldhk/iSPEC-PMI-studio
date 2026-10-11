/**
 * `T2570` (EPIC-047 Convergence) — a contract's risk class selects its
 * approval band, and `EPIC-031` still does the classifying.
 *
 * `FR-EXP-005`, `FR-DPE-003`, `R-047-16`, `R-047-17`, fourth audit finding F1.
 * Constitution XI Tier 1: the composed application, real sessions, a real
 * database, `EPIC-031`'s real engine and `EPIC-019`'s real steering.
 *
 * A contract is submitted as `expert-contract.approve.<riskClass>`. With no
 * classification rule, every class takes the most restrictive band and waits
 * for a human (`FR-DPE-004`). With the shipped workspace template loaded, each
 * class reaches the authority its own band calls for under the tenant's policy.
 * A medium contract refused because its band needs gates is not refused for
 * good: once policy changes, the same version is submitted again (`T2575`).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { RiskBand } from '../../src/modules/experts/expert.types.js';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { contract } from '../helpers/expert-fixtures.js';

const PREFIX = 'v1';
const WS = 'ws_experts_classify';
const AUTHOR = 'u_author';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(here, '../../../packages/decision-contract/classification-rules/expert-contracts.workspace.json');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

let harness: AuthenticatedApp;
let app: INestApplication;

beforeAll(async () => {
  if (noRuntime) return;
  harness = await startAuthenticatedApp({
    prefix: PREFIX,
    workspaceId: WS,
    userId: AUTHOR,
    async seed(db, ids) {
      await db.query(
        `INSERT INTO "access_grants" ("id","workspaceId","artifactType","artifactId","userId","level","grantedById")
         VALUES ('g_author',$1,'expert-registry',$1,$2,'edit',$2)`,
        [ids.workspaceId, ids.userId],
      );
    },
  });
  app = harness.app;
}, 600_000);

afterAll(async () => {
  await harness?.close();
}, 120_000);

const api = () => request(app.getHttpServer());

async function registered(key: string, riskClass: RiskBand): Promise<string> {
  const res = await api()
    .post(`/${PREFIX}/experts`)
    .set('Cookie', harness.cookie)
    .send({
      key,
      name: key,
      contract: contract({ riskClass, evidenceContract: { workClass: 'task-completion', contractVersion: 1 } }),
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.expert.id as string;
}

async function submitted(expertId: string): Promise<{ status: number; body: { status: string; decisionId: string } }> {
  const res = await api().post(`/${PREFIX}/experts/${expertId}/contract-versions/1/submit`).set('Cookie', harness.cookie);
  return { status: res.status, body: res.body };
}

async function explained(decisionId: string): Promise<{ effectiveClass: string; actionType?: string }> {
  const res = await api().get(`/${PREFIX}/decisions/${decisionId}/explanation`).set('Cookie', harness.cookie);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

suite('T2570 · a contract’s risk class selects its approval band (FR-EXP-005, FR-DPE-003)', () => {
  it('with no classification rule, every class takes the most restrictive band and waits for a human', async () => {
    for (const riskClass of ['low', 'medium', 'high'] as const) {
      const id = await registered(`unruled-${riskClass}`, riskClass);
      const res = await submitted(id);
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.status).toBe('submitted');
      expect((await explained(res.body.decisionId)).effectiveClass).toBe('high');
    }
  });

  it('with the shipped workspace template loaded, each class reaches the authority its band calls for', async () => {
    const { SteeringService } = await import('../../src/modules/steering/steering.service.js');
    const template = JSON.parse(readFileSync(TEMPLATE, 'utf8')) as { rules: unknown[] };
    await app.get(SteeringService, { strict: false }).create(WS, {
      scope: { scopeType: 'workspace', scopeRef: WS },
      subject: 'risk-classification',
      content: JSON.stringify({ rules: template.rules }),
      createdById: AUTHOR,
    });

    // low — auto-executes under the platform default policy; the version stands approved.
    const low = await submitted(await registered('ruled-low', 'low'));
    expect([low.status, low.body.status]).toEqual([201, 'approved']);
    expect((await explained(low.body.decisionId)).effectiveClass).toBe('low');

    // high — awaits a human other than its author.
    const high = await submitted(await registered('ruled-high', 'high'));
    expect([high.status, high.body.status]).toEqual([201, 'submitted']);
    expect((await explained(high.body.decisionId)).effectiveClass).toBe('high');
  });

  it('a medium contract refused for naming no gates is not refused for good', async () => {
    const id = await registered('ruled-medium', 'medium');
    const first = await submitted(id);
    expect([first.status, first.body.status]).toEqual([201, 'refused']);
    expect((await explained(first.body.decisionId)).effectiveClass).toBe('medium');

    // The tenant decides medium contracts go to a human; the same version is submitted again.
    const issued = await api()
      .post(`/${PREFIX}/decision-policies`)
      .set('Cookie', harness.cookie)
      .send({
        bandTreatment: { low: 'auto-execute', medium: 'human-approval', high: 'human-approval' },
        selfApprovalAllowed: [],
        automatedActions: [],
      });
    expect(issued.status, JSON.stringify(issued.body)).toBe(201);
    const again = await submitted(id);
    expect([again.status, again.body.status]).toEqual([201, 'submitted']);
    expect(again.body.decisionId).not.toBe(first.body.decisionId);
    const read = await api().get(`/${PREFIX}/experts/${id}`).set('Cookie', harness.cookie);
    expect(read.body.versions[0].decisionId).toBe(again.body.decisionId);
  });
});
