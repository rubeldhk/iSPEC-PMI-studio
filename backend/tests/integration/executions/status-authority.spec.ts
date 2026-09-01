/**
 * T1055, T1057, T1058, T1059 (EPIC-037 Band A) — the platform decides status,
 * not the agent.
 *
 * The proposal is recorded, EPIC-030 adjudicates, and the verdict comes back as
 * an **event**. Three things are asserted that are each easy to get wrong:
 *
 * - the proposal table carries **no verdict column** (`R-037-5`), so nothing
 *   mutable can become the audit authority by being read instead of the stream;
 * - the verdict maps to its event by the **refusal stage**, never by parsing
 *   prose (`X1`);
 * - a connector attempting to apply a transition directly is **recorded**, not
 *   merely unable to compile.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { POSTGRES_IMAGE } from '../../helpers/postgres-image.js';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import type { AdjudicationVerdict, ProposalAdjudicator } from '@pmi/loop-contract';
import {
  ExecutionEventService,
  type EventDb,
} from '../../../src/modules/executions/execution-event.service.js';
import {
  ExecutionProjectionService,
  type ProjectionDb,
} from '../../../src/modules/executions/execution-projection.service.js';
import {
  StatusProposalService,
  eventForVerdict,
  stateForVerdict,
  type ProposalDb,
} from '../../../src/modules/executions/status-proposal.service.js';
import type {
  DelegationPort,
  IdentityResolverPort,
} from '../../../src/modules/executions/execution-registration.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(here, '../../../prisma/migrations');

/** Set DOCKER_UNAVAILABLE=1 where no runtime exists (RAID R-04). */
const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;

const WS = 'ws_auth';
const EXEC = 'exec_auth';

const base = {
  proposalId: 'p1',
  reason: 'because',
  decidedAt: '2026-08-27T00:00:00.000Z',
};

describe('T1058 · a verdict maps to its event by STAGE, never by prose', () => {
  it.each([
    ['validated', 'validation-passed'],
    ['applied', 'transition-applied'],
    ['approval_required', 'approval-requested'],
    ['inconsistent', 'transition-inconsistent'],
    ['reconciliation_required', 'transition-reconciliation-requested'],
  ])('maps %s to %s', (verdict, event) => {
    const v = {
      ...base,
      verdict,
      ...(verdict === 'applied' ? { appliedTransitionId: 't1' } : {}),
      ...(verdict === 'approval_required' ? { requiredApproverRole: 'r' } : {}),
      ...(verdict === 'inconsistent'
        ? { mismatch: { expectedStatus: 'draft', observedStatus: 'review' } }
        : {}),
      ...(verdict === 'reconciliation_required'
        ? { reconciliation: { cause: 'application_outcome_unknown', detail: 'timeout' } }
        : {}),
    } as AdjudicationVerdict;
    expect(eventForVerdict(v)).toBe(event);
  });

  it.each([
    ['validation', 'validation-failed'],
    ['approval', 'approval-refused'],
    ['transition', 'transition-refused'],
  ])('maps a refusal at stage %s to %s', (stage, event) => {
    // The `X1` correction. `refused` alone could mean any of three events;
    // the stage decides, and `reason` is never read.
    const v = {
      ...base,
      verdict: 'refused',
      refusalStage: stage,
      refusalReasonCode: 'gate_failed',
    } as unknown as AdjudicationVerdict;
    expect(eventForVerdict(v)).toBe(event);
  });

  it('maps every verdict to a projected state', () => {
    for (const verdict of ['validated', 'applied', 'approval_required', 'refused', 'inconsistent', 'reconciliation_required']) {
      const v = { ...base, verdict, refusalStage: 'validation' } as unknown as AdjudicationVerdict;
      expect(stateForVerdict(v)).toBeTruthy();
    }
  });
});

suite('T1055 · the proposal is recorded, and carries no verdict', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let proposals: StatusProposalService;
  let events: ExecutionEventService;
  let verdict: AdjudicationVerdict;

  const identity: IdentityResolverPort = {
    resolveSnapshot: async (snapshotId) => ({
      snapshotId,
      principalId: 'p_agent',
      workspaceId: WS,
      kind: 'agent',
      sponsorUserId: 'u_sponsor',
      identityVersion: 1,
      connectorRegistrationId: 'conn_1',
    }),
    findConnector: async (_w, connectorId) => ({ connectorId, state: 'active' }),
  };

  const delegations: DelegationPort = {
    requireDelegated: async () => ({ id: 'd_1', identityVersion: 1 }),
  };

  const adjudicator: ProposalAdjudicator = {
    adjudicate: async () => verdict,
  };

  const request = (key: string) => ({
    executionId: EXEC,
    workspaceId: WS,
    targetRef: 'spec_1',
    targetVersion: 1,
    expectedCurrentStatus: 'draft',
    proposedState: 'review',
    rationale: 'ready for review',
    identity: {
      authenticatedPrincipalId: 'p_agent',
      agentSnapshotId: 'snap_1',
      connectorRegistrationId: 'conn_1',
      sponsorUserId: 'u_sponsor',
      delegationId: 'd_1',
      delegationIdentityVersion: 1,
    },
    correlationId: 'c1',
    idempotencyKey: key,
  });

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
    await db.query(`INSERT INTO "workspaces" ("id","name","updatedAt") VALUES ($1,'auth',now())`, [
      WS,
    ]);
    await db.query(
      `INSERT INTO "executions"
         ("id","correlationId","idempotencyKey","workspaceId","command","argsSanitized",
          "initiatorType","initiatorId","surface","contractVersion")
       VALUES ($1,'c1','k1',$2,'specify','{}'::jsonb,'agent','p_agent','fixture','1.0')`,
      [EXEC, WS],
    );
    await db.end();

    prisma = new PrismaClient({ datasources: { db: { url } } });
    events = new ExecutionEventService(prisma as unknown as EventDb);
    proposals = new StatusProposalService(
      prisma as unknown as ProposalDb,
      events,
      new ExecutionProjectionService(prisma as unknown as ProjectionDb),
      adjudicator,
      identity,
      delegations,
    );
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('the proposal table has NO adjudication column (R-037-5)', async () => {
    const columns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'status_transition_proposals'`,
    );
    const names = columns.map((c) => c.column_name.toLowerCase());
    expect(names.length).toBeGreaterThan(5);
    for (const forbidden of ['verdict', 'adjudication', 'decision', 'approved', 'state']) {
      expect(names, `the proposal carries a "${forbidden}" column`).not.toContain(forbidden);
    }
  });

  it('records the proposal and the verdict as separate events', async () => {
    verdict = { ...base, verdict: 'applied', appliedTransitionId: 't_committed' } as AdjudicationVerdict;
    const result = await proposals.propose(request('pk1'));

    expect(result.eventType).toBe('transition-applied');
    const history = await events.history(WS, EXEC);
    expect(history.map((e) => e.type)).toEqual(['status-transition-proposed', 'transition-applied']);
  });

  it('projects the proposal state, and the projection is not the authority', async () => {
    const rows = await prisma.$queryRawUnsafe<{ state: string; projectedThroughSequence: number }[]>(
      `SELECT "state","projectedThroughSequence" FROM "status_transition_state"`,
    );
    expect(rows[0]?.state).toBe('applied');
    // The projection knows how far it read, so staleness is visible.
    expect(rows[0]?.projectedThroughSequence).toBeGreaterThan(0);
  });

  it('a REFUSED verdict records the stage and code, not just a sentence', async () => {
    verdict = {
      ...base,
      verdict: 'refused',
      refusalStage: 'validation',
      refusalReasonCode: 'gate_failed',
    } as unknown as AdjudicationVerdict;
    const result = await proposals.propose(request('pk2'));
    expect(result.eventType).toBe('validation-failed');

    const payloads = await prisma.$queryRawUnsafe<{ payload: Record<string, unknown> }[]>(
      `SELECT "payload" FROM "execution_events" WHERE "type" = 'validation-failed'`,
    );
    expect(payloads[0]?.payload.refusalStage).toBe('validation');
    expect(payloads[0]?.payload.refusalReasonCode).toBe('gate_failed');
  });

  it('T1059 · a connector attempting to apply directly is REFUSED and recorded', async () => {
    // There is no code path that would let it — the contract has no such verb.
    // This records the attempt, because a governed registry should keep
    // evidence about a connector's behaviour rather than only failing silently.
    await proposals.refuseDirectApplication({
      workspaceId: WS,
      executionId: EXEC,
      attemptedBy: 'p_agent',
      targetRef: 'spec_1',
    });
    const rows = await prisma.$queryRawUnsafe<{ payload: Record<string, unknown> }[]>(
      `SELECT "payload" FROM "execution_events"
        WHERE "type" = 'transition-refused' ORDER BY "sequence" DESC LIMIT 1`,
    );
    expect(rows[0]?.payload.refusalReasonCode).toBe('unauthorized_actor');
    expect(String(rows[0]?.payload.reason)).toMatch(/may not apply/i);
  });

  it('an undelegated proposal is refused before anything is recorded', async () => {
    const refused = new StatusProposalService(
      prisma as unknown as ProposalDb,
      events,
      new ExecutionProjectionService(prisma as unknown as ProjectionDb),
      adjudicator,
      identity,
      {
        requireDelegated: async () => {
          throw new Error('no active delegation');
        },
      },
    );
    const before = (await events.history(WS, EXEC)).length;
    await expect(refused.propose(request('pk3'))).rejects.toThrow();
    expect((await events.history(WS, EXEC)).length, 'a refused proposal wrote an event').toBe(
      before,
    );
  });
});
