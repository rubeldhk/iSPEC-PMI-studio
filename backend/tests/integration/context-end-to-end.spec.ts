/**
 * `T1299` (EPIC-038 Phase Z) — assembly, provenance, isolation and inspection,
 * end to end, in one run against PostgreSQL.
 *
 * Each story has passed alone. The failure this catches is the one where they
 * disagree: an item the boundary admitted that provenance then mislabels, an
 * exclusion the assembler recorded that inspection does not show, a shortfall
 * the package carries that a reader never sees.
 *
 * Every component is the real one except the two with no provider in the
 * programme — the embedding (a deterministic letter-bag fixture) and the
 * baseline reader (a table) — and the access adjudicator, which is
 * `EPIC-024`'s adapter over fixture membership and grants.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { ForbiddenError } from '../../src/core/errors.js';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { accessPolicyFromEpic024 } from '../../src/modules/context/access.adapter.js';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import {
  PrismaContextStore,
  type ContextPrismaClient,
} from '../../src/modules/context/context.store.prisma.js';
import { InspectionService } from '../../src/modules/context/inspection.service.js';
import { ProvenanceService } from '../../src/modules/context/provenance.service.js';
import { IndexService } from '../../src/modules/context/retrieval/index.service.js';
import { SearchService } from '../../src/modules/context/retrieval/search.service.js';
import { PgVectorIndex, type PgVectorClient } from '../../src/modules/context/retrieval/vector.index.pg.js';
import { baselines, input } from '../helpers/context-fixtures.js';
import { artifacts, currentVersions, fixtureEmbedding } from '../helpers/context-retrieval-fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const HOME = 'ws_home';
const PARTNER = 'ws_partner';
const ACTOR = 'u_engineer';
const OBJECTIVE = 'booking notification sent twice';

const TEXTS = {
  'requirement:rq_notify@v2': 'booking notification sent twice to the customer',
  'requirement:rq_notify_old@v1': 'booking notification sent once',
  'specification:sp_notify@v1': 'notification service specification for bookings',
  'specification:sp_secret@v1': 'booking notification escalation salary review',
  'requirement:rq_partner@v1': 'booking notification sent twice partner copy',
};

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let store: PrismaContextStore;
let packageId: string;

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const url = container.getConnectionUri();
  const db = new Client({ connectionString: url });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  for (const ws of [HOME, PARTNER]) {
    for (const type of ['requirement', 'specification']) {
      await db.query(
        `INSERT INTO "context_source_classes" ("id","workspaceId","sourceType","securityClassification","indexable")
         VALUES ($1,$2,$3,'internal',true)`,
        [`sc_${ws}_${type}`, ws, type],
      );
    }
  }
  await db.end();

  prisma = new PrismaClient({ datasources: { db: { url } } });
  store = new PrismaContextStore(prisma as unknown as ContextPrismaClient);
  const vectors = new PgVectorIndex(prisma as unknown as PgVectorClient);
  const embedding = fixtureEmbedding();
  const index = new IndexService(store, vectors, embedding, artifacts(TEXTS));
  for (const [sourceType, sourceId, version] of [
    ['requirement', 'rq_notify', 'v2'],
    ['requirement', 'rq_notify_old', 'v1'],
    ['specification', 'sp_notify', 'v1'],
    ['specification', 'sp_secret', 'v1'],
  ] as const) {
    await index.reindex({ workspaceId: HOME, sourceType, sourceId, sourceVersion: version });
  }
  await index.reindex({ workspaceId: PARTNER, sourceType: 'requirement', sourceId: 'rq_partner', sourceVersion: 'v1' });

  // EPIC-024, as fixtures: the engineer is a member of HOME, and holds a grant
  // on sp_notify but not on sp_secret.
  const access = accessPolicyFromEpic024(
    {
      async requireWithinWorkspace(ws, actor) {
        if (ws !== HOME || actor !== ACTOR) throw new ForbiddenError('Not found.');
        return {};
      },
    },
    {
      async effectivelyReadable(_ws, _user, artifact) {
        return artifact.artifactId === 'sp_notify';
      },
    },
  );

  const result = await new AssemblyService(store, {
    retrieval: new SearchService(
      vectors,
      embedding,
      // rq_notify_old has moved on since it was indexed.
      currentVersions({
        'requirement:rq_notify': 'v2',
        'requirement:rq_notify_old': 'v3',
        'specification:sp_notify': 'v1',
        'specification:sp_secret': 'v1',
      }),
      { limit: 10 },
    ),
    access,
    sourceClasses: { classify: (ws, type) => store.classifySource(ws, type) },
    authorisations: store,
    provenance: new ProvenanceService(
      baselines({
        'rq_notify@v2': { status: 'current' },
        'sp_notify@v1': { status: 'superseded', supersededBy: 'sp_notify@v2' },
      }),
    ),
    costOf: () => 1,
  }).assemble(input({ workspaceId: HOME, actorId: ACTOR, executionId: undefined, objective: OBJECTIVE }));
  packageId = result.packageId;
}, 600_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
}, 120_000);

suite('T1299 · the four stories agree', () => {
  it('assembly: two items, each with the reason it was selected', async () => {
    const inspected = await new InspectionService(store, null, null).inspect(HOME, packageId);
    expect(inspected?.items.map((i) => i.sourceId).sort()).toEqual(['rq_notify', 'sp_notify']);
    for (const item of inspected?.items ?? []) expect(item.inclusionReason).toMatch(/objective relevance/);
  });

  it('provenance: the specification is superseded and names its successor; the requirement is current', async () => {
    const items = await store.itemsFor(HOME, packageId);
    const byId = Object.fromEntries(items.map((i) => [i.sourceId, i]));
    expect(byId['rq_notify']?.authoritativeStatus).toBe('current');
    expect(byId['sp_notify']).toMatchObject({ authoritativeStatus: 'superseded', supersededBy: 'sp_notify@v2' });
  });

  it('isolation: the partner workspace material never reached the assembler, and no grant leaked', async () => {
    const inspected = await new InspectionService(store, null, null).inspect(HOME, packageId);
    const everything = [...(inspected?.items ?? []), ...(inspected?.exclusions ?? [])].map((x) => x.sourceId);
    expect(everything).not.toContain('rq_partner');
    expect(await store.findPackage(PARTNER, packageId)).toBeNull();
  });

  it('inspection: the exclusions say why — permission for the ungranted spec, stale for the moved one', async () => {
    const inspected = await new InspectionService(store, null, null).inspect(HOME, packageId);
    const why = Object.fromEntries((inspected?.exclusions ?? []).map((e) => [e.sourceId, e.reason]));
    expect(why).toEqual({ sp_secret: 'permission', rq_notify_old: 'stale' });
  });

  it('and the arithmetic holds: items + exclusions = what retrieval returned', async () => {
    const inspected = await new InspectionService(store, null, null).inspect(HOME, packageId);
    expect((inspected?.items.length ?? 0) + (inspected?.exclusions.length ?? 0)).toBe(
      inspected?.package.retrievalReturned,
    );
  });
});
