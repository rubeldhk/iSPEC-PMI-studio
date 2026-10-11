/**
 * `T2185`, `T2216` (EPIC-039, API contract §6, `FR-HUB-053`, `FR-HUB-055`,
 * `SC-HUB-006`, quickstart Q17) — evidence intake through the real
 * `AppModule`: the enqueue route, the read route, and the
 * `integrations.evidence-intake` job handler driven by the manual ticker
 * exactly as the timer drives it in production.
 *
 * `EvidenceSink` is bound by the module to `EPIC-032`'s `EvidenceService` and
 * `CompletionGate` (`T2215`). Before that it was refusing, and this file
 * asserted `refused / evidence-seam-unbound`; now an intake for work no
 * Contract binds records `not-contributed / no-binding` without reading
 * anything, and `T2216` walks Q17 end to end.
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

  it('with EvidenceSink bound, work no Contract binds is not-contributed / no-binding and nothing is read (DEF-032-002)', async () => {
    const { body } = await request(t.api).post(path(t.projectA)).set('Cookie', t.cookie).send(BODY).expect(202);
    const before = await t.sql<{ n: string }>(`SELECT count(*)::text AS n FROM "capability_resolutions" WHERE "caller" = 'evidence-intake'`);
    await t.tick();
    const view = await request(t.api).get(`${path(t.projectA)}/${body.intakeId}`).set('Cookie', t.cookie).expect(200);
    expect(view.body).toMatchObject({ state: 'not-contributed', reason: 'no-binding', resolutionIds: [], attestationId: null });
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

suite("T2216 · quickstart Q17 end to end — a bound task's test-result item moves unmet → met from fixture results alone (SC-HUB-006)", () => {
  // What this shows, and what it does not: the item's state is read at
  // EPIC-032's `CompletionGate.evaluate` (through `GET /evidence/:workRef/unmet`
  // and `/status`). It is NOT a loop transition — `DEF-032-006` (deferred to
  // EPIC-030) records that the loop consumes none of the evidence seams, so no
  // loop moves because of this evidence, and this test does not claim one.
  const WORK = { type: 'task', id: 'tk_q17' };
  const evidencePath = `/v1/evidence/task:tk_q17`;

  it('binds the task to task-completion with tests-pass unmet', async () => {
    // Health first: the job ticks health and intake together, and a first
    // resolution against never-checked health would be refused health-unknown.
    await t.tick();
    const bound = await request(t.api)
      .post('/v1/evidence/bindings')
      .set('Cookie', t.cookie)
      .send({ workRef: WORK, workClass: 'task-completion', projectId: t.projectA, subject: { type: 'file', id: 'art_q17', version: 1 } });
    expect(bound.status, JSON.stringify(bound.body)).toBe(201);
    const unmet = await request(t.api).get(`${evidencePath}/unmet`).set('Cookie', t.cookie).expect(200);
    expect(unmet.body.unmet).toContain('tests-pass');
  });

  it('the intake reads ReadTestResults through fixture-ci and contributes an inline test-result Statement', async () => {
    const { body } = await request(t.api)
      .post(path(t.projectA))
      .set('Cookie', t.cookie)
      .send({ ...BODY, workRef: WORK, contractItemId: 'tests-pass', attestedArtifact: { id: 'art_q17', version: 1 } })
      .expect(202);
    await t.tick();
    const view = await request(t.api).get(`${path(t.projectA)}/${body.intakeId}`).set('Cookie', t.cookie).expect(200);
    expect(view.body, JSON.stringify(view.body)).toMatchObject({ state: 'contributed', reason: null });
    expect(typeof view.body.attestationId).toBe('string');
    expect(view.body.resolutionIds).toHaveLength(1);
    const rows = await t.sql<{ source: string; sourceVersion: string; storage: string; type: string }>(
      `SELECT "source","sourceVersion","storage","type" FROM "evidence_items" WHERE "id" = $1`,
      [view.body.attestationId],
    );
    // FR-EVS-041: recorded with the version AttestationSource authorised; inline, never referenced (DEF-032-004).
    expect(rows).toEqual([{ source: 'pmi-adapter:fixture-ci', sourceVersion: '0.1.0', storage: 'stored', type: 'https://in-toto.io/attestation/test-result/v0.1' }]);
  });

  it('CompletionGate.evaluate now reads tests-pass as met, from that evidence', async () => {
    const unmet = await request(t.api).get(`${evidencePath}/unmet`).set('Cookie', t.cookie).expect(200);
    expect(unmet.body.unmet).not.toContain('tests-pass');
    expect(unmet.body.unmet).toEqual(['reviewed']);
  });

  it('an external source the registry does not list is still refused by EPIC-032 (FR-EVS-040)', async () => {
    const res = await request(t.api)
      .post('/v1/evidence')
      .set('Cookie', t.cookie)
      .send({
        attestation: { _type: 'https://in-toto.io/Statement/v1', subject: [{ name: 'x@y', digest: { gitCommit: SHA } }], predicateType: 'https://in-toto.io/attestation/test-result/v0.1', predicate: { result: 'PASSED' } },
        attestedArtifact: { id: 'art_q17', version: 1 },
        attachedTo: WORK,
        producedAt: new Date().toISOString(),
        source: { uri: 'pmi-adapter:github-rest' },
        projectId: t.projectA,
      });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('not an authorised evidence source');
  });
});
