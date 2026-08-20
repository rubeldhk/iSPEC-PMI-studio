/**
 * T139a — the `/engines` listing endpoint returns capabilities.
 * Written to FAIL before T140 exists (Constitution V).
 *
 * FR-019 / US8: a project choosing an engine needs to know what each engine can
 * do, not only its name — FR-021 refuses registration of an engine missing a
 * Phase 1 capability, and this surface is where capabilities become visible.
 */
import { describe, expect, it } from 'vitest';
import { EnginesController } from '../../../src/modules/engines/engines.controller.js';
import { EngineRegistryService } from '../../../src/modules/engines/engine-registry.service.js';
import { UnauthenticatedError } from '../../../src/core/errors.js';
import type { SpecificationEngine } from '@pmi/engine-contract';

const CTX = { workspaceId: 'ws_a', userId: 'u1' };

/** Phase 1 capabilities — the set FR-021 requires of every registered engine. */
const CAPABILITIES = ['generate_specification', 'generate_tasks', 'validate_specification'];

function engine(name: string, version = '1.0.0'): SpecificationEngine {
  return {
    descriptor: { name, version, capabilities: [...CAPABILITIES] },
  } as SpecificationEngine;
}

function registryWith(...names: string[]): EngineRegistryService {
  const registry = new EngineRegistryService();
  names.forEach((name, i) => registry.register(engine(name), { isDefault: i === 0 }));
  return registry;
}

describe('EnginesController · GET /engines (FR-019)', () => {
  it('lists each registered engine with its CAPABILITIES, not only its name', async () => {
    const c = new EnginesController(registryWith('speckit', 'fixture'));
    const listed = await c.list(CTX);
    expect(listed.map((e) => e.name).sort()).toEqual(['fixture', 'speckit']);
    for (const row of listed) {
      expect(row.version).toBeTruthy();
      expect(row.capabilities).toEqual(CAPABILITIES);
    }
  });

  it('marks which engine is the deployment default', async () => {
    const c = new EnginesController(registryWith('speckit', 'fixture'));
    const listed = await c.list(CTX);
    expect(listed.find((e) => e.name === 'speckit')?.isDefault).toBe(true);
    expect(listed.find((e) => e.name === 'fixture')?.isDefault).toBe(false);
  });

  it('an empty registry lists as empty — the API side registers nothing itself', async () => {
    // Engines are supplied at the worker's composition root (FR-017); an empty
    // API-side registry is a legitimate state, not an error.
    const c = new EnginesController(new EngineRegistryService());
    await expect(c.list(CTX)).resolves.toEqual([]);
  });

  it('requires a session — 401, per the universal rules', async () => {
    const c = new EnginesController(registryWith('speckit'));
    await expect(c.list(undefined)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('exposes ONLY the read route — registration is composition-time, not HTTP', () => {
    // Contract: "Registration is a composition-time concern, not a runtime
    // endpoint in Phase 1." A write route here would be a new capability
    // surface nobody specified.
    const methods = Object.getOwnPropertyNames(EnginesController.prototype).filter(
      (m) => m !== 'constructor',
    );
    expect(methods).toEqual(['list']);
  });
});
