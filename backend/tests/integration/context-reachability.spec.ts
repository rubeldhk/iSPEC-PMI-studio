/**
 * `T1224` (EPIC-038) — the Context module is reachable through the composed
 * application.
 *
 * Constitution XI Tier 1. Written **before** `T1223` creates the module, so it
 * is observed failing first (Constitution V).
 *
 * ## Why this exists in Phase 1 rather than at the end
 *
 * *Built, tested, and reachable from nowhere* is the defect class this
 * repository has now recorded **eight times** — `DEF-005-001`, `T1178`'s
 * thirteen unbound stores, and the four `EPIC-034`'s convergence pass found at
 * once. Every unit test passed in every case.
 *
 * The question that finds it is *"which capabilities have a caller"*, not
 * *"which have a test"*, and the only place that question can be asked is
 * against the module graph the application actually builds. So the module is
 * registered in the same commit it is created, and this file is what makes that
 * checkable rather than remembered.
 *
 * ## Deliberately no database
 *
 * This asserts composition, not persistence. `EPIC-038`'s migration requires the
 * `pgvector` extension, and binding this test to a database image would make a
 * composition check fail for a storage reason — two failures that need
 * different fixes, reported as one.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

describe('T1224 · the Context module is reachable through the composed application', () => {
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

  it('registers ContextModule in the composition root', async () => {
    const { ContextModule } = await import('../../src/modules/context/context.module.js');
    // `app.select` throws when the module is not in the graph the application
    // built — which is exactly the state a registered-nowhere module is in.
    expect(() => app.select(ContextModule)).not.toThrow();
  });

  it('resolves ContextService from the graph the application actually builds', async () => {
    const { ContextModule, ContextService } = await import(
      '../../src/modules/context/context.module.js'
    );
    const service = app.select(ContextModule).get(ContextService, { strict: false });
    expect(service).toBeInstanceOf(ContextService);
  });

  it('and the area it declares is `context`, not a Room', async () => {
    // `R-038-11`, `FR-CTX-070`. Context is an application area with no workflow
    // type. Asserted here because the absence of a Room is a design decision,
    // and an absence nobody checks is one somebody adds later by analogy.
    const { ContextModule, ContextService } = await import(
      '../../src/modules/context/context.module.js'
    );
    const service = app.select(ContextModule).get(ContextService, { strict: false });
    expect(service.area).toBe('context');
    expect(service).not.toHaveProperty('workflowType');
  });
});
