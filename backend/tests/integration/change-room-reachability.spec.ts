/**
 * `T406u` (EPIC-034) — Constitution XI Tier 1.
 *
 * The module is reachable through the **composed application**, not merely
 * importable from a test. `DEF-005-001` is what the alternative looks like:
 * fifteen of fifteen tasks green and the feature unreachable in the running
 * application, found by a human opening a browser after closure.
 *
 * `T995d` mutates this — unregister `ChangeRoomModule` and these must fail.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

suite('T406u · the Change Room is reachable through the composed application', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.end();

    process.env['DATABASE_URL'] = url;
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../src/app.module.js');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  }, 120_000);

  it('registers ChangeRoomModule in the composition root', async () => {
    // The mutation proof's target (`T995d`). `select` throws when the module is
    // not part of the compiled graph.
    const { ChangeRoomModule } = await import('../../src/modules/change-room/change-room.module.js');
    expect(() => app.select(ChangeRoomModule)).not.toThrow();
  });

  it('resolves ChangeRoomService from the graph the application actually builds', async () => {
    const { ChangeRoomService } = await import(
      '../../src/modules/change-room/change-room.module.js'
    );
    const service = app.get(ChangeRoomService, { strict: false });
    expect(service).toBeInstanceOf(ChangeRoomService);
    expect(service.workflowType).toBe('change-room');
  });

  it('declares its six ports, five refusing and one degrading', async () => {
    // Reached through the composed graph rather than imported directly, so this
    // asserts what the running application holds.
    const { ChangeRoomService } = await import(
      '../../src/modules/change-room/change-room.module.js'
    );
    const service = app.get(ChangeRoomService, { strict: false });
    expect(service.ports).toHaveLength(6);
    expect(service.ports.filter((p) => p.absent === 'degrade').map((p) => p.name)).toEqual([
      'ImpactSource',
    ]);
  });

  it('the change-room workflow type loads in the composed loop', async () => {
    // `FR-CHR-001` — a distinct configured workflow type. This is the assertion
    // that would have caught `change-room.json` landing before its stage
    // handlers, which took every other workflow type down with it.
    const { LOOP_CONFIG_SOURCE } = await import('../../src/modules/loop/loop.tokens.js');
    const registry = app.get<{ require(type: string): unknown }>(LOOP_CONFIG_SOURCE, {
      strict: false,
    });
    expect(() => registry.require('change-room')).not.toThrow();
  });

  it('and the requirement-room type still loads beside it', async () => {
    // The all-or-nothing registry means one Room's configuration can break
    // another's. Asserted here so the coupling is visible where it bites.
    const { LOOP_CONFIG_SOURCE } = await import('../../src/modules/loop/loop.tokens.js');
    const registry = app.get<{ require(type: string): unknown }>(LOOP_CONFIG_SOURCE, {
      strict: false,
    });
    expect(() => registry.require('requirement-room')).not.toThrow();
  });
});
