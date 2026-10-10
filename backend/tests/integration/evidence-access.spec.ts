/**
 * T859i — access and isolation, through the composed application.
 * `FR-EVS-015` (`BR-0062`), `FR-EVS-016` (`BR-0001`).
 *
 * Evidence must not become a side channel around artifact access. Work whose
 * subject is a **specification** — an artifact `EPIC-024` governs by grant — is
 * unreadable through the evidence routes until the reader holds a grant on that
 * specification, and the refusal is `404`, not `403`: a resource the caller
 * cannot see is indistinguishable from one that does not exist (`FR-002`).
 *
 * And evidence never crosses a workspace: work bound in another workspace is
 * not found, by status, by unmet, by completion or in the rollup.
 *
 * Driven through the real `AppModule`, so the `AccessPolicy` under test is the
 * one `EvidenceModule` actually binds — `EPIC-024`'s `AccessInheritanceService`.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { AccessGrantService } from '../../src/modules/access/access-grant.service.js';
import { EVIDENCE_REPOSITORY } from '../../src/modules/evidence/evidence.tokens.js';
import type { EvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';

const PREFIX = 'v1';
const WS = 'ws_t859i';
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T859i · evidence honours artifact access and the workspace boundary', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;
  let cookie = '';

  const bind = (id: string, subject: { type: string; id: string }) =>
    request(app.getHttpServer())
      .post(`/${PREFIX}/evidence/bindings`)
      .set('Cookie', cookie)
      .send({
        workRef: { type: 'task', id },
        workClass: 'task-completion',
        projectId: 'p_t859i',
        subject: { ...subject, version: 1 },
      });

  beforeAll(async () => {
    harness = await startAuthenticatedApp({ prefix: PREFIX, workspaceId: WS, userId: 'u_t859i' });
    app = harness.app;
    cookie = harness.cookie;
  }, 300_000);

  afterAll(async () => {
    await harness?.close();
  }, 120_000);

  describe('FR-EVS-015 — the attested artifact’s access rules apply', () => {
    it('hides work about a specification the reader holds no grant on, as absent', async () => {
      // Refused before anything is written: binding governed work about an
      // artifact is a read of that artifact's existence.
      const bound = await bind('T-spec', { type: 'specification', id: 'spec-secret' });
      expect(bound.status).toBe(404);
      const repository = app.get<EvidenceRepository>(EVIDENCE_REPOSITORY, { strict: false });
      expect(await repository.bindings(WS, { type: 'task', id: 'T-spec' })).toEqual([]);

      for (const route of ['status', 'unmet']) {
        const read = await request(app.getHttpServer())
          .get(`/${PREFIX}/evidence/task:T-spec/${route}`)
          .set('Cookie', cookie);
        expect(read.status, route).toBe(404);
        expect(read.body.error.code).toBe('not_found');
      }
    });

    it('counts nothing the reader cannot open in the rollup', async () => {
      const rollup = await request(app.getHttpServer()).get(`/${PREFIX}/evidence/rollup`).set('Cookie', cookie);
      expect(rollup.status).toBe(200);
      expect(rollup.body.inFlight).toBe(0);
    });

    it('shows the same work once the reader is granted the specification', async () => {
      await app.get(AccessGrantService, { strict: false }).grant(
        WS,
        { artifactType: 'specification', artifactId: 'spec-secret' },
        { userId: 'u_t859i', level: 'read', grantedById: 'u_admin' },
      );
      expect((await bind('T-spec', { type: 'specification', id: 'spec-secret' })).status).toBe(201);
      const read = await request(app.getHttpServer())
        .get(`/${PREFIX}/evidence/task:T-spec/status`)
        .set('Cookie', cookie);
      expect(read.status).toBe(200);
      expect(read.body.unmet).toEqual(['tests-pass', 'reviewed']);
    });

    it('applies no grant rule to a subject EPIC-024 does not govern — the workspace boundary is the rule', async () => {
      expect((await bind('T-file', { type: 'file', id: 'src/a.ts' })).status).toBe(201);
    });
  });

  describe('FR-EVS-016 — evidence never crosses a workspace', () => {
    it('does not find work bound in another workspace, by any route', async () => {
      const repository = app.get<EvidenceRepository>(EVIDENCE_REPOSITORY, { strict: false });
      // The other workspace must exist for the foreign key; it is created the way
      // any tenant is, then work is bound in it directly — no session of ours can.
      const { Client } = await import('pg');
      const db = new Client({ connectionString: process.env['DATABASE_URL'] });
      await db.connect();
      await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ('ws_other','other',now())`);
      await db.end();
      await repository.appendBinding({
        workspaceId: 'ws_other',
        projectId: 'p_other',
        workRef: { type: 'task', id: 'T-foreign' },
        workClass: 'task-completion',
        contractVersion: 1,
        subjectArtifactType: 'file',
        subjectArtifactId: 'x',
        subjectVersion: 1,
      });

      for (const [method, route] of [
        ['get', 'status'],
        ['get', 'unmet'],
        ['post', 'complete'],
      ] as const) {
        const response = await request(app.getHttpServer())
          [method](`/${PREFIX}/evidence/task:T-foreign/${route}`)
          .set('Cookie', cookie)
          .send({});
        expect(response.status, route).toBe(404);
      }
    });
  });
});
