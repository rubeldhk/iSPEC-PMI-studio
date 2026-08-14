# Contract (DRAFT TARGET): ProjectExecutionEnvironment

**Epic**: `EPIC-027` | **Date**: 2026-08-13 | **Status**: 🟡 **DRAFT TARGET — not built, not agreed**

**Source**: Native Spec-Kit §4, §5, §19; Plan Amendment §7
**Decision that adopts or rejects it**: `D-21` — **the most time-critical decision in this epic**
**Research it depends on**: `R-AI-007`, `R-AI-009`, `R-AI-010`, `R-AI-011`

> **Why this one is urgent.** `T646` — the production `ContainerRuntime` — is the next task the
> EPIC-003 closure report recommends, and it is correct to recommend it: nothing in the programme has
> ever started a real container. Written as a Docker driver, it must later be refactored. Written
> against this port, Docker becomes a provider and the refactor never happens. **The difference is
> roughly one task.**

---

## What exists today

`engine-adapters/speckit/src/speckit.adapter.ts:66`:

```ts
export interface ContainerRuntime {
  start(options: {
    env: Record<string, string>;
    workspacePath: string;
    timeoutMs: number;
    signal: AbortSignal;
  }): Promise<SandboxSession>;
  stop(session: SandboxSession): Promise<void>;
}
```

**The shape is already right.** It is an injected port; the adapter's comment says why — *"so all
five steps, their ordering, and every failure path are unit-testable without Docker."* That
reasoning was about testability, and it happens to have produced exactly the seam the amendment
needs.

What it lacks is vocabulary. It cannot express lifecycle (ephemeral vs persistent), an egress policy,
a credential scope, or a provider capability — the four things Native §4, §5 and §19 require.

## What Native §4 requires

> *"Define a ProjectExecutionEnvironment abstraction capable of supporting: persistent VM, persistent
> development container, ephemeral container, Kubernetes workload, cloud development environment,
> future execution providers. PMI Studio business logic must not depend directly on Docker. Docker
> remains the Phase 1 execution provider unless another existing decision explicitly changes it."*

Both halves are satisfiable at once. That is the whole argument for `D-21`.

---

## Interface sketch

```ts
export type ExecutionLifecycle = 'ephemeral' | 'persistent';

export interface ExecutionEnvironmentDescriptor {
  readonly provider: string;                     // 'docker' | 'kubernetes' | 'cde' | 'fixture'
  readonly supportedLifecycles: readonly ExecutionLifecycle[];
  readonly supportsPersistentState: boolean;
  readonly supportsNetworkPolicy: boolean;
  readonly maxWallClockMs: number;
}

/** Named profile, never an ad-hoc list — Native §19. */
export interface EgressProfile {
  readonly name: 'generation' | 'implementation' | string;
  readonly allowedDestinations: readonly string[];
  readonly enforcement: 'network-policy' | 'proxy' | 'both';
}

export interface ExecutionRequest {
  readonly lifecycle: ExecutionLifecycle;
  readonly image: string;
  readonly env: Record<string, string>;
  readonly workspace: WorkspaceBinding;          // ephemeral scratch OR a persistent project ref
  readonly egressProfile: EgressProfile;
  readonly credentials: readonly ScopedCredentialRef[];   // refs, never values
  readonly resourceLimits: ResourceLimits;       // cpu · memory · pids · wall clock
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

export interface ProjectExecutionEnvironment {
  readonly descriptor: ExecutionEnvironmentDescriptor;

  start(request: ExecutionRequest): Promise<ExecutionSession>;
  stop(session: ExecutionSession): Promise<void>;      // idempotent; must not throw into a result
}
```

`ExecutionSession` keeps today's `SandboxSession` surface — `exec` · `writeFile` · `listFiles` ·
`readFile`. Nothing about it needs to change, and not changing it is what makes this a widening
rather than a replacement.

---

## The invariants this port must not break

### 1 · Everything `ADR-0002` asserts, unchanged for the `generation` profile

| Control | Status under this port |
|---|---|
| One environment per ephemeral execution, destroyed after | **Preserved** — `lifecycle: 'ephemeral'` |
| Non-root execution | **Preserved** — provider responsibility, asserted per provider |
| Read-only root filesystem except the scratch workspace | **Preserved** |
| CPU, memory, pid and wall-clock caps | **Preserved** — `ResourceLimits`, unchanged |
| Egress: AI provider endpoint only | **Preserved as the `generation` profile.** Its existing test asserts that profile and does not change |
| No platform credentials mounted | **Preserved and strengthened** — credentials are passed as refs, so a value cannot leak through the request object |
| Workspace never committed to any repository | **Preserved for ephemeral.** Persistent state is a *different binding*, not a relaxation |

**`ADR-0002` is extended, not superseded** (`D-36`). Native §27 permits superseding only *"with
documented reasoning"*, and there is none: every control above still applies to the case the ADR was
written for.

### 2 · Native §5's boundary is a mechanism, not a convention

> *"No sandbox state may implicitly become authoritative project state."*

This is the invariant most at risk once persistent state exists, because from inside a container the
two bindings look identical. `WorkspaceBinding` is therefore a **discriminated union**, not a path:

```ts
type WorkspaceBinding =
  | { kind: 'ephemeral'; scratchPath: string }
  | { kind: 'persistent'; projectRef: string; mode: 'read-only' | 'read-write'; branch: string };
```

A persistent binding always names a branch, and promotion to authoritative state always goes through
git or a governed lifecycle transition — never through the environment. **The type is what makes
"implicitly" impossible**: there is no binding that is persistent-and-unnamed.

### 3 · Business logic never names a provider

The third new dependency rule, asserted in `agent-independence.spec.ts`:

```text
any component  ──►  a container runtime directly     ❌ FORBIDDEN
any component  ──►  ProjectExecutionEnvironment      ✅
```

The Docker provider is registered at the worker composition root, exactly as engine adapters already
are. The pattern is proven in this repository; it is not being invented here.

---

## Egress profiles — `D-28`

Two profiles at Phase 1. The design point is that they are **named and enumerated**, so that
"implementation agents need more access" never becomes "widen the list".

| | `generation` | `implementation` |
|---|---|---|
| **Purpose** | Write a specification | Write and verify code |
| **Destinations** | AI provider endpoint only | AI provider · package registries · repository endpoints · approved MCP servers · documentation services |
| **Credentials** | AI provider token | AI provider token + per-run scoped repository token |
| **Repository writes** | None | Branch and pull request only — **never a protected branch** (Native §18) |
| **Status** | **Built and tested. Unchanged.** | New |

Native §19 states both halves of the instruction, and the second half is the one that gets forgotten:

> *"Re-evaluate the existing 'AI provider endpoint only' egress policy … **Do NOT simply open general
> internet access.** Design an explicit EgressPolicy abstraction / allow-list mechanism."*

**Not settled** (`R-AI-009`): the concrete destination list — registry hostnames vary by ecosystem
and by mirror — and whether enforcement is network policy, an auditing proxy, or both. A proxy is
what makes the policy *auditable* rather than merely *configured*, which Native §7's audit
requirements point toward. Recorded as a recommendation, not a verified design.

---

## Provider assessment

| Provider | Verdict | Note |
|---|---|---|
| **Docker** | ✅ **Phase 1**, mandated by Native §4 | Already designed, already tested against a mocked runtime |
| Kubernetes Jobs | Later | Natural second provider; matters only when hosting is decided (`D-31`) |
| Firecracker / gVisor | Deferred | `tech-stack.md` already records the trigger: *"revisit if untrusted third-party engines are ever registered"* |
| Cloud dev environments | Deferred | Fits Native §4's "persistent development container" and §21's interactive workspace |
| Agent-sandbox services (E2B, Modal) | Consistent with §2, rejected for Phase 1 | The amendment's own principle says buy commodity execution. Rejected only because `ADR-0002`'s isolation contract is already built and tested — a real trade-off, recorded rather than dismissed |

---

## What this contract does **not** decide

- **Where persistent project state physically lives** — `D-22`. Git remote is recommended; a managed
  volume is the alternative. The port takes a `projectRef`, which is deliberately opaque.
- **Credential minting and brokering** — `D-27`. The port takes refs; something must issue them.
- **Concurrency on one persistent project** — `R-AI-006`. Two runs on one project is the case nobody
  has thought through, and Spec Kit's feature numbering is not obviously safe under it.
- **Whether the interactive developer workspace (Native §21) uses this port** — probably yes, and it
  is one of the twelve ADRs Native §27 requires (`D-35`).
