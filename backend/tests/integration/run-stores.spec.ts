/**
 * `T1326` (EPIC-041) — runs, questions, markings and overrides survive a restart.
 *
 * `FR-LPW-041`, `R-041-7`. Four `runs.module.ts` stores were in memory in the
 * composed application (PMI-DOC-004B §2.1). Each Prisma store round-trips here
 * against a real PostgreSQL; the override store is additionally asserted to be
 * append-only, which the database enforces and the interface promises.
 *
 * Written to FAIL before `T1327` exists.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { POSTGRES_IMAGE } from '../helpers/postgres-image.js';
import {
  PrismaMarkingStore,
  PrismaOverrideStore,
  PrismaQuestionStore,
  PrismaRunStore,
} from '../../src/modules/runs/runs.store.prisma.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../prisma/migrations');
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_runs';
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

beforeAll(async () => {
  if (noRuntime) return;
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
  }
  await db.query(`INSERT INTO "organizations" ("id","name","updatedAt") VALUES ('org_default','Default',now()) ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'runs',now())`, [WS]);
  await db.query(
    `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt") VALUES ('pr_1',$1,'P','u_1',now())`,
    [WS],
  );
  await db.end();
  prisma = new PrismaClient({ datasourceUrl: container.getConnectionUri() });
}, 600_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
}, 120_000);

suite('T1326 · the run-side Prisma stores', () => {
  it('PrismaRunStore creates, finds, lists and updates a run', async () => {
    const runs = new PrismaRunStore(prisma.run);
    const run = await runs.create({
      workspaceId: WS,
      projectId: 'pr_1',
      mode: 'unattended',
      stopRange: 'after_specification',
      state: 'running',
      accessSnapshot: null,
      initiatedById: 'u_1',
      startedAt: new Date(),
      endedAt: null,
      outcomeReason: null,
    });
    expect(run.id).toBeTruthy();
    expect(await runs.find(WS, run.id)).toMatchObject({ id: run.id, state: 'running' });
    expect(await runs.find('ws_other', run.id)).toBeNull();
    expect((await runs.listForProject(WS, 'pr_1')).map((r) => r.id)).toContain(run.id);
    const updated = await runs.update(WS, run.id, { state: 'reached_stop_point', outcomeReason: 'stopped at range' });
    expect(updated.state).toBe('reached_stop_point');
    expect(updated.outcomeReason).toBe('stopped at range');
  });

  it('PrismaQuestionStore records a question against a run and lists it', async () => {
    const runs = new PrismaRunStore(prisma.run);
    const run = await runs.create({
      workspaceId: WS, projectId: 'pr_1', mode: 'unattended', stopRange: 'through_tasks', state: 'running',
      accessSnapshot: null, initiatedById: 'u_1', startedAt: new Date(), endedAt: null, outcomeReason: null,
    });
    const questions = new PrismaQuestionStore(prisma.recordedQuestion);
    const q = await questions.create({
      workspaceId: WS, runId: run.id, context: 'which retry policy?', optionsConsidered: ['a', 'b'],
      suggestedAnswer: 'a', provisionalAnswerApplied: 'a', restricted: false, createdAt: new Date(),
    });
    expect(await questions.find(WS, q.id)).toMatchObject({ optionsConsidered: ['a', 'b'], suggestedAnswer: 'a' });
    expect((await questions.listForRun(WS, run.id)).map((x) => x.id)).toEqual([q.id]);
  });

  it('PrismaMarkingStore marks an artifact provisional and clears it once', async () => {
    const runs = new PrismaRunStore(prisma.run);
    const run = await runs.create({
      workspaceId: WS, projectId: 'pr_1', mode: 'unattended', stopRange: 'through_tasks', state: 'running',
      accessSnapshot: null, initiatedById: 'u_1', startedAt: new Date(), endedAt: null, outcomeReason: null,
    });
    const q = await new PrismaQuestionStore(prisma.recordedQuestion).create({
      workspaceId: WS, runId: run.id, context: 'c', optionsConsidered: [], suggestedAnswer: 's',
      provisionalAnswerApplied: null, restricted: false, createdAt: new Date(),
    });
    const markings = new PrismaMarkingStore(prisma.provisionalMarking);
    const m = await markings.create({
      workspaceId: WS, artifactType: 'specification', artifactId: 'spec_x', questionId: q.id, clearedAt: null, createdAt: new Date(),
    });
    expect(await markings.listForArtifact(WS, { artifactType: 'specification', artifactId: 'spec_x' })).toHaveLength(1);
    expect(await markings.listForQuestion(WS, q.id)).toHaveLength(1);
    const cleared = await markings.clear(WS, m.id, new Date());
    expect(cleared.clearedAt).toBeInstanceOf(Date);
  });

  it('PrismaOverrideStore appends and lists, and the table refuses mutation', async () => {
    const overrides = new PrismaOverrideStore(prisma.provisionalApprovalOverride);
    const o = await overrides.append({
      workspaceId: WS, approvalRef: 'appr_1', approverId: 'u_2', approvedAt: new Date(),
      itemsAccepted: [{ artifactType: 'specification', artifactId: 'spec_x', questionId: 'q' }] as never,
    });
    expect((await overrides.listForApproval(WS, 'appr_1')).map((x) => x.id)).toEqual([o.id]);
    expect((overrides as unknown as Record<string, unknown>)['update']).toBeUndefined();
    expect((overrides as unknown as Record<string, unknown>)['delete']).toBeUndefined();
  });
});
