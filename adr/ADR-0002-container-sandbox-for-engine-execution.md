# ADR-0002 — Container sandbox for engine execution

**Status**: Accepted
**Date**: 2026-08-02 (recorded as an ADR 2026-08-03)
**Deciders**: Tech lead

## Context

Per ADR-0001 and research R-001, generating a specification means running an **AI coding agent**
inside a scaffolded workspace. The agent writes files and executes commands — that is its purpose,
not a misuse of it.

Running that in the platform's own process would make generation a remote code execution path into
the platform. PMI-DOC-003 later stated the principle directly: *"Treat AI agents as governed
services, not autonomous authorities."*

The run is also unbounded in time and cost. An AI agent has no natural stopping point, and each run
is metered spend.

## Decision

Every generation job runs in a **short-lived Docker container** built from a purpose-made engine
image containing the `specify` CLI, the AI agent CLI, and git.

Controls:

| Control | Purpose |
|---|---|
| One container per job, destroyed after | No state leaks between jobs or tenants |
| Non-root user | Limits in-container escalation |
| Read-only root filesystem except the scratch workspace | Agent cannot modify its own tooling |
| CPU, memory, and wall-clock caps | Enforces FR-025; bounds runaway cost |
| Egress allow-list: AI provider endpoint only | Agent cannot reach the platform, the database, or the internet |
| No platform credentials mounted | Agent holds AI provider credentials only |
| Workspace never committed to any repository | Generated scaffolding cannot be mistaken for platform code |

## Consequences

**Positive**

- Timeout (FR-025), clean-state-on-failure (FR-027), and the failure taxonomy (FR-026) become
  enforceable — killing a container is reliable in a way that killing a rogue in-process task is not.
- Resource caps are simultaneously a safety control and a cost control (RAID R-02).

**Negative**

- Docker Engine becomes a hard prerequisite on every worker host (RAID D-D).
- Container-in-container execution complicates CI, mitigated by testing against the fixture adapter
  and running the real engine only nightly (R-010).
- Correlation identifiers must cross a deliberately locked-down boundary — the hardest part of the
  observability work adopted in D-7 (see PC-3).

**Rejected alternatives**

- *Same-host subprocess* — no blast-radius containment, no reliable timeout enforcement.
- *Firecracker / gVisor microVMs* — stronger isolation, more operational weight than Phase 1
  warrants. Revisit if untrusted third-party engines are ever registered.

## Traceability

- Requirements: FR-024 to FR-028
- Research: R-001, R-006
- Principles: PP-003, PP-008; Architecture Implications
- Risks: RAID R-02, R-06
- Tasks: T086–T092, T044, T045
