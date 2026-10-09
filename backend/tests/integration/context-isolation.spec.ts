/**
 * `T1259` (EPIC-038) — the tenant boundary, against PostgreSQL.
 *
 * `FR-CTX-050`–`FR-CTX-053`, `SC-CTX-003`.
 *
 * Two workspaces holding **overlapping** material — the same source ids, the
 * same types — because a boundary is only tested where the two sides could be
 * confused. Distinct ids on each side would pass against a store that ignored
 * the workspace entirely.
 *
 * Driven through `PrismaContextStore`, so the authorisations, the source
 * classes, the packages and the index entries are all the real tables,
 * including the partitioned one. `T1289` mutates the partition predicate in
 * `search.service.ts` and requires this file to go red; the search assertions
 * join it in `T1279`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import {
  PrismaContextStore,
  type ContextPrismaClient,
} from '../../src/modules/context/context.store.prisma.js';
import type { Candidate } from '../../src/modules/context/retrieval/outcome.types.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import {
  PgVectorIndex,
  type PgVectorClient,
} from '../../src/modules/context/retrieval/vector.index.pg.js';
import { allow, input, retrieval } from '../helpers/context-fixtures.js';
import { artifacts, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const A = 'ws_alpha';
const B = 'ws_beta';

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let store: PrismaContextStore;

/** The same source, as each workspace holds it. */
const held = (workspaceId: string, sourceId: string, score: number): Candidate => ({
  sourceType: 'requirement',
  sourceId,
  sourceVersion: workspaceId === A ? 'v1' : 'v7',
  relevanceScore: score,
  workspaceId,
});

/**
 * A request from one workspace. Unbound to an execution: `executionId` is a
 * foreign key to `executions` (`T1267`), and this file is about the boundary.
 */
const ask = (workspaceId: string) => input({ workspaceId, executionId: undefined });

/** Assembly for workspace A, with the candidates retrieval returned. */
function assembler(found: readonly Candidate[]): AssemblyService {
  return new AssemblyService(store, {
    retrieval: retrieval(found),
    access: allow(),
    sourceClasses: { classify: (ws, type) => store.classifySource(ws, type) },
    authorisations: store,
  });
}

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const url = container.getConnectionUri();
  const db = new Client({ connectionString: url });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  // Each workspace classifies the type for itself. Classification is per
  // workspace configuration, so B's class must not stand in for A's.
  for (const ws of [A, B]) {
    await db.query(
      `INSERT INTO "context_source_classes" ("id","workspaceId","sourceType","securityClassification","indexable")
       VALUES ($1,$2,'requirement','internal',true)`,
      [`sc_${ws}`, ws],
    );
  }
  await db.end();
  prisma = new PrismaClient({ datasources: { db: { url } } });
  store = new PrismaContextStore(prisma as unknown as ContextPrismaClient);
}, 600_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
}, 120_000);

suite('T1259 · two workspaces, overlapping material, one boundary', () => {
  it("B's copy of a shared id never enters A's package, though it outranks A's", async () => {
    const result = await assembler([held(B, 'rq_1', 0.99), held(A, 'rq_1', 0.7)]).assemble(
      ask(A),
    );
    const items = await store.itemsFor(A, result.packageId);
    expect(items.map((i) => [i.sourceId, i.sourceVersion, i.crossBoundary])).toEqual([
      ['rq_1', 'v1', false],
    ]);
    const exclusions = await store.exclusionsFor(A, result.packageId);
    expect(exclusions.map((e) => [e.sourceId, e.reason])).toEqual([['rq_1', 'boundary']]);
  });

  it('and the exclusion is visible, not a silent drop: items + exclusions = candidates', async () => {
    const found = [held(B, 'rq_1', 0.99), held(B, 'rq_2', 0.95), held(A, 'rq_1', 0.7)];
    const result = await assembler(found).assemble(ask(A));
    expect(result.itemCount + result.exclusionCount).toBe(found.length);
  });

  it("A's package is absent from B — not forbidden, absent (FR-002)", async () => {
    const result = await assembler([held(A, 'rq_1', 0.9)]).assemble(ask(A));
    expect(await store.findPackage(B, result.packageId)).toBeNull();
    expect(await store.itemsFor(B, result.packageId)).toEqual([]);
    expect(await store.exclusionsFor(B, result.packageId)).toEqual([]);
    expect((await store.findPackage(A, result.packageId))?.id).toBe(result.packageId);
  });

  it('an authorisation recorded in the table lets exactly that source cross, marked and named', async () => {
    await prisma.contextReusableAuthorisation.create({
      data: {
        id: 'rka_iso_1',
        sourceType: 'requirement',
        sourceId: 'rq_shared',
        workspaceId: B,
        toWorkspaceId: A,
        authorisedBy: 'u_beta_owner',
        rationale: 'the shared integration requirement',
      },
    });
    const result = await assembler([
      held(B, 'rq_shared', 0.9),
      held(B, 'rq_private', 0.85),
    ]).assemble(ask(A));

    const items = await store.itemsFor(A, result.packageId);
    expect(items.map((i) => [i.sourceId, i.crossBoundary, i.authorisationRef])).toEqual([
      ['rq_shared', true, 'rka_iso_1'],
    ]);
    const exclusions = await store.exclusionsFor(A, result.packageId);
    expect(exclusions.map((e) => [e.sourceId, e.reason])).toEqual([['rq_private', 'boundary']]);
  });

  it('and the same authorisation does not run the other way', async () => {
    // B granted A. A's copy of `rq_shared` is not thereby readable by B.
    const result = await assembler([held(A, 'rq_shared', 0.9)]).assemble(
      ask(B),
    );
    expect(result.itemCount).toBe(0);
    const exclusions = await store.exclusionsFor(B, result.packageId);
    expect(exclusions[0]?.reason).toBe('boundary');
  });

  it("the index holds both workspaces' entries for one source, and each reads only its own", async () => {
    for (const ws of [A, B]) {
      await store.upsertIndexEntry({
        id: `ie_${ws}`,
        workspaceId: ws,
        sourceType: 'requirement',
        sourceId: 'rq_1',
        sourceVersion: ws === A ? 'v1' : 'v7',
        embeddingModelId: 'model-a',
        dimension: 3,
        indexedAt: new Date(),
      });
    }
    expect((await store.indexEntriesFor(A)).map((e) => e.sourceVersion)).toEqual(['v1']);
    expect((await store.indexEntriesFor(B)).map((e) => e.sourceVersion)).toEqual(['v7']);
  });

  it("re-indexing A's copy leaves B's entry for the same id untouched", async () => {
    const before = (await store.indexEntriesFor(B))[0]!;
    await store.upsertIndexEntry({
      id: 'ie_alpha_2',
      workspaceId: A,
      sourceType: 'requirement',
      sourceId: 'rq_1',
      sourceVersion: 'v2',
      embeddingModelId: 'model-a',
      dimension: 3,
      indexedAt: new Date(),
    });
    const after = (await store.indexEntriesFor(B))[0]!;
    expect([after.id, after.sourceVersion, after.indexedAt.getTime()]).toEqual([
      before.id,
      before.sourceVersion,
      before.indexedAt.getTime(),
    ]);
  });

  it('staleness is judged per workspace: a version current in B is stale in A', async () => {
    const current = new Map([['requirement:rq_1', 'v7']]);
    expect((await store.staleEntriesFor(A, current)).map((e) => e.workspaceId)).toEqual([A]);
    expect(await store.staleEntriesFor(B, current)).toEqual([]);
  });
});

/**
 * `T1279`, `T1289` — the same boundary through pgvector search.
 *
 * Both workspaces index the SAME source ids with near-identical text, each in
 * its own partition. `T1289`'s mutation removes the partition predicate from
 * the search; with it gone, B's entries rank in A's results and this suite
 * goes red. That is `SC-CTX-003`'s guard, proven to be load-bearing.
 */
suite('T1259 · search ranks within one workspace partition', () => {
  const C = 'ws_gamma';
  const D = 'ws_delta';
  const TEXTS = {
    'requirement:rq_s1@v1': 'booking notification is sent twice',
    'requirement:rq_s2@v1': 'invoice totals round incorrectly',
  };

  async function indexBoth(): Promise<PgVectorIndex> {
    const vectors = new PgVectorIndex(prisma as unknown as PgVectorClient);
    for (const ws of [C, D]) {
      await prisma.contextSourceClass.create({
        data: { id: `sc_s_${ws}`, workspaceId: ws, sourceType: 'requirement', securityClassification: 'internal', indexable: true },
      });
      const index = new IndexService(store, vectors, fixtureEmbedding(), artifacts(TEXTS));
      for (const sourceId of ['rq_s1', 'rq_s2']) {
        await index.reindex({ workspaceId: ws, sourceType: 'requirement', sourceId, sourceVersion: 'v1' });
      }
    }
    return vectors;
  }

  it("each workspace's entries live in its own partition", async () => {
    await indexBoth();
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "workspaceId", tableoid::regclass::text AS part FROM "context_index_entries"
        WHERE "workspaceId" IN ($1, $2) GROUP BY 1, 2`,
      C,
      D,
    )) as { workspaceId: string; part: string }[];
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.part)).size).toBe(2);
    expect(rows.every((r) => r.part !== 'context_index_entries_default')).toBe(true);
  });

  it("C's search returns only C's material, though D's is identical", async () => {
    const vectors = new PgVectorIndex(prisma as unknown as PgVectorClient);
    const out = await new SearchService(vectors, fixtureEmbedding(), null, { limit: 10 }).search({
      workspaceId: C,
      objective: 'booking notification',
    });
    expect(out.candidates.map((c) => c.sourceId).sort()).toEqual(['rq_s1', 'rq_s2']);
    expect(out.returned).toBe(2);
  });
});

/**
 * `T1807` — the project boundary, inside one workspace partition, through
 * pgvector search and the real authorisation table.
 */
suite('T1807 · two projects, one workspace', () => {
  const WS = 'ws_projects';
  const TEXTS = {
    'requirement:rq_mine@v1': 'booking notification sent twice',
    'requirement:rq_theirs@v1': 'booking notification sent twice in the other project',
    'requirement:rq_shared@v1': 'booking notification retry policy shared',
  };
  const OWNER: Record<string, string> = { rq_mine: 'pr_1', rq_theirs: 'pr_2', rq_shared: 'pr_2' };

  async function search(): Promise<SearchService> {
    const vectors = new PgVectorIndex(prisma as unknown as PgVectorClient);
    await prisma.contextSourceClass.create({
      data: { id: 'sc_proj', workspaceId: WS, sourceType: 'requirement', securityClassification: 'internal', indexable: true },
    });
    const index = new IndexService(store, vectors, fixtureEmbedding(), {
      async read(_ws, type, id, version) {
        const text = (TEXTS as Record<string, string>)[`${type}:${id}@${version}`];
        return text === undefined ? null : { text, projectId: OWNER[id] ?? null };
      },
    });
    for (const sourceId of Object.keys(OWNER)) {
      await index.reindex({ workspaceId: WS, sourceType: 'requirement', sourceId, sourceVersion: 'v1' });
    }
    await prisma.contextReusableAuthorisation.create({
      data: {
        id: 'rka_proj', sourceType: 'requirement', sourceId: 'rq_shared', workspaceId: WS, toWorkspaceId: WS,
        fromProjectId: 'pr_2', toProjectId: 'pr_1', authorisedBy: 'u_owner', rationale: 'shared retry policy',
      },
    });
    return new SearchService(vectors, fixtureEmbedding(), null, { limit: 10 });
  }

  it("project 1's package excludes project 2's material, and admits only what was authorised across", async () => {
    const result = await new AssemblyService(store, {
      retrieval: await search(),
      access: allow(),
      sourceClasses: { classify: (ws, type) => store.classifySource(ws, type) },
      authorisations: store,
    }).assemble(input({ workspaceId: WS, projectId: 'pr_1', executionId: undefined, objective: 'booking notification' }));

    const items = await store.itemsFor(WS, result.packageId);
    expect(Object.fromEntries(items.map((i) => [i.sourceId, [i.crossBoundary, i.authorisationRef ?? null]]))).toEqual({
      rq_mine: [false, null],
      rq_shared: [true, 'rka_proj'],
    });
    const exclusions = await store.exclusionsFor(WS, result.packageId);
    expect(exclusions.map((e) => [e.sourceId, e.reason])).toEqual([['rq_theirs', 'boundary']]);
  });

  it('the database refuses a project authorisation naming one end only, or a project to itself', async () => {
    const base = {
      sourceType: 'requirement', sourceId: 'rq_x', workspaceId: WS, toWorkspaceId: WS,
      authorisedBy: 'u_owner', rationale: 'r',
    };
    await expect(
      prisma.contextReusableAuthorisation.create({ data: { ...base, id: 'rka_half', fromProjectId: 'pr_2' } }),
    ).rejects.toThrow(/projects_together|check/i);
    await expect(
      prisma.contextReusableAuthorisation.create({ data: { ...base, id: 'rka_self', fromProjectId: 'pr_1', toProjectId: 'pr_1' } }),
    ).rejects.toThrow(/cross_two|check/i);
  });
});

/**
 * `T1825` — an authorised source in ANOTHER workspace is retrieved from its
 * owner's partition and included as a marked crossing. Before `T1826` search
 * read only the requester's partition, so `FR-CTX-051`'s exception could be
 * judged but never reached.
 */
suite('T1825 · authorised sources are ranked in their owners partitions', () => {
  const REQUESTER = 'ws_reader_x';
  const OWNER_WS = 'ws_owner_x';
  const TEXTS: Record<string, string> = {
    'requirement:rq_local@v1': 'booking notification sent twice locally',
    'requirement:rq_shared_x@v1': 'booking notification sent twice shared handbook',
    'requirement:rq_private_x@v1': 'booking notification sent twice private postmortem',
  };

  it('retrieves exactly the authorised foreign source, stamped with its owner, and includes it as a crossing', async () => {
    const vectors = new PgVectorIndex(prisma as unknown as PgVectorClient);
    for (const ws of [REQUESTER, OWNER_WS]) {
      await prisma.contextSourceClass.create({
        data: { id: `sc_x_${ws}`, workspaceId: ws, sourceType: 'requirement', securityClassification: 'internal', indexable: true },
      });
    }
    const index = new IndexService(store, vectors, fixtureEmbedding(), {
      async read(_ws, type, id, version) {
        const text = TEXTS[`${type}:${id}@${version}`];
        return text === undefined ? null : { text, projectId: null };
      },
    });
    await index.reindex({ workspaceId: REQUESTER, sourceType: 'requirement', sourceId: 'rq_local', sourceVersion: 'v1' });
    for (const sourceId of ['rq_shared_x', 'rq_private_x']) {
      await index.reindex({ workspaceId: OWNER_WS, sourceType: 'requirement', sourceId, sourceVersion: 'v1' });
    }
    await prisma.contextReusableAuthorisation.create({
      data: {
        id: 'rka_x', sourceType: 'requirement', sourceId: 'rq_shared_x', workspaceId: OWNER_WS,
        toWorkspaceId: REQUESTER, authorisedBy: 'u_owner', rationale: 'shared handbook',
      },
    });

    const search = new SearchService(vectors, fixtureEmbedding(), null, { limit: 10 }, store);
    const out = await search.search({ workspaceId: REQUESTER, objective: 'booking notification sent twice' });
    expect(Object.fromEntries(out.candidates.map((c) => [c.sourceId, c.workspaceId]))).toEqual({
      rq_local: REQUESTER,
      rq_shared_x: OWNER_WS,
    });

    const result = await new AssemblyService(store, {
      retrieval: search,
      access: allow(),
      sourceClasses: { classify: (ws, type) => store.classifySource(ws, type) },
      authorisations: store,
    }).assemble(input({ workspaceId: REQUESTER, executionId: undefined, objective: 'booking notification sent twice' }));
    const items = await store.itemsFor(REQUESTER, result.packageId);
    expect(Object.fromEntries(items.map((i) => [i.sourceId, i.authorisationRef ?? null]))).toEqual({
      rq_local: null,
      rq_shared_x: 'rka_x',
    });
  });
});
