/**
 * `T1901` (EPIC-047) — the Experts module is reachable through the composed
 * application.
 *
 * Constitution XI Tier 1. Written before `T1902` creates the module, so it is
 * observed failing first (Constitution V). Composition, not persistence: no
 * database is started, so a storage fault cannot masquerade as a wiring one.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

describe('T1901 · the Experts module is reachable through the composed application', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../src/app.module.js');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
  }, 300_000);

  afterAll(async () => {
    await app?.close();
  }, 60_000);

  it('registers ExpertsModule in the composition root', async () => {
    const { ExpertsModule } = await import('../../src/modules/experts/experts.module.js');
    expect(() => app.select(ExpertsModule)).not.toThrow();
  });

  it('resolves ExpertsService, which declares the engineering-experts area and no Room', async () => {
    const { ExpertsModule, ExpertsService } = await import('../../src/modules/experts/experts.module.js');
    const service = app.select(ExpertsModule).get(ExpertsService, { strict: false });
    expect(service).toBeInstanceOf(ExpertsService);
    // `FR-EXP-070` — a registry screen in its own area, not a governed Room.
    expect(service.area).toBe('engineering-experts');
    expect(service).not.toHaveProperty('workflowType');
  });
});
