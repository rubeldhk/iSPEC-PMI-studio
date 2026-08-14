# Contract: ProjectExecutionEnvironment

**Epic**: `EPIC-028` | **Date**: 2026-08-14 | **Status**: ✅ **IMPLEMENTATION CONTRACT**

**Package**: `packages/execution-contract` | **Providers**: `execution-providers/docker`

**Supersedes**: [`027-ai-native-amendment/contracts/project-execution-environment.md`](../../027-ai-native-amendment/contracts/project-execution-environment.md)
— a draft target for decision `D-21`. This is what gets built.

**Source**: Native Spec-Kit §4, §5, §19 | **Requirements**: `FR-AGT-006`–`011`

---

## What moves, and why that is the whole point

`ContainerRuntime` is declared **inside** `engine-adapters/speckit/src/speckit.adapter.ts` at line 66.
That placement is why nothing else can use it, and why implementing it there would make Docker the
abstraction rather than a provider.

The port's *shape* is already right — the adapter's own comment explains that it exists *"so all five
steps, their ordering, and every failure path are unit-testable without Docker."* That reasoning was
about testability and happens to have produced exactly the seam `D-21` needs. **This contract widens
it and moves it out.** Nothing about `SandboxSession` changes, which is what makes this a widening
rather than a replacement.

## Interface

```ts
export type ExecutionLifecycle = 'ephemeral' | 'persistent';

export interface ExecutionEnvironmentDescriptor {
  readonly provider: string;
  readonly supportedLifecycles: readonly ExecutionLifecycle[];   // non-empty
  readonly supportsPersistentState: boolean;
  readonly supportsNetworkPolicy: boolean;
  readonly maxWallClockMs: number;
}

export type WorkspaceBinding =
  | { kind: 'ephemeral';  scratchPath: string }
  | { kind: 'persistent'; projectRef: string; mode: 'read-only' | 'read-write'; branch: string };

export interface EgressProfile {
  readonly name: string;
  readonly allowedDestinations: readonly string[];   // never a wildcard
  readonly enforcement: 'network-policy' | 'proxy' | 'both';
}

export interface ScopedCredentialRef {
  readonly id: string;
  readonly purpose: 'ai-provider' | 'repository';
  readonly scope: string;
  readonly expiresAt: string;        // required — a ref without an expiry is invalid
}

export interface ExecutionRequest {
  readonly lifecycle: ExecutionLifecycle;
  readonly image: string;
  readonly env: Record<string, string>;          // never a secret value
  readonly workspace: WorkspaceBinding;
  readonly egressProfile: EgressProfile;
  readonly credentials: readonly ScopedCredentialRef[];
  readonly resourceLimits: ResourceLimits;       // cpu · memory · pids · wallClockMs
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

/** Unchanged from today's SandboxSession — deliberately. */
export interface ExecutionSession {
  exec(command: readonly string[]): Promise<ExecResult>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<string>;
}

export interface ProjectExecutionEnvironment {
  readonly descriptor: ExecutionEnvironmentDescriptor;
  start(request: ExecutionRequest): Promise<ExecutionSession>;
  /** Idempotent. Must never throw into a result. */
  stop(session: ExecutionSession): Promise<void>;
}
```

## Validation rules — the ones that carry weight

Each is a refusal at registration or at `start`, and each has a test that can fail.

| Rule | Why |
|---|---|
| A provider with `supportsNetworkPolicy: false` **cannot accept any egress profile** | Otherwise a security control silently does nothing — the exact failure `ADR-0002` exists to prevent |
| `allowedDestinations` rejects `*`, `0.0.0.0/0`, `::/0` and any general-internet form | Native §19: *"Do NOT simply open general internet access"* — `FR-AGT-011` |
| `allowedDestinations` must be non-empty | An empty list reads as "no restriction" to a careless implementation |
| A `persistent` binding **must** name a branch | Native §5's invariant, made structural — see below |
| A provider not declaring `persistent` refuses that binding, naming the reason | Docker Phase 1 declares `ephemeral` only |
| Every `ScopedCredentialRef` must carry `expiresAt` | `D-27`: nothing long-lived enters a sandbox |
| `env` is asserted to contain no value matching a credential | A ref that gets flattened into an env var defeats the whole type |

### The union is the mechanism, not the convention

> *"No sandbox state may implicitly become authoritative project state."* — Native §5

From inside a container, an ephemeral scratch directory and a persistent project checkout look
identical. The discriminated union makes the dangerous state unrepresentable: **there is no binding
that is persistent and unnamed.** A persistent binding always carries a branch, so promotion always
goes through git — which is what `D-29` requires, and `D-22` makes the git remote the durable
substrate.

## Egress profiles — Phase 1

| | `generation` | `implementation` |
|---|---|---|
| Destinations | AI provider endpoint only | **AI provider endpoint only, for now** |
| Status | **Frozen constant.** `SC-AGT-005` asserts byte-for-byte equality with `ADR-0002`; its existing test runs unmodified | Mechanism built, list deliberately minimal |
| Enforcement | `network-policy` (Docker) | `network-policy` (Docker); `proxy` recorded as intent |

**The `implementation` profile ships with one destination on purpose** (`R-028-6`). Registry hostnames
vary by ecosystem, mirror and tenant; a plausible-looking npm/PyPI/GitHub list would be untested, would
read as authoritative, and the first real implementation agent would inherit it as settled. A
one-destination profile still proves the abstraction and still fails loudly rather than permitting
silently.

**The proxy is not built here.** `enforcement` records `D-28`'s intent; the Docker provider implements
the network-policy half. The gap is recorded rather than hidden.

## `ADR-0002` — extended, never superseded

Every control, and what happens to it:

| Control | Under this contract |
|---|---|
| One environment per ephemeral execution, destroyed after | Preserved — `lifecycle: 'ephemeral'` |
| Non-root execution | Preserved — provider responsibility, asserted per provider |
| Read-only root filesystem except scratch | Preserved |
| CPU, memory, pid, wall-clock caps | Preserved — `ResourceLimits`, unchanged |
| Egress: AI provider endpoint only | Preserved **as the `generation` profile**, with its test unmodified |
| No platform credentials mounted | Preserved and **strengthened** — credentials are refs, so a value cannot leak through the request |
| Workspace never committed | Preserved for ephemeral. Persistent is a different binding, not a relaxation |

Native §27 permits superseding an ADR only *"with documented reasoning"*, and there is none: every
control still applies to the case the ADR was written for. `D-36` recorded this; the contract enforces
it.

## Provider: Docker (Phase 1)

Native §4 names it: *"Docker remains the Phase 1 execution provider."*

Talks to the Engine HTTP API over the unix socket — **no `dockerode`, no `docker` CLI** (`R-028-1`).
Six endpoints; `ADR-0002`'s controls are daemon flags set directly on the create call, so there is no
translation layer between the security contract and its enforcement.

**`T447` is split** (`R-028-2`): `T447a` asserts request construction, flag presence, failure mapping,
cancellation and teardown idempotence against a mocked daemon in CI. `T447b` is a **manual, recorded**
run — RAID **R-04** means container-in-container is unavailable in CI, and EPIC-003 has already
demonstrated what happens when a component is signed off on mocked evidence alone.

## Not in this contract

| Not here | Where |
|---|---|
| Persistent-workspace implementation | EPIC-029 — the type ships, nothing persists it |
| Credential minting / brokering | `D-27` decided the model; `R-AI-011` uninvestigated, no vendor mechanism verified |
| The egress proxy | Recorded as `enforcement` intent; needs an owning epic |
| Kubernetes, CDE, Firecracker providers | Later. The port is what makes them a swap |
| Concurrency on one persistent project | `R-AI-006` — nobody has thought it through, and Spec Kit's feature numbering is not obviously safe under it |
