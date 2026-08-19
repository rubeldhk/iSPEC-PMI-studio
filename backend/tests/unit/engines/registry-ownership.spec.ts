/**
 * T554 — exactly one implementation owns FR-021's capability check.
 *
 * `T648` had been open since 2026-08-08 with no owner: `assertPhase1Capabilities`
 * in `@pmi/engine-contract` and an open-coded `PHASE_1_CAPABILITIES.filter(...)`
 * inside `EngineRegistryService.registerAll` were two answers to one
 * requirement. EPIC-028 adds an agent registry and an execution-provider
 * registry — fixing one duplicate is cheap, fixing three is a refactor.
 *
 * This is a source-level assertion because the defect is *structural*: both
 * implementations agreed behaviourally, which is exactly why no behavioural
 * test caught it.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PHASE_1_CAPABILITIES, missingPhase1Capabilities } from '@pmi/engine-contract';
import { EngineRegistryService } from '../../../src/modules/engines/engine-registry.service.js';
import { MissingCapabilityError } from '@pmi/engine-contract';
import type { EngineDescriptor, SpecificationEngine } from '@pmi/engine-contract';

const here = dirname(fileURLToPath(import.meta.url));
const registrySource = readFileSync(
  resolve(here, '../../../src/modules/engines/engine-registry.service.ts'),
  'utf8',
);

function engine(name: string, capabilities: EngineDescriptor['capabilities']): SpecificationEngine {
  return {
    descriptor: { name, version: `${name}-1`, capabilities },
    generateSpecification: async () => {
      throw new Error('not called');
    },
    generateTasks: async () => {
      throw new Error('not called');
    },
    validateSpecification: async () => {
      throw new Error('not called');
    },
  } as unknown as SpecificationEngine;
}

describe('T554 · the check has one implementation', () => {
  it('the contract exports it', () => {
    expect(typeof missingPhase1Capabilities).toBe('function');
  });

  it('the registry service does not re-derive it', () => {
    // The exact shape of the duplicate that existed: a second filter over
    // PHASE_1_CAPABILITIES inside registerAll.
    const stripped = registrySource.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
    expect(stripped).not.toMatch(/PHASE_1_CAPABILITIES\s*\.\s*filter/);
  });

  it('the registry service delegates to the contract', () => {
    expect(registrySource).toMatch(/missingPhase1Capabilities/);
  });
});

describe('T554 · both entry points refuse identically', () => {
  const incomplete = engine('partial', [...PHASE_1_CAPABILITIES].slice(0, 2));

  it('register() refuses, naming the missing capability', () => {
    const registry = new EngineRegistryService();
    expect(() => registry.register(incomplete)).toThrow(MissingCapabilityError);
  });

  it('registerAll() refuses the same adapter for the same reason', () => {
    const registry = new EngineRegistryService();
    expect(() => registry.registerAll([{ engine: incomplete }])).toThrow(MissingCapabilityError);
  });

  it('reports the same missing set from both paths', () => {
    const direct = missingPhase1Capabilities(incomplete.descriptor);
    const registry = new EngineRegistryService();
    try {
      registry.registerAll([{ engine: incomplete }]);
      expect.unreachable('should have refused');
    } catch (e) {
      expect((e as MissingCapabilityError).missing).toEqual(direct);
    }
  });

  it('registerAll is all-or-nothing: one bad adapter registers none (T139)', () => {
    const registry = new EngineRegistryService();
    const good = engine('complete', [...PHASE_1_CAPABILITIES]);
    expect(() =>
      registry.registerAll([{ engine: good, isDefault: true }, { engine: incomplete }]),
    ).toThrow(MissingCapabilityError);
    expect(registry.listRegistered()).toEqual([]);
  });
});
