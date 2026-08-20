/**
 * T847 · `DEF-001-005` — every controller the application registers gets every
 * dependency it declares.
 *
 * **The gap this closes.** Controller unit tests construct their subject
 * directly — `new ProjectsController(service)` — so they exercise the class and
 * never the container. Nothing booted `AppModule` and looked at what was
 * actually built, and the container's failure mode here is silent: Nest reads
 * class-typed constructor parameters from `design:paramtypes`, esbuild (and so
 * `tsx`, the only way this API runs) does not emit it, and a missing metadata
 * entry is indistinguishable from "no dependency". Seven properties across four
 * controllers were `undefined`, and every endpoint 500ed on its first call.
 *
 * **Why it enumerates rather than lists.** Controllers are read from the Nest
 * metadata of the modules `AppModule` imports, so a controller added tomorrow is
 * covered without anyone remembering this file exists. A hand-written list would
 * protect exactly the seven sites already known to be broken — the eighth is the
 * one that reaches production.
 */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext, Type } from '@nestjs/common';
import { AppModule } from '../../../src/app.module.js';

/** Nest's own metadata keys. Reading them is what makes this enumerate. */
const IMPORTS = 'imports';
const CONTROLLERS = 'controllers';

let graph: INestApplicationContext;

/** Every controller reachable from AppModule, including through DynamicModules. */
function controllersOf(module: unknown, seen = new Set<unknown>()): Type<unknown>[] {
  // A DynamicModule is a plain object carrying `module` plus its own metadata;
  // a static module is a class with the metadata on it. Both appear in imports,
  // and AuthModule.register() made the first form live in this application.
  const dynamic = module as { module?: unknown; controllers?: Type<unknown>[]; imports?: unknown[] };
  const target = dynamic?.module ?? module;
  if (target === undefined || target === null || seen.has(target)) return [];
  seen.add(target);

  const own = (dynamic.controllers ??
    (Reflect.getMetadata(CONTROLLERS, target as object) as Type<unknown>[] | undefined) ??
    []) as Type<unknown>[];

  const imports = (dynamic.imports ??
    (Reflect.getMetadata(IMPORTS, target as object) as unknown[] | undefined) ??
    []) as unknown[];

  return [...own, ...imports.flatMap((i) => controllersOf(i, seen))];
}

beforeAll(async () => {
  // No DATABASE_URL: nothing here connects. The container builds instances and
  // this test reads their properties; the lazy Prisma client is never touched.
  delete process.env['DATABASE_URL'];
  graph = await NestFactory.createApplicationContext(AppModule, { logger: false });
}, 60_000);

afterAll(async () => {
  await graph?.close();
});

describe('T847 · DEF-001-005 · the composed application injects what its controllers declare', () => {
  it('finds the controllers by enumeration, so a new one is covered without an edit here', () => {
    const found = controllersOf(AppModule).map((c) => c.name);

    // The floor is deliberately a count, not a list: asserting exact names
    // would turn every legitimately-added controller into a failure of this
    // test rather than a subject of it.
    expect(found.length, 'no controllers enumerated — the metadata walk is broken, and a green ' +
      'result below would mean nothing').toBeGreaterThanOrEqual(5);
    expect(found).toContain('AuthController');
  });

  it.each(controllersOf(AppModule).map((c) => [c.name, c] as const))(
    '%s receives every dependency it declares',
    (name, controller) => {
      const instance = graph.get(controller) as Record<string, unknown>;

      const missing = Object.entries(instance)
        .filter(([, value]) => value === undefined)
        .map(([key]) => key);

      expect(
        missing,
        `${name} has undefined injected properties: ${missing.join(', ')}. A class-typed ` +
          `constructor parameter resolves to undefined under esbuild/tsx, which emits no ` +
          `design:paramtypes — inject by explicit token instead (DEF-001-005).`,
      ).toEqual([]);
    },
  );
});
