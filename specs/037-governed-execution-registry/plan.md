# Implementation Plan: Governed Execution Registry

**Epic**: `EPIC-037` | **Branch**: `037-governed-execution-registry` | **Date**: 2026-08-25

**Spec**: [spec.md](./spec.md) · **Input**: Step C1 authorisation, Constitution XII, PMI-DOC-004 §6.22

## Summary

Make PMI Studio the system of record for governed Spec Kit executions wherever they run. One
provider-neutral semantic contract, three transport bindings, an append-only event stream as the
only authority, and projections that are explicitly derived. The Epic delivers the **thin
foundation** first — registration, immutable events, completion, phase-aware target binding, status
proposals, comments, evidence linking, and a fixture connector that round-trips one execution end to
end. Additional connectors and advanced reconciliation follow by dependency.

## Technical Context

**Language/Version**: TypeScript 5.7 · Node 22

**Primary Dependencies**: NestJS 10 (`@nestjs/platform-express`) · Prisma 5 · PostgreSQL 16 ·
MCP (specification 2025-11-25) · Vitest 2.1

**Storage**: PostgreSQL 16. Append-only enforced **in the database**, reusing the existing
`reject_mutation()` trigger already applied to `audit_entries`, `requirement_versions`,
`specification_*` and `lifecycle_transitions`.

**Testing**: Vitest projects — `backend-unit`, `backend-contract`, `backend-integration`,
`architecture`, `governance`

**Target Platform**: Linux container (the EPIC-014 stack) and local development

**Project Type**: Web application — backend service plus a connector SDK package. **No frontend work
in this Epic.**

**Performance Goals**: History queries bounded and paginated by default; a registration is one write
plus one event append.

**Constraints**: No connector may import a data-access module (`FR-EXR-019`, enforced by an
architecture test). No `PATCH` in the surface. No destructive migration.

**Scale/Scope**: 22 functional requirements, 10 success criteria, 5 user stories, 6 connector types,
29 event types across 4 classes.

**Docs consulted**:
- **MCP** — `/websites/modelcontextprotocol_io_specification_2025-11-25`, *server tools: input and
  output schema, structured content, error results*. Confirms `outputSchema` (JSON Schema 2020-12,
  object at root), `structuredContent` alongside a text fallback, and that **tool-execution
  refusals use `isError: true`** rather than a JSON-RPC error. This decides how a refused
  registration surfaces on the MCP binding — see `R-037-7`.
- **NestJS / Prisma / PostgreSQL** — no external query needed. Every pattern this Epic uses already
  exists in the repository: the `reject_mutation()` trigger, the module/composition-root shape, and
  the `engine-contract` package layout. Reusing an in-repo pattern is stronger evidence than a
  documentation snippet, and `R-037-2` records the specific precedent.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code produced only via Spec Kit commands | **PASS** — this plan is the output of `/speckit-plan`; no code written yet |
| II | Every requirement traces to a cited `SRS/` document | **PASS** — 13 traced sources; "not yet covered by SRS: none" |
| III | Epic → Feature → Task; `specs/037-*/` exists | **PASS** |
| IV | `/speckit-converge` scheduled as the exit gate | **PASS** — Phase Z |
| V | Every implementation task carries a test written to fail first | **PASS** — planned per task; contract tests precede handlers |
| VI | `specs/037-*/defects/` is the sole defect intake | **PASS** — created in Phase 1 |
| VII | local → dev → stage → prod, no skipping | **PASS** — this Epic delivers to `local` only |
| VIII | Session labelled with the working Epic | **PASS** — `EPIC-037 Governed Execution Registry` |
| IX | Every stop ends with an executable next action | **PASS** |
| X | Decision questions batched | **PASS** — clarify escalated **zero**; seven resolved from architecture |
| XI | Tier 1 real entry point; Tier 2 transcript for a journey | **PASS** — Tier 1 via HTTP routes against the composed graph. **Tier 2 not applicable**: this Epic delivers no user-facing journey; its screens belong to EPIC-031/033/036. Recorded rather than omitted |
| XII | Every governed command registered; append-only; phase-aware binding; platform-adjudicated status | **PASS** — this Epic *is* the mechanism. Until it lands, its own commands are answered "records pending EPIC-037", never PASS by omission |
| — | Repository synced before work started | **PASS** |
| — | No other session active on this checkout | **PASS** |

**Post-Phase-1 re-evaluation**: re-checked after the data model and contracts below. No gate
changed. The one that moved closest to failing is **XI**, and it is recorded as *not applicable at
Tier 2 with a reason* rather than passed silently.

## Project Structure

### Documentation (this feature)

```text
specs/037-governed-execution-registry/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── execution-contract.md      # the semantic contract, transport-neutral
│   ├── event-vocabulary.md        # 29 events, 4 classes, one meaning each
│   └── state-machines.md          # the three machines
├── checklists/requirements.md
└── defects/
```

### Source Code (repository root)

```text
packages/execution-contract/       # NEW — semantic contract + types + fixture connector
  src/
  tests/

backend/src/modules/executions/    # NEW — registry module
  executions.controller.ts         # REST binding
  execution-registration.service.ts
  execution-event.service.ts       # append + sequence allocation
  execution-projection.service.ts  # derived state, rebuildable
  execution-comment.service.ts
  execution-target.service.ts      # phase-aware binding
  status-proposal.service.ts       # records proposals; EPIC-030 adjudicates
  reconciliation.service.ts
  executions.store.ts

backend/prisma/migrations/         # NEW, additive only
backend/tests/{unit,contract,integration}/executions/
tests/architecture/                # connector isolation check
```

**Structure decision**: a new `packages/execution-contract` mirrors the existing
`packages/engine-contract`, which is the shape that keeps PC-1/PC-2 honest today. The contract
package holds no transport and no data access, so a connector can depend on it without being able to
reach the database — the property `FR-EXR-019` asserts and an architecture test enforces.

## Phase 0 — Research

See [research.md](./research.md) for the ten decisions, their rationale and rejected alternatives.
Summary of what was decided:

| ID | Decision |
|---|---|
| `R-037-1` | Event sourcing with a derived projection, not a mutable row with an audit side-table |
| `R-037-2` | Immutability enforced by the existing `reject_mutation()` database trigger, not by application discipline |
| `R-037-3` | Server-allocated gapless sequence with `expectedSequence` optimistic concurrency |
| `R-037-4` | Phase-aware target binding as one table with an `input`/`output` discriminator |
| `R-037-5` | Proposals immutable; adjudication expressed only as events; state projected |
| `R-037-6` | New tables only; `Run` and `AuditEntry` gain one optional reference each |
| `R-037-7` | MCP refusals use `isError: true` with `structuredContent`, not JSON-RPC errors |
| `R-037-8` | Idempotency key unique per workspace, not global |
| `R-037-9` | Redaction retains the original under a compliance role; crypto-erasure is the legal exception |
| `R-037-10` | Fixture connector ships in the contract package and is the conformance oracle |

## Phase 1 — Design & Contracts

- **[data-model.md](./data-model.md)** — 10 entities, their fields, relationships and the three
  state machines' persistence.
- **[contracts/execution-contract.md](./contracts/execution-contract.md)** — the semantic contract
  and its REST, MCP and SDK bindings with a parity table.
- **[contracts/event-vocabulary.md](./contracts/event-vocabulary.md)** — 29 events, one unambiguous
  meaning each, with the payload each carries and which class it belongs to.
- **[contracts/state-machines.md](./contracts/state-machines.md)** — execution lifecycle,
  status-transition governance, and execution registration/governance state.
- **[quickstart.md](./quickstart.md)** — runnable validation scenarios `V37-1` … `V37-10`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| A new package (`packages/execution-contract`) | Connectors must depend on the contract without being able to reach data access | Putting the contract inside `backend/src` would let any connector import a store; the isolation would then rest on review rather than on the module graph |
| Event sourcing rather than a status column | `BR-0197` requires immutable authoritative history, and governance continues after execution ends | A mutable row plus an audit table was rejected in Rev 2 review: it makes the mutable row authoritative and the audit advisory, which is the audit hole the Epic exists to close |
| Three state machines rather than one | Lifecycle terminates; governance does not; registration state is orthogonal to both | One machine could not express "completed, awaiting approval three days later", which is the normal case |
