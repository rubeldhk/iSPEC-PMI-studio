# Register: Preserved Elements

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

Changes to the sixteen elements Native §28 preserves (`FR-AMD-015`).

**All five fields are required and non-empty**, asserted by `G-27-12`. The migration cost and the
rejected alternative are exactly the two a motivated author omits, and they are the two that decide
whether the change was worth it.

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## Native §28 — four of sixteen touched, and the first one records that nothing changed

Native §28 names sixteen elements this programme must not invalidate without explicit justification,
and requires **five fields** on every proposed change: the reason, the affected requirement or
decision, the migration impact, the compatibility impact, and the alternative considered.
`G-27-12` asserts all five are non-empty on every row.

**The most important row is the first, and it records that nothing changed.** §28 exists to stop an
evolutionary amendment quietly becoming a rewrite, and the element most at risk was the one the
amendment did *not* touch: the `SpecificationEngine` contract. Native §3 forbids merging it with the
agent executor, so EPIC-028 added a second contract beside it.

## The twelve elements not touched at all

React · NestJS · TypeScript/Node · PostgreSQL · Prisma · Redis/Valkey abstraction · engine adapters ·
fixture adapter · worker composition root · workspace identity · append-only audit and version
history · existing traceability · architecture dependency tests · OpenTelemetry design.

`ADR-0003`'s stack is intact. The worker composition-root pattern was not merely preserved but
**applied twice more** — `agent-composition.ts` and `execution-composition.ts` are the same shape as
`engine-composition.ts`, which is the strongest available evidence the pattern was right.

## Register

| element | reason | affected_requirement | migration_impact | compatibility_impact | alternative_considered |
|---|---|---|---|---|---|
| SpecificationEngine contract | UNCHANGED. Native §3 forbids merging SpecificationEngine and AgentExecutor, so EPIC-028 added a SECOND contract beside it rather than widening the first | FR-017, FR-021, FR-022, ADR-0001 — all preserved; ADR-0001 extended in principle to agents, never superseded | None. Every existing caller compiles and passes unchanged, and engine-swap.spec.ts required no assertion change | None. A third-party engine adapter written against the EPIC-003 contract still registers and still runs | Widening SpecificationEngine with agentProvider, agentModel and an invokeAgent method. Rejected: it is precisely the merge Native §3 forbids, and would make every engine adapter carry AI-provider concerns |
| Docker isolation | WIDENED, not weakened. C-20 caught T646 about to hard-code Docker as the execution substrate, which Native §4 forbids; D-21 widened the port instead | ADR-0002 extended not superseded; FR-AGT-007, FR-AGT-009; decisions D-21, D-22, D-31 | SpecKitAdapterOptions.runtime became .environment; ContainerRuntime and SandboxSession deleted from the engine adapter and retained only as deprecated type aliases so existing tests compile. Six test files updated, no assertion weakened | STRENGTHENED. Every ADR-0002 control — non-root, read-only rootfs, single tmpfs writable path, cpu/memory/pid caps, CapDrop ALL, no-new-privileges, non-bridge network — is now an assertion that fails a build rather than a line in a manifest nothing read at runtime | Implementing Docker directly against the engine adapter ContainerRuntime, as T646 originally planned. Rejected by D-21: it would have made Docker the abstraction, and D-31 makes the second provider near-certainly Kubernetes |
| Sandbox credential model | UNCHANGED in use; the seam is prepared. aiProviderToken is still a single opaque string and still in use; ScopedCredentialRef is added to ExecutionRequest and is currently always empty | ADR-0002 (no platform credentials mounted — still true); decisions D-27, D-40, D-41 | None yet, and that is the point. ExecutionRequest.credentials is declared, validated and passed as an empty array. When the broker lands the call site changes and the contract does not | None. The generation egress profile and its test are frozen by committed content hash, and T549a asserts sandbox.json and sandbox-config.spec.ts are unchanged | Implementing the credential broker in EPIC-028. Rejected: D-27 names the model but R-AI-011 has never been verified against what GitHub, GitLab and Bitbucket support, and a broker built on an unverified delegation model is worse than none because it would be trusted |
| BullMQ asynchronous generation | UNCHANGED. Native §20 asks whether GenerationJob should become a more general ExecutionJob or AgentRun; D-25 kept BullMQ and put the run state machine in the database instead | FR-024 to FR-028; ADR-0003; conflict C-24; decision D-25 | None in this epic. GenerationJob to AgentRun is a schema change owned by EPIC-012, which is held. A run suspends by COMPLETING its queue job, so wall-clock timeout keeps meaning something | None. BullMQ is preserved exactly as Native §28 requires, and its timeout semantics stay meaningful because they apply per compute segment | Adopting Temporal for multi-step compensation. Rejected with a recorded trigger: revisit when more than one capability needs compensation, or when run duration routinely exceeds a day. Under D-31 it would also be a service PMI Studio operates |
