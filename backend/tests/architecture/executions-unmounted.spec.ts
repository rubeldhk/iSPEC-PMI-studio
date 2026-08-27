/**
 * T1038 (EPIC-037 Band A, C3C closure) — the executions REST surface is not
 * reachable, and cannot become reachable by accident.
 *
 * `ExecutionsController` exists and is correct as a *translation* of the
 * semantic contract. What it lacks is any way to authenticate its callers, and
 * during C3C it was mounted anyway. Real HTTP against the composed application
 * showed `GET /v1/executions/:workspaceId/:id/history` answering **200 with a
 * live workspace's event stream** to a caller with no session, and `POST
 * /v1/executions` taking `identity.authenticatedPrincipalId` from the request
 * body.
 *
 * It is now unmounted. This file is what keeps it that way: a static half that
 * fails the moment the controller is listed again, and a live half that boots
 * the real application and proves the routes 404.
 *
 * The live half matters more than it looks. Source inspection is exactly the
 * evidence that let the original mistake through — the controller's own header
 * asserted identity was not taken from the body, and reading it agreed.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

const here = dirname(fileURLToPath(import.meta.url));
const MODULE = resolve(here, '../../src/modules/executions/executions.module.ts');
const APP_MODULE = resolve(here, '../../src/app.module.ts');

const source = readFileSync(MODULE, 'utf8');
/** Comments stripped: the header explains the rule, the code must obey it. */
const declared = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('T1038 · the module declares no controller', () => {
  it('lists an empty `controllers` array', () => {
    // Present and empty, not absent: an absent key reads as an oversight, and
    // the next person adds one.
    expect(declared).toMatch(/controllers:\s*\[\s*\]/);
  });

  it('does not import the controller at all', () => {
    // Belt and braces. An unused import is the half-step back to mounting it.
    expect(declared.includes('ExecutionsController'), 'the module names the controller').toBe(
      false,
    );
  });

  it('the check can fail — a mounted controller is detectable', () => {
    // Anti-tautology: without this, both assertions above would pass against a
    // file that had been emptied or renamed.
    const mounted = 'controllers: [ExecutionsController],';
    expect(/controllers:\s*\[\s*\]/.test(mounted)).toBe(false);
    expect(mounted.includes('ExecutionsController')).toBe(true);
  });

  it('still composes and exports the facade the fixture connector uses', () => {
    // Failing closed must not mean failing empty. The registry is still built;
    // only the unauthenticated transport is gone.
    expect(declared).toContain('ExecutionRegistryFacade');
    expect(declared).toMatch(/exports:\s*\[[\s\S]*ExecutionRegistryFacade/);
  });

  it('is still registered in the production AppModule', () => {
    // The module belongs in the application — `DEF-005-001` was a module built,
    // tested and never registered. This one is registered and serves no routes,
    // which is a different and deliberate thing.
    expect(readFileSync(APP_MODULE, 'utf8')).toContain('ExecutionsModule');
  });
});

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const live = noRuntime ? describe.skip : describe;

live('T1038 · the routes do not answer over HTTP', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    // No database is reached: every provider here is lazy, and a 404 is decided
    // by the router before any handler runs.
    process.env['DATABASE_URL'] ??= 'postgresql://unused:unused@127.0.0.1:1/unused';
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../src/app.module.js');
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('v1');
    await app.listen(0);
    base = await app.getUrl();
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  }, 60_000);

  it('GET history is not routed', async () => {
    // The one that actually leaked. It returned 200 and a real event stream.
    const res = await fetch(`${base}/v1/executions/ws_any/exec_any/history`);
    expect(res.status, 'the execution history is reachable again').toBe(404);
  });

  it('GET snapshot is not routed', async () => {
    const res = await fetch(`${base}/v1/executions/ws_any/exec_any`);
    expect(res.status).toBe(404);
  });

  it.each([
    ['register', '/v1/executions'],
    ['append', '/v1/executions/exec_any/events'],
    ['complete', '/v1/executions/exec_any/completion'],
    ['propose', '/v1/executions/exec_any/proposals'],
  ])('POST %s is not routed', async (_name, path) => {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_any' }),
    });
    expect(res.status).toBe(404);
  });

  it('the 404s are the router, not a broken server', async () => {
    // The control. If the application failed to boot, or the global prefix were
    // wrong, every assertion above would pass for the wrong reason.
    const res = await fetch(`${base}/v1/auth/me`);
    expect(res.status, 'the application is not serving anything').not.toBe(404);
  });

  it('no PATCH route exists on any execution path', async () => {
    const res = await fetch(`${base}/v1/executions/exec_any`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(404);
  });
});
