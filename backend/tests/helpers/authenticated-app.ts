/**
 * `T1150` — boot the composed application with a database and a real session.
 *
 * Introduced when `DEF-033-001` was fixed. Binding the Requirement Room to
 * authenticated identity means its routes now resolve their caller against
 * `EPIC-024`'s authoritative directory, which reads `users` — so an integration
 * test that drives those routes needs a database and a signed-in caller where
 * before it needed neither.
 *
 * Shared rather than copied because the next Room to be bound will need exactly
 * this, and three divergent copies of a security fixture is how one of them
 * quietly stops authenticating.
 *
 * The session is minted through the real `SessionService` that
 * `SessionContextMiddleware` resolves against. Sign-in itself is proven by
 * `sign-in.spec.ts`; callers of this helper need a valid session, not a second
 * proof of how one is obtained.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from './postgres-image.js';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

export interface AuthenticatedApp {
  readonly app: INestApplication;
  readonly container: StartedPostgreSqlContainer;
  /** Ready to pass to supertest's `.set('Cookie', …)`. */
  readonly cookie: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly databaseUrl: string;
  close(): Promise<void>;
}

export interface AuthenticatedAppOptions {
  readonly prefix?: string;
  readonly workspaceId?: string;
  readonly userId?: string;
  /** Extra rows to seed once migrations are applied. */
  seed?(db: Client, ids: { workspaceId: string; userId: string }): Promise<void>;
}

export async function startAuthenticatedApp(
  options: AuthenticatedAppOptions = {},
): Promise<AuthenticatedApp> {
  const prefix = options.prefix ?? 'v1';
  const workspaceId = options.workspaceId ?? 'ws_test';
  const userId = options.userId ?? 'u_test';

  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const databaseUrl = container.getConnectionUri();

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS)
    .filter((d) => /^\d/.test(d))
    .sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
    workspaceId,
    'test workspace',
  ]);
  await db.query(
    `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
     VALUES ($1,$2,$3,'Test User','unused',now())`,
    [userId, workspaceId, `${userId}@example.test`],
  );
  await options.seed?.(db, { workspaceId, userId });
  await db.end();

  // Set BEFORE the composition root runs — that is where production learns it
  // too, so the app is configured the way an operator configures it.
  process.env['DATABASE_URL'] = databaseUrl;

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../../src/app.module.js');
  const { ErrorFilter } = await import('../../src/core/error.filter.js');
  const { SessionService } = await import('../../src/modules/auth/sessions.js');
  const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');

  const { configureBodyParsing } = await import('../../src/core/http-body.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, bodyParser: false });
  configureBodyParsing(app);
  app.useGlobalFilters(new ErrorFilter());
  app.setGlobalPrefix(prefix);
  await app.init();

  const session = app.get(SessionService, { strict: false }).create({
    userId,
    workspaceId,
    email: `${userId}@example.test`,
    displayName: 'Test User',
  });

  return {
    app,
    container,
    cookie: `${SESSION_COOKIE}=${session.token}`,
    workspaceId,
    userId,
    databaseUrl,
    async close(): Promise<void> {
      await app.close();
      await container.stop();
    },
  };
}

/**
 * `T1332` / `T1383` (EPIC-041) — boot a SECOND application against a database
 * the first one already used, without a new container.
 *
 * `startAuthenticatedApp` creates a database and an application together, which
 * is right for every test that needs one of each. A restart test needs two
 * applications and one database, in sequence: what the first wrote, the second
 * must read. The container stays the caller's to stop.
 */
export async function rebootApp(
  databaseUrl: string,
  ids: { workspaceId: string; userId: string; prefix?: string },
): Promise<{ app: INestApplication; cookie: string }> {
  process.env['DATABASE_URL'] = databaseUrl;
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../../src/app.module.js');
  const { ErrorFilter } = await import('../../src/core/error.filter.js');
  const { SessionService } = await import('../../src/modules/auth/sessions.js');
  const { SESSION_COOKIE } = await import('../../src/modules/auth/auth.controller.js');

  const { configureBodyParsing } = await import('../../src/core/http-body.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, bodyParser: false });
  configureBodyParsing(app);
  app.useGlobalFilters(new ErrorFilter());
  app.setGlobalPrefix(ids.prefix ?? 'v1');
  await app.init();

  const session = app.get(SessionService, { strict: false }).create({
    userId: ids.userId,
    workspaceId: ids.workspaceId,
    email: `${ids.userId}@example.test`,
    displayName: 'Test User',
  });
  return { app, cookie: `${SESSION_COOKIE}=${session.token}` };
}
