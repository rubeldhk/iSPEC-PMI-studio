/**
 * `T1365` (EPIC-041) — the registry writes an assurance with every execution,
 * derived from the surface through `assuranceFor`, the only writer
 * (`FR-LPW-034`, `R-041-5`, ADR-0030).
 *
 * Pulled forward from US3: the Phase 1 migration made `executions.assurance`
 * NOT NULL, and the first full integration run after it found every real
 * registration failing on the constraint — the column existed before its
 * writer did. The fakes here capture the INSERT the service issues, so the
 * test is about what is written, not about PostgreSQL.
 *
 * Written to FAIL before `T1366`.
 */
import { describe, expect, it, vi } from 'vitest';
import { RegistryRefusedError, type RegisterExecutionRequest } from '@pmi/execution-registry-contract';
import { ExecutionRegistrationService } from '../../../src/modules/executions/execution-registration.service.js';

const WS = 'ws_assure';

function request(surface: string): RegisterExecutionRequest {
  return {
    workspaceId: WS,
    correlationId: 'c1',
    idempotencyKey: `k_${surface}`,
    command: 'specify',
    argsSanitized: {},
    surface,
    contractVersion: '1.0',
    identity: {
      agentSnapshotId: 'snap_1',
      authenticatedPrincipalId: 'p_agent',
      sponsorUserId: 'u_sponsor',
      connectorRegistrationId: 'conn_1',
    },
    input: { targetType: 'specification', targetId: 'spec_1' },
  } as unknown as RegisterExecutionRequest;
}

/** Captures every raw statement the service issues inside its transaction. */
function harness() {
  const executed: { sql: string; values: unknown[] }[] = [];
  const tx = {
    $queryRawUnsafe: vi.fn(async () => []),
    $executeRawUnsafe: vi.fn(async (sql: string, ...values: unknown[]) => {
      executed.push({ sql, values });
      return 1;
    }),
  };
  const db = {
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => fn(tx),
    // EPIC-043 T1443: the replay lookup (by idempotency key) sees nothing; the
    // snapshot read sees the row.
    $queryRawUnsafe: vi.fn(async (sql: string) =>
      sql.includes('"idempotencyKey" = $2')
        ? []
        : [{ id: 'exec_1', workspaceId: WS, command: 'specify', surface: 'local-cli', assurance: 'local', governanceState: 'governed', parentExecutionId: null, lifecycleState: null, projectedThroughSequence: null }],
    ),
  };
  const events = { append: vi.fn(async () => ({ sequence: 1 })) };
  const identity = {
    resolveSnapshot: vi.fn(async () => ({
      snapshotId: 'snap_1',
      workspaceId: WS,
      principalId: 'p_agent',
      sponsorUserId: 'u_sponsor',
      identityVersion: 1,
    })),
    findConnector: vi.fn(async () => ({ state: 'active' })),
  };
  const delegations = { requireDelegated: vi.fn(async () => ({ id: 'd1', identityVersion: 1 })) };
  const service = new ExecutionRegistrationService(
    db as never,
    events as never,
    identity as never,
    delegations as never,
  );
  return { service, executed };
}

/** The `executions` INSERT, as column names paired with the bound values. */
function executionsRow(executed: { sql: string; values: unknown[] }[]): Record<string, unknown> {
  const insert = executed.find((e) => /INSERT INTO "executions"/.test(e.sql));
  expect(insert, 'no executions INSERT was issued').toBeDefined();
  const columns = [...(insert as { sql: string }).sql.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1] ?? '').filter((c) => c !== 'executions');
  const row: Record<string, unknown> = {};
  // Literal columns (governanceState) carry no placeholder; walk placeholders in order.
  const placeholders = [...(insert as { sql: string }).sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  const valueColumns = columns.filter((c) => c !== 'governanceState');
  valueColumns.forEach((c, i) => {
    const p = placeholders[i];
    row[c] = p === undefined ? undefined : (insert as { values: unknown[] }).values[p - 1];
  });
  row['governanceState'] = 'governed';
  return row;
}

describe('T1365 · every registration writes an assurance derived from its surface', () => {
  it.each([
    ['local-cli', 'local'],
    ['mcp-client', 'local'],
    ['fixture', 'local'],
    ['managed-sandbox', 'managed'],
    ['ci-cd', 'managed'],
  ])('surface %s is stored with assurance %s', async (surface, assurance) => {
    const { service, executed } = harness();
    await service.register(request(surface));
    const row = executionsRow(executed);
    expect(row['surface']).toBe(surface);
    expect(row['assurance']).toBe(assurance);
  });

  it('names the column explicitly — the database has no default to fall back on (NOT NULL by migration)', async () => {
    const { service, executed } = harness();
    await service.register(request('local-cli'));
    const insert = executed.find((e) => /INSERT INTO "executions"/.test(e.sql));
    expect(insert?.sql).toMatch(/"assurance"/);
  });
});

describe('T1365 · assurance is never accepted from the caller (FR-LPW-034)', () => {
  it('refuses a body carrying assurance, naming the field', async () => {
    const { service, executed } = harness();
    const forged = { ...request('local-cli'), assurance: 'managed' } as unknown as RegisterExecutionRequest;
    const error = await service.register(forged).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RegistryRefusedError);
    expect((error as RegistryRefusedError).refusal).toBe('assurance_not_accepted');
    expect((error as Error).message).toMatch(/assurance/);
    expect(executed).toEqual([]);
  });

  it('the projection carries it — a snapshot reads the stored assurance (SC-LPW-009)', async () => {
    const { service } = harness();
    const snapshot = await service.snapshot(WS, 'exec_1');
    expect(snapshot?.assurance).toBe('local');
  });
});
