/**
 * `T2301` (EPIC-048) — the Learning module is reachable through the composed
 * application.
 *
 * Constitution XI Tier 1. Written **before** `T2302` creates the module, so it is
 * observed failing first (Constitution V). `DEF-005-001` is what a module built,
 * tested and registered nowhere looks like: every unit test green and the
 * capability unreachable in the running application.
 *
 * ## Deliberately no database
 *
 * This asserts composition, not persistence — the `context-reachability.spec.ts`
 * reasoning. A route that is mounted answers `401` to a caller with no session;
 * an unmounted one answers `404`. That difference is the whole assertion.
 */
import 'reflect-metadata';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

describe('T2301 · the Learning module is reachable through the composed application', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env['DATABASE_URL'];
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../src/app.module.js');
    const { ErrorFilter } = await import('../../src/core/error.filter.js');
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new ErrorFilter());
    app.setGlobalPrefix('v1');
    await app.init();
  }, 300_000);

  afterAll(async () => {
    await app?.close();
  }, 60_000);

  it('registers LearningModule in the composition root', async () => {
    const { LearningModule } = await import('../../src/modules/learning/learning.module.js');
    expect(() => app.select(LearningModule)).not.toThrow();
  });

  it('resolves LearningService from the graph the application builds, declaring no workflow type', async () => {
    const { LearningModule, LearningService } = await import(
      '../../src/modules/learning/learning.module.js'
    );
    const service = app.select(LearningModule).get(LearningService, { strict: false });
    expect(service).toBeInstanceOf(LearningService);
    // FR-LRN-070: candidate review lives in EPIC-031's Inbox; no workflow here.
    expect(service).not.toHaveProperty('workflowType');
  });

  it('mounts GET /learning/knowledge — 401 without a session, never 404', async () => {
    const res = await request(app.getHttpServer()).get('/v1/learning/knowledge');
    expect(res.status).toBe(401);
  });

  /**
   * Phase 9 — each port whose owner is on `main` is bound to its adapter in the
   * graph the application builds, not left refusing (`R-048-20`). Asked through
   * the module's own ports object, so a rebinding in some other test proves
   * nothing here. Ports whose owner is not on `main` stay refusing.
   */
  describe('Phase 9 · ports bound to owners on main', () => {
    const ports = async () => {
      const { LearningModule } = await import('../../src/modules/learning/learning.module.js');
      const { LEARNING_PORTS_TOKEN } = await import('../../src/modules/learning/learning.tokens.js');
      return app.select(LearningModule).get(LEARNING_PORTS_TOKEN, { strict: false }) as import('../../src/modules/learning/learning.tokens.js').LearningPorts;
    };
    const notUnbound = async (call: () => Promise<unknown>) => {
      const { GovernanceSeamUnboundError } = await import('../../src/core/errors.js');
      const outcome = await call().then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      if ('error' in outcome) expect(outcome.error).not.toBeInstanceOf(GovernanceSeamUnboundError);
      return outcome;
    };

    it('T2389 · ApprovalAttestations reaches EPIC-032 (an unknown candidate is NotFound, not unbound)', async () => {
      const p = await ports();
      const outcome = await notUnbound(() =>
        p.attestations.contribute({ workspaceId: 'ws_x', candidateId: 'lc_none' } as never),
      );
      expect(outcome).toHaveProperty('error');
      expect(String((outcome as { error: Error }).error.message)).toContain('lc_none');
    });
  });
});
