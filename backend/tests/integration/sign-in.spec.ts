/**
 * T830 · `DEF-005-001` — sign-in works in the application that actually runs.
 *
 * **Why this test exists.** EPIC-005 closed 15 / 15 with every test green, and
 * the first local UAT run got a 500 from `POST /v1/auth/sign-in` with
 * verified-good credentials. `T024a` proves the controller against a **mocked**
 * identity provider, so it proves behaviour *given a working directory* and can
 * never observe whether a working one is wired. Nothing was:
 * `PrismaUserDirectory` had zero production call sites, and the composed graph
 * resolved the deliberately-refusing `UnconfiguredUserDirectory` — the fourth
 * instance of built-tested-called-by-nothing (DEF-001-001, DEF-001-002,
 * DEF-028-005).
 *
 * So this file boots `AppModule` itself — no overrides, no mocks — against a
 * real PostgreSQL, and signs in over real HTTP. Written first and observed
 * failing with `UserDirectoryUnavailableError` (surfacing as 500) before the
 * `T831` wiring existed. If a refactor ever unbinds the directory again, this
 * is the test that goes red.
 */
import 'reflect-metadata';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import argon2 from 'argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const EMAIL = 'signin-probe@example.test';
const PASSWORD = 'correct horse battery staple';

suite('T830 · DEF-005-001 · the composed application can be signed into (BR-0002)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    // The same migration sequence `prisma migrate deploy` runs (T457 precedent).
    const db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      'ws_signin',
      'sign-in probe',
    ]);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ('u_signin','ws_signin',$1,'Sign-in Probe',$2,now())`,
      [EMAIL, await argon2.hash(PASSWORD, { type: argon2.argon2id })],
    );
    await db.end();

    // The URL must be in the environment BEFORE the composition root runs,
    // because that is where production learns it too — this test configures
    // the app exactly the way an operator does, not through a test seam.
    process.env['DATABASE_URL'] = container.getConnectionUri();

    // Imported AFTER the env is set, so the composition root composes against
    // this database rather than a stale value from the test runner's shell.
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../src/app.module.js');
    const { ErrorFilter } = await import('../../src/core/error.filter.js');

    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new ErrorFilter());
    app.setGlobalPrefix('v1');
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  async function signIn(email: string, password: string): Promise<Response> {
    return fetch(`${base}/v1/auth/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  }

  it('returns 200 and a session cookie for valid credentials', async () => {
    const res = await signIn(EMAIL, PASSWORD);

    expect(
      res.status,
      'the REAL module graph refused sign-in — if this is 500, the user directory is unwired ' +
        'again (UserDirectoryUnavailableError, DEF-005-001)',
    ).toBe(200);

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('pmi_session=');
    expect(cookie).toContain('HttpOnly');

    const body = (await res.json()) as { user: { email: string }; workspace: { id: string } };
    expect(body.user.email).toBe(EMAIL);
    expect(body.workspace.id).toBe('ws_signin');
  });

  it('carries the session into GET /v1/auth/me', async () => {
    // The cookie is only proof if something downstream honours it.
    const signedIn = await signIn(EMAIL, PASSWORD);
    const cookie = (signedIn.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const me = await fetch(`${base}/v1/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe(EMAIL);
  });

  it('returns 401 — not 500 — for a wrong password', async () => {
    // The distinction DEF-005-001 was about: bad credentials are a 401 the
    // caller can act on; 500 means the platform could not even check them.
    const res = await signIn(EMAIL, 'wrong-password');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown email, indistinguishably', async () => {
    const res = await signIn('nobody@example.test', PASSWORD);
    expect(res.status).toBe(401);
    // One message for both halves — naming which failed would confirm account
    // existence (the controller's own rule, asserted here end to end).
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe('Invalid email or password.');
  });
});
