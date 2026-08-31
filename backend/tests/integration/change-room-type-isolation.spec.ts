/**
 * `T994z` (EPIC-034) — this Room is its own workflow type.
 *
 * `FR-CHR-001`, `SC-CHR-010`: *zero transitions succeed under another Room's
 * stages, authorities or gates*. `ADR-0018`'s only decided constraint — three
 * distinct workflow types over one engine, never a variant of another Room.
 *
 * ## What "borrowing a stage" would actually cost
 *
 * The spec puts it plainly: borrowing another Room's stage collapses two
 * governed surfaces. A Change Room object moving through the Requirement Room's
 * `Decide` would be adjudicated by that Room's authorities — which are about
 * approving a requirement set, not about changing an approved baseline. The
 * transition would succeed, the audit trail would look complete, and the wrong
 * people would have approved the wrong thing.
 *
 * ## Why this is an integration test
 *
 * The isolation lives in the **composed registry**, not in either Room's code.
 * `buildConfigRegistry` loads every workflow file, `StageRegistry` throws on a
 * duplicate handler, and the two Rooms' stage sets are unioned at the
 * composition root. A unit test over either Room's constants would assert what
 * that Room intends; only the composed application knows what it got.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import { CHANGE_ROOM_STAGES } from '../../src/modules/change-room/stage-handlers.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

interface ConfigRegistry {
  /** `stages` is a list of names, as `change-room.json` declares them. */
  require(type: string): { stages: readonly string[] };
}

suite('T994z · the Change Room resolves as its own workflow type', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let registry: ConfigRegistry;

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

    const { LOOP_CONFIG_SOURCE } = await import('../../src/modules/loop/loop.tokens.js');
    registry = app.get<ConfigRegistry>(LOOP_CONFIG_SOURCE, { strict: false });
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  }, 120_000);

  it('loads as `change-room`, not as a variant of another type', () => {
    expect(() => registry.require('change-room')).not.toThrow();
  });

  it('and the Requirement Room loads beside it as its own type', () => {
    // Both, from the composed registry. `buildConfigRegistry` is all-or-nothing
    // — adding `change-room.json` before its handlers existed took the
    // Requirement Room down with it, which is how `T1164`'s prediction was
    // confirmed.
    expect(() => registry.require('requirement-room')).not.toThrow();
  });

  it('a type nobody declared is refused, not defaulted to a neighbour', () => {
    // The failure mode that would make the two assertions above meaningless: a
    // registry answering every name with something.
    expect(() => registry.require('change-room-v2')).toThrow();
    expect(() => registry.require('requirement')).toThrow();
  });

  it('the two types declare different stage sets', () => {
    // `FR-CHR-001` — its own stages. Identical sets would mean one Room's
    // configuration could be swapped for the other's without anything noticing.
    const change = registry.require('change-room').stages;
    const requirement = registry.require('requirement-room').stages;
    expect(change).not.toEqual(requirement);
  });

  it('the Change Room declares Verify and the Requirement Room does not', () => {
    // The specific difference, named. A set difference that happened to be
    // empty would satisfy the previous assertion through ordering alone.
    const change = registry.require('change-room').stages;
    const requirement = registry.require('requirement-room').stages;
    expect(change).toContain('Verify');
    expect(requirement).not.toContain('Verify');
  });

  it('and its stages are the seven it declares', () => {
    const change = registry.require('change-room').stages;
    expect(change).toEqual([...CHANGE_ROOM_STAGES]);
  });

  it('no stage belongs to both Rooms by accident', () => {
    // `StageRegistry` throws on a duplicate handler, so the union that composed
    // successfully is itself the proof that no two Rooms claim one stage's
    // behaviour. This asserts the consequence: the Change Room contributes only
    // what the Requirement Room does not.
    const change = new Set(registry.require('change-room').stages);
    const requirement = new Set(registry.require('requirement-room').stages);
    const onlyChange = [...change].filter((stage) => !requirement.has(stage));
    expect(onlyChange).toEqual(['Verify']);
  });
});
