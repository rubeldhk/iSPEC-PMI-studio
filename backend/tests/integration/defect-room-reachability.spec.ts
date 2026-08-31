/**
 * `T997v` (EPIC-035) — Constitution XI Tier 1.
 *
 * The module is reachable through the **composed application**, not merely
 * importable from a test. `DEF-005-001` is what the alternative looks like:
 * fifteen of fifteen tasks green and the feature unreachable in the running
 * application, found by a human opening a browser after closure.
 *
 * `EPIC-034` then found four more of the same class at its convergence pass,
 * each with a passing unit test throughout. The question that catches them is
 * *which capabilities have a caller*.
 *
 * ## The all-or-nothing registry
 *
 * `buildConfigRegistry` refuses **every** workflow file when any one names an
 * unregistered stage. Adding `change-room.json` before its handlers existed took
 * the Requirement Room down with it — every type refused, and `declareObject`
 * answered `500` for all of them.
 *
 * So this file asserts all three types load, not just this Room's. A Room that
 * loaded while breaking its siblings would pass a test that only asked about
 * itself.
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

suite('T997v · the Defect Room is reachable through the composed application', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
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

  it('registers DefectRoomModule in the composition root', async () => {
    // `select` throws when the module is not part of the compiled graph. This
    // is the assertion `T998a`'s mutation proof targets.
    const { DefectRoomModule } = await import('../../src/modules/defect-room/defect-room.module.js');
    expect(() => app.select(DefectRoomModule)).not.toThrow();
  });

  it('resolves DefectRoomService from the graph the application actually builds', async () => {
    const { DefectRoomService } = await import(
      '../../src/modules/defect-room/defect-room.module.js'
    );
    const service = app.get(DefectRoomService, { strict: false });
    expect(service).toBeInstanceOf(DefectRoomService);
    expect(service.workflowType).toBe('defect-room');
  });

  it('declares its nine ports, eight refusing and one degrading', async () => {
    // Reached through the composed graph rather than imported directly, so this
    // asserts what the running application holds.
    const { DefectRoomService } = await import(
      '../../src/modules/defect-room/defect-room.module.js'
    );
    const service = app.get(DefectRoomService, { strict: false });
    expect(service.ports).toHaveLength(9);
    expect(service.ports.filter((p) => p.absent === 'degrade').map((p) => p.name)).toEqual([
      'AgentGateway',
    ]);
  });

  it('and TestExecution is among the refusing eight', async () => {
    // `FR-DFR-062`. The port that does not exist must refuse in the running
    // application, not only in a unit test — absence is never a pass.
    const { DefectRoomService } = await import(
      '../../src/modules/defect-room/defect-room.module.js'
    );
    const service = app.get(DefectRoomService, { strict: false });
    const port = service.ports.find((p) => p.name === 'TestExecution')!;
    expect(port.absent).toBe('refuse');
  });

  it('the defect-room workflow type loads in the composed loop', async () => {
    // `FR-DFR-001` — a distinct configured workflow type.
    const { LOOP_CONFIG_SOURCE } = await import('../../src/modules/loop/loop.tokens.js');
    const registry = app.get<{ require(type: string): unknown }>(LOOP_CONFIG_SOURCE, {
      strict: false,
    });
    expect(() => registry.require('defect-room')).not.toThrow();
  });

  it('and both sibling Rooms still load beside it', async () => {
    // The all-or-nothing registry, asserted where it bites. Adding a workflow
    // file before its handlers exist takes every other Room down with it.
    const { LOOP_CONFIG_SOURCE } = await import('../../src/modules/loop/loop.tokens.js');
    const registry = app.get<{ require(type: string): unknown }>(LOOP_CONFIG_SOURCE, {
      strict: false,
    });
    expect(() => registry.require('requirement-room')).not.toThrow();
    expect(() => registry.require('change-room')).not.toThrow();
  });

  it('the routing resolver is in the graph, with no destination bound', async () => {
    // Registered and honest: `EPIC-033`'s and `EPIC-034`'s intakes are real
    // routes, and neither is bound here. `route` says so rather than recording
    // a transfer that never arrived.
    const { RoutingResolver } = await import('../../src/modules/defect-room/routing.service.js');
    const resolver = app.get(RoutingResolver, { strict: false });
    const routed = await resolver.route({
      workspaceId: 'ws_1',
      defectId: 'df_1',
      outcome: 'change-request',
      summary: 'the notification fires twice',
    });
    expect(routed.routed).toBe(false);
  });
});
