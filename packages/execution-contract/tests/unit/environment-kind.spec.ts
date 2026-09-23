/**
 * `T1312` (EPIC-041) — the contract can say where an environment lives.
 *
 * `FR-LPW-030`, `R-041-4`. Two kinds, a required `kind` on every descriptor,
 * and one coherence rule: a `controlled-local` environment is persistent by
 * definition — a developer's directory that vanished after each command would
 * not be the developer's directory — so a descriptor that claims the kind
 * without the lifecycle is refused. The Docker provider's refusal of persistent
 * bindings is untouched (`FR-LPW-033`): it is asserted here to still hold for a
 * `managed-isolated` descriptor.
 *
 * Written to FAIL before `T1313` exists.
 */
import { describe, expect, it } from 'vitest';
import {
  ENVIRONMENT_KINDS,
  assertEnvironmentKindCoherent,
  assertLifecycleSupported,
  type ExecutionEnvironmentDescriptor,
} from '../../src/index.js';

const managed: ExecutionEnvironmentDescriptor = {
  provider: 'docker',
  kind: 'managed-isolated',
  supportedLifecycles: ['ephemeral'],
  supportsPersistentState: false,
  supportsNetworkPolicy: true,
  maxWallClockMs: 1000,
};

const local: ExecutionEnvironmentDescriptor = {
  provider: 'developer-machine',
  kind: 'controlled-local',
  supportedLifecycles: ['persistent'],
  supportsPersistentState: true,
  supportsNetworkPolicy: false,
  maxWallClockMs: 0,
};

describe('T1312 · ExecutionEnvironmentKind', () => {
  it('has exactly two members, and customer-cloud is not one of them yet', () => {
    // PMI-DOC-007 D-9: a value nothing produces is decoration. Customer cloud
    // gets a member when it gets an owner (BR-0131).
    expect([...ENVIRONMENT_KINDS]).toEqual(['managed-isolated', 'controlled-local']);
  });

  it('requires kind on every descriptor', () => {
    // @ts-expect-error — a descriptor with no kind cannot say which assurance it offers
    const missing: ExecutionEnvironmentDescriptor = {
      provider: 'x',
      supportedLifecycles: ['ephemeral'],
      supportsPersistentState: false,
      supportsNetworkPolicy: false,
      maxWallClockMs: 1,
    };
    expect(missing).toBeDefined();
  });

  it('refuses a controlled-local descriptor that does not support a persistent workspace', () => {
    expect(() =>
      assertEnvironmentKindCoherent({ ...local, supportedLifecycles: ['ephemeral'] }),
    ).toThrow(/controlled-local.*persistent/);
  });

  it('accepts a coherent controlled-local descriptor', () => {
    expect(() => assertEnvironmentKindCoherent(local)).not.toThrow();
  });

  it('accepts a managed-isolated descriptor with ephemeral only', () => {
    expect(() => assertEnvironmentKindCoherent(managed)).not.toThrow();
  });
});

describe('T1312 · the Docker-style refusal is the provider\'s, not the contract\'s (FR-LPW-033)', () => {
  const persistent = { kind: 'persistent', projectRef: 'p1', mode: 'read-write', branch: 'main' } as const;

  it('a managed-isolated descriptor still refuses a persistent binding', () => {
    expect(() => assertLifecycleSupported(managed, persistent)).toThrow(/does not support a persistent/);
  });

  it('a controlled-local descriptor accepts one — the existing persistent arm, no new arm', () => {
    expect(() => assertLifecycleSupported(local, persistent)).not.toThrow();
  });
});
