/**
 * `T1367` (EPIC-041) — the provider conformance suite, extended for the two
 * environment kinds (`FR-LPW-033`).
 *
 * A `managed-isolated` provider MUST refuse a persistent binding; a
 * `controlled-local` descriptor MUST declare `supportedLifecycles` including
 * `persistent`; and the suite asserts the refusal ONLY for `managed-isolated`
 * — the managed provider's refusal stays in force for the managed provider
 * and is not generalised to the contract.
 *
 * `assertDescriptorConformance` is the one function the Docker provider's
 * tests (`T1368`) and the fixture descriptors call, so every provider is held
 * to the same words.
 *
 * Written to FAIL before `assertDescriptorConformance` exists.
 */
import { describe, expect, it } from 'vitest';
import {
  PolicyRefusedError,
  assertDescriptorConformance,
  assertLifecycleSupported,
  type ExecutionEnvironmentDescriptor,
  type WorkspaceBinding,
} from '../../src/index.js';

const PERSISTENT: WorkspaceBinding = { kind: 'persistent', projectRef: 'proj_1', mode: 'read-write', branch: 'main' };
const EPHEMERAL: WorkspaceBinding = { kind: 'ephemeral', scratchPath: '/tmp/x' };

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

describe('T1367 · provider conformance by environment kind', () => {
  it('a conforming managed-isolated descriptor passes, and refuses a persistent binding', () => {
    expect(() => assertDescriptorConformance(managed)).not.toThrow();
    expect(() => assertLifecycleSupported(managed, PERSISTENT)).toThrow(PolicyRefusedError);
    expect(() => assertLifecycleSupported(managed, EPHEMERAL)).not.toThrow();
  });

  it('a managed-isolated descriptor that would accept a persistent binding does NOT conform (FR-LPW-033 stays in force)', () => {
    const leaky = { ...managed, supportedLifecycles: ['ephemeral', 'persistent'] as const };
    expect(() => assertDescriptorConformance(leaky)).toThrow(PolicyRefusedError);
    expect(() => assertDescriptorConformance(leaky)).toThrow(/managed-isolated/);
  });

  it('a controlled-local descriptor must declare the persistent lifecycle', () => {
    expect(() => assertDescriptorConformance(local)).not.toThrow();
    const stateless = { ...local, supportedLifecycles: ['ephemeral'] as const };
    expect(() => assertDescriptorConformance(stateless)).toThrow(PolicyRefusedError);
    expect(() => assertDescriptorConformance(stateless)).toThrow(/controlled-local/);
  });

  it('asserts the persistent refusal ONLY for managed-isolated — a controlled-local provider accepts the binding', () => {
    expect(() => assertLifecycleSupported(local, PERSISTENT)).not.toThrow();
    expect(() => assertDescriptorConformance(local)).not.toThrow();
  });

  it('is total over the environment kinds — an unknown kind is refused, not ignored', () => {
    const unknown = { ...managed, kind: 'cloud-shell' as never };
    expect(() => assertDescriptorConformance(unknown)).toThrow(PolicyRefusedError);
  });
});
