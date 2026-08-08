/**
 * T034a — engine resolution returns the project's selected engine and falls
 * back to the default (FR-018, FR-019).
 *
 * This file was marked complete on 2026-08-05 and did not exist.
 */
import { describe, it, expect } from 'vitest';
import {
  PHASE_1_CAPABILITIES,
  engineOk,
  type EngineDescriptor,
  type SpecificationEngine,
} from '@pmi/engine-contract';
import {
  EngineRegistryService,
  NoDefaultEngineError,
} from '../../../src/modules/engines/engine-registry.service.js';
import {
  EngineResolverService,
  EngineSelectionUnavailableError,
  type ProjectEngineSelectionPort,
} from '../../../src/modules/engines/engine-resolver.service.js';

function stubEngine(name: string): SpecificationEngine {
  const descriptor: EngineDescriptor = {
    name,
    version: `${name}-1.0.0+model=stub`,
    capabilities: [...PHASE_1_CAPABILITIES],
  };
  return {
    descriptor,
    generateSpecification: async () =>
      engineOk({ title: 't', contentRaw: 'raw', contentParsed: {} }, descriptor),
    generateTasks: async () => engineOk([{ description: 'd' }], descriptor),
    validateSpecification: async () => engineOk([], descriptor),
  };
}

function selections(map: Record<string, string | null>): ProjectEngineSelectionPort {
  return { findEngineNameForProject: async (projectId) => map[projectId] ?? null };
}

function build(map: Record<string, string | null>): EngineResolverService {
  const registry = new EngineRegistryService();
  registry.register(stubEngine('speckit'), { isDefault: true });
  registry.register(stubEngine('fixture'));
  return new EngineResolverService(registry, selections(map));
}

describe('resolution (FR-018, FR-019)', () => {
  it('returns the default when a project has selected nothing', async () => {
    const engine = await build({}).resolveForProject('project-1');
    expect(engine.descriptor.name).toBe('speckit');
  });

  it('returns the default when the selection is explicitly null', async () => {
    const engine = await build({ 'project-1': null }).resolveForProject('project-1');
    expect(engine.descriptor.name).toBe('speckit');
  });

  it('returns the selected engine when a project has chosen one', async () => {
    const engine = await build({ 'project-1': 'fixture' }).resolveForProject('project-1');
    expect(engine.descriptor.name).toBe('fixture');
  });

  it('resolves per project, not globally', async () => {
    const resolver = build({ 'project-1': 'fixture' });
    expect((await resolver.resolveForProject('project-1')).descriptor.name).toBe('fixture');
    expect((await resolver.resolveForProject('project-2')).descriptor.name).toBe('speckit');
  });

  it('treats an empty selection string as no selection', async () => {
    const engine = await build({ 'project-1': '' }).resolveForProject('project-1');
    expect(engine.descriptor.name).toBe('speckit');
  });
});

describe('a selection that cannot be honoured', () => {
  it('FAILS rather than silently falling back to the default', async () => {
    // Substituting a different engine would change what the project produces
    // while FR-022 provenance recorded the run as ordinary. The artifact would
    // be attributed to an engine the project did not choose, and nothing would
    // say so.
    const resolver = build({ 'project-1': 'retired-engine' });
    await expect(resolver.resolveForProject('project-1')).rejects.toBeInstanceOf(
      EngineSelectionUnavailableError,
    );
  });

  it('names the project, the selection, and what IS registered', async () => {
    const resolver = build({ 'project-1': 'retired-engine' });
    try {
      await resolver.resolveForProject('project-1');
      throw new Error('expected EngineSelectionUnavailableError');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('project-1');
      expect(message).toContain('retired-engine');
      expect(message).toContain('speckit');
    }
  });

  it('surfaces the absence of a default rather than inventing one', async () => {
    const registry = new EngineRegistryService();
    registry.register(stubEngine('only'));
    const resolver = new EngineResolverService(registry, selections({}));
    await expect(resolver.resolveForProject('project-1')).rejects.toBeInstanceOf(
      NoDefaultEngineError,
    );
  });
});
