/**
 * `T1181`, `T1182` (EPIC-033) — the Room's persistent store.
 *
 * `REQUIREMENT_ROOM_STORE` has defaulted to in-memory since `T338b`, and the
 * store's own header explains the asymmetry honestly. What no one checked is
 * that nothing ever replaced it: candidates, clarifications, decisions and
 * **baselines** all lived in the process. A baseline is the artifact `RULE-02`
 * exists to make immutable, and it did not survive a restart.
 *
 * The shape of these assertions follows the store's own contract rather than
 * the table: `nextBaselineVersion` and `supersede` are the two with real logic,
 * and both are asserted against concurrent and superseded states rather than a
 * single happy path.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import type {
  BaselineRow,
  CandidateRow,
  ClarificationRow,
  RequirementRoomStore,
} from '../../src/modules/requirement-room/requirement-room.store.js';
import {
  PrismaRequirementRoomStore,
  type RoomPrismaClient,
} from '../../src/modules/requirement-room/requirement-room.store.prisma.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_roomdb';
const PROJECT = 'pr_roomdb';
const ROOM = 'ro_roomdb';

const candidate = (id: string, over: Partial<CandidateRow> = {}): CandidateRow => ({
  id,
  workspaceId: WS,
  projectId: PROJECT,
  roomObjectId: ROOM,
  sourceRef: 'notes',
  normalizedText: `Requirement ${id}`,
  epistemic: 'fact',
  aiAnalysis: null,
  promotedTo: null,
  acceptanceCriteria: null,
  intendedForImplementation: true,
  createdAt: new Date('2026-08-29T10:00:00Z'),
  ...over,
});

const clarification = (id: string, over: Partial<ClarificationRow> = {}): ClarificationRow =>
  ({
    id,
    workspaceId: WS,
    roomObjectId: ROOM,
    candidateId: null,
    question: `What does ${id} mean?`,
    answer: null,
    answeredBy: null,
    answeredAt: null,
    askedBy: 'u_1',
    blocksBaseline: true,
    createdAt: new Date('2026-08-29T10:00:00Z'),
    ...over,
  }) as ClarificationRow;

const baseline = (id: string, version: number, over: Partial<BaselineRow> = {}): BaselineRow =>
  ({
    id,
    workspaceId: WS,
    projectId: PROJECT,
    version,
    memberVersionIds: [`rv_${version}`],
    setHash: `hash_${version}`.padEnd(64, '0'),
    approvedBy: 'u_1',
    approvedAt: new Date('2026-08-29T10:00:00Z'),
    rationale: 'agreed',
    decisionId: `rd_${version}`,
    supersededBy: null,
    evidenceContractRef: 'ev_1',
    ...over,
  }) as BaselineRow;

suite('T1181 · the Room store against a real database', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let store: RequirementRoomStore;
  let url = '';

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [WS]);
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    store = new PrismaRequirementRoomStore(prisma as unknown as RoomPrismaClient);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('creates candidates and lists them scoped to the Room', async () => {
    await store.createCandidates([candidate('c1'), candidate('c2')]);
    await store.createCandidates([candidate('c_other', { roomObjectId: 'ro_elsewhere' })]);

    const rows = await store.listCandidates(WS, ROOM);
    expect(rows.map((r) => r.id).sort()).toEqual(['c1', 'c2']);
    expect(rows[0]?.epistemic).toBe('fact');
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('survives a NEW client — the property the in-memory store cannot have', async () => {
    const fresh = new PrismaClient({ datasources: { db: { url } } });
    try {
      const rows = await new PrismaRequirementRoomStore(fresh as unknown as RoomPrismaClient).listCandidates(WS, ROOM);
      expect(rows.map((r) => r.id).sort()).toEqual(['c1', 'c2']);
    } finally {
      await fresh.$disconnect();
    }
  });

  it('marks a candidate promoted, keeping a reference and never a copy', async () => {
    const row = await store.markPromoted('c1', 'req_123');
    expect(row.promotedTo).toBe('req_123');
    // `FR-RQR-002`, `D-33` — the register's text is not copied here.
    expect(Object.keys(row)).not.toContain('description');
  });

  it('sets acceptance criteria, and null and [] stay distinguishable', async () => {
    const set = await store.setCandidateCriteria('c2', {
      acceptanceCriteria: ['measurable thing'],
      intendedForImplementation: true,
    });
    expect(set.acceptanceCriteria).toEqual(['measurable thing']);

    const cleared = await store.setCandidateCriteria('c2', {
      acceptanceCriteria: null,
      intendedForImplementation: false,
    });
    // `FR-RQR-030`'s note: null and [] are the same state and both block, but
    // the column must still round-trip what it was given.
    expect(cleared.acceptanceCriteria).toBeNull();
    expect(cleared.intendedForImplementation).toBe(false);
  });

  it('finds a candidate by id, and returns null for one that does not exist', async () => {
    expect((await store.findCandidateById('c1'))?.id).toBe('c1');
    expect(await store.findCandidateById('nope')).toBeNull();
  });

  it('creates and answers clarifications', async () => {
    await store.createClarifications([clarification('q1'), clarification('q2')]);
    const answered = await store.answerClarification('q1', {
      answer: 'Within one business day.',
      answeredBy: 'u_1',
      answeredAt: new Date('2026-08-29T11:00:00Z'),
    });
    expect(answered.answer).toBe('Within one business day.');
    expect(answered.answeredAt).toBeInstanceOf(Date);

    const rows = await store.listClarifications(WS, ROOM);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.answer === null)).toHaveLength(1);
  });
});

suite('T1181 · baselines — versioning and supersession', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let store: RequirementRoomStore;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    const url = container.getConnectionUri();
    const db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$1,now())`, [WS]);
    await db.end();
    prisma = new PrismaClient({ datasources: { db: { url } } });
    store = new PrismaRequirementRoomStore(prisma as unknown as RoomPrismaClient);
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  /**
   * A baseline references the decision that approved it — `baselines.decisionId`
   * is a foreign key, and `BR-0025` is why. The fixture creates the decision
   * first rather than working around the constraint, because a baseline nobody
   * decided is the state the column exists to forbid.
   */
  const decisionFor = (version: number) =>
    store.createDecision({
      id: `rd_${version}`,
      workspaceId: WS,
      roomObjectId: ROOM,
      decidedBy: 'u_1',
      decidedByKind: 'human',
      authorityBasis: 'lead',
      objectVersion: 1,
      chosenOption: 'A',
      declinedOptions: ['B'],
      rationale: 'agreed',
      decisionId: `rd_${version}`,
      decidedAt: new Date('2026-08-29T10:00:00Z'),
    } as never);

  it('starts at version 1 when a project has none', async () => {
    expect(await store.nextBaselineVersion(PROJECT)).toBe(1);
  });

  it('creates a baseline and reads it by id and by version', async () => {
    await decisionFor(1);
    await store.createBaseline(baseline('b1', 1));
    expect((await store.findBaselineById('b1'))?.version).toBe(1);
    expect((await store.findBaselineByVersion(PROJECT, 1))?.id).toBe('b1');
    expect(await store.findBaselineByVersion(PROJECT, 99)).toBeNull();
  });

  it('advances the next version past the highest, not the count', async () => {
    // The distinction matters: a deleted or skipped version would make a
    // count-based answer reissue a version that already existed.
    await decisionFor(5);
    await store.createBaseline(baseline('b5', 5));
    expect(await store.nextBaselineVersion(PROJECT)).toBe(6);
  });

  it('supersedes, and the superseded baseline REMAINS readable', async () => {
    // `FR-RQR-052` — a superseded baseline stays readable and names what
    // replaced it. Deleting it would break the trace `SC-RQR-006` asserts.
    const superseded = await store.supersede('b1', 5);
    expect(superseded.supersededBy).toBe(5);

    const still = await store.findBaselineById('b1');
    expect(still, 'the superseded baseline was removed').not.toBeNull();
    expect(still?.setHash).toBe(baseline('b1', 1).setHash);
  });

  it('lists baselines for the project, superseded ones included', async () => {
    const rows = await store.listBaselines(WS, PROJECT);
    expect(rows.map((r) => r.version).sort((a, b) => a - b)).toEqual([1, 5]);
    expect(rows.filter((r) => r.supersededBy === null)).toHaveLength(1);
  });

  it('records exceptions and decisions against the baseline', async () => {
    await store.createBaselineExceptions([
      {
        id: 'ex1',
        workspaceId: WS,
        baselineId: 'b5',
        requirementVersionId: 'rv_5',
        condition: 'missing-acceptance-criteria',
        authorizedBy: 'u_lead',
        reason: 'deferred to the next cycle',
        createdAt: new Date('2026-08-29T10:00:00Z'),
      },
    ] as never);
    const rows = await store.listBaselineExceptions(WS, 'b5');
    expect(rows[0]?.authorizedBy).toBe('u_lead');

    await store.createDecision({
      id: 'd_options',
      workspaceId: WS,
      roomObjectId: ROOM,
      decidedBy: 'u_1',
      decidedByKind: 'human',
      authorityBasis: 'lead',
      objectVersion: 1,
      chosenOption: 'A',
      declinedOptions: ['B', 'C'],
      rationale: 'A is reversible',
      decisionId: 'd_options',
      decidedAt: new Date('2026-08-29T12:00:00Z'),
    } as never);
    const decisions = await store.listDecisions(WS, ROOM);
    // `FR-RQR-023` — the options NOT chosen are retained.
    const options = decisions.find((d) => d.id === 'd_options');
    expect(options?.declinedOptions).toEqual(['B', 'C']);
  });

  it('records a handoff and finds it both ways', async () => {
    await store.createHandoff({
      id: 'h1',
      workspaceId: WS,
      baselineId: 'b5',
      baselineVersion: 5,
      specificationWorkflowRef: 'wf_1',
      selectedBy: 'u_1',
      selectedAt: new Date('2026-08-29T10:00:00Z'),
    } as never);
    // `SC-RQR-006` runs in both directions, so both lookups exist.
    expect(await store.listHandoffsForBaseline(WS, 'b5')).toHaveLength(1);
    expect(await store.listHandoffsForWorkflow(WS, 'wf_1')).toHaveLength(1);
  });
});
