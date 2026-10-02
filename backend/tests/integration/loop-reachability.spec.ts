/**
 * T934 — Constitution XI Tier 1, and the pattern the backend did not have.
 *
 * *"Every user-facing capability has a test driving it through its **real entry
 * point** against the composed module graph, not a hand-assembled one; a mocked
 * collaborator does not satisfy this."*
 *
 * `EPIC-029`'s `T899a` set this precedent on the frontend by mounting the
 * application at its root. The backend had no equivalent: its five existing
 * `tests/integration/` files exercise services, and a service test passes
 * happily while the module it lives in is unregistered — which is how
 * `DEF-005-001` shipped a 500 on sign-in with 15/15 tasks green, the fourth
 * *built, tested, called by nothing* defect after `DEF-001-001`, `DEF-001-002`
 * and `DEF-028-005`.
 *
 * **Why `NestFactory.create` and not `Test.createTestingModule`.** Two reasons,
 * and the second is the better one:
 *
 *   1. `@nestjs/testing` is not installed, and adding it would enter a
 *      dependency into `package.json` with no `specs/_shared/dependencies.md`
 *      entry — the rule `T993d` exists to enforce, breached in the act of
 *      satisfying `T934`.
 *   2. `NestFactory.create(AppModule)` is *literally what `main.ts` does*.
 *      `Test.createTestingModule({ imports: [AppModule] })` builds a testing
 *      wrapper around the graph; this builds the graph. For a test whose whole
 *      claim is "the real entry point", the second is not a compromise — it is
 *      the stronger form.
 *
 * **The bootstrap configuration is mirrored, not shared, and that is a risk.**
 * `main.ts` sets `ErrorFilter` and the `v1` global prefix inline, so there is no
 * function this file can call to be certain it is configured identically. The
 * prefix matters most: get it wrong and every route 404s, which is exactly the
 * failure this test reports. Recorded rather than papered over — extracting a
 * shared bootstrap belongs to whichever Epic owns `main.ts`, not to this one.
 *
 * **`T980`-class mutation proof**: removing `LoopModule` from `app.module.ts`
 * must turn this file red. A reachability test that passes when the module is
 * unregistered proves nothing at all.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startAuthenticatedApp, type AuthenticatedApp } from '../helpers/authenticated-app.js';
import { LoopService } from '../../src/modules/loop/loop.service.js';

/** Mirrors `main.ts`. See the note above on why this is duplicated. */
const PREFIX = 'v1';

/**
 * `T1159` — this suite needs a database and a session.
 *
 * Both follow from `DEF-030-003`. The loop resolves its caller against
 * `EPIC-024`'s directory, which reads `users`; and "reachable" now means
 * *reachable by someone*. The reachability property itself is unchanged.
 */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T934 · the loop is reachable through the composed application (Constitution XI Tier 1)', () => {
  let harness: AuthenticatedApp;
  let app: INestApplication;
  let cookie = '';

  beforeAll(async () => {
    harness = await startAuthenticatedApp({ prefix: PREFIX, workspaceId: 'ws_t934' });
    app = harness.app;
    cookie = harness.cookie;
  }, 300_000);

  afterAll(async () => {
    await harness?.close();
  }, 120_000);

  it('composes the whole application, not a hand-assembled subgraph', () => {
    // `startAuthenticatedApp` calls `NestFactory.create(AppModule)` — the same
    // thing `main.ts` does, moved into the helper when this suite gained a
    // session (`T1159`). If AppModule itself failed to compile, every assertion
    // below would fail for a reason that has nothing to do with the loop.
    // Asserted first so the report says which.
    expect(app).toBeDefined();
  });

  it('registers the configured LoopModule in the composition root', async () => {
    // The mutation proof's target. `select` throws if the module is not part of
    // the compiled graph — an import never added to app.module.ts cannot
    // satisfy this.
    //
    // Selected by the CONSTANT, not by the class. Since `T1165` the loop is a
    // dynamic module, and Nest keys those by their metadata: `select(LoopModule)`
    // asks for a module token the graph does not contain, and throws whether or
    // not the loop is registered — which would make this assertion fail for a
    // reason unrelated to what it tests.
    const { GOVERNED_LOOP } = await import('../../src/composition/governed-loop.js');
    expect(() => app.select(GOVERNED_LOOP)).not.toThrow();
  });

  it('resolves LoopService from the graph the application actually builds', () => {
    const service = app.get(LoopService, { strict: false });
    expect(service).toBeInstanceOf(LoopService);
  });

  it.each([
    ['post', `/${PREFIX}/loop/objects`],
    ['post', `/${PREFIX}/loop/objects/probe/transitions`],
    ['get', `/${PREFIX}/loop/objects/probe/history`],
    ['get', `/${PREFIX}/loop/objects/probe/progress`],
    ['get', `/${PREFIX}/loop/objects/probe/exceptions`],
  ] as const)('routes %s %s — the real entry point answers', async (method, route) => {
    const response = await request(app.getHttpServer())[method](route).set('Cookie', cookie).send({});
    const code = (response.body as { error?: { code?: string } })?.error?.code;

    // Deliberately NOT asserting success. This is a reachability test, and what
    // it must distinguish is "the route exists and a handler answered" from "no
    // such route".
    //
    // The distinction is sharper than a status. Since `DEF-030-001`, an
    // UNMATCHED path is `500 internal_error` — NestJS's NotFoundException
    // reaching the catch-all filter. A MATCHED path answers with a platform
    // code: `validation_failed` for a bad body, `not_found` for an object that
    // does not exist. `not_found` here means the handler RAN and looked, which
    // is exactly what reachability asks.
    expect(
      code,
      `${method.toUpperCase()} ${route} answered ${response.status} with code ${String(code)} — ` +
        'internal_error means no handler matched',
    ).not.toBe('internal_error');
    expect(code).toBeDefined();
  });

  it('answers an unowned route differently from an owned one, or the check above is vacuous', async () => {
    // Anti-vacuity. If the application answered every path the same way, the
    // assertion above would pass over a completely unwired module.
    //
    // TIGHTENED 2026-08-25 (`T1017`). This asserted 500 and said so:
    // `DEF-030-001` made 404 impossible, because `ErrorFilter` was a bare
    // `@Catch()` and NestJS's own `NotFoundException` reached `toHttpStatus`,
    // which mapped anything that is not a `PlatformError` to `internal_error`.
    // `DEF-001-006` fixed that in `EPIC-001` — the filter now recognises
    // `HttpException` and keeps its status — so the weaker property is retired
    // and the real guarantee is asserted: **an unmatched route is 404**.
    const unowned = await request(app.getHttpServer())
      .get(`/${PREFIX}/loop/objects/probe/not-a-real-sub-resource`)
      .set('Cookie', cookie);
    // An OWNED route with a bad body: real validation, a documented platform
    // code, a 400. That is the distinction, and it is behaviour rather than a
    // stub — `declareObject` genuinely refuses a request missing workspaceId.
    const owned = await request(app.getHttpServer())
      .post(`/${PREFIX}/loop/objects`)
      .set('Cookie', cookie)
      // `projectId` is the omission now: `workspaceId` is no longer a field a
      // caller supplies, so it can no longer be the one left out (`T1157`).
      .send({ workflowType: 'example-workflow' });

    expect(owned.status).toBe(400);
    expect(unowned.status, "an unmatched route must be 404 (DEF-001-006)").toBe(404);
    expect(unowned.status).not.toBe(owned.status);
  });
});
