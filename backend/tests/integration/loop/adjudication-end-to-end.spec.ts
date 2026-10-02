/**
 * T1111 (C2C) — the applied verdict, end to end, through the real application.
 *
 * Every prior phase stopped short of this. C2A built the decision engine and
 * could not reach `applied`. C2A closure wired it and still could not: EPIC-021
 * supplied no gate service and EPIC-009 surfaced no transition identity. This is
 * the first test in which a proposal travels the whole governed path and comes
 * back `applied` with an id that names a committed row.
 *
 * ## No shortcuts on the path under test
 *
 * The application is the real `AppModule`, the database is real PostgreSQL, and
 * every service is resolved from Nest DI. The gate is configured through
 * EPIC-021's real `GateConfigService`, the human decision is recorded through
 * its real `GateProductionService`, authorisation is EPIC-024's real
 * `AccessEnforcementService`, and the transition is EPIC-009's real
 * transactional repository.
 *
 * ## Nothing on the success path is inserted directly (C2D)
 *
 * C2C created the specification with raw SQL, because `SPECIFICATION_STORE` was
 * bound to the in-memory store while the lifecycle services read PostgreSQL —
 * `X16`, a split source of truth the test was quietly stepping around.
 *
 * That binding is fixed, so the specification is now created through
 * `SPECIFICATION_STORE.commitGeneration` resolved from DI: the same production
 * persistence the generation service calls. (The generation *service* above it
 * needs an AI engine, which is why the store is the entry point rather than the
 * service — it is production code either way, and no test-only provider,
 * default-allow adapter or configuration override is involved.)
 *
 * Only workspace, user and project rows remain direct inserts. They are
 * tenancy fixtures, not the governed artifact, and no service under test
 * creates them.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../../helpers/postgres-image.js';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import type { AdjudicationProposal } from '@pmi/loop-contract';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_e2e';
const SPEC = 'spec_e2e';
const ACTOR = 'u_proposer';
const DECIDER = 'u_decider';

suite('T1111 · a proposal travels the governed path and comes back applied', () => {
  let container: StartedPostgreSqlContainer;
  let db: Client;
  let app: INestApplication;
  let url = '';

  let adjudicator: any;

  let gateConfig: any;

  let gateProduction: any;

  let lifecycleRepo: any;
  let specStore: any;
  let policies: any;
  let gateSetVersionOf: (g: any) => string;

  function proposal(over: Partial<AdjudicationProposal> = {}): AdjudicationProposal {
    return {
      proposalId: 'p-e2e',
      executionId: 'e-e2e',
      workspaceId: WS,
      specificationId: SPEC,
      expectedCurrentStatus: 'draft',
      requestedStatus: 'review',
      targetVersion: 1,
      proposerId: ACTOR,
      proposerType: 'human',
      proposerIdentitySnapshotId: 'snap-proposer',
      originatingConnector: 'e2e',
      evidenceRefs: [],
      reason: 'ready for review',
      correlationId: 'corr-e2e',
      causationId: 'cause-e2e',
      idempotencyKey: 'idem-e2e',
      proposedAt: '2026-08-26T09:00:00.000Z',
      ...over,
    };
  }

  /** Put the specification back in `draft` and clear decisions between cases. */
  async function reset(): Promise<void> {
    for (const table of ['lifecycle_transitions', 'gate_final_outcomes', 'adjudication_records']) {
      await db.query(`ALTER TABLE "${table}" DISABLE TRIGGER USER`);
      await db.query(`DELETE FROM "${table}" WHERE "workspaceId" = $1`, [WS]);
      await db.query(`ALTER TABLE "${table}" ENABLE TRIGGER USER`);
    }
    await db.query(`ALTER TABLE "application_policies" DISABLE TRIGGER USER`);
    await db.query(`DELETE FROM "application_policies" WHERE "workspaceId" = $1`, [WS]);
    await db.query(`ALTER TABLE "application_policies" ENABLE TRIGGER USER`);
    await db.query(`DELETE FROM "review_gates" WHERE "workspaceId" = $1`, [WS]);
    await db.query(`UPDATE "specifications" SET "lifecycleState" = 'draft' WHERE "id" = $1`, [SPEC]);
  }

  /** Authorise automatic application through the real production service. */
  async function permitAutoApply(): Promise<void> {
    await policies.configure({
      workspaceId: WS,
      targetArtifactType: 'specification',
      fromStatus: 'draft',
      toStatus: 'review',
      autoApplyPermitted: true,
      createdById: 'u_admin',
      approvedById: DECIDER,
      approvedBySnapshotId: 'snap-decider',
      correlationId: 'corr-e2e',
    });
  }

  /** Configure a blocking gate and record a human decision on it. */
  async function gateWithDecision(disposition: 'passed' | 'failed'): Promise<string> {
    const gate = await gateConfig.createGate(WS, {
      transition: 'draft->review',
      requiredRoles: ['security-reviewer'],
      blocking: true,
    });
    const gates = await gateProduction.applicableGates(WS, 'draft', 'review');
    const { versionId } = await lifecycleRepo.currentStatus(WS, SPEC);
    await gateProduction.recordDecision({
      workspaceId: WS,
      specificationId: SPEC,
      fromStatus: 'draft',
      toStatus: 'review',
      targetVersionId: versionId,
      gateId: gate.id,
      gateSetVersion: gateSetVersionOf(gates),
      disposition,
      reason: disposition === 'passed' ? 'reviewed and approved' : 'security findings outstanding',
      evaluatorId: 'security-reviewer',
      evaluatorSnapshotId: 'snap-role',
      decidedById: DECIDER,
      decidedBySnapshotId: 'snap-decider',
      correlationId: 'corr-e2e',
      causationId: 'cause-e2e',
    });
    return gate.id;
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    url = container.getConnectionUri();
    db = new Client({ connectionString: url });
    await db.connect();
    for (const dir of readdirSync(MIGRATIONS)
      .filter((d) => /^\d/.test(d))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'e2e',now())`, [WS]);
    for (const [id, email] of [
      [ACTOR, 'proposer@example.test'],
      [DECIDER, 'decider@example.test'],
    ]) {
      await db.query(
        `INSERT INTO "users" ("id","workspaceId","email","displayName","passwordHash","updatedAt")
         VALUES ($1,$2,$3,'E2E','x',now())`,
        [id, WS, email],
      );
    }
    await db.query(
      `INSERT INTO "projects" ("id","workspaceId","name","ownerUserId","updatedAt")
       VALUES ('proj_e2e',$1,'E2E',$2,now())`,
      [WS, ACTOR],
    );
    process.env['DATABASE_URL'] = url;
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../../src/app.module.js');
    const tokens = await import('../../../src/modules/loop/loop.tokens.js');
    const { GateConfigService } = await import(
      '../../../src/modules/reviews/gate-config.service.js'
    );
    const production = await import('../../../src/modules/reviews/gate-production.service.js');
    const { LIFECYCLE_TRANSITION_REPOSITORY } = await import(
      '../../../src/modules/specifications/specifications.module.js'
    );

    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    adjudicator = app.get(tokens.PROPOSAL_ADJUDICATOR, { strict: false });
    gateConfig = app.get(GateConfigService, { strict: false });
    gateProduction = app.get(production.GateProductionService, { strict: false });
    lifecycleRepo = app.get(LIFECYCLE_TRANSITION_REPOSITORY, { strict: false });
    gateSetVersionOf = production.gateSetVersionOf;

    const { SPECIFICATION_STORE } = await import(
      '../../../src/modules/specifications/specifications.module.js'
    );
    const { ApplicationPolicyService } = await import(
      '../../../src/modules/loop/application-policy.service.js'
    );
    specStore = app.get(SPECIFICATION_STORE, { strict: false });
    policies = app.get(ApplicationPolicyService, { strict: false });

    // X16 — created through PRODUCTION persistence, not raw SQL. The same call
    // the generation service makes once an engine has produced content, and the
    // same row every lifecycle service now reads.
    await specStore.commitGeneration({
      specification: {
        id: SPEC,
        workspaceId: WS,
        projectId: 'proj_e2e',
        title: 'E2E probe',
        lifecycleState: 'draft',
        currentVersionId: null,
        engineName: 'fixture',
        engineVersion: '1',
        generatedAt: new Date(),
        isOutOfDate: false,
        createdById: ACTOR,
        updatedById: ACTOR,
      },
      version: {
        id: 'ver_e2e',
        workspaceId: WS,
        specificationId: SPEC,
        versionNumber: 1,
        contentRaw: '# E2E probe',
        contentParsed: {},
        lifecycleStateAtCreation: 'draft',
        authoredById: ACTOR,
      },
      links: [],
      job: { id: 'job_e2e', state: 'succeeded', resultRef: SPEC },
      // `X19`, C2E — ownership is part of creation. The owner grant is written
      // in the SAME transaction as the specification, so there is deliberately
      // no `grants.grant(...)` after this block: the success path must not
      // depend on somebody remembering to authorise the artifact afterwards.
      ownership: {
        initiatingActorId: ACTOR,
        initiatingActorType: 'human',
        ownerUserId: ACTOR,
        ownerSnapshotId: `snap-${ACTOR}`,
        correlationId: 'corr-e2e',
        causationId: 'job_e2e',
        idempotencyKey: 'job_e2e',
      },
    });
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await db?.end();
    await container?.stop();
  });

  it('applies, and the transition id names a committed row', async () => {
    await reset();
    await gateWithDecision('passed');
    await permitAutoApply();

    const v = await adjudicator.adjudicate(proposal());

    expect(v.verdict, `expected applied, got ${v.verdict}: ${v.reason}`).toBe('applied');
    expect(v.appliedTransitionId, 'applied without a transition id').toBeTruthy();

    const { rows } = await db.query<{
      id: string;
      fromState: string;
      toState: string;
      correlationId: string;
      causationId: string;
    }>(
      `SELECT "id","fromState","toState","correlationId","causationId"
       FROM "lifecycle_transitions" WHERE "id" = $1`,
      [v.appliedTransitionId],
    );
    expect(rows, 'the returned id matches no committed transition').toHaveLength(1);
    expect(rows[0]!.fromState).toBe('draft');
    expect(rows[0]!.toState).toBe('review');

    // The causal chain, end to end: proposal -> transition.
    expect(rows[0]!.correlationId, 'correlation was not carried into the transition').toBe(
      'corr-e2e',
    );
    expect(rows[0]!.causationId).toBe('cause-e2e');

    // And the state actually moved.
    const state = await db.query<{ lifecycleState: string }>(
      `SELECT "lifecycleState" FROM "specifications" WHERE "id" = $1`,
      [SPEC],
    );
    expect(state.rows[0]!.lifecycleState).toBe('review');
  });

  it('links adjudication evidence to the same transition and correlation', async () => {
    const { rows } = await db.query<{
      verdict: string;
      appliedTransitionId: string;
      correlationId: string;
    }>(
      `SELECT "verdict","appliedTransitionId","correlationId"
       FROM "adjudication_records" WHERE "workspaceId" = $1 AND "verdict" = 'applied'`,
      [WS],
    );
    expect(rows, 'no applied adjudication record was written').toHaveLength(1);
    expect(rows[0]!.correlationId).toBe('corr-e2e');

    const linked = await db.query(`SELECT "id" FROM "lifecycle_transitions" WHERE "id" = $1`, [
      rows[0]!.appliedTransitionId,
    ]);
    expect(linked.rows, 'the adjudication record points at no transition').toHaveLength(1);
  });

  it('keeps the transition readable after the application restarts', async () => {
    const before = await db.query<{ id: string }>(
      `SELECT "id" FROM "lifecycle_transitions" WHERE "workspaceId" = $1`,
      [WS],
    );
    const id = before.rows[0]!.id;

    await app.close();
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../../src/app.module.js');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const { LIFECYCLE_TRANSITION_REPOSITORY } = await import(
      '../../../src/modules/specifications/specifications.module.js'
    );
    const repo = app.get(LIFECYCLE_TRANSITION_REPOSITORY, { strict: false });
    const read = await repo.findTransition(WS, id);
    expect(read, 'the transition did not survive a restart').not.toBeNull();
    expect(read.correlationId).toBe('corr-e2e');

    // Re-resolve for the remaining cases.
    const tokens = await import('../../../src/modules/loop/loop.tokens.js');
    const production = await import('../../../src/modules/reviews/gate-production.service.js');
    const { GateConfigService } = await import(
      '../../../src/modules/reviews/gate-config.service.js'
    );
    adjudicator = app.get(tokens.PROPOSAL_ADJUDICATOR, { strict: false });
    gateConfig = app.get(GateConfigService, { strict: false });
    gateProduction = app.get(production.GateProductionService, { strict: false });
    lifecycleRepo = repo;

    // **No re-grant.** This block used to re-issue the grant, because EPIC-024's
    // store was in-memory and grants did not survive a restart. C2D made them
    // durable and C2E made creation issue them, so re-issuing here would hide
    // both: the next test would pass because the artifact had just been
    // authorised rather than because the authorisation persisted.
    //
    // Asserted rather than assumed — if durability regresses, this fails here
    // with a clear reason instead of somewhere downstream.
    const { AccessGrantService } = await import(
      '../../../src/modules/access/access-grant.service.js'
    );
    const survivingGrants = await app
      .get(AccessGrantService, { strict: false })
      .activeGrants(WS, { artifactType: 'specification', artifactId: SPEC });
    expect(
      survivingGrants.map((g: { userId: string }) => g.userId),
      'the owner grant did not survive the restart',
    ).toContain(ACTOR);
  });

  it('a retry applies nothing more and returns the original verdict', async () => {
    await reset();
    await gateWithDecision('passed');
    await permitAutoApply();
    const first = await adjudicator.adjudicate(proposal());
    expect(first.verdict).toBe('applied');

    const retry = await adjudicator.adjudicate(proposal());
    expect(retry.verdict).toBe('applied');
    expect(retry.appliedTransitionId).toBe(first.appliedTransitionId);

    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "lifecycle_transitions" WHERE "workspaceId" = $1`,
      [WS],
    );
    expect(Number(rows[0]!.n), 'the retry produced a second transition').toBe(1);
  });

  it('with NO application policy the verdict is validated, not applied (X15)', async () => {
    await reset();
    await gateWithDecision('passed');
    // Everything else passes: authorised, gate-cleared, no drift. What is
    // missing is anyone having decided this transition may apply automatically.
    const v = await adjudicator.adjudicate(proposal({ idempotencyKey: 'idem-nopolicy' }));
    expect(v.verdict).toBe('validated');
    expect(v.appliedTransitionId).toBeUndefined();
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "lifecycle_transitions" WHERE "workspaceId" = $1`,
      [WS],
    );
    expect(Number(rows[0]!.n), 'a transition applied with no policy authorising it').toBe(0);
  });

  it('a DISABLED policy applies nothing, and the history is kept', async () => {
    await reset();
    await gateWithDecision('passed');
    await permitAutoApply();
    await policies.disable({
      workspaceId: WS,
      targetArtifactType: 'specification',
      fromStatus: 'draft',
      toStatus: 'review',
      createdById: 'u_admin',
      correlationId: 'corr-e2e',
    });
    const v = await adjudicator.adjudicate(proposal({ idempotencyKey: 'idem-disabled' }));
    expect(v.verdict).toBe('validated');

    // Withdrawal appends; it does not erase what was in force before.
    const { rows } = await db.query<{ state: string; policyVersion: number }>(
      `SELECT "state","policyVersion" FROM "application_policies" WHERE "workspaceId" = $1
       ORDER BY "policyVersion"`,
      [WS],
    );
    expect(rows.length, 'the policy history was rewritten rather than appended').toBeGreaterThan(1);
    expect(rows.some((r) => r.state === 'effective'), 'no effective version was ever recorded').toBe(
      true,
    );
  });

  it('refuses to authorise auto-application with no approver', async () => {
    await reset();
    await expect(
      policies.configure({
        workspaceId: WS,
        targetArtifactType: 'specification',
        fromStatus: 'draft',
        toStatus: 'review',
        autoApplyPermitted: true,
        createdById: 'u_admin',
        correlationId: 'corr-e2e',
      }),
      'a permissive policy was accepted with nobody approving it',
    ).rejects.toThrow(/approved/i);
  });

  it('the policy record cannot be edited or deleted', async () => {
    await reset();
    await permitAutoApply();
    await expect(
      db.query(`UPDATE "application_policies" SET "autoApplyPermitted" = false WHERE "workspaceId" = $1`, [WS]),
    ).rejects.toThrow(/append-only/i);
    await expect(
      db.query(`DELETE FROM "application_policies" WHERE "workspaceId" = $1`, [WS]),
    ).rejects.toThrow(/append-only/i);
  });

  it('a FAILED gate refuses, and applies nothing', async () => {
    await reset();
    await gateWithDecision('failed');
    const v = await adjudicator.adjudicate(proposal({ idempotencyKey: 'idem-failed' }));
    expect(v.verdict).toBe('refused');
    expect(v.refusalStage).toBe('validation');
    expect(v.refusalReasonCode).toBe('gate_failed');
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "lifecycle_transitions" WHERE "workspaceId" = $1`,
      [WS],
    );
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it('a gate with no decision yet is PENDING, not a refusal', async () => {
    await reset();
    await gateConfig.createGate(WS, {
      transition: 'draft->review',
      requiredRoles: ['security-reviewer'],
      blocking: true,
    });
    const v = await adjudicator.adjudicate(proposal({ idempotencyKey: 'idem-pending' }));
    expect(v.verdict).toBe('reconciliation_required');
    expect(v.reconciliation.cause).toBe('gate_evaluation_incomplete');
  });

  it('a decision made against a different gate SET is STALE', async () => {
    await reset();
    await gateWithDecision('passed');
    // A second gate now applies, so the set the decision was made against is
    // no longer the set in force.
    await gateConfig.createGate(WS, {
      transition: 'draft->review',
      requiredRoles: ['qa-agent'],
      blocking: true,
    });
    const v = await adjudicator.adjudicate(proposal({ idempotencyKey: 'idem-stale' }));
    expect(v.verdict).toBe('reconciliation_required');
    expect(v.reconciliation.cause).toBe('gate_outcomes_stale');
  });

  it('a decision made against a different specification VERSION is STALE (FR-ENH-029)', async () => {
    await reset();
    await gateWithDecision('passed');
    await permitAutoApply();

    // Append a new version through the production store and point the
    // specification at it — the artifact the gate examined is no longer the
    // artifact being transitioned.
    const appended = await specStore.appendVersion({
      workspaceId: WS,
      specificationId: SPEC,
      versionNumber: 2,
      contentRaw: '# E2E probe, revised',
      contentParsed: {},
      lifecycleStateAtCreation: 'draft',
      authoredById: ACTOR,
    });
    await specStore.updateSpecification(WS, SPEC, {
      currentVersionId: appended.id,
      updatedById: ACTOR,
    });

    const v = await adjudicator.adjudicate(proposal({ idempotencyKey: 'idem-verstale' }));
    expect(v.verdict, 'a decision on an older version still authorised').toBe(
      'reconciliation_required',
    );
    expect(v.reconciliation.cause).toBe('gate_outcomes_stale');

    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "lifecycle_transitions" WHERE "workspaceId" = $1`,
      [WS],
    );
    expect(Number(rows[0]!.n), 'a stale outcome authorised an application').toBe(0);
  });

  it('an ungated transition is not blocked — and is not "unavailable" either', async () => {
    await reset();
    await permitAutoApply();
    // No gate configured for draft->review. FR-ENH-012 makes gates
    // configurable and SC-ENH-004 scopes the human-decision rule to *gated*
    // transitions, so nothing here blocks.
    const v = await adjudicator.adjudicate(proposal({ idempotencyKey: 'idem-ungated' }));
    expect(v.verdict, `ungated transition produced ${v.verdict}: ${v.reason}`).toBe('applied');
  });

  it('a stale expected state is INCONSISTENT, and applies nothing', async () => {
    await reset();
    await gateWithDecision('passed');
    await db.query(`UPDATE "specifications" SET "lifecycleState" = 'review' WHERE "id" = $1`, [SPEC]);
    const v = await adjudicator.adjudicate(proposal({ idempotencyKey: 'idem-drift' }));
    expect(v.verdict).toBe('inconsistent');
    expect(v.mismatch.expectedStatus).toBe('draft');
    expect(v.mismatch.observedStatus).toBe('review');
  });

  it('an unauthorised proposer leaves no adjudication evidence', async () => {
    await reset();
    await gateWithDecision('passed');
    // EPIC-024's rule is "unrestricted until granted": an artifact with NO
    // grants is editable by anyone in the workspace, and only once a grant
    // exists does it exclude. The grant issued in setup is what makes this
    // specification governed — without it the intruder would be allowed, and
    // this test would pass or fail for reasons unrelated to authorisation.
    await expect(
      adjudicator.adjudicate(proposal({ proposerId: 'u_intruder', idempotencyKey: 'idem-noauth' })),
    ).rejects.toThrow();

    // EPIC-024 refuses opaquely by design, so the refusal is proven by the
    // attempt it records rather than by the message it throws.
    const { AccessEnforcementService } = await import(
      '../../../src/modules/access/access-enforcement.service.js'
    );
    const attempts = await app
      .get(AccessEnforcementService, { strict: false })
      .attemptsFor(WS, { artifactType: 'specification', artifactId: SPEC });
    expect(
      attempts.some(
        (a: { userId: string; action: string }) =>
          a.userId === 'u_intruder' && a.action === 'propose-transition',
      ),
      'EPIC-024 did not refuse the intruder — the artifact may be ungoverned',
    ).toBe(true);
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "adjudication_records" WHERE "proposerId" = 'u_intruder'`,
    );
    expect(Number(rows[0]!.n), 'an unauthorised caller wrote evidence').toBe(0);
  });

  it('two concurrent proposals produce at most one applied transition', async () => {
    await reset();
    await gateWithDecision('passed');
    await permitAutoApply();
    const results = await Promise.allSettled([
      adjudicator.adjudicate(proposal({ proposalId: 'pA', idempotencyKey: 'race-a' })),
      adjudicator.adjudicate(proposal({ proposalId: 'pB', idempotencyKey: 'race-b' })),
    ]);
    const applied = results.filter(
      (r) => r.status === 'fulfilled' && r.value.verdict === 'applied',
    );
    expect(applied.length, 'both concurrent proposals applied').toBeLessThanOrEqual(1);

    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "lifecycle_transitions" WHERE "workspaceId" = $1`,
      [WS],
    );
    expect(Number(rows[0]!.n), 'two transitions for one state change').toBeLessThanOrEqual(1);
  });

  it('the finalized gate decision cannot be edited or deleted', async () => {
    await reset();
    await gateWithDecision('passed');
    await expect(
      db.query(`UPDATE "gate_final_outcomes" SET "disposition" = 'failed' WHERE "workspaceId" = $1`, [
        WS,
      ]),
    ).rejects.toThrow(/append-only/i);
    await expect(
      db.query(`DELETE FROM "gate_final_outcomes" WHERE "workspaceId" = $1`, [WS]),
    ).rejects.toThrow(/append-only/i);
  });

  it('refuses to finalize a PASS with no human decider (FR-ENH-014)', async () => {
    await reset();
    const gate = await gateConfig.createGate(WS, {
      transition: 'draft->review',
      requiredRoles: ['security-reviewer'],
      blocking: true,
    });
    const gates = await gateProduction.applicableGates(WS, 'draft', 'review');
    await expect(
      gateProduction.recordDecision({
        workspaceId: WS,
        specificationId: SPEC,
        fromStatus: 'draft',
        toStatus: 'review',
        targetVersionId: null,
        gateId: gate.id,
        gateSetVersion: gateSetVersionOf(gates),
        disposition: 'passed',
        reason: 'nobody decided this',
        evaluatorId: 'security-reviewer',
        correlationId: 'c',
        causationId: 'c',
      }),
      'an automated verdict alone finalized a gated transition',
    ).rejects.toThrow(/human decision/i);
  });
});
