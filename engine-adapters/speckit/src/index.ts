/**
 * Spec Kit adapter (EPIC-003, F-08.6 + F-08.7).
 *
 * Per research R-001, `specify` only scaffolds; the `/speckit-*` commands are
 * prompt templates executed by an AI coding agent. Generation therefore means
 * orchestrating a container through five ordered steps, not calling an API —
 * a sandboxed execution runtime, not an integration client.
 *
 * The correlation boundary (T162) came from EPIC-001, because threading a
 * correlation id across a locked-down sandbox is far cheaper to design in than
 * to retrofit (PC-3).
 */
export { buildSandboxEnvironment, SANDBOX_CORRELATION_ENV } from './correlation.js';
export {
  buildEngineDescriptor,
  formatEngineVersion,
  IncompleteProvenanceError,
  SPECKIT_ENGINE_NAME,
  type EngineToolVersions,
} from './descriptor.js';
export { findSpecificationPath, parseSpecification, type ParseOutcome } from './parse.js';
export {
  DEFAULT_ENGINE_IMAGE,
  DEFAULT_RESOURCE_LIMITS,
  INVOCATION_STEPS,
  SPECKIT_INPUT_CEILING,
  SpecKitEngine,
  redact,
  type ContainerRuntime,
  type ExecResult,
  type InvocationStep,
  type SandboxSession,
  type SpecKitAdapterOptions,
} from './speckit.adapter.js';
export {
  nodeWorkspaceFileSystem,
  withEphemeralWorkspace,
  WORKSPACE_PREFIX,
  type EphemeralWorkspace,
  type WorkspaceFileSystem,
} from './workspace.js';

// EPIC-041 T1345 — the local initialiser (R-041-8): Spec Kit on the host, at
// the pinned tag, in the user's directory. Composed at the worker's root.
export {
  LocalSpecKitInitialiser,
  buildInitCommand,
  execFileOnHost,
  SPEC_KIT_REPOSITORY,
  type Exec,
  type ExecResult as LocalExecResult,
  type InitialiseInput,
  type InitialiseResult,
  type InitialiseStep,
  type LocalInitialiser,
} from './local-init.js';
