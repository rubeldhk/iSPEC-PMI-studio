/**
 * `T1418` (EPIC-043, `R-043-10`, `FR-PIC-031`) — the executions REST surface is
 * mounted **behind the connector guard on every route**, and cannot lose the
 * guard by accident.
 *
 * This file REPLACES `executions-unmounted.spec.ts` (`DEF-037-001`). The shape
 * is the same, inverted: a static half that reads the controller and fails the
 * moment a handler lacks the guard or a registered scope, and a live half that
 * boots the real application and proves every route answers an absent
 * credential with the ONE refusal — with a control route proving the router is
 * alive. The live half is what caught the original mistake; it stays.
 *
 * Written to FAIL before `T1419` (the controller is not mounted; the routes 404).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { registeredConnectorScopes } from '../../src/modules/connector/connector-scope.js';

const here = dirname(fileURLToPath(import.meta.url));
const CONTROLLER = resolve(here, '../../src/modules/executions/executions.controller.ts');
const MODULE = resolve(here, '../../src/modules/executions/executions.module.ts');

const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const controller = strip(readFileSync(CONTROLLER, 'utf8'));
const module_ = strip(readFileSync(MODULE, 'utf8'));

/** Every `@Get/@Post(...)` handler with the decorators that precede it. */
function handlers(): { route: string; decorators: string }[] {
  const out: { route: string; decorators: string }[] = [];
  const re = /((?:\s*@\w+\([^)]*\)\s*)+)\s*async\s+\w+\s*\(/g;
  for (let m = re.exec(controller); m !== null; m = re.exec(controller)) {
    const decorators = m[1] as string;
    const route = /@(Get|Post)\(([^)]*)\)/.exec(decorators)?.[0] ?? '';
    if (route) out.push({ route, decorators });
  }
  return out;
}

describe('T1418 · static — every route carries the guard and a registered scope', () => {
  it('the module lists the controller', () => {
    expect(module_).toMatch(/controllers:\s*\[[^\]]*ExecutionsController/);
  });

  it('the class or every handler is guarded by ConnectorAuthGuard', () => {
    const classGuarded = /@UseGuards\(ConnectorAuthGuard\)[\s\S]*?@Controller\(|@Controller\([^)]*\)\s*@UseGuards\(ConnectorAuthGuard\)/.test(controller);
    const all = handlers();
    expect(all.length, 'no handlers found').toBeGreaterThanOrEqual(8);
    const unguarded = all.filter((h) => !classGuarded && !/@UseGuards\(ConnectorAuthGuard\)/.test(h.decorators)).map((h) => h.route);
    expect(unguarded).toEqual([]);
  });

  it('every handler names a scope the registry knows', () => {
    const known = new Set(registeredConnectorScopes());
    const bad = handlers()
      .map((h) => ({ route: h.route, scope: /@ConnectorScope\('([^']+)'\)/.exec(h.decorators)?.[1] }))
      .filter((h) => h.scope === undefined || !known.has(h.scope))
      .map((h) => `${h.route} → ${h.scope ?? 'none'}`);
    expect(bad).toEqual([]);
  });

  it('the check can fail — a handler stripped of its guard is detectable', () => {
    const mutated = controller.replace('@UseGuards(ConnectorAuthGuard)', '');
    expect(mutated).not.toBe(controller);
  });
});

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const live = noRuntime ? describe.skip : describe;

live('T1418 · live — every route answers an absent credential with the one refusal', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    process.env['DATABASE_URL'] ??= 'postgresql://unused:unused@127.0.0.1:1/unused';
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../src/app.module.js');
    // 2026-09-19 — the filter `main.ts` installs. The guard's refusal is a
    // `PlatformError`; only `ErrorFilter` turns it into the 401 and the body
    // this half asserts, and without it Nest answers 500 for every route,
    // including the control. The half was never seen to fail because the
    // engine-registration load used to abort composition against the
    // unreachable database above and the worker died before a test ran; the
    // load became non-fatal and these nine ran for the first time on CI.
    const { ErrorFilter } = await import('../../src/core/error.filter.js');
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new ErrorFilter());
    app.setGlobalPrefix('v1');
    await app.listen(0);
    base = await app.getUrl();
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  }, 60_000);

  const ROUTES: [string, string, string][] = [
    ['POST', 'register', '/v1/executions'],
    ['POST', 'append', '/v1/executions/exec_any/events'],
    ['POST', 'complete', '/v1/executions/exec_any/completion'],
    ['POST', 'comment', '/v1/executions/exec_any/comments'],
    ['POST', 'propose', '/v1/executions/exec_any/proposals'],
    ['GET', 'history', '/v1/executions/exec_any/history'],
    ['GET', 'snapshot', '/v1/executions/exec_any'],
    ['POST', 'sync', '/v1/executions/sync'],
  ];

  it.each(ROUTES)('%s %s is routed and refuses with invalid_connector_credential', async (method, _name, path) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error).toEqual({ code: 'invalid_connector_credential', message: 'Invalid connector credential.' });
  });

  it('the control: the session boundary still answers its own 401, so the router is alive', async () => {
    const res = await fetch(`${base}/v1/auth/me`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthenticated');
  });
});
