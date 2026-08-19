# Contract: Specification Engine Interface (Phase 1)

**Epic**: `EPIC-001` | **Date**: 2026-08-02 | **Implements**: FR-016 to FR-028

**SRS source**: `PMI_Studio_Reference_Documents_for_SpecKit.docx` §Specification Engine Contract
(`ISpecificationEngine`, 8 methods) and §Key Recommendations — *"Treat Spec Kit as Engine V1, not the
product."*

This is the boundary the entire platform talks through. Nothing outside `engine-adapters/*` may know
that Spec Kit exists.

## Phase 1 scope

The SRS defines eight capabilities. Clarification confirmed Phase 1 implements three:

| Capability | Phase 1 | Notes |
|------------|---------|-------|
| `generateSpecification` | ✅ Required | US3 |
| `generateTasks` | ✅ Required | US4 |
| `validateSpecification` | ✅ Required | US6 |
| `improveSpecification` | ❌ Deferred | |
| `generateAcceptanceCriteria` | ❌ Deferred | |
| `estimateComplexity` | ❌ Deferred | |
| `analyzeDependencies` | ❌ Deferred | |

An adapter declaring fewer than the three required capabilities is **refused at registration**,
naming the missing capability (FR-021, US8 scenario 4).

## Interface

```typescript
/** Declared once in packages/engine-contract. The only engine type backend/ may import. */
export interface SpecificationEngine {
  readonly descriptor: EngineDescriptor;

  generateSpecification(
    input: GenerateSpecificationInput,
    ctx: EngineContext,
  ): Promise<EngineResult<GeneratedSpecification>>;

  generateTasks(
    input: GenerateTasksInput,
    ctx: EngineContext,
  ): Promise<EngineResult<GeneratedTask[]>>;

  validateSpecification(
    input: ValidateSpecificationInput,
    ctx: EngineContext,
  ): Promise<EngineResult<ValidationFinding[]>>;
}

export interface EngineDescriptor {
  name: string;
  /** Identifies BOTH the engine tool version AND the AI agent/model. Recorded on every
   *  artifact (FR-022). Same Spec Kit + different model = different engine version. */
  version: string;
  capabilities: EngineCapability[];
}

export type EngineCapability =
  | 'generate_specification'
  | 'generate_tasks'
  | 'validate_specification';

export interface EngineContext {
  /** Cooperative cancellation — FR-024. */
  signal: AbortSignal;
  /** Hard wall-clock ceiling — FR-025. */
  timeoutMs: number;
  /** Progress for FR-028; must never block the caller. */
  onProgress?: (note: string) => void;
}
```

### Inputs

```typescript
export interface GenerateSpecificationInput {
  projectName: string;
  /** Never empty — an empty selection is refused before the job starts (FR-026). */
  requirements: RequirementInput[];
}

export interface RequirementInput {
  reference: string;
  description: string;
  type: 'business' | 'functional' | 'non_functional' | 'constraint';
  priority: 'p1' | 'p2' | 'p3';
}

export interface GenerateTasksInput {
  projectName: string;
  specificationTitle: string;
  specificationContent: string;
}

export interface ValidateSpecificationInput {
  specificationTitle: string;
  specificationContent: string;
}
```

### Result type

Engines **return** failures; they do not throw for expected conditions. This is what makes the
failure taxonomy in FR-026 enforceable rather than dependent on exception hygiene.

```typescript
export type EngineResult<T> =
  | { ok: true; value: T; producedBy: EngineDescriptor }
  | { ok: false; failure: EngineFailure };

export interface EngineFailure {
  reason: EngineFailureReason;
  /** Human-readable, safe to show the user. Never a raw stack trace. */
  message: string;
  /** Operator-facing detail. Never returned to the user. */
  diagnostics?: string;
}

export type EngineFailureReason =
  | 'engine_unavailable'   // engine could not be reached or started
  | 'engine_error'         // engine ran and failed
  | 'malformed_output'     // ran, produced something unparseable
  | 'empty_output'         // ran, produced nothing — a failure, NOT an empty specification
  | 'timeout'              // exceeded timeoutMs (FR-025)
  | 'cancelled'            // user cancelled (FR-024)
  | 'input_too_large'      // rejected BEFORE starting, not after failing
  | 'empty_selection';     // zero requirements supplied
```

### Outputs

```typescript
export interface GeneratedSpecification {
  title: string;
  /** Engine output verbatim. Always persisted (R-007) so a future parser fix
   *  can re-derive structure without re-running the engine. */
  contentRaw: string;
  contentParsed: Record<string, unknown>;
}

export interface GeneratedTask {
  description: string;
}

export interface ValidationFinding {
  /** REQUIRED — must identify the part of the specification concerned (FR-023).
   *  A finding without a location is malformed output. */
  location: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}
```

## Rules every adapter must satisfy

| # | Rule | Requirement |
|---|------|-------------|
| E1 | Declare every capability it provides; registration is refused if any Phase 1 capability is missing | FR-021 |
| E2 | Return a failure result rather than throwing, for every reason in the taxonomy | FR-026 |
| E3 | Never return a partial artifact alongside a failure | FR-027, SC-006 |
| E4 | Honour `signal` — abandon work promptly on cancellation | FR-024 |
| E5 | Honour `timeoutMs` — self-terminate rather than relying on the caller | FR-025 |
| E6 | Treat empty output as `empty_output`, never as a valid empty specification | FR-026 |
| E7 | Report `input_too_large` **before** starting work, not after failing | Spec edge case |
| E8 | Leave no process, container, or temporary file behind on any terminal outcome | FR-027 |
| E9 | Never leak platform credentials into engine output or diagnostics | R-006 |
| E10 | `descriptor.version` must change when either the engine tool or the AI model changes | FR-022 |

## Adapter registration

```typescript
export interface EngineRegistry {
  /** Refuses registration, naming the missing capability, if any Phase 1
   *  capability is absent (FR-021). */
  register(engine: SpecificationEngine): void;
  resolveForProject(projectId: string): SpecificationEngine;
  listRegistered(): EngineDescriptor[];
}
```

Adapters are supplied at composition time and resolved through dependency injection. Adding an engine
means registering a provider — **no change to any calling code** (FR-019, SC-008).

## Enforcement of engine-independence

The SRS's central architectural claim is only worth anything if something fails when it stops being
true. Three mechanisms, per research R-009:

1. **Package boundary** (FR-017) — `backend/` depends on `packages/engine-contract`, never on
   `engine-adapters/*`. All engine capabilities are invoked exclusively through this contract.
2. **Architecture test** (FR-017) — `backend/tests/architecture` **fails the build** if any file
   under `backend/src` references a Spec Kit symbol, package, or string identifier.
3. **Fixture adapter** — `engine-adapters/fixture` implements this contract with trivial
   deterministic output. It backs the User Story 8 acceptance test (proving the contract is
   engine-neutral, not Spec-Kit-shaped) and the fast test suite.

`engine-adapters/speckit` is the **default engine** registered at composition time (FR-018); a
project inherits it unless it selects another (FR-019).

## SpecKitAdapter implementation notes

Per research R-001, **Spec Kit is not a callable generation API**. The `specify` CLI only scaffolds;
the `/speckit-*` commands are prompt templates executed by an AI coding agent. So
`generateSpecification` performs:

1. Create an ephemeral workspace directory; `git init`.
2. `specify init --here --force --integration claude --script sh --ignore-agent-tools`
3. Write the requirement set into the workspace as command input.
4. Invoke the AI coding agent CLI in headless mode with the `/speckit-specify` command.
5. Read back `specs/<feature>/spec.md`; parse; destroy the workspace.

All of it inside a container with hard CPU, memory, and wall-clock caps, a non-root user, a read-only
root filesystem apart from the workspace, and egress restricted to the AI provider endpoint (R-006).

**This is the largest single component in Phase 1.** It is a sandboxed execution runtime, not an
integration client — budget it accordingly.

## Contract test suite

One suite, run against **every** registered adapter including the fixture. An adapter is not
conformant until all pass.

| Test | Asserts |
|------|---------|
| Declares all three Phase 1 capabilities | E1 |
| Registration refused when a capability is missing, naming it | FR-021 |
| Valid input → `ok: true` with a populated descriptor | FR-022 |
| Empty requirement selection → `empty_selection`, no work started | E7 |
| Oversized input → `input_too_large` **before** starting | E7 |
| Cancellation mid-run → `cancelled`, no artifact | E4, E3 |
| Timeout exceeded → `timeout`, no artifact | E5, E3 |
| Unparseable output → `malformed_output`, no artifact | E6, E3 |
| Empty output → `empty_output`, never an empty specification | E6 |
| Engine unreachable → `engine_unavailable`, distinct from `engine_error` | FR-026 |
| Every finding carries a location | FR-023 |
| No temp files, processes, or containers survive any terminal outcome | E8 |
| Diagnostics contain no credentials | E9 |
