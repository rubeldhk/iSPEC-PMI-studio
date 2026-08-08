---

description: "Task list for EPIC-003 — Specification Engine & Sandbox"
---

# Tasks: Specification Engine & Sandbox

**Epic**: `EPIC-003` | **Module**: M-08 | **Tasks**: 35

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** under decision D-10. Buildable now — nothing here depends on the
> Business Requirement Specification.


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

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

- [ ] T447 Implement a production `ContainerRuntime` (OCI/Docker driver) honouring `docker/sandbox.json` in `engine-adapters/speckit/src/container-runtime.ts`, with unit tests against a mocked daemon per missing (no task owned this — the adapter defines the port and nothing implements it, so the Spec Kit engine cannot actually run)
- [ ] T448 Register `SpecKitEngine` as the default engine in `worker/src/engine-composition.ts` once T447 lands, per FR-018 (partial) — the composition root still registers `FixtureEngine` as default, so the *default engine* requirement is unmet in the running system even though the adapter is built
- [ ] T449 Remove the duplicate registry: `worker/src/engine-composition.ts` defines its own `EngineRegistry` alongside `backend/src/modules/engines/engine-registry.service.ts` per duplication — decide which owns capability validation, since two implementations of FR-021 can disagree
