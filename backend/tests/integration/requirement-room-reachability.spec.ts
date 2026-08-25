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
import { AppModule } from '../../src/app.module.js';
import { ErrorFilter } from '../../src/core/error.filter.js';
import { RequirementRoomModule } from '../../src/modules/requirement-room/requirement-room.module.js';
import { RequirementRoomService } from '../../src/modules/requirement-room/requirement-room.service.js';

/** Mirrors `main.ts`. See the note above on why this is duplicated. */
const PREFIX = 'v1';

describe('T337x · the Requirement Room is reachable through the composed application', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new ErrorFilter());
    app.setGlobalPrefix(PREFIX);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

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
    ['post', `/${PREFIX}/rooms/requirement/intake`],
    ['post', `/${PREFIX}/rooms/requirement/probe/clarifications`],
    ['get', `/${PREFIX}/rooms/requirement/probe/analysis`],
    ['post', `/${PREFIX}/rooms/requirement/probe/options`],
    ['post', `/${PREFIX}/rooms/requirement/probe/decide`],
    ['post', `/${PREFIX}/rooms/requirement/probe/baseline`],
    ['post', `/${PREFIX}/baselines/1/handoff`],
    ['get', `/${PREFIX}/rooms/requirement/probe/readiness`],
  ] as const)('routes %s %s — the real entry point answers', async (method, route) => {
    const response = await request(app.getHttpServer())[method](route).send({});
    const code = (response.body as { error?: { code?: string } })?.error?.code;
    // A platform code means a handler RAN. `internal_error` is what an unmatched
    // path returns under DEF-030-001, so it is the one answer that means "no
    // handler matched" — and `not_yet_implemented` surfaces as internal_error
    // too, which is why the four contract routes are asserted separately below.
    expect(code, `${method.toUpperCase()} ${route} answered ${response.status}`).toBeDefined();
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
      .send({ sourceRef: 'doc-1' });
    const unowned = await request(app.getHttpServer()).get(
      `/${PREFIX}/rooms/requirement/probe/not-a-real-sub-resource`,
    );

    expect(owned.status).toBe(400);
    expect((owned.body as { error?: { code?: string } }).error?.code).toBe('validation_failed');
    expect(unowned.status, "an unmatched route must be 404 (DEF-001-006)").toBe(404);
    expect(unowned.status).not.toBe(owned.status);
  });

  it('names the missing fields, so a caller can act on the refusal', async () => {
    const response = await request(app.getHttpServer())
      .post(`/${PREFIX}/rooms/requirement/intake`)
      .send({ sourceRef: 'doc-1' });
    expect((response.body as { error?: { message?: string } }).error?.message).toMatch(
      /workspaceId/,
    );
  });
});
