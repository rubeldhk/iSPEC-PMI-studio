---

description: "Task list for EPIC-003 — Specification Engine & Sandbox"
---

# Tasks: Specification Engine & Sandbox

**Epic**: `EPIC-003` | **Module**: M-08 | **Tasks**: 35

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** under decision D-10. Buildable now — nothing here depends on the
> Business Requirement Specification.

**Session label**: `EPIC-003 Specification Engine` (Constitution VIII). Branch: `epic/003-specification-engine`.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

**One exception, 2026-08-14**: the three convergence tasks were renumbered `T447`→`T646`,
`T448`→`T647`, `T449`→`T648` because they collided with identifiers EPIC-025 already owned. See the
Phase 6 note. Invariance is a convention for *correctly allocated* IDs, not a reason to keep a
collision.

---

## F-08.1 · Engine contract

- [X] T031 [P] Write failing unit tests for contract type guards and result narrowing in `packages/engine-contract/tests/unit/contract.spec.ts`
- [X] T032 Define `SpecificationEngine`, `EngineDescriptor`, `EngineResult`, `EngineFailureReason`, and all input/output types per `contracts/specification-engine.md` in `packages/engine-contract/src/index.ts` (unit test: T031)

## F-08.2 · Engine registry and capability validation

- [X] T033 [P] Write failing unit tests asserting registration is refused, naming the missing capability, in `backend/tests/unit/engines/registry.spec.ts`
- [X] T034 Define `EngineRegistration` model in `backend/prisma/schema.prisma` and implement the engine registry with capability validation in `backend/src/modules/engines/engine-registry.service.ts` (unit test: T033)
- [X] T136 [P] [US8] Unit tests asserting an adapter missing a required capability is refused, naming it, in `backend/tests/unit/engines/capability-refusal.spec.ts`
- [X] T139 [US8] Implement startup capability validation refusing incomplete adapters in `backend/src/modules/engines/engine-registry.service.ts` (unit test: T136)

## F-08.3 · Engine resolution and selection

- [X] T034a [P] Write failing unit tests asserting engine resolution returns the project's selected engine and falls back to the default, in `backend/tests/unit/engines/engine-resolver.spec.ts`
- [X] T035 Implement per-project engine resolution in `backend/src/modules/engines/engine-resolver.service.ts` (unit test: T034a)
- [X] T035a Register the Spec Kit adapter as the default engine at the composition root in `worker/src/engine-composition.ts` (FR-018; unit test: T034a)
- [X] T135 [P] [US8] Unit tests asserting per-project engine selection resolves the correct adapter in `backend/tests/unit/engines/engine-selection.spec.ts`
- [ ] T138 [US8] Implement per-project engine selection endpoint in `backend/src/modules/projects/projects.controller.ts` (unit test: T135)

  > ⏸ **BLOCKED — held product surface.** `projects.controller.ts` does not exist and belongs to
  > **EPIC-006**, which is held pending `PMI-DOC-004`. `plan.md` already excluded F-08.9 from this
  > epic for exactly this reason ("it touches `projects.controller.ts` and therefore the held product
  > surface") — T138 sits in F-08.3 and was missed by that split. The *behaviour* is built and tested
  > (T135, `EngineResolverService`); only the HTTP surface waits.


## F-08.4 · Fixture adapter

*Catalog epic: **Future engine adapter**. Deliberately trivial — proves the contract is engine-neutral and keeps the test suite fast, deterministic, and free of AI agent calls.*

- [X] T036 [P] Write failing unit tests for deterministic fixture output and failure injection in `engine-adapters/fixture/tests/unit/fixture.spec.ts`
- [X] T037 Implement the fixture adapter with injectable failure modes for every reason in the taxonomy in `engine-adapters/fixture/src/fixture.adapter.ts` (unit test: T036)

## F-08.5 · Conformance suite

*One suite, run against every adapter. An adapter is not conformant until all 13 cases pass.*

- [X] T038 Implement the shared engine conformance suite (13 cases from `contracts/specification-engine.md`) in `packages/engine-contract/tests/conformance/engine-conformance.suite.ts`
- [X] T039 Run the conformance suite against the fixture adapter in `engine-adapters/fixture/tests/conformance.spec.ts`
- [X] T093 [US3] Run the shared conformance suite against the Spec Kit adapter in `engine-adapters/speckit/tests/conformance.spec.ts`

## F-08.6 · Spec Kit sandbox

*Untrusted execution. The largest single component in the Epic — a sandboxed runtime, not an integration client.*

- [X] T086 [P] [US3] Unit tests for workspace provisioning and guaranteed teardown on every terminal outcome in `engine-adapters/speckit/tests/unit/workspace.spec.ts`
- [X] T088a [P] [US3] Unit tests asserting the engine image definition installs the `specify` CLI, the AI agent CLI, and git, and declares a non-root default user, in `engine-adapters/speckit/tests/unit/engine-image.spec.ts`
- [X] T088 [US3] Build the engine container image containing the `specify` CLI, AI agent CLI, and git in `engine-adapters/speckit/docker/Dockerfile` (unit test: T088a)
- [X] T089a [P] [US3] Unit tests asserting the sandbox manifest declares a non-root user, a read-only root filesystem, CPU, memory and wall-clock caps, and an egress allow-list containing only the AI provider endpoint — the sole containment for RAID **R-02** — in `engine-adapters/speckit/tests/unit/sandbox-config.spec.ts`
- [X] T089 [US3] Apply sandbox constraints — non-root user, read-only root filesystem, CPU/memory/wall-clock caps, egress restricted to the AI provider — in `engine-adapters/speckit/docker/sandbox.json` (unit test: T089a)
- [X] T090 [US3] Implement ephemeral workspace provisioning and teardown in `engine-adapters/speckit/src/workspace.ts` (unit test: T086)

## F-08.7 · Spec Kit invocation and parsing

*The five-step sequence from research R-001: `specify` scaffolds, an AI agent generates.*

- [X] T087 [P] [US3] Unit tests for Spec Kit output parsing against recorded fixtures in `engine-adapters/speckit/tests/unit/parse.spec.ts`
- [X] T090a [P] [US3] Unit tests for the five-step invocation sequence against a mocked container runtime, asserting correct ordering and that a failure at any step yields the right failure reason, in `engine-adapters/speckit/tests/unit/invocation.spec.ts`
- [X] T091 [US3] Implement the five-step invocation (`git init` → `specify init --here --force --integration claude --script sh --ignore-agent-tools` → write input → headless agent run → read back) in `engine-adapters/speckit/src/speckit.adapter.ts` (unit test: T090a)
- [X] T091a [P] [US3] Unit tests asserting the descriptor version changes when either the Spec Kit release or the AI model changes, in `engine-adapters/speckit/tests/unit/descriptor.spec.ts`
- [X] T092 [US3] Implement descriptor version capturing both Spec Kit and AI model identity in `engine-adapters/speckit/src/descriptor.ts` (unit test: T091a)

## F-08.8 · Architecture enforcement

- [X] T047 Implement the architecture test failing the build if `backend/src/**` references any Spec Kit symbol, package, or string identifier, in `backend/tests/architecture/engine-independence.spec.ts`
- [X] T142 [US8] Extend the architecture test to cover string identifiers and dynamic imports in `backend/tests/architecture/engine-independence.spec.ts`
- [X] T137 [P] [US8] Integration test generating against both adapters and asserting identical platform behaviour in `backend/tests/integration/engine-swap.spec.ts`
- [X] T142a Implement the architecture test failing the build if any `backend/src/modules/**/*.service.ts` imports an HTTP type, enforcing PC-1 service/transport separation, in `backend/tests/architecture/transport-independence.spec.ts`

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/003-specification-engine/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T169 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/003-specification-engine/closure.md`
- [X] T170 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/003-specification-engine/closure.md`
- [X] T171 Triage `specs/003-specification-engine/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/003-specification-engine/closure.md`
- [X] T172 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/003-specification-engine/closure.md`

---

## Phase 6: Convergence

*Appended by `/speckit-converge` on 2026-08-08. No existing task modified. IDs continue from the
repository maximum (`T446`), so they stay unique programme-wide.*

> ⚠️ **That claim was wrong, and it was corrected on 2026-08-14.** `T446` was not the repository
> maximum: **EPIC-025 already owned `T447`–`T451`**, allocated by the `D-19` split and recorded in
> [`002/plan.md`](../002-team-review-access-storage/plan.md). This pass allocated `T447`, `T448` and
> `T449` on top of them, so three identifiers meant two different things — a token-refresh service in
> EPIC-025 and a container runtime here. The EPIC-028 routing then made two of them three-way.
>
> **Renumbered to `T646`–`T648`** (the true corpus maximum was `T645`). EPIC-025 is untouched. This
> is conflict **C-10** recurring inside the epic task namespace, and **`D-9`** — namespace epic task
> IDs — is the open decision that would have prevented it.

**All three are now owned by [EPIC-028](../028-agent-execution-seam/tasks.md)**, which builds them
behind the `ProjectExecutionEnvironment` port per `D-21`. The rows below are retained for history and
are **not actionable in this epic**.

- ~~[ ] T646~~ **ROUTED → EPIC-028 T646a/T646b** — Implement a production `ContainerRuntime` (OCI/Docker driver) honouring `docker/sandbox.json` in `engine-adapters/speckit/src/container-runtime.ts`, with unit tests against a mocked daemon per missing (no task owned this — the adapter defines the port and nothing implements it, so the Spec Kit engine cannot actually run)
- ~~[ ] T647~~ **ROUTED → EPIC-028 T647** — Register `SpecKitEngine` as the default engine in `worker/src/engine-composition.ts` once T646 lands, per FR-018 (partial) — the composition root still registers `FixtureEngine` as default, so the *default engine* requirement is unmet in the running system even though the adapter is built
- ~~[ ] T648~~ **ROUTED → EPIC-028 T648** — Remove the duplicate registry: `worker/src/engine-composition.ts` defines its own `EngineRegistry` alongside `backend/src/modules/engines/engine-registry.service.ts` per duplication — decide which owns capability validation, since two implementations of FR-021 can disagree

> **`T595` · Delivered by EPIC-028, 2026-08-17.** All three routed rows are now built. Recorded here
> so a reader of *this* file is not left believing they are outstanding; **EPIC-003's closure is not
> reopened** and its task ledger is unchanged — these rows stay struck through and owned elsewhere.
>
> | Row | Landed as | Note |
> |---|---|---|
> | `T646` | `T646a` **done** · `T646b` **NOT done** | `T646a` implements `DockerExecutionEnvironment` against the Docker Engine HTTP API. It did **not** land as `engine-adapters/speckit/src/container-runtime.ts` as this row proposed — decision `D-21` (conflict `C-20`) moved it behind a port into `execution-providers/docker`, because Native §4 forbids business logic depending directly on Docker. `T646b`, the real container run, still needs a machine with a daemon |
> | `T647` | **done** | `SpecKitEngine` is the default engine; `FR-018` is satisfied in the running system for the first time |
> | `T648` | **done** | `worker/src/engine-composition.ts` delegates capability validation to `assertPhase1Capabilities`; one implementation owns `FR-021` |
>
> The one thing EPIC-003's closure report said it could not claim — *"No real container has ever
> started"* — **remains true**. `T646b` is the task that changes it, and it has not run.

---

## Phase 7: Convergence

*Appended by `/speckit-converge` on 2026-08-08, a second pass after the EPIC-003 implementation
commit. No existing task modified. IDs continue from the repository maximum (`T460`).*

*`T646`, `T647`, `T648` (now routed to EPIC-028) and `T138` remain open from the previous pass and are **deliberately not
repeated here** — re-appending a tracked finding manufactures duplicate work and makes the epic look
like it is regressing.*

- [X] T461 **CRITICAL** Add the session-label line `**Session label**: EPIC-003 Specification Engine` to this task document per Constitution VIII (missing) — required by `governance/document-structure.md`; EPIC-023/024/025 carry one and EPIC-001/003/004 do not
- [X] T462 Create `backend/src/modules/engines/engines.module.ts` and import it in `backend/src/app.module.ts` per FR-019 (partial) — `EngineRegistryService` and `EngineResolverService` are built and tested but nothing outside their own directory constructs them, so they are unreachable from the running API
- [X] T463 Implement a Prisma-backed `EngineRegistrationStore` in `backend/src/modules/engines/engine-registration.store.ts`, or record why the table stays unwritten, per T034 (partial) — the port has no implementation, so `recordRegistrations()` no-ops and `engine_registrations` is never written
- [X] T464 Execute quickstart **V11** (engine independence) and record the outcome in `specs/003-specification-engine/closure.md` per plan Definition of done (missing) — its substance is automated by T136/T137, but the walkthrough has never been run
- [X] T465 Reconcile the fixture adapter path: T037 names `engine-adapters/fixture/src/fixture.adapter.ts`, the code lives at `src/index.ts` (partial) — correct the record or move the file
