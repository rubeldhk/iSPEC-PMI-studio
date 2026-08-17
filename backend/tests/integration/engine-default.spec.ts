/**
 * T572 — the default engine resolves to Spec Kit, and the chain wires end to end.
 *
 * `FR-018` has been unsatisfiable since EPIC-003: the Spec Kit engine could not
 * be registered because it needed a container runtime that did not exist and an
 * agent it named as a literal. EPIC-003's closure report is blunt about the
 * result — *"fully built, fully tested, and unreachable."*
 *
 * This asserts the opposite: engine → agent → environment composes, and a
 * generation actually runs through all three. **No Docker daemon is involved.**
 * Every dependency is injectable, which is exactly the difference between a
 * chain that is wired and a chain that merely exists.
 *
 * What this does NOT prove is that a real container starts. That is `T646b`,
 * and a green run here must never be reported as evidence for it.
 */
import { describe, expect, it } from 'vitest';
import type { ExecutionRequest, ExecutionSession, ProjectExecutionEnvironment } from '@pmi/execution-contract';
import { composeEngineRegistry } from '@pmi/worker/engine-composition';
import { composeExecutionRegistry } from '@pmi/worker/execution-composition';
import { composeAgentRegistry } from '@pmi/worker/agent-composition';

const SPEC = ['# Feature Specification: Apollo', '', '## Requirements', '', '- **FR-001**: MUST x', ''].join('\n');

/** Records the request the engine built, so the wiring is inspectable. */
function fakeEnvironment(): ProjectExecutionEnvironment & { requests: ExecutionRequest[] } {
  const requests: ExecutionRequest[] = [];
  const session: ExecutionSession = {
    exec: async () => ({ exitCode: 0, stdout: SPEC, stderr: '' }),
    writeFile: async () => undefined,
    listFiles: async () => ['specs/001-apollo/spec.md'],
    readFile: async () => SPEC,
  };
  return {
    requests,
    descriptor: {
      provider: 'fake',
      supportedLifecycles: ['ephemeral'],
      supportsPersistentState: false,
      supportsNetworkPolicy: true,
      maxWallClockMs: 900_000,
    },
    start: async (request) => {
      requests.push(request);
      return session;
    },
    stop: async () => undefined,
  };
}

/** ADR-0002: the ONE credential a sandbox receives. The engine refuses without it. */
const TOKEN = 'sk-test-not-a-real-key';

const fileSystem = {
  makeTempDirectory: async () => '/tmp/pmi-engine-default',
  removeDirectory: async () => undefined,
};

describe('T572 · the default engine is Spec Kit (FR-018)', () => {
  it('resolves to speckit, not the fixture', () => {
    const registry = composeEngineRegistry({ environment: fakeEnvironment(), fileSystem, aiProviderToken: TOKEN });
    expect(registry.resolve().descriptor.name).toBe('speckit');
  });

  it('keeps the fixture registered, because it is what proves neutrality', () => {
    const registry = composeEngineRegistry({ environment: fakeEnvironment(), fileSystem, aiProviderToken: TOKEN });
    expect(registry.list().map((d) => d.name).sort()).toEqual(['fixture', 'speckit']);
  });

  it('records complete provenance on the default engine (FR-022)', () => {
    const registry = composeEngineRegistry({ environment: fakeEnvironment(), fileSystem, aiProviderToken: TOKEN });
    const descriptor = registry.resolve().descriptor;
    expect(descriptor.version).toBeTruthy();
    expect(descriptor.capabilities.length).toBeGreaterThan(0);
  });
});

describe('T572 · engine → agent → environment wires end to end', () => {
  it('a generation runs through all three and produces a specification', async () => {
    const environment = fakeEnvironment();
    const registry = composeEngineRegistry({ environment, fileSystem, aiProviderToken: TOKEN });

    const result = await registry.resolve().generateSpecification(
      {
        projectName: 'Apollo',
        requirements: [
          { reference: 'FR-001', type: 'functional', priority: 'must', description: 'x' },
        ],
      } as never,
      {
        correlationId: '00000000-0000-4000-8000-000000000000',
        signal: new AbortController().signal,
        timeoutMs: 5_000,
      },
    );

    expect(result.ok, 'the composed chain failed').toBe(true);
    if (result.ok) expect(result.value.title).toContain('Apollo');
  });

  it('the engine asks the environment for an EPHEMERAL workspace', async () => {
    // Native §5: no sandbox state may implicitly become authoritative project
    // state. The engine must never request a persistent binding.
    const environment = fakeEnvironment();
    const registry = composeEngineRegistry({ environment, fileSystem, aiProviderToken: TOKEN });

    await registry.resolve().generateSpecification(
      { projectName: 'Apollo', requirements: [{ reference: 'FR-001', type: 'functional', priority: 'must', description: 'x' }] } as never,
      { correlationId: '00000000-0000-4000-8000-000000000000', signal: new AbortController().signal, timeoutMs: 5_000 },
    );

    expect(environment.requests).toHaveLength(1);
    expect(environment.requests[0]?.lifecycle).toBe('ephemeral');
    expect(environment.requests[0]?.workspace.kind).toBe('ephemeral');
  });

  it('the engine applies the FROZEN generation egress profile (SC-AGT-005)', async () => {
    const environment = fakeEnvironment();
    const registry = composeEngineRegistry({ environment, fileSystem, aiProviderToken: TOKEN });

    await registry.resolve().generateSpecification(
      { projectName: 'Apollo', requirements: [{ reference: 'FR-001', type: 'functional', priority: 'must', description: 'x' }] } as never,
      { correlationId: '00000000-0000-4000-8000-000000000000', signal: new AbortController().signal, timeoutMs: 5_000 },
    );

    const profile = environment.requests[0]?.egressProfile;
    expect(profile?.name).toBe('generation');
    // ADR-0002: the AI provider endpoint and nothing else.
    expect(profile?.allowedDestinations).toEqual(['api.anthropic.com']);
  });

  it('the correlation id reaches the container environment (PC-3)', async () => {
    const environment = fakeEnvironment();
    const registry = composeEngineRegistry({ environment, fileSystem, aiProviderToken: TOKEN });

    await registry.resolve().generateSpecification(
      { projectName: 'Apollo', requirements: [{ reference: 'FR-001', type: 'functional', priority: 'must', description: 'x' }] } as never,
      { correlationId: '00000000-0000-4000-8000-000000000000', signal: new AbortController().signal, timeoutMs: 5_000 },
    );

    expect(Object.values(environment.requests[0]?.env ?? {})).toContain(
      '00000000-0000-4000-8000-000000000000',
    );
  });
});

describe('T572 · the sibling composition roots agree', () => {
  it('the execution registry defaults to docker (Native §4 Phase 1)', () => {
    const environment = fakeEnvironment();
    expect(composeExecutionRegistry(environment).resolve().descriptor.provider).toBe('fake');
    // The real default, composed without a daemon: constructing it must not
    // require one, or the worker could not start on a host that is briefly down.
    expect(composeExecutionRegistry().resolve().descriptor.provider).toBe('docker');
  });

  it('the agent registry has a default the engine can use', () => {
    expect(composeAgentRegistry().resolve().descriptor.specKitIntegrationName).toBeTruthy();
  });
});
