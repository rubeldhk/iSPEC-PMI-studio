/**
 * T830 — sign-in works in the RUNNING application (DEF-005-001, BR-0002).
 *
 * Why this test exists: EPIC-005 closed 15/15 green and the running API
 * returned 500 on sign-in — because T024a proves the controller's behaviour
 * given a MOCKED identity provider, and no test anywhere booted the real
 * module graph. This one does: real `AppModule`, real middleware, real
 * `PrismaUserDirectory` against a real PostgreSQL, over real HTTP.
 *
 * Written to FAIL against the code as it stands (the deliberately-refusing
 * `UnconfiguredUserDirectory` turns sign-in into a 500) — a red run here is
 * the defect reproducing; green is T831's wiring landing.
 *
 * RAID R-04: needs a container runtime; skipped loudly by name where none
 * exists.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import argon2 from 'argon2';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const EMAIL = 'uat@pmi.test';
const PASSWORD = 'uat-password-123';

suite('T830 · sign-in against the real module graph (DEF-005-001)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      'ws_uat',
      'UAT workspace',
    ]);
    await db.query(
      `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
       VALUES ('u_uat','ws_uat',$1,'UAT User',$2,now())`,
      [EMAIL, await argon2.hash(PASSWORD, { type: argon2.argon2id })],
    );
    await db.end();

    // The composition reads DATABASE_URL — set BEFORE the graph is built,
    // exactly as a deployment would.
    process.env['DATABASE_URL'] = container.getConnectionUri();

    // Mirror main.ts: the module graph, the error filter, the /v1 prefix.
    const { AppModule } = await import('../../src/app.module.js');
    const { ErrorFilter } = await import('../../src/core/error.filter.js');
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new ErrorFilter());
    app.setGlobalPrefix('v1');
    await app.listen(0, '127.0.0.1');
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
    delete process.env['DATABASE_URL'];
  });

  it('POST /v1/auth/sign-in returns 200 and a session cookie for good credentials', async () => {
    const response = await fetch(`${baseUrl}/v1/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    // The defect's exact probe: this was 500 internal_error before T831.
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({
      user: { email: EMAIL, displayName: 'UAT User' },
      workspace: { id: 'ws_uat' },
    });
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('pmi_session=');
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('a wrong password is 401 unauthenticated — not 500, not 200', async () => {
    const response = await fetch(`${baseUrl}/v1/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: 'wrong-password' }),
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthenticated');
  });

  it('the session cookie carries into GET /v1/auth/me (the T833 journey)', async () => {
    const signIn = await fetch(`${baseUrl}/v1/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const cookie = (signIn.headers.get('set-cookie') ?? '').split(';')[0] as string;

    const me = await fetch(`${baseUrl}/v1/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    const body = (await me.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ user: { email: EMAIL }, workspace: { id: 'ws_uat' } });
  });

  it('never leaks the password hash through any auth response', async () => {
    const response = await fetch(`${baseUrl}/v1/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    expect(JSON.stringify(await response.json())).not.toMatch(/argon2|passwordHash/);
  });
});
