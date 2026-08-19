/**
 * T033 — engine registry: registration is refused, naming the missing capability.
 *
 * No adapter is imported. The registry is exercised through stub engines built
 * from the contract alone, which is the same constraint the architecture test
 * enforces on `backend/src`.
 */
import { describe, it, expect } from 'vitest';
import {
  MissingCapabilityError,
  PHASE_1_CAPABILITIES,
  engineOk,
  type EngineCapability,
  type EngineDescriptor,
  type SpecificationEngine,
} from '@pmi/engine-contract';
import {
  EngineRegistryService,
  NoDefaultEngineError,
  UnknownEngineError,
  type EngineRegistrationRecord,
} from '../../../src/modules/engines/engine-registry.service.js';

function stubEngine(name: string, capabilities: EngineCapability[] = [...PHASE_1_CAPABILITIES]): SpecificationEngine {
  const descriptor: EngineDescriptor = { name, version: `${name}-1.0.0+model=stub`, capabilities };
  return {
    descriptor,
    generateSpecification: async () =>
      engineOk({ title: 't', contentRaw: 'raw', contentParsed: {} }, descriptor),
    generateTasks: async () => engineOk([{ description: 'd' }], descriptor),
    validateSpecification: async () => engineOk([], descriptor),
  };
}

describe('registration (FR-021)', () => {
  it('accepts an engine declaring all three Phase 1 capabilities', () => {
    const registry = new EngineRegistryService();
    registry.register(stubEngine('complete'));
    expect(registry.has('complete')).toBe(true);
    expect(registry.listRegistered().map((d) => d.name)).toEqual(['complete']);
  });

  it.each([...PHASE_1_CAPABILITIES])('refuses an engine missing %s, naming it', (missing) => {
    const registry = new EngineRegistryService();
    const incomplete = stubEngine(
      'incomplete',
      PHASE_1_CAPABILITIES.filter((c) => c !== missing),
    );

    try {
      registry.register(incomplete);
      throw new Error('expected registration to be refused');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingCapabilityError);
      expect((error as MissingCapabilityError).missing).toEqual([missing]);
      expect((error as Error).message).toContain(missing);
      expect((error as Error).message).toContain('incomplete');
    }
    // A refused engine must not be half-registered.
    expect(registry.has('incomplete')).toBe(false);
    expect(registry.listRegistered()).toEqual([]);
  });

  it('records the descriptor version so provenance is inspectable (FR-022)', () => {
    const registry = new EngineRegistryService();
    registry.register(stubEngine('versioned'));
    expect(registry.listRegistered()[0]?.version).toBe('versioned-1.0.0+model=stub');
  });
});

describe('lookup', () => {
  it('returns the engine registered under a name', () => {
    const registry = new EngineRegistryService();
    const engine = stubEngine('alpha');
    registry.register(engine);
    expect(registry.get('alpha')).toBe(engine);
  });

  it('names what IS registered when asked for an engine that is not', () => {
    const registry = new EngineRegistryService();
    registry.register(stubEngine('alpha'));
    try {
      registry.get('beta');
      throw new Error('expected UnknownEngineError');
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownEngineError);
      // An error that lists the alternatives is actionable; "not found" is not.
      expect((error as Error).message).toContain('alpha');
    }
  });

  it('refuses to guess a default when none was nominated', () => {
    const registry = new EngineRegistryService();
    registry.register(stubEngine('alpha'));
    expect(() => registry.getDefault()).toThrow(NoDefaultEngineError);
  });

  it('returns the nominated default (FR-018)', () => {
    const registry = new EngineRegistryService();
    registry.register(stubEngine('alpha'));
    registry.register(stubEngine('beta'), { isDefault: true });
    expect(registry.getDefault().descriptor.name).toBe('beta');
    expect(registry.defaultEngineName).toBe('beta');
  });
});

describe('persistence of what was accepted', () => {
  it('records every registered engine, flagging the default', async () => {
    const recorded: EngineRegistrationRecord[] = [];
    const registry = new EngineRegistryService({
      record: async (registration) => {
        recorded.push(registration);
      },
    });
    registry.register(stubEngine('alpha'));
    registry.register(stubEngine('beta'), { isDefault: true });
    await registry.recordRegistrations();

    expect(recorded).toHaveLength(2);
    expect(recorded.find((r) => r.name === 'beta')?.isDefault).toBe(true);
    expect(recorded.find((r) => r.name === 'alpha')?.isDefault).toBe(false);
    expect(recorded.find((r) => r.name === 'alpha')?.capabilities).toEqual([
      ...PHASE_1_CAPABILITIES,
    ]);
  });

  it('works without a store — the registry is usable before persistence exists', async () => {
    const registry = new EngineRegistryService();
    registry.register(stubEngine('alpha'));
    await expect(registry.recordRegistrations()).resolves.toBeUndefined();
  });
});
