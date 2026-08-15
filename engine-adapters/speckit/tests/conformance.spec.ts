/**
 * T093 — the shared conformance suite, run against the Spec Kit adapter.
 *
 * The same thirteen cases the fixture passes (T039). That is the whole point:
 * if the real engine needed a different suite, the contract would be shaped
 * around Spec Kit and ADR-0001 would be a comment rather than an architecture.
 *
 * The container runtime is mocked. Per RAID **R-04**, building and running a
 * real container in CI is unreliable — so conformance runs against a driven
 * runtime on every commit, and the real engine is exercised nightly
 * (EPIC-015 T146, quickstart V13). This suite proves the adapter's LOGIC is
 * conformant; it does not prove a container starts, and this epic is explicit
 * about which of those it has.
 */
import { expect } from 'vitest';
import {
  PHASE_1_CAPABILITIES,
  type EngineCapability,
  type EngineDescriptor,
  type EngineFailureReason,
} from '@pmi/engine-contract';
import { runEngineConformance, type ConformanceHarness } from '@pmi/engine-contract/conformance';
import { buildEngineDescriptor } from '../src/descriptor.js';
import {
  SPECKIT_INPUT_CEILING,
  SpecKitEngine,
  type ContainerRuntime,
  type ExecResult,
  type SandboxSession,
} from '../src/speckit.adapter.js';
import type { WorkspaceFileSystem } from '../src/workspace.js';
import { FixtureAgent } from '@pmi/agent-adapter-fixture';

const SECRET_PROBE = 'sk-speckitProbe0123456789';
const GENERATED_SPEC = '# Specification: Conformance\n\n## Overview\n\nGenerated body.\n';

const descriptor = buildEngineDescriptor({
  specifyVersion: '0.0.17',
  agentCliVersion: '1.0.0',
  agentModel: 'claude-opus-5',
});

/** Workspace bookkeeping shared across every engine the suite builds, so C12 can see leaks. */
const workspaces = { created: [] as string[], removed: [] as string[] };

const fileSystem: WorkspaceFileSystem = {
  makeTempDirectory: async (prefix) => {
    const path = `${prefix}${workspaces.created.length + 1}`;
    workspaces.created.push(path);
    return path;
  },
  removeDirectory: async (path) => {
    workspaces.removed.push(path);
  },
};

/** Container bookkeeping — E8 covers containers as well as directories. */
const containers = { started: 0, stopped: 0 };

interface RuntimeBehaviour {
  exec?: (command: readonly string[]) => Promise<ExecResult>;
  files?: Record<string, string>;
  startThrows?: unknown;
}

function buildEngine(behaviour: RuntimeBehaviour = {}): SpecKitEngine {
  const files = behaviour.files ?? { 'specs/001-conformance/spec.md': GENERATED_SPEC };

  const session: SandboxSession = {
    exec: async (command) => {
      if (behaviour.exec) return behaviour.exec(command);
      // A healthy agent asked to analyse an empty specification reports one.
      // Returning empty stdout would mock an agent that silently approves
      // anything, and C11 would then pass against a fiction.
      if (command.includes('/speckit-analyze')) {
        return {
          exitCode: 0,
          stdout: 'document | error | The specification has no content.\n',
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    writeFile: async () => undefined,
    listFiles: async () => Object.keys(files),
    readFile: async (path) => files[path] ?? '',
  };

  const runtime: ContainerRuntime = {
    start: async () => {
      // Counted only on success: a start that throws leaves no container to
      // stop, so counting it would report a leak that does not exist.
      if (behaviour.startThrows) throw behaviour.startThrows;
      containers.started++;
      return session;
    },
    stop: async () => {
      containers.stopped++;
    },
  };

  return new SpecKitEngine({ descriptor, runtime, fileSystem, aiProviderToken: SECRET_PROBE, agent: new FixtureAgent() });
}

/** Drive the adapter into a specific terminal reason through the runtime alone. */
function failing(reason: EngineFailureReason): SpecKitEngine {
  switch (reason) {
    case 'engine_unavailable':
      return buildEngine({ startThrows: new Error(`runtime unreachable using ${SECRET_PROBE}`) });
    case 'engine_error':
      return buildEngine({
        exec: async () => ({ exitCode: 1, stdout: '', stderr: `failed with ${SECRET_PROBE}` }),
      });
    case 'malformed_output':
      return buildEngine({ files: { 'specs/001-conformance/spec.md': 'agent chatter, no document' } });
    case 'empty_output':
      return buildEngine({ files: { 'README.md': 'nothing was generated' } });
    default:
      // empty_selection, input_too_large, timeout and cancelled are reached
      // through input and context, not through the runtime.
      return buildEngine();
  }
}

const harness: ConformanceHarness = {
  name: 'speckit (mocked runtime)',
  inputCeiling: SPECKIT_INPUT_CEILING,
  secretProbe: SECRET_PROBE,

  create: () => buildEngine(),

  createFailing: (reason) => failing(reason),

  createSlow: (delayMs) =>
    buildEngine({
      exec: async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    }),

  incompleteDescriptor: (missing: EngineCapability): EngineDescriptor => ({
    ...descriptor,
    name: 'speckit-incomplete',
    capabilities: PHASE_1_CAPABILITIES.filter((capability) => capability !== missing),
  }),

  /** E8 — every workspace removed, every started container stopped. */
  assertNothingLeftBehind: async () => {
    const leaked = workspaces.created.filter((path) => !workspaces.removed.includes(path));
    expect(leaked, 'workspaces left behind').toEqual([]);
    expect(containers.started - containers.stopped, 'containers left running').toBe(0);
  },
};

runEngineConformance(harness);
