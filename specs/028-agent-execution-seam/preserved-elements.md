# Preserved Elements — Native §28 change record

**Epic**: `EPIC-028` | **Requirement**: `FR-AMD-015` | **Check**: `G-28-02` (`T589`) | **Version**: 1

Native Spec-Kit §28 names sixteen elements this programme must not invalidate without explicit
justification, and requires that **every proposed change to one of them record five fields**: the
reason, the affected existing requirement or decision, the migration impact, the compatibility
impact, and the alternative considered.

This epic touches three of the sixteen. Each row below carries all five fields; `T589` fails if any
is empty, because a change recorded without its consequences is a change nobody weighed.

**The most important row is the first one, and it records that nothing changed.** Native §28's
purpose is to stop an evolutionary amendment quietly becoming a rewrite, and the element most at
risk here was the one this epic did *not* touch.

---

## PE-01 · `SpecificationEngine` contract — **UNCHANGED**

| Field | Record |
|---|---|
| **Change** | **None.** The interface, its failure taxonomy, its descriptor and its registration rules are byte-for-byte what EPIC-003 shipped |
| **Reason** | Native §3 forbids merging `SpecificationEngine` and the agent executor: *"They represent different abstractions."* This epic adds a **second** contract beside it rather than widening the first. The engine still answers *how PMI Studio does specification-driven engineering*; the agent contract answers *which AI capability does the reasoning* |
| **Affected requirement / decision** | `FR-017`, `FR-021`, `FR-022`, `ADR-0001`. All preserved; `ADR-0001` is **extended in principle to agents**, not superseded |
| **Migration impact** | **None.** Every existing caller of `SpecificationEngine` compiles and passes unchanged. `engine-swap.spec.ts` — EPIC-003's `SC-008` acceptance test — required no assertion change |
| **Compatibility impact** | **None.** A third-party engine adapter written against the EPIC-003 contract still registers and still runs |
| **Alternative considered** | Widening `SpecificationEngine` with agent fields — `agentProvider`, `agentModel`, an `invokeAgent` method. **Rejected**: it is precisely the merge Native §3 forbids, and it would have made every engine adapter carry AI-provider concerns it has no business knowing |

---

## PE-02 · Docker isolation — **WIDENED, not weakened**

| Field | Record |
|---|---|
| **Change** | `ContainerRuntime`, declared *inside* `engine-adapters/speckit/src/speckit.adapter.ts`, becomes `ProjectExecutionEnvironment` in `@pmi/execution-contract`. Docker becomes a **provider behind that port** (`execution-providers/docker`) rather than the abstraction itself |
| **Reason** | Conflict `C-20`: `T646` was about to hard-code Docker as *the* execution substrate, which Native §4 forbids — business logic must not depend directly on Docker. Decision `D-21` widened the port instead. Docker remains the Phase 1 provider, which is what Native §4 asks for |
| **Affected requirement / decision** | `ADR-0002` (**extended, not superseded** — every control it names is now asserted field-by-field in CI by `T570`, which was never previously possible), `FR-AGT-007`, `FR-AGT-009`, decisions `D-21`, `D-22`, `D-31` |
| **Migration impact** | `SpecKitAdapterOptions.runtime` → `.environment`; the local `ContainerRuntime` and `SandboxSession` declarations are deleted and retained only as deprecated type aliases so existing tests compile. Six test files updated, no assertion weakened. `ExecutionSession` is deliberately **identical in shape** to the `SandboxSession` it replaces |
| **Compatibility impact** | **Strengthened.** Every `ADR-0002` control — non-root user, read-only rootfs, single tmpfs writable path, cpu/memory/pid caps, `CapDrop: ALL`, `no-new-privileges`, non-`bridge` network — is now an assertion that fails a build rather than a line in a JSON manifest nothing read at runtime. The threat model is unchanged; its enforcement is testable for the first time |
| **Alternative considered** | Implementing Docker directly against the engine adapter's own `ContainerRuntime`, as `T646` originally planned. **Rejected** by `D-21`: it would have made Docker the abstraction, and `D-31` (multi-tenant SaaS) makes the second provider near-certainly Kubernetes — a sibling registration under the port, a rewrite without it |

---

## PE-03 · Sandbox credential model — **UNCHANGED HERE, and the seam is prepared**

| Field | Record |
|---|---|
| **Change** | `aiProviderToken: string` on `SpecKitAdapterOptions` is **unchanged and still in use**. `ScopedCredentialRef[]` is added to `ExecutionRequest` and is currently always empty |
| **Reason** | Decision `D-27` supersedes the single opaque token with per-run minted, purpose-scoped, short-lived credentials — but the broker that mints them does not exist, and `R-AI-011` (secure git credential delegation) is **uninvestigated**. Shipping the *type* without the mechanism keeps the seam reachable; shipping a half-built broker would put a credential path into production on an unverified model |
| **Affected requirement / decision** | `ADR-0002` (*"no platform credentials mounted; the agent holds AI provider credentials only"* — still true), decisions `D-27`, `D-40`, `D-41` (BYOK) |
| **Migration impact** | **None yet, and that is the point.** `ExecutionRequest.credentials` is declared, validated (`T580`: a ref without `expiresAt` is rejected, `env` is scanned for secret values, an unresolvable ref fails the run **before any container starts**) and passed as an empty array. When the broker lands, the call site changes and the contract does not |
| **Compatibility impact** | **None.** The `generation` egress profile and its test are frozen and untouched — `T549a` asserts `sandbox.json` and `sandbox-config.spec.ts` are unchanged from `main` by content hash. `SC-AGT-005` exists precisely to prove which half of the security boundary this epic did *not* touch |
| **Alternative considered** | Implementing the credential broker in this epic. **Rejected**: `D-27` names the model but `R-AI-011` has never been verified against what GitHub, GitLab and Bitbucket actually support. A broker built on an unverified delegation model is worse than no broker, because it would be trusted |

---

## What this epic did NOT touch

Recorded because Native §28's list is the thing a reader checks, and an absence is only reassuring
if someone looked:

React · NestJS · TypeScript · PostgreSQL · Prisma · BullMQ · Redis/Valkey · the worker composition
root pattern · workspace identity · append-only audit · traceability · architecture tests ·
OpenTelemetry — **all unchanged.** `ADR-0003`'s stack is intact.

The worker composition root pattern is not merely unchanged but **applied twice more**:
`agent-composition.ts` and `execution-composition.ts` are the same shape as `engine-composition.ts`,
which is the strongest available evidence the pattern was the right one.
