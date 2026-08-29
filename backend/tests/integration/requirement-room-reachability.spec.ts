/**
 * T337x — Constitution XI Tier 1. `FR-RQR-070`.
 *
 * Follows the pattern `EPIC-030`'s `T934` established for the backend, including
 * the two things that pattern learned the hard way:
 *
 *   - **`NestFactory.create(AppModule)`, not `Test.createTestingModule`.**
 *     `@nestjs/testing` is not a declared dependency, and adding one without a
 *     `specs/_shared/dependencies.md` entry breaches `TS-001`. It is also the
 *     stronger form: this is literally what `main.ts` does.
 *   - **The bootstrap is mirrored, not shared.** `main.ts` sets `ErrorFilter`
 *     and the `v1` prefix inline, so this file duplicates them and can drift.
 *     The prefix matters most — get it wrong and every route 404s, which is
 *     exactly the failure this test reports.
 *
 * **`DEF-030-001` shapes the route assertion.** Every unmatched path in this
 * application returns `500 internal_error`, not `404`, because `ErrorFilter` is
 * a bare `@Catch()`. So *"the route exists"* is asserted as *"a handler answered
 * with a platform code"* rather than as a status — which is a sharper property
 * anyway.
 *
 * The `T337z`-class mutation proof: removing `RequirementRoomModule` from
 * `app.module.ts` must turn this file red.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { AppModule } from '../../src/app.module.js';
import { ErrorFilter } from '../../src/core/error.filter.js';
import { RequirementRoomModule } from '../../src/modules/requirement-room/requirement-room.module.js';
import { RequirementRoomService } from '../../src/modules/requirement-room/requirement-room.service.js';
import { SessionService } from '../../src/modules/auth/sessions.js';
import { SESSION_COOKIE } from '../../src/modules/auth/auth.controller.js';

/** Mirrors `main.ts`. See the note above on why this is duplicated. */
const PREFIX = 'v1';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const WS = 'ws_t337x';
const USER = 'u_t337x';

/**
 * `T1150` — this suite now needs a database and a session.
 *
 * Both are consequences of `DEF-033-001`'s fix rather than incidental setup.
 * The Room resolves its caller against `EPIC-024`'s authoritative directory,
 * which reads `users`; and "reachable" now means *reachable by someone*. A
 * stubbed directory would prove the routes answer without proving they resolve
 * anyone, which is the state this file exists to rule out.
 */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T337x · the Requirement Room is reachable through the composed application', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let cookie = '';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'t337x',now())`, [
      WS,
    ]);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ($1,$2,'t337x@example.test','T337x','unused',now())`,
      [USER, WS],
    );
    await db.end();

    process.env['DATABASE_URL'] = container.getConnectionUri();
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new ErrorFilter());
    app.setGlobalPrefix(PREFIX);
    await app.init();

    // Minted through the real `SessionService` the middleware resolves against.
    // Sign-in itself is proven by `sign-in.spec.ts`; what this suite needs is a
    // valid session, not a second proof of how one is obtained.
    const session = app
      .get(SessionService, { strict: false })
      .create({ userId: USER, workspaceId: WS, email: 't337x@example.test', displayName: 'T337x' });
    cookie = `${SESSION_COOKIE}=${session.token}`;
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  }, 120_000);

  it('composes the whole application, not a hand-assembled subgraph', () => {
    expect(app).toBeDefined();
  });

  it('registers RequirementRoomModule in the composition root', () => {
    // The mutation proof's target. `select` throws if the module is not part of
    // the compiled graph — an import never added to app.module.ts cannot
    // satisfy this, which is the DEF-005-001 failure class.
    expect(() => app.select(RequirementRoomModule)).not.toThrow();
  });

  it('resolves RequirementRoomService from the graph the application builds', () => {
    expect(app.get(RequirementRoomService, { strict: false })).toBeInstanceOf(
      RequirementRoomService,
    );
  });

  it.each([
    // `T1173` — Phase 9's two new routes. The collection and its creation, on
    // one path: `GET` lists the workspace's Rooms for the index, `POST` opens
    // one. Both were absent when `T405j` found the journey unattemptable.
    ['get', `/${PREFIX}/rooms/requirement`],
    ['post', `/${PREFIX}/rooms/requirement`],
    ['post', `/${PREFIX}/rooms/requirement/intake`],
    ['post', `/${PREFIX}/rooms/requirement/probe/clarifications`],
    ['get', `/${PREFIX}/rooms/requirement/probe/analysis`],
    ['post', `/${PREFIX}/rooms/requirement/probe/options`],
    ['post', `/${PREFIX}/rooms/requirement/probe/decide`],
    ['post', `/${PREFIX}/rooms/requirement/probe/baseline`],
    ['post', `/${PREFIX}/baselines/1/handoff`],
    ['get', `/${PREFIX}/rooms/requirement/probe/readiness`],
  ] as const)('routes %s %s — the real entry point answers', async (method, route) => {
    const response = await request(app.getHttpServer())[method](route).set('Cookie', cookie).send({});
    const body = response.body as { error?: { code?: string; message?: string } };

    // A handler RAN — and the discriminator had to be rebuilt twice.
    //
    // Originally: "an unmatched path is `internal_error`, so any platform code
    // means a handler matched". `DEF-001-006` fixed the filter, and an unmatched
    // path became `404 not_found` — a platform code. The assertion kept passing
    // and stopped meaning anything.
    //
    // `T405e` caught it: with `RequirementRoomModule` unregistered, every route
    // in this loop still passed. Only the neighbouring anti-vacuity test failed.
    //
    // The discriminator that survives is the MESSAGE. `toErrorBody` keeps a
    // `PlatformError`'s own text and the filter authors a generic sentence for a
    // framework status — so an unmatched path says exactly
    // "The requested resource does not exist.", and a handler that ran says
    // something of its own, or succeeds.
    const unmatched =
      response.status === 404 && body.error?.message === 'The requested resource does not exist.';
    expect(
      unmatched,
      `${method.toUpperCase()} ${route} answered ${response.status} with the framework's own ` +
        'not-found message — no handler matched',
    ).toBe(false);
    expect(body.error?.code !== undefined || response.status < 300).toBe(true);
  });

  it('answers an unowned route differently from an owned one, or the check above is vacuous', async () => {
    // Anti-vacuity. If the application answered every path the same way, the
    // assertion above would pass over a completely unwired module.
    //
    // The owned route does REAL validation and returns a documented 400; the
    // unowned one is DEF-030-001's 500. Tighten to 404 when that defect is
    // fixed.
    const owned = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/requirement/intake`)
      .set('Cookie', cookie)
      .send({ sourceRef: 'doc-1' });
    const unowned = await request(app.getHttpServer())
      .get(`/${PREFIX}/rooms/requirement/probe/not-a-real-sub-resource`)
      .set('Cookie', cookie);

    expect(owned.status).toBe(400);
    expect((owned.body as { error?: { code?: string } }).error?.code).toBe('validation_failed');
    expect(unowned.status, "an unmatched route must be 404 (DEF-001-006)").toBe(404);
    expect(unowned.status).not.toBe(owned.status);
  });

  it('names the missing fields, so a caller can act on the refusal', async () => {
    const response = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/requirement/intake`)
      .set('Cookie', cookie)
      .send({ sourceRef: 'doc-1' });
    // `projectId` rather than `workspaceId`: since `T1148` the workspace comes
    // from the session, so it is no longer a field a caller can omit. The
    // property under test is unchanged — a refusal names what the caller must
    // fix — and it now names only fields the caller actually controls.
    expect((response.body as { error?: { message?: string } }).error?.message).toMatch(
      /projectId/,
    );
  });
});
