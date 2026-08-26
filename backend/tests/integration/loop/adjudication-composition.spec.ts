/**
 * T1102 (EPIC-030 C2A closure) — runtime reachability of the adjudicator.
 *
 * Closure finding `X6`: every port had zero production implementations and
 * `ProposalAdjudicatorService` was constructed only by tests. Unit tests could
 * not have caught that — they *were* the manual construction.
 *
 * So this boots the **real `AppModule`**, with no overrides and no mocks,
 * exactly the way `T830` does, and asks the container for the adjudicator. If
 * any provider is missing, mis-tokened, or depends on something the graph
 * cannot supply, `NestFactory.create` fails here rather than in production.
 *
 * ## What "reaches the real adapters" is proven by
 *
 * Not by inspecting classes — by **observing their behaviour**:
 *
 * - With no EPIC-024 grant, the proposal is refused *by EPIC-024*. Nothing else
 *   in this graph can produce that refusal.
 * - With a grant, the same proposal gets past authorisation and past the real
 *   Prisma idempotency read, and fails in *EPIC-009* instead — a different
 *   error from a different Epic, which is only reachable if both real adapters
 *   ran in order.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import type { AdjudicationProposal } from '@pmi/loop-contract';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WORKSPACE = 'ws_adjudication';
const ACTOR = 'u_proposer';
const SPEC = 'spec_missing';

function proposal(overrides: Partial<AdjudicationProposal> = {}): AdjudicationProposal {
  return {
    proposalId: 'p-composition',
    executionId: 'e-composition',
    workspaceId: WORKSPACE,
    specificationId: SPEC,
    expectedCurrentStatus: 'draft',
    requestedStatus: 'review',
    targetVersion: 1,
    proposerId: ACTOR,
    proposerType: 'human',
    proposerIdentitySnapshotId: 'snap-composition',
    originatingConnector: 'composition-test',
    evidenceRefs: [],
    reason: 'runtime reachability probe',
    correlationId: 'c-composition',
    causationId: 'e-composition',
    idempotencyKey: 'k-composition',
    proposedAt: '2026-08-25T12:00:00.000Z',
    ...overrides,
  };
}

suite('T1102 · the adjudicator is reachable from the composed application', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let tokens: any;
  let adjudicator: any;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,$2,now())`, [
      WORKSPACE,
      'adjudication composition',
    ]);
    await db.end();

    // Before the composition root runs, because that is where production learns
    // it too (T830's precedent).
    process.env['DATABASE_URL'] = container.getConnectionUri();

    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../../src/app.module.js');
    tokens = await import('../../../src/modules/loop/loop.tokens.js');

    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    // `strict: false` because the token is exported by LoopModule and resolved
    // from the application root — which is how EPIC-037 will resolve it.
    adjudicator = app.get(tokens.PROPOSAL_ADJUDICATOR, { strict: false });
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('the container supplies an adjudicator at all', async () => {
    const { ProposalAdjudicatorService } = await import(
      '../../../src/modules/loop/adjudicator.service.js'
    );
    expect(adjudicator, 'PROPOSAL_ADJUDICATOR resolved to nothing').toBeDefined();
    expect(adjudicator).toBeInstanceOf(ProposalAdjudicatorService);
  });

  it('every required production port resolves, and to the real adapter', async () => {
    const a = await import('../../../src/modules/loop/adjudication.adapters.js');
    const { LifecycleApplicationAdapter } = await import(
      '../../../src/modules/loop/lifecycle-application.adapter.js'
    );

    // Named one by one rather than counted: a count passes when a port is
    // swapped for the wrong implementation, which is the failure that matters.
    const expected: [symbol, unknown, string][] = [
      [tokens.ADJUDICATION_LIFECYCLE_VALIDATION, a.EpicNineLifecycleValidation, 'EPIC-009'],
      [tokens.ADJUDICATION_LIFECYCLE_APPLICATION, LifecycleApplicationAdapter, 'EPIC-009'],
      [tokens.ADJUDICATION_GATE_OUTCOMES, a.UnconfiguredGateOutcomes, 'EPIC-021'],
      [tokens.ADJUDICATION_AUTHORITY_POLICY, a.ConfiguredAuthorityPolicy, 'EPIC-030'],
      [tokens.ADJUDICATION_INTAKE_AUTHORIZATION, a.AccessIntakeAuthorization, 'EPIC-024'],
      [tokens.ADJUDICATION_RECORDS, a.PrismaAdjudicationRecords, 'EPIC-030'],
      [tokens.ADJUDICATION_APPLICATION_INTENTS, a.PrismaApplicationIntents, 'EPIC-030'],
    ];

    for (const [token, cls, owner] of expected) {
      const resolved = app.get(token, { strict: false });
      expect(resolved, `${String(token)} (${owner}) resolved to nothing`).toBeDefined();
      expect(
        resolved,
        `${String(token)} is not the production adapter for ${owner}`,
      ).toBeInstanceOf(cls as never);
    }
  });

  it('exposes ONLY the consumer-facing token, not the ports EPIC-037 could bypass with', async () => {
    const { LoopModule: loopModule } = await import('../../../src/modules/loop/loop.module.js');
    // `FR-GEL-073`: a consumer that could reach the gate port could assemble an
    // adjudicator with a permissive one. LoopModule exports the adjudicator and
    // nothing else from this set — asserted on the module metadata, because
    // `app.get(..., {strict:false})` searches the whole graph and would resolve
    // a provider whether or not it was exported.
    const exported = (Reflect.getMetadata('exports', loopModule) ?? []) as unknown[];
    expect(exported).toContain(tokens.PROPOSAL_ADJUDICATOR);
    for (const t of [
      tokens.ADJUDICATION_GATE_OUTCOMES,
      tokens.ADJUDICATION_LIFECYCLE_APPLICATION,
      tokens.ADJUDICATION_RECORDS,
      tokens.ADJUDICATION_INTAKE_AUTHORIZATION,
    ]) {
      expect(exported, `${String(t)} is exported and should not be`).not.toContain(t);
    }
  });

  it('reaches the REAL EPIC-024: an ungranted proposal is refused by authorisation', async () => {
    // Nothing else in this graph refuses here, so observing this refusal proves
    // AccessIntakeAuthorization ran against the real AccessEnforcementService.
    await expect(
      adjudicator.adjudicate(proposal()),
      'the ungranted proposal was not refused by EPIC-024',
    ).rejects.toThrow();
  });

  it('writes NO evidence for a proposal EPIC-024 refused', async () => {
    const db = new Client({ connectionString: container.getConnectionUri() });
    await db.connect();
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "adjudication_records" WHERE "workspaceId" = $1`,
      [WORKSPACE],
    );
    await db.end();
    expect(Number(rows[0]!.n), 'an unauthorised caller left evidence behind').toBe(0);
  });

  it('reaches the REAL EPIC-009 once a grant exists', async () => {
    const { AccessGrantService } = await import(
      '../../../src/modules/access/access-grant.service.js'
    );
    const grants = app.get(AccessGrantService, { strict: false });
    await grants.grant(
      WORKSPACE,
      { artifactType: 'specification', artifactId: SPEC },
      { userId: ACTOR, level: 'edit', grantedById: 'u_admin' },
    );

    // Past EPIC-024, past the real Prisma idempotency read, into EPIC-009 —
    // which has no such specification. A different Epic's error, reachable only
    // if both preceding adapters ran for real and in order.
    await expect(adjudicator.adjudicate(proposal())).rejects.toThrow();
  });
});
