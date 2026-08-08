/**
 * T135 [US8] — per-project engine selection resolves the correct adapter.
 *
 * US8 is the architectural proof: switch a project to a different engine and
 * the platform behaves identically. This asserts the *selection* half — that
 * the right adapter comes back, and that swapping it changes nothing about how
 * the caller works.
 *
 * The HTTP surface for changing a selection is T138, which is BLOCKED: it
 * writes into `projects.controller.ts`, product surface owned by the held
 * EPIC-006. Selection is therefore exercised through the port, which is where
 * the behaviour actually lives.
 */
import { describe, it, expect } from 'vitest';
import {
  PHASE_1_CAPABILITIES,
  engineOk,
  type EngineContext,
  type EngineDescriptor,
  type SpecificationEngine,
} from '@pmi/engine-contract';
import { EngineRegistryService } from '../../../src/modules/engines/engine-registry.service.js';
import {
  EngineResolverService,
  type ProjectEngineSelectionPort,
} from '../../../src/modules/engines/engine-resolver.service.js';

/** Two engines with deliberately different output, so a swap is observable. */
function engineProducing(name: string, body: string): SpecificationEngine {
  const descriptor: EngineDescriptor = {
    name,
    version: `${name}-2.0.0+model=stub`,
    capabilities: [...PHASE_1_CAPABILITIES],
  };
  return {
    descriptor,
    generateSpecification: async () =>
      engineOk({ title: `${name} spec`, contentRaw: body, contentParsed: { by: name } }, descriptor),
    generateTasks: async () => engineOk([{ description: `${name} task` }], descriptor),
    validateSpecification: async () =>
      engineOk([{ location: 'document', severity: 'info', message: `${name} finding` }], descriptor),
  };
}

const selectionTable: Record<string, string | null> = {
  'project-default': null,
  'project-fixture': 'fixture',
  'project-speckit': 'speckit',
};

const port: ProjectEngineSelectionPort = {
  findEngineNameForProject: async (projectId) => selectionTable[projectId] ?? null,
};

function resolver(): EngineResolverService {
  const registry = new EngineRegistryService();
  registry.register(engineProducing('speckit', 'produced by speckit'), { isDefault: true });
  registry.register(engineProducing('fixture', 'produced by fixture'), {});
  return new EngineResolverService(registry, port);
}

const ctx: EngineContext = {
  signal: new AbortController().signal,
  timeoutMs: 5_000,
  correlationId: 'selection-test',
};

describe('per-project selection resolves the correct adapter (US8)', () => {
  it.each([
    ['project-default', 'speckit'],
    ['project-fixture', 'fixture'],
    ['project-speckit', 'speckit'],
  ])('%s resolves to %s', async (projectId, expected) => {
    const engine = await resolver().resolveForProject(projectId as string);
    expect(engine.descriptor.name).toBe(expected);
  });

  it('the resolved engine is the one that produces the artifact', async () => {
    const engine = await resolver().resolveForProject('project-fixture');
    const result = await engine.generateSpecification(
      { projectName: 'Acme', requirements: [{ reference: 'FR-1', description: 'd', type: 'functional', priority: 'p1' }] },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contentRaw).toBe('produced by fixture');
      // FR-022: provenance names the engine that actually ran.
      expect(result.producedBy.name).toBe('fixture');
      expect(result.producedBy.version).toContain('fixture');
    }
  });

  it('switching the selection switches the producer, with no change at the call site', async () => {
    // SC-008: a second engine costs zero changes outside the adapter layer.
    // The caller below is byte-identical across both projects.
    const call = async (projectId: string) => {
      const engine = await resolver().resolveForProject(projectId);
      return engine.generateSpecification(
        { projectName: 'Acme', requirements: [{ reference: 'FR-1', description: 'd', type: 'functional', priority: 'p1' }] },
        ctx,
      );
    };

    const viaDefault = await call('project-default');
    const viaFixture = await call('project-fixture');

    expect(viaDefault.ok).toBe(true);
    expect(viaFixture.ok).toBe(true);
    if (viaDefault.ok && viaFixture.ok) {
      expect(viaDefault.producedBy.name).toBe('speckit');
      expect(viaFixture.producedBy.name).toBe('fixture');
      // Same shape from both — the platform cannot tell them apart structurally.
      expect(Object.keys(viaDefault.value).sort()).toEqual(Object.keys(viaFixture.value).sort());
    }
  });

  it('every capability is reachable through the resolved engine', async () => {
    const engine = await resolver().resolveForProject('project-fixture');
    const tasks = await engine.generateTasks(
      { projectName: 'Acme', specificationTitle: 'S', specificationContent: 'body' },
      ctx,
    );
    const findings = await engine.validateSpecification(
      { specificationTitle: 'S', specificationContent: 'body' },
      ctx,
    );
    expect(tasks.ok).toBe(true);
    expect(findings.ok).toBe(true);
    if (findings.ok) expect(findings.value[0]?.location).toBeTruthy();
  });
});
