/**
 * T463 — the engine registration store.
 *
 * Convergence found `engine_registrations` in the schema with nothing that ever
 * wrote to it: the port existed, no implementation did, and
 * `recordRegistrations()` silently no-opped.
 */
import { describe, it, expect } from 'vitest';
import { PHASE_1_CAPABILITIES, engineOk, type SpecificationEngine } from '@pmi/engine-contract';
import { EngineRegistryService } from '../../../src/modules/engines/engine-registry.service.js';
import {
  NullEngineRegistrationStore,
  PrismaEngineRegistrationStore,
  type EngineRegistrationDelegate,
} from '../../../src/modules/engines/engine-registration.store.js';

type UpsertArgs = Parameters<EngineRegistrationDelegate['upsert']>[0];

function recordingDelegate() {
  const calls: UpsertArgs[] = [];
  const delegate: EngineRegistrationDelegate = {
    upsert: async (args) => {
      calls.push(args);
      return {};
    },
  };
  return { delegate, calls };
}

function stubEngine(name: string, version = `${name}-1.0.0+model=stub`): SpecificationEngine {
  const descriptor = { name, version, capabilities: [...PHASE_1_CAPABILITIES] };
  return {
    descriptor,
    generateSpecification: async () =>
      engineOk({ title: 't', contentRaw: 'raw', contentParsed: {} }, descriptor),
    generateTasks: async () => engineOk([{ description: 'd' }], descriptor),
    validateSpecification: async () => engineOk([], descriptor),
  };
}

describe('recording what a deployment accepted', () => {
  it('writes name, version, capabilities and the default flag', async () => {
    const { delegate, calls } = recordingDelegate();
    const store = new PrismaEngineRegistrationStore(delegate);

    await store.record({
      name: 'speckit',
      version: 'speckit-0.0.17+agent=1.0.0+model=claude-opus-5',
      capabilities: [...PHASE_1_CAPABILITIES],
      isDefault: true,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.where).toEqual({ name: 'speckit' });
    expect(calls[0]?.create.version).toContain('model=claude-opus-5');
    expect(calls[0]?.create.capabilities).toEqual([...PHASE_1_CAPABILITIES]);
    expect(calls[0]?.create.isDefault).toBe(true);
  });

  it('UPSERTS rather than creates', async () => {
    // Registration runs on every startup; `create` would fail the second time a
    // process booted.
    const { delegate, calls } = recordingDelegate();
    const store = new PrismaEngineRegistrationStore(delegate);
    await store.record({ name: 'speckit', version: 'v1', capabilities: [], isDefault: true });
    await store.record({ name: 'speckit', version: 'v1', capabilities: [], isDefault: true });
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => 'update' in call)).toBe(true);
  });

  it('records an upgraded engine as ONE row at its current version', async () => {
    // Not a row per deployment: an operator asking "what is running" should get
    // one answer per engine.
    const { delegate, calls } = recordingDelegate();
    const store = new PrismaEngineRegistrationStore(delegate);
    await store.record({ name: 'speckit', version: 'v1', capabilities: [], isDefault: true });
    await store.record({ name: 'speckit', version: 'v2', capabilities: [], isDefault: true });
    expect(calls[1]?.where).toEqual({ name: 'speckit' });
    expect(calls[1]?.update.version).toBe('v2');
  });

  it('copies capabilities rather than sharing the array', async () => {
    const { delegate, calls } = recordingDelegate();
    const capabilities = [...PHASE_1_CAPABILITIES];
    await new PrismaEngineRegistrationStore(delegate).record({
      name: 'x',
      version: 'v',
      capabilities,
      isDefault: false,
    });
    capabilities.length = 0;
    expect(calls[0]?.create.capabilities).toHaveLength(3);
  });
});

describe('the registry writes through the store', () => {
  it('records every registered engine, flagging the default', async () => {
    const { delegate, calls } = recordingDelegate();
    const registry = new EngineRegistryService(new PrismaEngineRegistrationStore(delegate));
    registry.register(stubEngine('speckit'), { isDefault: true });
    registry.register(stubEngine('fixture'));

    await registry.recordRegistrations();

    const names = calls.map((call) => call.where.name).sort();
    expect(names).toEqual(['fixture', 'speckit']);
    expect(calls.find((call) => call.where.name === 'speckit')?.create.isDefault).toBe(true);
    expect(calls.find((call) => call.where.name === 'fixture')?.create.isDefault).toBe(false);
  });
});

describe('the null store', () => {
  it('records nothing to a database but keeps what it was given', async () => {
    // "No store supplied" and "this deployment deliberately does not persist"
    // are different states, and only one is a configuration mistake.
    const store = new NullEngineRegistrationStore();
    const registry = new EngineRegistryService(store);
    registry.register(stubEngine('fixture'), { isDefault: true });
    await registry.recordRegistrations();
    expect(store.recorded.map((r) => r.name)).toEqual(['fixture']);
  });
});
