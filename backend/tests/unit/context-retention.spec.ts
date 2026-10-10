/**
 * `T1267` (EPIC-038) — a package lives as long as its execution, by cascade.
 *
 * `FR-CTX-066`, `R-038-9`. Two retention policies over one audit trail produce a
 * window where the execution is inspectable and its context has gone. So this
 * Epic has no policy of its own: the foreign key decides, and the stores offer
 * no delete for anyone to schedule.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import { PrismaContextStore } from '../../src/modules/context/context.store.prisma.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const sql = readdirSync(MIGRATIONS)
  .filter((d) => /^\d/.test(d))
  .map((d) => readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8').replace(/--.*$/gm, ''))
  .join('\n');

describe('T1267 · retention is inherited from the execution', () => {
  it('context_packages.executionId references executions ON DELETE CASCADE', () => {
    expect(sql).toMatch(
      /ALTER TABLE "context_packages"[\s\S]*?FOREIGN KEY \("executionId"\)\s*REFERENCES "executions"\s*\("id"\)\s*ON DELETE CASCADE/,
    );
  });

  it('and items and exclusions cascade from the package', () => {
    expect(sql).toMatch(/"context_items_package_fkey"[\s\S]*?ON DELETE CASCADE/);
    expect(sql).toMatch(/"context_exclusions_package_fkey"[\s\S]*?ON DELETE CASCADE/);
  });

  it.each([
    ['InMemoryContextStore', InMemoryContextStore.prototype],
    ['PrismaContextStore', PrismaContextStore.prototype],
  ])('%s offers no delete of packages, items or exclusions', (_name, proto) => {
    const methods = Object.getOwnPropertyNames(proto);
    expect(methods.filter((m) => /delete|remove|purge|expire|prune/i.test(m))).toEqual([]);
  });
});
