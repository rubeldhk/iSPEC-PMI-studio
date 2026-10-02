/**
 * `T1369` (EPIC-041) — the fixture connector on a local surface.
 *
 * The fixture connector registers with `surface: 'mcp-client'` and a
 * `controlled-local` environment binding a persistent workspace, and the
 * registry accepts it — the universal contract admits a controlled-local
 * execution without a new verb (`FR-LPW-030`, `FR-LPW-032`). Its assurance
 * is derived by the registry, never sent by the connector (`FR-LPW-034`).
 *
 * Written to FAIL before `T1370` extends the connector.
 */
import { describe, expect, it } from 'vitest';
import { FixtureConnector } from '../src/fixture-connector.js';
import { assuranceFor } from '../src/contract.js';
import type { ExecutionRegistry, ExecutionSnapshot, RegisterExecutionRequest } from '../src/contract.js';

const IDENTITY = {
  authenticatedPrincipalId: 'p_agent',
  agentSnapshotId: 'snap_agent',
  connectorRegistrationId: 'conn_1',
  sponsorUserId: 'u_sponsor',
  delegationId: 'd_1',
  delegationIdentityVersion: 1,
};

/** A registry that accepts what the universal contract admits and derives the assurance itself. */
function accepting(): { registry: ExecutionRegistry; registers: RegisterExecutionRequest[] } {
  const registers: RegisterExecutionRequest[] = [];
  const snapshotFor = (r: RegisterExecutionRequest): ExecutionSnapshot => ({
    executionId: r.executionId ?? 'exec_1',
    workspaceId: r.workspaceId,
    command: r.command,
    surface: r.surface,
    assurance: assuranceFor(r.surface),
    lifecycleState: 'registered',
    governanceState: 'governed',
    projectedThroughSequence: 0,
    parentExecutionId: r.parentExecutionId ?? null,
  });
  return {
    registers,
    registry: {
      register: async (r) => {
        if ('assurance' in r) throw new Error('assurance is derived, never accepted');
        registers.push(r);
        return snapshotFor(r);
      },
      appendEvent: async () => {
        throw new Error('not exercised');
      },
      complete: async () => {
        throw new Error('not exercised');
      },
      proposeTransition: async () => {
        throw new Error('not exercised');
      },
      history: async () => [],
      snapshot: async () => {
        throw new Error('not exercised');
      },
    },
  };
}

describe('T1369 · a controlled-local execution registers through the universal contract', () => {
  it('registers with surface mcp-client and a controlled-local persistent environment, and is accepted', async () => {
    const { registry, registers } = accepting();
    const connector = new FixtureConnector(registry, {
      workspaceId: 'ws_a',
      identity: IDENTITY,
      correlationId: 'corr_1',
      surface: 'mcp-client',
      environment: { kind: 'controlled-local', workspace: { kind: 'persistent', projectRef: 'proj_1', mode: 'read-write', branch: 'main' } },
    });
    const snapshot = await connector.register({
      command: 'specify',
      args: {},
      binding: { targetType: 'specification', targetId: 'spec_1' },
    });
    expect(registers).toHaveLength(1);
    expect(registers[0]).toMatchObject({ surface: 'mcp-client', environment: 'controlled-local:persistent:proj_1' });
    expect(registers[0]).not.toHaveProperty('assurance');
    expect(snapshot.surface).toBe('mcp-client');
    expect(snapshot.assurance).toBe('local');
  });

  it('defaults to the fixture surface with no environment, exactly as before (T1029 unchanged)', async () => {
    const { registry, registers } = accepting();
    const connector = new FixtureConnector(registry, { workspaceId: 'ws_a', identity: IDENTITY, correlationId: 'corr_1' });
    const snapshot = await connector.register({ command: 'specify', args: {}, binding: { targetType: 'specification', targetId: 'spec_1' } });
    expect(registers[0]?.surface).toBe('fixture');
    expect(registers[0]).not.toHaveProperty('environment');
    expect(snapshot.assurance).toBe('local');
  });

  it('a managed-sandbox surface is managed assurance — same connector, same contract (FR-LPW-031)', async () => {
    const { registry } = accepting();
    const connector = new FixtureConnector(registry, { workspaceId: 'ws_a', identity: IDENTITY, correlationId: 'corr_1', surface: 'managed-sandbox' });
    const snapshot = await connector.register({ command: 'plan', args: {}, binding: { targetType: 'specification', targetId: 'spec_1' } });
    expect(snapshot.assurance).toBe('managed');
  });
});
