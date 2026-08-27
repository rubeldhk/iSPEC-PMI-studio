/**
 * T1029 (EPIC-037 Band A) — the fixture connector is the conformance oracle.
 *
 * Driven against a **recording stub** of the registry, so what is under test is
 * the connector's own behaviour: what it sends, in what order, and what it
 * cannot send at all. The registry's behaviour is proven elsewhere against a
 * real database.
 */
import { describe, expect, it } from 'vitest';
import { FixtureConnector } from '../src/fixture-connector.js';
import type {
  AppendEventRequest,
  AppendedEvent,
  CompleteExecutionRequest,
  ExecutionRegistry,
  ExecutionSnapshot,
  ProposeTransitionRequest,
  RegisterExecutionRequest,
} from '../src/contract.js';

const IDENTITY = {
  authenticatedPrincipalId: 'p_agent',
  agentSnapshotId: 'snap_agent',
  connectorRegistrationId: 'conn_1',
  sponsorUserId: 'u_sponsor',
  delegationId: 'd_1',
  delegationIdentityVersion: 1,
};

interface Recorded {
  registers: RegisterExecutionRequest[];
  appends: AppendEventRequest[];
  completions: CompleteExecutionRequest[];
  proposals: ProposeTransitionRequest[];
}

function recorder(): { registry: ExecutionRegistry; seen: Recorded } {
  const seen: Recorded = { registers: [], appends: [], completions: [], proposals: [] };
  let sequence = 0;
  const event = (type: string): AppendedEvent => {
    sequence += 1;
    return {
      eventId: `ev${sequence}`,
      executionId: 'exec_1',
      sequence,
      type: type as AppendedEvent['type'],
      recordedAt: '2026-08-27T00:00:00.000Z',
      replayed: false,
    };
  };
  const snapshot: ExecutionSnapshot = {
    executionId: 'exec_1',
    workspaceId: 'ws_a',
    command: 'specify',
    surface: 'fixture',
    lifecycleState: 'registered',
    governanceState: 'governed',
    projectedThroughSequence: 1,
    parentExecutionId: null,
  };
  return {
    seen,
    registry: {
      register: async (r) => {
        seen.registers.push(r);
        return snapshot;
      },
      appendEvent: async (r) => {
        seen.appends.push(r);
        return event(r.type);
      },
      complete: async (r) => {
        seen.completions.push(r);
        return event(r.outcome);
      },
      proposeTransition: async (r) => {
        seen.proposals.push(r);
        return event('status-transition-proposed');
      },
      history: async () => [],
      snapshot: async () => snapshot,
    },
  };
}

const connector = (registry: ExecutionRegistry): FixtureConnector =>
  new FixtureConnector(registry, {
    workspaceId: 'ws_a',
    identity: IDENTITY,
    correlationId: 'corr_1',
  });

describe('T1029 · the round trip is registered, started, completed — in that order', () => {
  it('sends all three, and the completion carries output and a comment', async () => {
    const { registry, seen } = recorder();
    const result = await connector(registry).run({
      command: 'specify',
      args: { spec: 'specs/037/spec.md' },
      binding: { targetType: 'specification', targetId: 'spec_1', commitBefore: 'abc' },
      output: { commitAfter: 'def', resultingVersion: 2 },
      comment: 'Generated.',
    });

    expect(seen.registers).toHaveLength(1);
    expect(seen.appends.map((a) => a.type)).toEqual(['started']);
    expect(seen.completions).toHaveLength(1);
    expect(seen.completions[0]?.completionComment).toBe('Generated.');
    expect(seen.completions[0]?.output?.commitAfter).toBe('def');
    expect(result.completed.sequence).toBeGreaterThan(result.started.sequence);
  });

  it('never sends commitAfter at registration', async () => {
    // `AC-EXR-17b`. The connector cannot even express it: `InputBinding` has no
    // such field, and this asserts it never appears on the wire regardless.
    const { registry, seen } = recorder();
    await connector(registry).run({
      command: 'specify',
      args: {},
      binding: { targetType: 'specification', targetId: 'spec_1', commitBefore: 'abc' },
      output: { commitAfter: 'def' },
      comment: 'done',
    });
    expect(JSON.stringify(seen.registers[0]?.input)).not.toContain('commitAfter');
  });

  it('declares itself as the fixture surface and pins the contract version', async () => {
    const { registry, seen } = recorder();
    await connector(registry).register({
      command: 'plan',
      args: {},
      binding: { targetType: 'specification', targetId: 'spec_1' },
    });
    expect(seen.registers[0]?.surface).toBe('fixture');
    expect(seen.registers[0]?.contractVersion).toBe('1.0');
  });
});

describe('T1029 · identity is passed through, never constructed', () => {
  it('carries the eight references it was handed, unchanged', async () => {
    const { registry, seen } = recorder();
    await connector(registry).run({
      command: 'specify',
      args: {},
      binding: { targetType: 'specification', targetId: 'spec_1' },
      output: {},
      comment: 'done',
    });
    for (const call of [seen.registers[0], seen.appends[0], seen.completions[0]]) {
      expect(call?.identity).toEqual(IDENTITY);
    }
  });

  it('does not mint or alter a snapshot id', async () => {
    // A connector that could choose its own snapshot could claim to be anyone
    // who ever acted. It only forwards what the server minted.
    const { registry, seen } = recorder();
    await connector(registry).register({
      command: 'specify',
      args: {},
      binding: { targetType: 'specification', targetId: 'spec_1' },
    });
    expect(seen.registers[0]?.identity.agentSnapshotId).toBe('snap_agent');
  });
});

describe('T1029 · idempotency keys are distinct per operation', () => {
  it('gives register, start and complete different keys', async () => {
    const { registry, seen } = recorder();
    await connector(registry).run({
      command: 'specify',
      args: {},
      binding: { targetType: 'specification', targetId: 'spec_1' },
      output: {},
      comment: 'done',
    });
    const keys = [
      seen.registers[0]!.idempotencyKey,
      seen.appends[0]!.idempotencyKey,
      seen.completions[0]!.idempotencyKey,
    ];
    // A shared key would make the registry treat the second call as a replay
    // of the first and silently discard it.
    expect(new Set(keys).size, 'two operations shared an idempotency key').toBe(3);
  });

  it('accepts an injected key function, so a retry can be made deterministic', async () => {
    const { registry, seen } = recorder();
    const fixed = new FixtureConnector(registry, {
      workspaceId: 'ws_a',
      identity: IDENTITY,
      correlationId: 'corr_1',
      keyFor: (op) => `fixed:${op}`,
    });
    await fixed.start('exec_1');
    await fixed.start('exec_1');
    expect(seen.appends.map((a) => a.idempotencyKey)).toEqual(['fixed:started', 'fixed:started']);
  });
});

describe('T1029 · the connector cannot apply, approve or patch', () => {
  it('exposes no such method', () => {
    // Not restraint — the registry it holds has no such verb, so there is
    // nothing for the connector to call.
    const { registry } = recorder();
    const instance = connector(registry) as unknown as Record<string, unknown>;
    for (const verb of ['applyTransition', 'approve', 'setStatus', 'patch', 'adjudicate']) {
      expect(typeof instance[verb], `the connector exposes ${verb}`).toBe('undefined');
    }
    // The control: the four it does have are functions.
    for (const verb of ['register', 'start', 'complete', 'propose']) {
      expect(typeof instance[verb]).toBe('function');
    }
  });

  it('proposes without deciding — the verdict comes back as an event', async () => {
    const { registry, seen } = recorder();
    const event = await connector(registry).propose({
      executionId: 'exec_1',
      targetRef: 'spec_1',
      targetVersion: 1,
      expectedCurrentStatus: 'draft',
      proposedState: 'review',
      rationale: 'ready',
    });
    expect(seen.proposals).toHaveLength(1);
    // Nothing in the request expresses a verdict; the connector asks.
    expect(JSON.stringify(seen.proposals[0])).not.toMatch(/verdict|applied|approved/);
    expect(event.type).toBe('status-transition-proposed');
  });
});
