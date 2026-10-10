/**
 * `T1293` (EPIC-038) — the consolidated boundary confirmations.
 *
 * Each is a statement about what this Epic did **not** do, and an absence
 * nobody checks is one somebody adds later by analogy:
 *
 * 1. No source payload is stored in this Epic's tables — references only.
 * 2. No second access model (`FR-CTX-054`) — adjudication is `EPIC-024`'s.
 * 3. The screen is a shell area like the Rooms, so its load is the shell's.
 * 4. No workflow type is declared (`FR-CTX-070`).
 * 5. This Epic published no package — its contracts live in the module.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../..');
const MIGRATIONS = resolve(ROOT, 'backend/prisma/migrations');
const MODULE = resolve(ROOT, 'backend/src/modules/context');

const uncomment = (s: string): string => s.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const epic038Sql = readdirSync(MIGRATIONS)
  .filter((d) => /epic038/.test(d))
  .map((d) => uncomment(readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8')))
  .join('\n');

describe('T1293 · 1 — no source payload is stored', () => {
  it('reads the Epic-038 migrations, or the check is vacuous', () => {
    expect(epic038Sql).toMatch(/CREATE TABLE "context_items"/);
  });

  it.each(['content', 'body', 'payload', 'text', 'excerpt', 'blob', 'document'])(
    'no column is called %s',
    (column) => {
      expect(epic038Sql).not.toMatch(new RegExp(`"${column}"\\s+(TEXT|JSONB|BYTEA|VARCHAR)`, 'i'));
    },
  );

  it('and the references ARE there, so the absence is not the absence of the concept', () => {
    expect(epic038Sql).toMatch(/"sourceId"\s+TEXT NOT NULL/);
    expect(epic038Sql).toMatch(/"sourceVersion"\s+TEXT NOT NULL/);
  });
});

describe('T1293 · 2 — no second access model', () => {
  const files = readdirSync(MODULE, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ f, code: uncomment(readFileSync(join(MODULE, f), 'utf8')) }));

  it('the module defines no grant, role or permission table of its own', () => {
    expect(epic038Sql).not.toMatch(/CREATE TABLE "context_(grants|roles|permissions|acl)/i);
  });

  it('access is asked of EPIC-024 services, and only through the adapter', () => {
    const importers = files.filter(({ code }) => /from '\.\.\/access\//.test(code)).map(({ f }) => f);
    expect(importers.sort()).toEqual(['context.module.ts']);
    expect(files.find(({ f }) => f === 'access.adapter.ts')?.code).toMatch(/effectivelyReadable/);
  });
});

describe('T1293 · 3 — the screen is a shell area, as the Rooms are', () => {
  const areas = readFileSync(resolve(ROOT, 'frontend/src/shell/areas.ts'), 'utf8');

  it('Context is registered in the one area registry, delivered, with an element', () => {
    const block = areas.slice(areas.indexOf("id: 'context'"), areas.indexOf("id: 'context'") + 600);
    expect(block).toMatch(/status: 'delivered'/);
    expect(block).toMatch(/element: ContextView/);
  });
});

describe('T1293 · 4 — no workflow type', () => {
  it('no workflow declaration names context', () => {
    const dir = resolve(ROOT, 'packages/loop-contract/workflows');
    expect(readdirSync(dir).filter((f) => /context/i.test(f))).toEqual([]);
  });
});

describe('T1293 · 5 — this Epic published no package', () => {
  it('no packages/context* exists', () => {
    const packages = readdirSync(resolve(ROOT, 'packages'));
    expect(packages.filter((p) => /context/i.test(p))).toEqual([]);
  });

  it('and nothing outside the module imports it except the composition root', () => {
    const SRC = resolve(ROOT, 'backend/src');
    const importers = readdirSync(SRC, { recursive: true })
      .map(String)
      .map((f) => f.split('\\').join('/'))
      .filter((f) => f.endsWith('.ts') && !f.startsWith('modules/context/'))
      .filter((f) => /from '[^']*modules\/context\//.test(readFileSync(join(SRC, f), 'utf8')));
    expect(importers).toEqual(['app.module.ts']);
  });
});
