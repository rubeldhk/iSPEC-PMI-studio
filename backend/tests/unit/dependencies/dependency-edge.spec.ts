/**
 * T251 — DependencyEdge integrity (FR-ENH-008, R-017-3).
 * Written to FAIL before T252/T256 exist (Constitution V).
 *
 * A SEPARATE table from TraceabilityLink: derivation links are system-written
 * and immutable; dependency edges are user-maintained and cycle-checked.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DependenciesService,
  InMemoryDependencyStore,
} from '../../../src/modules/dependencies/dependencies.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

const WS = 'ws_a';
const A = { artifactType: 'specification', artifactId: 's_a' };
const B = { artifactType: 'specification', artifactId: 's_b' };

function build(): DependenciesService {
  return new DependenciesService(new InMemoryDependencyStore());
}

describe('T251 · the DependencyEdge model (T252)', () => {
  it('is its own table with a dependency type — NOT a discriminator on traceability_links', () => {
    const match = /model DependencyEdge \{[\s\S]*?\n\}/.exec(SCHEMA);
    expect(match, 'model DependencyEdge missing').toBeTruthy();
    const block = match![0];
    expect(block).toMatch(/dependencyType/);
    expect(block).toMatch(/@@map\("dependency_edges"\)/);
  });

  it('refuses duplicates at the database — unique across the full endpoint pair', () => {
    const block = /model DependencyEdge \{[\s\S]*?\n\}/.exec(SCHEMA)![0];
    expect(block).toMatch(/@@unique\(\[sourceType, sourceId, targetType, targetId\]\)/);
  });

  it('indexes BOTH traversal directions — impact walks backwards, listing walks forwards', () => {
    const block = /model DependencyEdge \{[\s\S]*?\n\}/.exec(SCHEMA)![0];
    expect(block).toMatch(/@@index\(\[sourceType, sourceId\]\)/);
    expect(block).toMatch(/@@index\(\[targetType, targetId\]\)/);
  });

  it('the migration refuses a self-edge at the database layer', () => {
    const dir = readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .find((d) =>
        /CREATE TABLE "dependency_edges"/.test(readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8')),
      );
    expect(dir, 'no migration creates dependency_edges').toBeTruthy();
    const sql = readFileSync(join(MIGRATIONS, dir!, 'migration.sql'), 'utf8');
    expect(sql).toMatch(/CHECK\s*\(\s*NOT\s*\(\s*"sourceType" = "targetType" AND "sourceId" = "targetId"\s*\)\s*\)/);
  });
});

describe('T251 · edge integrity at the service', () => {
  it('a duplicate edge is refused', async () => {
    const service = build();
    await service.create(WS, { source: A, target: B, dependencyType: 'consumes' }, 'u1');
    await expect(
      service.create(WS, { source: A, target: B, dependencyType: 'consumes' }, 'u1'),
    ).rejects.toThrow(/already|duplicate/i);
  });

  it('a self-edge is refused', async () => {
    await expect(
      build().create(WS, { source: A, target: A, dependencyType: 'consumes' }, 'u1'),
    ).rejects.toThrow(/itself|self/i);
  });

  it('source and target must share the workspace — a foreign edge endpoint is an opaque refusal', async () => {
    const store = new InMemoryDependencyStore();
    const service = new DependenciesService(store, {
      artifacts: {
        // B exists only in ws_b: from ws_a's viewpoint it does not exist.
        exists: async (workspaceId, ref) =>
          ref.artifactId === 's_b' ? workspaceId === 'ws_b' : workspaceId === WS,
      },
    });
    await expect(
      service.create(WS, { source: A, target: B, dependencyType: 'consumes' }, 'u1'),
    ).rejects.toThrow();
  });
});
