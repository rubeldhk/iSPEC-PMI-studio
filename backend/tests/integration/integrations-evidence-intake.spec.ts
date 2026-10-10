/**
 * `T2185` (EPIC-039, API contract §6, `FR-HUB-053`, `FR-HUB-055`) — evidence
 * intake through the real `AppModule`: the enqueue route, the read route, and
 * the `integrations.evidence-intake` job handler driven by the manual ticker
 * exactly as the timer drives it in production.
 *
 * `EvidenceSink` is left **unbound** here, as the module binds it: the intake is
 * recorded `refused / evidence-seam-unbound` and nothing is contributed — the
 * Evidence Contract item stays unmet (`FR-HUB-055`). The bound path is `T2216`.
 *
 * Written to FAIL before `T2186`.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INTAKE_JOB } from '../../src/modules/integrations/evidence/intake.job.js';
import { startIntegrationsApp, type IntegrationsApp } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const SHA = 'b'.repeat(40);
const BODY = { workRef: { type: 'task', id: 'tk_1' }, contractItemId: 'tests-pass', capability: 'ReadTestResults', revision: SHA, attestedArtifact: { id: 'art_1', version: 1 } };

let t: IntegrationsApp;

beforeAll(async () => {
  if (noRuntime) return;
  t = await startIntegrationsApp({ workspaceId: 'ws_intake', userId: 'u_intake' });
  t.bindPolicy();
  const entry = await t.register('fixture-ci');
  await t.configure(t.projectA, 'ReadTestResults', [{ registryEntryId: entry }]).expect(200);
}, 600_000);

afterAll(async () => {
  await t?.stop();
}, 120_000);

const path = (projectId: string): string => `/v1/projects/${projectId}/integrations/evidence-intake`;

suite('T2185 · evidence intake routes and job (API §6)', () => {
  it('the job is named integrations.evidence-intake', () => {
    expect(INTAKE_JOB).toBe('integrations.evidence-intake');
  });

  it('POST enqueues → 202 { intakeId }, pending and due', async () => {
    const res = await request(t.api).post(path(t.projectA)).set('Cookie', t.cookie).send(BODY).expect(202);
    expect(typeof res.body.intakeId).toBe('string');
    const view = await request(t.api).get(`${path(t.projectA)}/${res.body.intakeId}`).set('Cookie', t.cookie).expect(200);
    expect(view.body).toMatchObject({ intakeId: res.body.intakeId, state: 'pending', attempts: 0, resolutionIds: [], attestationId: null });
  });

  it('no revision → 400, recorded not-contributed / no-revision first (FR-HUB-053)', async () => {
    const { revision: _r, ...noRevision } = BODY;
    const res = await request(t.api).post(path(t.projectA)).set('Cookie', t.cookie).send(noRevision).expect(400);
    expect(res.body.error.code).toBe('validation_failed');
    const rows = await t.sql<{ state: string; reason: string }>(`SELECT "state", "reason" FROM "evidence_intake_attempts" WHERE "projectId" = $1 AND "revision" IS NULL`, [t.projectA]);
    expect(rows).toEqual([{ state: 'not-contributed', reason: 'no-revision' }]);
  });

  it('a capability that yields no evidence → 400', async () => {
    await request(t.api).post(path(t.projectA)).set('Cookie', t.cookie).send({ ...BODY, capability: 'SendNotification' }).expect(400);
  });

  it('while EvidenceSink is unbound the job records refused / evidence-seam-unbound and nothing is read (FR-HUB-055)', async () => {
    const { body } = await request(t.api).post(path(t.projectA)).set('Cookie', t.cookie).send(BODY).expect(202);
    const before = await t.sql<{ n: string }>(`SELECT count(*)::text AS n FROM "capability_resolutions" WHERE "caller" = 'evidence-intake'`);
    await t.tick();
    const view = await request(t.api).get(`${path(t.projectA)}/${body.intakeId}`).set('Cookie', t.cookie).expect(200);
    expect(view.body).toMatchObject({ state: 'refused', reason: 'evidence-seam-unbound', resolutionIds: [], attestationId: null });
    const after = await t.sql<{ n: string }>(`SELECT count(*)::text AS n FROM "capability_resolutions" WHERE "caller" = 'evidence-intake'`);
    expect(after).toEqual(before);
  });

  it('an intake is not readable from another project (404)', async () => {
    const { body } = await request(t.api).post(path(t.projectA)).set('Cookie', t.cookie).send(BODY).expect(202);
    await request(t.api).get(`${path(t.projectB)}/${body.intakeId}`).set('Cookie', t.cookie).expect(404);
  });

  it('a project outside the workspace is 404', async () => {
    await request(t.api).post(path(t.foreignProject)).set('Cookie', t.cookie).send(BODY).expect(404);
  });

  it('a connector credential is refused surface_not_accepted (FR-HUB-004)', async () => {
    const res = await request(t.api).post(path(t.projectA)).set('Authorization', `Bearer ${t.tokenA}`).send(BODY);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('surface_not_accepted');
  });
});
