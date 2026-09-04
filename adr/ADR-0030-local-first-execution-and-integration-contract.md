# ADR-0030 — Local-first execution and the PMI integration contract

**Status**: Accepted
**Date**: 2026-09-03
**Deciders**: Project Owner (product direction, `D-47`) · Tech lead (architecture)

> Created by **EPIC-041 `/speckit-plan`** under decision `D-47` (PMI-DOC-007 v1.0, approved
> 2026-09-03). PMI-DOC-007 §9.1 drafted this record; the plan step ratifies it.

## Context

The delivered platform has one way to run a governed Spec Kit command: PMI Studio starts a
disposable container, holds the AI credential, runs the agent headlessly inside it, and parses the
result back into PostgreSQL (`ADR-0002`, `ADR-0009`). The workspace is a memory-backed scratch
area, destroyed when the run ends.

The Project Owner's restated objectives of 2026-09-03 (PMI-DOC-004B §1) require the opposite: the
**user's own agent** runs the commands, in a **real directory on the user's machine**, and PMI
Studio supplies the inputs, receives the events and shows the journey. Verification found nine of
ten objectives unmet, and every one traced to the execution model (PMI-DOC-004B §3).

The corpus had already half-said this. Constitution XII: *"execute anywhere through an approved
integration; govern, record and trace everything in PMI Studio."* `ADR-0024` admitted controlled
local as a fabric mode — and made it `MAY`. `ADR-0017` called the interactive workspace *"exactly
this objective… unowned and unspecified."* `ADR-0010` designed an MCP surface with no code.

## Decision

**Controlled-local is the default execution mode.** Three consequences follow, and each is a
boundary the platform now keeps:

1. **The project directory is the durable substrate for artifact content; PMI Studio is the durable
   substrate for status, decisions and evidence** (PMI-DOC-007 §2.3). Neither restates the other.
   In local mode `ADR-0009`'s *"volumes are cache only"* does not apply — the directory and its git
   repository are the thing itself, not a cache of it.
2. **The platform never runs the agent in local mode.** It provisions the directory
   (`EPIC-041`), supplies requirements, constitution and policy through a contract (`EPIC-042`,
   `EPIC-043`), and records what the agent reports. What it does not do is hold the user's AI
   credential or start the user's agent.
3. **Agents reach PMI Studio only through the integration contract** — `EPIC-037`'s execution
   contract plus the read and sync tools of PMI-DOC-007 §4 — **authenticated by a project-scoped
   connector credential** (`EPIC-041`), never by writing to a table (Constitution XII.7,
   `BR-0201`). The credential resolves to a non-human `Principal` (`D-46`), so *who is acting* has
   one answer across humans, agents and connectors.

**Assurance is recorded, not hidden.** Every execution carries `assurance: managed | local`,
derived from the surface it arrived through, never supplied by the caller. This closes
`ADR-0024`'s open item with one field and two values (PMI-DOC-007 `D-9`).

**The managed sandbox is retained as an optional mode.** `ADR-0002` and `ADR-0013` stand; the
Docker provider is unchanged; unattended runs (`EPIC-023`) keep it. No objective requires it.

## Consequences

**Positive** — the delivered Rooms, execution registry and application shell become the product
rather than a parallel product: they are what the local agent's events land in.

**Positive** — the 20 % human work of the Owner's method concentrates in one place: the wiring
repairs `EPIC-041` makes as its Foundational phase. Everything else the replan adds is skills,
templates and contracts.

**Positive** — provider independence is strengthened, not weakened: any agent Spec Kit supports can
run in the directory, because the platform never names one at run time.

**Negative** — a developer machine offers weaker isolation than a disposable container. This is
stated in `ADR-0024` and accepted for the target user; the mitigations are the project-scoped
credential, the assurance label, Constitution XII.6's prohibition on AI self-approval, and secret
refusal at intake (`FR-EXR-022`).

**Negative** — "identical governance across modes" is now tested against the mode the product
actually runs in, and the sandbox mode risks becoming the one nobody exercises. The conformance
suite for execution providers is what keeps it honest.

**Negative** — the containerised application stack runs no worker, so a project provisioned under
it stays *initialisation pending* until the setup skill completes it on the user's machine
(`EPIC-041` `R-041-1`). That is the clarified behaviour, recorded rather than smoothed over.

## Traceability

PMI-DOC-007 v1.0 §1, §2, §9.1 · PMI-DOC-004B §3 · `D-47` · Constitution XII ·
`BR-0132`, `BR-0133`, `BR-0201` · `ADR-0002` (retained) · `ADR-0009` (amended 2026-09-03) ·
`ADR-0010` (closes with `EPIC-043`) · `ADR-0014` (extended by PMI-DOC-007 §2.3) · `ADR-0017`
(owned by `EPIC-041`) · `ADR-0024` (amended 2026-09-03) · `EPIC-041` · `EPIC-042` · `EPIC-043`
