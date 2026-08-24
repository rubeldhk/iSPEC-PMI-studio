---

description: "Task list for EPIC-032 Evidence Store & Evidence Contracts"
---

# Tasks: Evidence Store & Evidence Contracts

**Epic**: `EPIC-032`

**Input**: Design documents from `/specs/032-evidence-store-contracts/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/evidence-contract.md](./contracts/evidence-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code names its
test, written FIRST and failing before the implementing code. The `/speckit-tasks` skill describes
tests as optional; **the constitution overrides it**.

**Non-code outputs count too** (Constitution V, v1.2.0). This Epic's non-code outputs are the
**Evidence Contract definitions** under `packages/evidence-contract/contracts/`; their executable
conformance check is `T856p`, written failing-first, and `T856q` makes the definitions pass it.

**Organization**: grouped by the five user stories of [spec.md](./spec.md).

## ⚠ Task identifier scheme — read before adding a task

**83 tasks on the block `T855`–`T864`, one base identifier per phase, suffixed within it.** (81
originally; `T857h` and `T859k` added 2026-08-22 to close analysis findings `C1` and `C2`.)
`T855a`–`T855e` is Phase 1, `T856a`–`T856s` is Phase 2, and so on. The governance regex is
`T\d{3}[a-z]?\b`, so every one of these is a distinct, valid identifier.

**This is not a stylistic choice. The corpus has nearly run out of three-digit identifiers.**
Counted across `main` and every Wave 1 branch: **977 of 999 prefixes are in use, 22 remain, and the
longest contiguous free run is ten** — which is this block. A flat allocation for this Epic was not
available, and will not be available for `EPIC-033`, `EPIC-034` or `EPIC-035`.

**This needs a decision that is not this Epic's to take** — see Notes. `T863j` hands it over.

**Before starting**: sync from GitHub, and **work in a dedicated worktree** at
`.claude/worktrees/epic-032-evidence-store-contracts` — the plan records the concurrent-session gate
as **FAIL** and `T855a` is its discharge. Label the session `EPIC-032 Evidence Store & Contracts`.

**Before finishing**: close with a report (Constitution IX). The Delivery Board is **stale**.

**Interaction budget** (Constitution X): implementation is an execution phase — run without pausing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5
- Exact file paths in every description

## Two senses of "contract" — both correct, kept apart

`packages/evidence-contract` is an **interface contract** package, named for the
`engine-contract`/`agent-contract` family. `EvidenceContract` is a **domain entity**: the
required-evidence set `BR-0142` names. They are different things and both keep their names —
**Constitution II, the SRS wins**, and `BR-0142` calls it an Evidence Contract.

So in this Epic, write **the `evidence-contract` package** or **an Evidence Contract**, never bare
*"the evidence contract"*. *(Analysis finding `I1`, 2026-08-22 — the first recommendation was to
rename the entity, which would have put the code out of step with the requirement that names it.)*

## Path Conventions

- Contract package: `packages/evidence-contract/`
- Store and gate: `backend/src/modules/evidence/`
- Tests: `packages/evidence-contract/tests/`, `backend/tests/{unit,integration,architecture}/`

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T855a Create the worktree `git worktree add .claude/worktrees/epic-032-evidence-store-contracts epic/032-evidence-store-contracts` and work there — discharges the plan's one failing Constitution gate, the `EPIC-030` precedent
- [ ] T855b [P] Scaffold `packages/evidence-contract/package.json` and `packages/evidence-contract/tsconfig.json` so the package typechecks independently (`TS-004`)
- [ ] T855c [P] Register an `evidence-contract` project in `vitest.workspace.ts` without `passWithNoTests` (`TS-005`)
- [ ] T855d [P] Add `packages/evidence-contract` to the `## Paths that must not break` list in `governance/repository-layout.md` (`G-05d`)
- [ ] T855e Confirm `supertest` is present from `EPIC-030` `T916`/`T917`; if that branch has not merged, add it with its `TS-001` register entry in `specs/_shared/dependencies.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: no user story phase may start until this completes

### The attestation envelope — adopted from in-toto, `R-032-1`

- [ ] T856a [P] Write failing unit tests for the Statement types in `packages/evidence-contract/tests/attestation.spec.ts` — asserts `subject` is a **non-empty tuple**, so an attestation with no subject digest is a compile error and not merely a runtime refusal (`FR-EVS-042`)
- [ ] T856b Implement `Attestation` and `AttestationSubject` in `packages/evidence-contract/src/attestation.ts` (unit test: T856a) — `FR-EVS-011`, `FR-EVS-013`
- [ ] T856c [P] Write failing unit tests for the predicate registry in `packages/evidence-contract/tests/predicates.spec.ts` — standard in-toto and SLSA URIs are distinguishable from PMI-defined ones, so a future standard predicate can replace a PMI one without the gate changing
- [ ] T856d Implement the `predicateType` registry in `packages/evidence-contract/src/predicates.ts` (unit test: T856c) — `FR-EVS-003`, covering all nine `BR-0140` kinds

### The Evidence Contract and the gate result

- [ ] T856e [P] Write failing unit tests for the Contract types in `packages/evidence-contract/tests/contract.spec.ts` — asserts `ContractItem` has **no `met` field**, `acceptingPredicateTypes` is non-empty, and `zeroItemPolicyRef` is required when `items` is empty (`FR-EVS-025`, `FR-EVS-026`)
- [ ] T856f Implement `EvidenceContract` and `ContractItem` in `packages/evidence-contract/src/contract.ts` (unit test: T856e) — `FR-EVS-020`
- [ ] T856g [P] Write failing unit tests for the gate result in `packages/evidence-contract/tests/gate.spec.ts` — asserts `CompletionResult`'s failure branch carries a **non-empty** `unmet` list, and that four `ItemState` members exist with three of them not `met`
- [ ] T856h Implement `ContractStatus`, `ItemState` and `CompletionResult` in `packages/evidence-contract/src/gate.ts` (unit test: T856g) — `FR-EVS-032`, `FR-EVS-014`, `FR-EVS-034`
- [ ] T856i [P] Write failing unit tests for the three ports in `packages/evidence-contract/tests/ports.spec.ts` — each declares an absent-behaviour of refuse
- [ ] T856j Implement `EvidenceStorage`, `AccessPolicy` and `AttestationSource` in `packages/evidence-contract/src/ports.ts` (unit test: T856i) — `FR-EVS-035`, `FR-EVS-015`, `FR-EVS-040`
- [ ] T856k Implement the export barrel `packages/evidence-contract/src/index.ts` (unit test: T856a)

### Binding to EPIC-025 storage — the adapter EPIC-031 forgot

- [ ] T856l [P] Write failing unit tests for the storage adapter in `backend/tests/unit/evidence-storage-adapter.spec.ts` — binds `EvidenceStorage` to `EPIC-025`'s `StorageProvider`, and maps `StorageFailure.reason` `provider_unavailable` / `destination_missing` onto **unresolvable**, never onto satisfied (`FR-EVS-014`)
- [ ] T856m Implement `backend/src/modules/evidence/storage.adapter.ts` and register it against the `EvidenceStorage` token (unit test: T856l) — `FR-EVS-005` stored-or-referenced, `R-032-2`. Named explicitly because `EPIC-031`'s analysis found this exact binding missing there (`C2`)

### Persistence

- [ ] T856n Add `EvidenceItem`, `EvidenceContract`, `WorkEvidenceBinding` and `CompletionAttempt` models to `backend/prisma/schema.prisma` per [data-model.md](./data-model.md) §1–§5
- [ ] T856o Generate the migration under `backend/prisma/migrations/` including **`subjectDigest NOT NULL`**, the stored/referenced exclusivity constraint, and **`outcome = 'refused' ⇒ unmetItems NOT NULL`** — three fences, not conveniences (`FR-EVS-042`, `FR-EVS-032`)

### Contract definitions and their conformance check — the non-code output

- [ ] T856p [P] Write the failing executable conformance check in `backend/tests/architecture/evidence-contract-conformance.spec.ts` — fails on an item with no accepting `predicateType`, an unknown work class, or a **zero-item Contract with no `zeroItemPolicyRef`** (`R-032-4`)
- [ ] T856q Author the initial Evidence Contract definitions in `packages/evidence-contract/contracts/` and make them pass (conformance: T856p) — Constitution V for a non-code output
- [ ] T856r [P] Write the failing architecture test in `backend/tests/architecture/evidence-independence.spec.ts` — no Room vocabulary, no loop stage name, no risk band, and **no compliance-verdict type** (`FR-EVS-051`, `FR-EVS-052`, the `U-09` boundary)

### Module skeleton and wiring

- [ ] T856s [P] Write the failing reachability test in `backend/tests/integration/evidence-reachability.spec.ts` importing the real `AppModule` — Constitution XI Tier 1, `R-032-8`

**Checkpoint**: contract, schema and checks exist and fail for the right reasons

---

## Phase 3: User Story 1 - Declaring completion does not complete anything (Priority: P1) 🎯 MVP

**Goal**: `BR-0144`, `RULE-05` — the requirement the differentiator rests on

**Independent test**: [quickstart.md](./quickstart.md) Scenario 1

- [ ] T857a Implement `backend/src/modules/evidence/evidence.module.ts` and `evidence.tokens.ts` (integration test: T856s)
- [ ] T857b Register `EvidenceModule` in `backend/src/app.module.ts` (integration test: T856s) — the wiring T856s exists to prove
- [ ] T857c [P] [US1] Write failing unit tests for derived item state in `backend/tests/unit/evidence-contract-status.spec.ts` — met/unmet is **computed from evidence**, and there is no path that sets it (`FR-EVS-030`)
- [ ] T857d [US1] Implement `backend/src/modules/evidence/contract.status.ts` (unit test: T857c) — `FR-EVS-022`, `FR-EVS-027`
- [ ] T857e [P] [US1] Write failing unit tests for the completion gate in `backend/tests/unit/evidence-completion-gate.spec.ts` — refuses with a **non-empty** unmet list, returns a `Result` rather than throwing, and records the refusal (`FR-EVS-030`, `FR-EVS-032`, `FR-EVS-033`)
- [ ] T857f [US1] Implement `backend/src/modules/evidence/completion.gate.ts` (unit test: T857e) — `R-032-2`'s result-not-exception rule
- [ ] T857g [US1] Implement `POST /evidence/:workRef/complete` in `backend/src/modules/evidence/evidence.controller.ts` (integration test: T856s) — `409` carrying the unmet list
- [ ] T857h [US1] Implement the **refuse-on-unreachable** branch in `backend/src/modules/evidence/completion.gate.ts` (integration test: T862a) — `FR-EVS-035`, `R-032-5`. An unevaluated Contract is not a satisfied one. *Added 2026-08-22 to close analysis finding `C1`: the requirement had a test, a success criterion and a mutation proof, and nothing that built the behaviour*

**Checkpoint**: US1 demonstrable — "done" refuses, and says what is missing

---

## Phase 4: User Story 2 - Work knows what it must prove before it starts (Priority: P1)

**Goal**: `BR-0142` — a required-evidence set decided at closure is decided by whoever is closing

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 2, 3 and 11

- [ ] T858a [P] [US2] Write failing unit tests for Contract loading in `backend/tests/unit/evidence-contract-loader.spec.ts` — a **weakened** Contract published while work is in flight is refused **at load** (`FR-EVS-024`)
- [ ] T858b [US2] Implement `backend/src/modules/evidence/contract.loader.ts` (unit test: T858a) — `FR-EVS-020`, `FR-EVS-024`
- [ ] T858c [P] [US2] Write failing unit tests for binding at creation in `backend/tests/unit/evidence-binding.spec.ts` — the Contract attaches at work creation with every item unmet, and `contractVersion` is fixed then (`FR-EVS-021`, `FR-EVS-023`)
- [ ] T858d [US2] Implement `WorkEvidenceBinding` creation in `backend/src/modules/evidence/contract.loader.ts` (unit test: T858c)
- [ ] T858e [P] [US2] Write failing unit tests for zero-item Contracts in `backend/tests/unit/evidence-zero-item.spec.ts` — permitted only with an explicit `zeroItemPolicyRef`, and the emptiness is visible (`FR-EVS-026`)
- [ ] T858f [US2] Implement zero-item validation in `backend/src/modules/evidence/contract.loader.ts` (unit test: T858e)
- [ ] T858g [US2] Implement `GET /evidence/:workRef/unmet` in `backend/src/modules/evidence/evidence.controller.ts` (integration test: T856s) — `FR-EVS-022`, `SC-EVS-003`: one query, no opening individual evidence
- [ ] T858h [US2] Implement re-evaluation on evidence arrival in `backend/src/modules/evidence/completion.gate.ts` (unit test: T857e) — `FR-EVS-031`, a **new** `CompletionAttempt` rather than a mutation of the old

**Checkpoint**: US2 demonstrable — the Contract is a gate, not a closing checklist

---

## Phase 5: User Story 3 - Every piece of evidence answers where it came from (Priority: P1)

**Goal**: `BR-0141` — evidence whose provenance is unknown is a claim with better formatting

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 4, 5 and 10

- [ ] T859a [P] [US3] Write failing unit tests for attestation persistence in `backend/tests/unit/evidence-attestation-store.spec.ts` — source, time, attested artifact and **version** all present; attachable to an artifact, task, decision or outcome; append-only (`FR-EVS-004`, `FR-EVS-010`, `FR-EVS-011`, `SC-EVS-002`)
- [ ] T859b [US3] Implement `backend/src/modules/evidence/attestation.store.ts` (unit test: T859a)
- [ ] T859c [P] [US3] Write failing integration test asserting `EvidenceItem` rejects `UPDATE` and `DELETE` in `backend/tests/integration/evidence-append-only.spec.ts` — following the `audit-immutability.spec.ts` precedent
- [ ] T859d [P] [US3] Write failing unit tests for integrity verification in `backend/tests/unit/evidence-integrity.spec.ts` — a corrupted payload yields **integrity-failed**, which is **not met** (`FR-EVS-013`, `FR-EVS-034`)
- [ ] T859e [US3] Implement integrity checking in `backend/src/modules/evidence/attestation.store.ts` (unit test: T859d)
- [ ] T859f [P] [US3] Write failing unit tests for unresolvable references in `backend/tests/unit/evidence-unresolvable.spec.ts` — a removed reference target reads **unresolvable**, never satisfied (`FR-EVS-014`, `SC-EVS-006`)
- [ ] T859g [US3] Implement reference resolution in `backend/src/modules/evidence/storage.adapter.ts` (unit test: T859f)
- [ ] T859h [P] [US3] Write failing unit tests for superseded-version evidence in `backend/tests/unit/evidence-superseded.spec.ts` — evidence for `v1` stays readable and is **not** evidence for `v2` (`FR-EVS-012`, `SC-EVS-007`)
- [ ] T859i [P] [US3] Write failing integration tests for access and isolation in `backend/tests/integration/evidence-access.spec.ts` — reads honour the attested artifact's rules (`FR-EVS-015`, `BR-0062`) and never cross a workspace (`FR-EVS-016`)
- [ ] T859j [US3] Implement the `AccessPolicy` binding to `EPIC-024` in `backend/src/modules/evidence/evidence.module.ts` (integration test: T859i) — evidence must not become a side channel around artifact access
- [ ] T859k [US3] Implement **version-scoped item matching** in `backend/src/modules/evidence/contract.status.ts` (unit test: T859h) — `FR-EVS-012`: an attestation satisfies an item only for the artifact version it names, and evidence for a superseded version stays readable without satisfying the current one. *Added 2026-08-22 to close analysis finding `C2`*

**Checkpoint**: US3 demonstrable — presence is not validity

---

## Phase 6: User Story 4 - Specialist tools contribute, and PMI Studio rebuilds none of them (Priority: P2)

**Goal**: `BR-0146` and `ADR-0022`'s decided boundary

**Independent test**: [quickstart.md](./quickstart.md) Scenarios 7 and 8

- [ ] T860a [P] [US4] Write failing unit tests for external contribution in `backend/tests/unit/evidence-contribution.spec.ts` — the contributing tool and its version are recorded alongside ordinary provenance (`FR-EVS-041`)
- [ ] T860b [US4] Implement contribution handling in `backend/src/modules/evidence/attestation.store.ts` (unit test: T860a) — `FR-EVS-040`, through the adapter path, **no bespoke per-tool route**
- [ ] T860c [P] [US4] Write failing unit tests for version-less refusal in `backend/tests/unit/evidence-no-version.spec.ts` — a contribution naming no artifact version is refused, never attached to whatever is current (`FR-EVS-042`)
- [ ] T860d [US4] Implement `POST /evidence` in `backend/src/modules/evidence/evidence.controller.ts` (integration test: T856s; unit test: T860c) — `400` on a missing subject digest, `FR-EVS-042`
- [ ] T860e [P] [US4] Write the `EPIC-015` producer integration test in `backend/tests/integration/evidence-from-qa-suite.spec.ts` — an existing `EPIC-015` validation run lands as a `test-result/v0.1` attestation and satisfies a Contract item, with **nothing re-run by this Epic** (`FR-EVS-050`, `SC-EVS-005`, `R-032-6`)
- [ ] T860f [P] [US4] Write the no-analysis assertion in `backend/tests/architecture/evidence-no-review-engine.spec.ts` — asserts this Epic performs no scanning, linting or review analysis of its own (`FR-EVS-043`, `ADR-0022`)
- [ ] T860g [US4] Implement `GET /evidence/rollup` in `backend/src/modules/evidence/evidence.controller.ts` (integration test: T856s) — `FR-EVS-006`, `SC-EVS-008`, the `BG-08` measure computed from the store

**Checkpoint**: US4 demonstrable — the boundary `ADR-0022` decided is honoured and asserted

---

## Phase 7: User Story 5 - Nine kinds of proof behave like one kind of thing (Priority: P2)

**Goal**: `BR-0140` — a per-type mechanism gives the gate nine code paths and nine ways to be wrong

**Independent test**: [quickstart.md](./quickstart.md) Scenario 6

- [ ] T861a [P] [US5] Write failing unit tests covering **every** evidence type `BR-0140` names in `backend/tests/unit/evidence-all-types.spec.ts` — each storable or referenceable through the same mechanism (`FR-EVS-001`, `FR-EVS-002`)
- [ ] T861b [US5] Implement uniform type handling in `backend/src/modules/evidence/attestation.store.ts` (unit test: T861a)
- [ ] T861c [P] [US5] Write failing unit tests for multi-type Contract items in `backend/tests/unit/evidence-multi-type.spec.ts` — an item accepting two `predicateType`s is met by either; evidence of a non-accepted type leaves it unmet **and says why** (`FR-EVS-025`)
- [ ] T861d [US5] Implement accepting-type matching in `backend/src/modules/evidence/contract.status.ts` (unit test: T861c)
- [ ] T861e [US5] Implement `GET /evidence/:workRef/status` in `backend/src/modules/evidence/evidence.controller.ts` (integration test: T856s) — `FR-EVS-027`, the Room Evidence region projection

**Checkpoint**: all five user stories demonstrable

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T862a [P] Write the fail-closed integration test in `backend/tests/integration/evidence-fail-closed.spec.ts` — an unreachable store refuses completion (`SC-EVS-009`, `FR-EVS-035`)
- [ ] T862b **Mutation proof — `FR-EVS-030`**: add a bypass permitting completion with an unmet Contract to `backend/src/modules/evidence/completion.gate.ts`, revert (unit test: T857e — it must fail while the mutation stands). Record the observation (`SC-EVS-001`)
- [ ] T862c **Mutation proof — `FR-EVS-024`**: allow a weakened Contract to load in `backend/src/modules/evidence/contract.loader.ts`, revert (unit test: T858a — it must fail while the mutation stands). Record the observation
- [ ] T862d **Mutation proof — `FR-EVS-035`**: make the gate allow when the store is unreachable in `backend/src/modules/evidence/completion.gate.ts`, revert (integration test: T862a — it must fail while the mutation stands). Record the observation (`SC-EVS-009`)
- [ ] T862e **Mutation proof — Constitution XI Tier 1**: remove `EvidenceModule` from `backend/src/app.module.ts`, revert (integration test: T856s — it must fail while the mutation stands). Record the observation
- [ ] T862f [P] Verify the `R-032-7` targets — evidence write p95 < 60 ms, Contract evaluation p95 < 150 ms **at 50 items**, unmet query p95 < 100 ms, rollup p95 < 500 ms **at 10,000 items** — and record the measured figures
- [ ] T862g [P] Confirm the gate budget composes with `EPIC-030`'s 150 ms transition and `EPIC-031`'s 120 ms decide, and record the combined measurement
- [ ] T862h [P] Confirm attestations are never pruned by any retention path (`R-032-7`) — evidence for a superseded version must stay readable
- [ ] T862i Run and record each [quickstart.md](./quickstart.md) scenario individually: **Scenario 1** (done does not complete), **Scenario 2** (Contract up front), **Scenario 3** (no weakening in flight), **Scenario 4** (provenance), **Scenario 5** (presence is not validity), **Scenario 6** (nine kinds, one mechanism), **Scenario 7** (external tool, zero analysis), **Scenario 8** (`EPIC-015` as producer), **Scenario 9** (unreachable store refuses), **Scenario 10** (not a side channel), **Scenario 11** (empty Contract visible), **Scenario 12** (XI Tier 1). *Enumerated 2026-08-22 to close analysis finding `A1` — the prior wording instructed enumeration rather than enumerating, and `EPIC-031` had already tried that fix once*

---

## Phase Z: Epic Closure (MANDATORY - Constitution IV, VI, VII, IX, XI)

Ordered as the constitution's *"Quality gates in order"* states them.

- [ ] T863a Confirm every implementation task has a passing unit test or conformance check
- [ ] T863b **Constitution XI Tier 1 (ALWAYS)** — `T856s` drives evidence contribution and the completion gate through their **real HTTP routes** against the composed module graph via the real `AppModule`, and `T862e` proved it fails when the module is unregistered
- [ ] T863c **Constitution XI Tier 2 (Epics delivering a journey)** — **NOT APPLICABLE, by rule.** The *Evidence & Compliance* area needs the compliance half, which is `U-09` and unowned, and `UX-0060` forbids implementing an area before its Epic is declared. Recorded rather than deleted (`R-032-8`, the `EPIC-029` `F1` precedent)
- [ ] T863d **`ADR-0022` is NOT reported as converged.** It stays Open awaiting `U-09`, and the closing report says so. *"The differentiator is now owned"* is the overstatement this Epic most invites
- [ ] T863e Update `specs/brs-v2-reconciliation.md` §4 to record `U-08`'s home as **settled** rather than as an alternative — decided at clarification 2026-08-22, and the register still offers the choice
- [ ] T863f [P] Confirm every evidence type `BR-0140` names was exercised against one gate (`SC-EVS-004`) — nine types, one mechanism, demonstrated rather than asserted
- [ ] T863g Run `/speckit-converge`; append and complete any remaining unbuilt work
- [ ] T863h Triage `specs/032-evidence-store-contracts/defects/`; every record closed or deferred to a named Epic
- [ ] T863i Re-run the full suite green — `pnpm lint && pnpm typecheck && pnpm test && pnpm test:governance`
- [ ] T863j **Hand the task-identifier exhaustion to `EPIC-026`** — 977 of 999 three-digit prefixes are in use across the corpus, 22 remain, and `EPIC-033`–`035` cannot each be allocated a flat block. Not this Epic's to fix; its to escalate with the measurement attached
- [ ] T863k Promote `local → dev` (no environment skipped) and publish the Epic closing report: work completed, work deferred, the four mutation observations, the measured performance figures, and the recommended next command (Constitution IX). Refresh the Delivery Board or restate its staleness

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: `T855a` first — it discharges the failing gate
- **Foundational (Phase 2)**: blocks every user story
- **US1 (Phase 3)**: Phase 2 only. **MVP**
- **US2 (Phase 4)**: Phase 2, plus US1's `contract.status.ts` (`T857d`)
- **US3 (Phase 5)**: Phase 2, plus the storage adapter (`T856m`)
- **US4 (Phase 6)**: Phase 2, plus US3's attestation store (`T859b`)
- **US5 (Phase 7)**: US3's store and US1's status projection
- **Polish, Closure**: last

### Cross-Epic dependencies — none blocking

Consumes `EPIC-025` storage, `EPIC-024` access control and `EPIC-013`/`U-13` adapters. Every port
**refuses when unfilled** (`FR-EVS-035`), so none blocks. `EPIC-015` is **built and closed** and is a
producer, not a dependency (`R-032-6`).

### Parallel Example: Phase 2

```text
T856a, T856c, T856e, T856g, T856i   — five contract test files
T856l, T856p, T856r, T856s          — adapter, conformance, independence, reachability
```

---

## Implementation Strategy

**MVP is User Story 1** — a completion declaration refused by an unmet Contract, naming what is
missing. It is `BR-0144` and `RULE-05`, and it is demonstrable with one evidence type and no Room.

**US3 is the phase to schedule carefully.** Three of its tasks encode *presence is not validity* —
unresolvable references, failed integrity, superseded versions — and each is a way a Contract could
silently read as satisfied. Two are mutation-proved in Phase N.

**Four mutation proofs (`T862b`–`T862e`)** each require a deliberate break, an observed failure and a
revert. Three target guarantees this plan moved into the type system and the schema.

---

## Notes

- **The corpus is nearly out of three-digit task identifiers.** 977 of 999 prefixes are used across
  `main` and every Wave 1 branch; 22 remain; the longest contiguous free run is the ten this Epic
  took. `EPIC-033`, `EPIC-034` and `EPIC-035` cannot each be given a flat block. The suffixed scheme
  above works and is legal, but it is a workaround. **The real fix is widening `T\d{3}[a-z]?` to
  accept four digits** in `tests/governance/epic-stage/task-ids.spec.ts`, `dor.ts` and
  `task-paths.spec.ts` — which is `EPIC-026`'s to own, not this Epic's to take. `T863j` escalates it
  with the measurement attached.
- **`T863d` and `T863e` are handovers, not work.** One forbids claiming `ADR-0022` converged; the
  other corrects a register that still offers a choice already made. Both exist so closure cannot be
  claimed while a record disagrees.
- **`T856m` exists because `EPIC-031`'s analysis found its equivalent missing.** The port was
  defined, the adapter was not, and nothing failed — `DOR-08` asks whether tasks have tests, not
  whether ports have bindings. Naming the adapter as its own task is the cheapest correction.
- **Constitution V over the skill default**: `/speckit-tasks` calls tests optional; the constitution
  overrides every template, skill and tool default.
