/**
 * T137 [US8] — generating against BOTH adapters, asserting identical platform behaviour.
 *
 * This is the acceptance test for the SRS's central architectural claim: that
 * PMI Studio is not tied to Spec Kit. SC-008 says a second engine costs zero
 * changes outside the adapter layer, and the only honest way to show that is to
 * run the same caller against two engines and check nothing else moves.
 *
 * The caller below is written ONCE and run against both. If supporting a second
 * engine required a branch anywhere in it, this test could not be written in
 * this shape — which is the point.
 *
 * Both adapters are TEST-ONLY dependencies here. `backend/src` may import the
 * contract and never a concrete engine; the architecture test enforces that
 * independently of what is installed.
 */
import { describe, it, expect } from 'vitest';
import {
  MissingCapabilityError,
  PHASE_1_CAPABILITIES,
  assertPhase1Capabilities,
  type EngineContext,
  type GenerateSpecificationInput,
  type SpecificationEngine,
} from '@pmi/engine-contract';
import { FixtureEngine } from '@pmi/engine-adapter-fixture';
import {
  SpecKitEngine,
  buildEngineDescriptor,
  type ContainerRuntime,
  type SandboxSession,
} from '@pmi/engine-adapter-speckit';

/**
 * T575 — the engine now takes a `ProjectExecutionEnvironment`, which carries a
 * descriptor. Fakes declare one so the port is honoured rather than cast away.
 */
const ENV_DESCRIPTOR = {
  provider: 'fake',
  supportedLifecycles: ['ephemeral'],
  supportsPersistentState: false,
  supportsNetworkPolicy: true,
  maxWallClockMs: 900_000,
} as const;
import { EngineRegistryService } from '../../src/modules/engines/engine-registry.service.js';
import { FixtureAgent } from '@pmi/agent-adapter-fixture';
import {
  EngineResolverService,
  type ProjectEngineSelectionPort,
} from '../../src/modules/engines/engine-resolver.service.js';

const CORRELATION_ID = '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607';
const GENERATED = '# Specification: Acme\n\n## Overview\n\nGenerated body.\n';

function speckitEngine(): SpecKitEngine {
  // Models what a real run leaves in the workspace: a specification AND a task
  // list, because the platform calls all three capabilities.
  const workspaceFiles: Record<string, string> = {
    'specs/001-acme/spec.md': GENERATED,
    'specs/001-acme/tasks.md': '- [ ] T001 Implement invoicing\n- [ ] T002 Record approvals\n',
  };
  const session: SandboxSession = {
    exec: async () => ({ exitCode: 0, stdout: 'document | info | ok\n', stderr: '' }),
    writeFile: async () => undefined,
    listFiles: async () => Object.keys(workspaceFiles),
    readFile: async (path) => workspaceFiles[path] ?? '',
  };
  const environment: ContainerRuntime = { descriptor: ENV_DESCRIPTOR, start: async () => session, stop: async () => undefined };
  return new SpecKitEngine({
    descriptor: buildEngineDescriptor({
      specifyVersion: '0.0.17',
      agentCliVersion: '1.0.0',
      agentModel: 'claude-opus-5',
    }),
    environment,
    fileSystem: {
      makeTempDirectory: async (prefix) => `${prefix}swap`,
      removeDirectory: async () => undefined,
    },
    aiProviderToken: 'sk-swapTestToken0123456789',
    agent: new FixtureAgent(),
  });
}

/** Two projects, two engines, one registry. */
function buildResolver(): EngineResolverService {
  const registry = new EngineRegistryService();
  registry.register(speckitEngine(), { isDefault: true });
  registry.register(new FixtureEngine());

  const selections: ProjectEngineSelectionPort = {
    findEngineNameForProject: async (projectId) =>
      projectId === 'project-on-fixture' ? 'fixture' : null,
  };
  return new EngineResolverService(registry, selections);
}

const ctx: EngineContext = {
  signal: new AbortController().signal,
  timeoutMs: 5_000,
  correlationId: CORRELATION_ID,
};

const input: GenerateSpecificationInput = {
  projectName: 'Acme',
  requirements: [
    { reference: 'FR-001', description: 'Issue invoices', type: 'functional', priority: 'p1' },
  ],
};

/**
 * The platform's caller. Written once, engine-agnostic, and used unchanged for
 * every project below. There is deliberately no parameter naming an engine.
 */
async function generateFor(projectId: string) {
  const engine: SpecificationEngine = await buildResolver().resolveForProject(projectId);
  return engine.generateSpecification(input, ctx);
}

describe('the same caller drives both engines (SC-008)', () => {
  it.each(['project-on-default', 'project-on-fixture'])('%s generates successfully', async (projectId) => {
    const result = await generateFor(projectId);
    expect(result.ok).toBe(true);
  });

  it('produces the same RESULT SHAPE from both', async () => {
    const viaSpeckit = await generateFor('project-on-default');
    const viaFixture = await generateFor('project-on-fixture');

    expect(viaSpeckit.ok).toBe(true);
    expect(viaFixture.ok).toBe(true);
    if (viaSpeckit.ok && viaFixture.ok) {
      expect(Object.keys(viaSpeckit.value).sort()).toEqual(Object.keys(viaFixture.value).sort());
      expect(Object.keys(viaSpeckit).sort()).toEqual(Object.keys(viaFixture).sort());
      for (const result of [viaSpeckit, viaFixture]) {
        expect(typeof result.value.title).toBe('string');
        expect(typeof result.value.contentRaw).toBe('string');
        expect(result.value.contentRaw.trim()).not.toBe('');
      }
    }
  });

  it('attributes each artifact to the engine that actually produced it (FR-022)', async () => {
    const viaSpeckit = await generateFor('project-on-default');
    const viaFixture = await generateFor('project-on-fixture');

    if (viaSpeckit.ok && viaFixture.ok) {
      expect(viaSpeckit.producedBy.name).toBe('speckit');
      expect(viaFixture.producedBy.name).toBe('fixture');
      // Different engines must never share a version string, or provenance
      // stops distinguishing them.
      expect(viaSpeckit.producedBy.version).not.toBe(viaFixture.producedBy.version);
    }
  });

  it('reports the SAME failure reason from both for the same bad input', async () => {
    // Identical platform behaviour is mostly about failures: if two engines
    // classify the same problem differently, every caller needs to know which
    // engine it is talking to.
    const empty: GenerateSpecificationInput = { projectName: 'Acme', requirements: [] };
    const results = await Promise.all(
      ['project-on-default', 'project-on-fixture'].map(async (projectId) => {
        const engine = await buildResolver().resolveForProject(projectId);
        return engine.generateSpecification(empty, ctx);
      }),
    );

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.reason).toBe('empty_selection');
    }
  });

  it('exposes the same capability set from both', async () => {
    for (const projectId of ['project-on-default', 'project-on-fixture']) {
      const engine = await buildResolver().resolveForProject(projectId);
      expect(engine.descriptor.capabilities).toEqual([...PHASE_1_CAPABILITIES]);
    }
  });

  it('offers every capability through both engines', async () => {
    for (const projectId of ['project-on-default', 'project-on-fixture']) {
      const engine = await buildResolver().resolveForProject(projectId);
      const tasks = await engine.generateTasks(
        { projectName: 'Acme', specificationTitle: 'S', specificationContent: '- [ ] do the thing' },
        ctx,
      );
      const findings = await engine.validateSpecification(
        { specificationTitle: 'S', specificationContent: 'body' },
        ctx,
      );
      expect(tasks.ok, `generateTasks failed for ${projectId}`).toBe(true);
      expect(findings.ok, `validateSpecification failed for ${projectId}`).toBe(true);
    }
  });
});

describe('adding an engine costs nothing outside the adapter layer (SC-008)', () => {
  it('registers a third engine without touching the caller', async () => {
    // The whole registration is these three lines. `generateFor` above is
    // unchanged and unaware.
    const registry = new EngineRegistryService();
    registry.register(speckitEngine(), { isDefault: true });
    registry.register(new FixtureEngine());
    registry.register(new FixtureEngine({ failWith: 'engine_error' }));

    expect(registry.listRegistered()).toHaveLength(2); // same name replaces
    expect(registry.listRegistered().map((d) => d.name).sort()).toEqual(['fixture', 'speckit']);
  });
});

/**
 * T464 — quickstart **V11 · Engine independence (US8)**, executed.
 *
 * The plan's Definition of done requires V11 to pass. Its five steps map exactly
 * onto code, so it is run here as a repeatable scenario rather than transcribed
 * as a one-off manual walkthrough — a scenario nobody can re-run is a claim, not
 * a check.
 *
 * Step 4 (`pnpm test:arch`) is a separate suite by design and is run as its own
 * CI gate; it is asserted here only to the extent that this file cannot see it.
 */
describe('quickstart V11 · engine independence (executed)', () => {
  it('V11.1 — the fixture adapter is registered alongside Spec Kit', () => {
    const registry = new EngineRegistryService();
    registry.register(speckitEngine(), { isDefault: true });
    registry.register(new FixtureEngine());
    expect(registry.listRegistered().map((d) => d.name).sort()).toEqual(['fixture', 'speckit']);
  });

  it('V11.2 — a project can be switched to the fixture engine', async () => {
    const engine = await buildResolver().resolveForProject('project-on-fixture');
    expect(engine.descriptor.name).toBe('fixture');
  });

  it('V11.3 — generation succeeds and records the fixture as producer', async () => {
    const result = await generateFor('project-on-fixture');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.producedBy.name).toBe('fixture');
  });

  it('V11.3b — no behavioural difference outside the adapter layer', async () => {
    const viaFixture = await generateFor('project-on-fixture');
    const viaSpeckit = await generateFor('project-on-default');
    expect(viaFixture.ok).toBe(viaSpeckit.ok);
    if (viaFixture.ok && viaSpeckit.ok) {
      expect(Object.keys(viaFixture.value).sort()).toEqual(Object.keys(viaSpeckit.value).sort());
    }
  });

  it('V11.5 — an adapter declaring only two of three capabilities is refused, naming it', () => {
    const missing = PHASE_1_CAPABILITIES[2];
    try {
      assertPhase1Capabilities({
        name: 'half-built',
        version: 'half-built-1.0.0+model=none',
        capabilities: [PHASE_1_CAPABILITIES[0], PHASE_1_CAPABILITIES[1]],
      });
      throw new Error('expected the incomplete adapter to be refused');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingCapabilityError);
      expect((error as Error).message).toContain(missing);
      expect((error as Error).message).toContain('half-built');
    }
  });
});
