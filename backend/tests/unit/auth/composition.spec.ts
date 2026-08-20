/**
 * T832 · `DEF-005-001` — the composed graph resolves a directory that answers.
 *
 * This is the check whose absence let a 15/15 epic ship an unusable
 * capability: every auth test proved behaviour *given* a working directory,
 * and none asked whether the application actually composed one. This file asks
 * exactly that — it boots `AppModule` (no HTTP, no database connection; the
 * client is lazy and `findByEmail` is never called) and inspects what the DI
 * container resolved.
 *
 * It also pins the two injection sites that resolved to `undefined` under
 * tsx/esbuild, which emits no `design:paramtypes` — a refactor that drops an
 * `@Inject` back to a bare type annotation fails here, not in production.
 */
import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../../src/app.module.js';
import { AuthController } from '../../../src/modules/auth/auth.controller.js';
import { USER_DIRECTORY } from '../../../src/modules/auth/auth.tokens.js';
import {
  PrismaUserDirectory,
  UnconfiguredUserDirectory,
} from '../../../src/modules/auth/identity-provider.js';
import { SessionService } from '../../../src/modules/auth/sessions.js';

let app: INestApplicationContext | undefined;
const savedUrl = process.env['DATABASE_URL'];

async function compose(databaseUrl: string | undefined): Promise<INestApplicationContext> {
  if (databaseUrl === undefined) delete process.env['DATABASE_URL'];
  else process.env['DATABASE_URL'] = databaseUrl;
  app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
  if (savedUrl === undefined) delete process.env['DATABASE_URL'];
  else process.env['DATABASE_URL'] = savedUrl;
});

describe('T832 · DEF-005-001 · USER_DIRECTORY is wired, not defaulted', () => {
  it('resolves PrismaUserDirectory when a database is configured', async () => {
    const graph = await compose('postgresql://composition-probe:unused@localhost:5432/unused');

    const directory = graph.get(USER_DIRECTORY);
    expect(
      directory,
      'the composed graph resolved the refusing default — the composition root no longer binds ' +
        'the real directory, which is DEF-005-001 shipping a second time',
    ).toBeInstanceOf(PrismaUserDirectory);
    expect(directory).not.toBeInstanceOf(UnconfiguredUserDirectory);
  });

  it('keeps the refusing default when no database is configured', async () => {
    // The refusal is a feature: an unconfigured environment must name its
    // missing configuration, never answer "no such user" to everyone.
    const graph = await compose(undefined);

    expect(graph.get(USER_DIRECTORY)).toBeInstanceOf(UnconfiguredUserDirectory);
  });
});

describe('T832 · the injection sites that type-metadata cannot serve', () => {
  // tsx/esbuild emits no design:paramtypes. A parameter without @Inject
  // resolves to undefined SILENTLY — the container does not error, the first
  // method call does. These assertions make that failure a test failure.

  it('the controller holds a real SessionService', async () => {
    const graph = await compose(undefined);

    const controller = graph.get(AuthController);
    const sessions = (controller as unknown as { sessions: unknown }).sessions;
    expect(
      sessions,
      'AuthController.sessions is undefined: its @Inject(SessionService) was dropped, and under ' +
        'tsx/esbuild a bare type annotation injects nothing',
    ).toBeInstanceOf(SessionService);
  });

  it('the module (which builds the session middleware) holds one too', async () => {
    const graph = await compose(undefined);

    const { AuthModule } = await import('../../../src/modules/auth/auth.module.js');
    const module = graph.get(AuthModule);
    expect((module as unknown as { sessions: unknown }).sessions).toBeInstanceOf(SessionService);
  });
});
