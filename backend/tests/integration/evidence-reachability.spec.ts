/**
 * T856s — Constitution XI Tier 1 for the evidence store (`R-032-8`), written to
 * fail first.
 *
 * Imports the real `AppModule` through `startAuthenticatedApp`, which calls
 * `NestFactory.create(AppModule)` — literally what `main.ts` does. A service
 * test passes happily while its module is unregistered, which is how
 * `DEF-005-001` shipped a 500 on sign-in with every task green.
 *
 * Two halves:
 *
 * 1. **Every route answers** with a platform code rather than the 404 an
 *    unmatched path gets (`DEF-001-006`).
 * 2. **The gate, end to end, over HTTP** (`T863b`): work is bound to a Contract,
 *    a declaration of completion is refused with the unmet items named
 *    (`FR-EVS-030`, `FR-EVS-032`), evidence is contributed through `POST
 *    /evidence`, and the same declaration is then accepted. No service is
 *    called directly; nothing is mocked.
 *
 * `T862e`'s mutation proof targets this file: removing `EvidenceModule` from
 * `app.module.ts` must turn it red.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';

const PREFIX = 'v1';
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

function attestation(predicateType: string, version: number) {
  return {
    attestation: {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ name: 'src/feature.ts', digest: { gitCommit: `c0ffee${version}`.padEnd(40, '0') } }],
      predicateType,
      predicate: { result: 'PASSED' },
    },
    attestedArtifact: { id: 'artifact-t856s', version },
    attachedTo: { type: 'task', id: 'T856s-work' },
    producedAt: new Date().toISOString(),
    source: { uri: 'pmi:qa-suite' },
    projectId: 'p_t856s',
  };
}

suite('T856s · the evidence store is reachable through the composed application (XI Tier 1)', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;
  let cookie = '';

  beforeAll(async () => {
    harness = await startAuthenticatedApp({ prefix: PREFIX, workspaceId: 'ws_t856s' });
    app = harness.app;
    cookie = harness.cookie;
  }, 300_000);

  afterAll(async () => {
    await harness?.close();
  }, 120_000);

  it('resolves EvidenceService from the graph the application actually builds', () => {
    expect(app.get(EvidenceService, { strict: false })).toBeInstanceOf(EvidenceService);
  });

  it.each([
    ['post', `/${PREFIX}/evidence`],
    ['post', `/${PREFIX}/evidence/bindings`],
    ['get', `/${PREFIX}/evidence/task:probe/status`],
    ['get', `/${PREFIX}/evidence/task:probe/unmet`],
    ['post', `/${PREFIX}/evidence/task:probe/complete`],
    ['get', `/${PREFIX}/evidence/rollup`],
  ] as const)('routes %s %s — a handler answers', async (method, route) => {
    // A handler that looked and found nothing answers 404 too, so status alone
    // cannot tell "no such work" from "no such route". The body can: an
    // unmatched path gets the framework's generic body, and a handler names
    // what it looked for.
    const unmatched = await request(app.getHttpServer())
      .get(`/${PREFIX}/evidence/task:probe/not-a-real-sub-resource`)
      .set('Cookie', cookie);
    const response = await request(app.getHttpServer())[method](route).set('Cookie', cookie).send({});
    const code = (response.body as { error?: { code?: string } })?.error?.code;
    expect(code, `${method} ${route} answered ${response.status} with ${String(code)}`).not.toBe('internal_error');
    expect(response.body, `${method} ${route} answered exactly as an unmatched route does`).not.toEqual(unmatched.body);
  });

  it('answers an unowned route with 404 and no platform code, or the check above is vacuous', async () => {
    const unowned = await request(app.getHttpServer())
      .get(`/${PREFIX}/evidence/task:probe/not-a-real-sub-resource`)
      .set('Cookie', cookie);
    const owned = await request(app.getHttpServer())
      .post(`/${PREFIX}/evidence/bindings`)
      .set('Cookie', cookie)
      .send({ workRef: { type: 'task' } });
    expect(owned.status).toBe(400);
    expect(unowned.status).toBe(404);
  });

  describe('the completion gate, end to end over HTTP (FR-EVS-030, T863b)', () => {
    const work = 'task:T856s-work';

    it('binds the work to its Contract with every item unmet (FR-EVS-021)', async () => {
      const bound = await request(app.getHttpServer())
        .post(`/${PREFIX}/evidence/bindings`)
        .set('Cookie', cookie)
        .send({
          workRef: { type: 'task', id: 'T856s-work' },
          workClass: 'task-completion',
          projectId: 'p_t856s',
          subject: { type: 'file', id: 'artifact-t856s', version: 1 },
        });
      expect(bound.status, JSON.stringify(bound.body)).toBe(201);
      expect(bound.body.contractVersion).toBe(1);

      const unmet = await request(app.getHttpServer()).get(`/${PREFIX}/evidence/${work}/unmet`).set('Cookie', cookie);
      expect(unmet.status).toBe(200);
      expect(unmet.body.unmet).toEqual(['tests-pass', 'reviewed']);
    });

    it('refuses a declaration of completion, naming what is missing (FR-EVS-032)', async () => {
      const refused = await request(app.getHttpServer())
        .post(`/${PREFIX}/evidence/${work}/complete`)
        .set('Cookie', cookie)
        .send({});
      expect(refused.status).toBe(409);
      expect(refused.body.error.details.unmet).toEqual(['tests-pass', 'reviewed']);
    });

    it('accepts it once the evidence the Contract requires has been contributed', async () => {
      for (const kind of ['test-result', 'approval'] as const) {
        const contributed = await request(app.getHttpServer())
          .post(`/${PREFIX}/evidence`)
          .set('Cookie', cookie)
          .send(attestation(predicateTypeFor(kind), 1));
        expect(contributed.status, JSON.stringify(contributed.body)).toBe(201);
      }

      const status = await request(app.getHttpServer()).get(`/${PREFIX}/evidence/${work}/status`).set('Cookie', cookie);
      expect(status.body.satisfied).toBe(true);

      const accepted = await request(app.getHttpServer())
        .post(`/${PREFIX}/evidence/${work}/complete`)
        .set('Cookie', cookie)
        .send({});
      expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
      expect(accepted.body).toEqual({ ok: true });
    });

    it('reports the completed work in the rollup, computed from the store (T860g, SC-EVS-008)', async () => {
      const rollup = await request(app.getHttpServer())
        .get(`/${PREFIX}/evidence/rollup?projectId=p_t856s`)
        .set('Cookie', cookie);
      expect(rollup.status).toBe(200);
      expect(rollup.body).toMatchObject({
        projectId: 'p_t856s',
        completed: 1,
        completedSatisfied: 1,
        satisfactionRate: 1,
        inFlight: 0,
        unevaluated: 0,
      });
    });

    it('refuses an attestation that names no subject digest with 400 (FR-EVS-042)', async () => {
      const body = attestation(predicateTypeFor('test-result'), 1);
      const response = await request(app.getHttpServer())
        .post(`/${PREFIX}/evidence`)
        .set('Cookie', cookie)
        .send({ ...body, attestation: { ...body.attestation, subject: [] } });
      expect(response.status).toBe(400);
    });
  });
});
