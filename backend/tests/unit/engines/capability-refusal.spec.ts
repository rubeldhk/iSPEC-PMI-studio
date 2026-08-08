/**
 * T136 [US8] — an adapter missing a required capability is refused at startup,
 * and the refusal names it.
 *
 * US8 scenario 4: proving the platform is not tied to Spec Kit means proving a
 * *different* engine can be plugged in — and that a half-built one cannot.
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
import { EngineRegistryService } from '../../../src/modules/engines/engine-registry.service.js';

function stubEngine(
  name: string,
  capabilities: EngineCapability[] = [...PHASE_1_CAPABILITIES],
): SpecificationEngine {
  const descriptor: EngineDescriptor = { name, version: `${name}-1.0.0+model=stub`, capabilities };
  return {
    descriptor,
    generateSpecification: async () =>
      engineOk({ title: 't', contentRaw: 'raw', contentParsed: {} }, descriptor),
    generateTasks: async () => engineOk([{ description: 'd' }], descriptor),
    validateSpecification: async () => engineOk([], descriptor),
  };
}

describe('T139 · startup capability validation', () => {
  it('registers a complete set of adapters', () => {
    const registry = new EngineRegistryService();
    registry.registerAll([
      { engine: stubEngine('primary'), isDefault: true },
      { engine: stubEngine('secondary') },
    ]);
    expect(registry.listRegistered().map((d) => d.name).sort()).toEqual(['primary', 'secondary']);
    expect(registry.defaultEngineName).toBe('primary');
  });

  it.each([...PHASE_1_CAPABILITIES])('refuses startup when an adapter lacks %s', (missing) => {
    const registry = new EngineRegistryService();
    const incomplete = stubEngine('half-built', PHASE_1_CAPABILITIES.filter((c) => c !== missing));

    try {
      registry.registerAll([{ engine: stubEngine('good'), isDefault: true }, { engine: incomplete }]);
      throw new Error('expected startup validation to refuse');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingCapabilityError);
      expect((error as Error).message).toContain(missing);
      expect((error as Error).message).toContain('half-built');
    }
  });

  it('registers NOTHING when any adapter is refused', () => {
    // All-or-nothing: registering the valid subset would boot the platform into
    // a configuration nobody designed — possibly without the intended default.
    const registry = new EngineRegistryService();
    expect(() =>
      registry.registerAll([
        { engine: stubEngine('good'), isDefault: true },
        { engine: stubEngine('bad', []) },
      ]),
    ).toThrow(MissingCapabilityError);

    expect(registry.listRegistered()).toEqual([]);
    expect(registry.has('good')).toBe(false);
    expect(registry.defaultEngineName).toBeUndefined();
  });

  it('names every offending adapter, not just the first', () => {
    const registry = new EngineRegistryService();
    try {
      registry.registerAll([
        { engine: stubEngine('bad-one', []) },
        { engine: stubEngine('bad-two', ['generate_specification']) },
      ]);
      throw new Error('expected startup validation to refuse');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('bad-one');
      expect(message).toContain('bad-two');
    }
  });

  it('accepts an empty adapter set without inventing a default', () => {
    const registry = new EngineRegistryService();
    registry.registerAll([]);
    expect(registry.listRegistered()).toEqual([]);
    expect(registry.defaultEngineName).toBeUndefined();
  });
});
