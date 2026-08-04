---

description: "Task list for EPIC-003 — Specification Engine & Sandbox"
---

# Tasks: Specification Engine & Sandbox

**Epic**: `EPIC-003` | **Module**: M-08 | **Tasks**: 29

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

- [ ] T033 [P] Write failing unit tests asserting registration is refused, naming the missing capability, in `backend/tests/unit/engines/registry.spec.ts`
- [ ] T034 Define `EngineRegistration` model in `backend/prisma/schema.prisma` and implement the engine registry with capability validation in `backend/src/modules/engines/engine-registry.service.ts` (unit test: T033)
- [ ] T136 [P] [US8] Unit tests asserting an adapter missing a required capability is refused, naming it, in `backend/tests/unit/engines/capability-refusal.spec.ts`
- [ ] T139 [US8] Implement startup capability validation refusing incomplete adapters in `backend/src/modules/engines/engine-registry.service.ts` (unit test: T136)

## F-08.3 · Engine resolution and selection

- [X] T034a [P] Write failing unit tests asserting engine resolution returns the project's selected engine and falls back to the default, in `backend/tests/unit/engines/engine-resolver.spec.ts`
- [X] T035 Implement per-project engine resolution in `backend/src/modules/engines/engine-resolver.service.ts` (unit test: T034a)
- [X] T035a Register the Spec Kit adapter as the default engine at the composition root in `worker/src/engine-composition.ts` (FR-018; unit test: T034a)
- [ ] T135 [P] [US8] Unit tests asserting per-project engine selection resolves the correct adapter in `backend/tests/unit/engines/engine-selection.spec.ts`
- [ ] T138 [US8] Implement per-project engine selection endpoint in `backend/src/modules/projects/projects.controller.ts` (unit test: T135)

## F-08.4 · Fixture adapter

*Catalog epic: **Future engine adapter**. Deliberately trivial — proves the contract is engine-neutral and keeps the test suite fast, deterministic, and free of AI agent calls.*

- [X] T036 [P] Write failing unit tests for deterministic fixture output and failure injection in `engine-adapters/fixture/tests/unit/fixture.spec.ts`
- [X] T037 Implement the fixture adapter with injectable failure modes for every reason in the taxonomy in `engine-adapters/fixture/src/fixture.adapter.ts` (unit test: T036)

## F-08.5 · Conformance suite

*One suite, run against every adapter. An adapter is not conformant until all 13 cases pass.*

- [ ] T038 Implement the shared engine conformance suite (13 cases from `contracts/specification-engine.md`) in `packages/engine-contract/tests/conformance/engine-conformance.suite.ts`
- [ ] T039 Run the conformance suite against the fixture adapter in `engine-adapters/fixture/tests/conformance.spec.ts`
- [ ] T093 [US3] Run the shared conformance suite against the Spec Kit adapter in `engine-adapters/speckit/tests/conformance.spec.ts`

## F-08.6 · Spec Kit sandbox

*Untrusted execution. The largest single component in the Epic — a sandboxed runtime, not an integration client.*

- [ ] T086 [P] [US3] Unit tests for workspace provisioning and guaranteed teardown on every terminal outcome in `engine-adapters/speckit/tests/unit/workspace.spec.ts`
- [ ] T088 [US3] Build the engine container image containing the `specify` CLI, AI agent CLI, and git in `engine-adapters/speckit/docker/Dockerfile`
- [ ] T089 [US3] Apply sandbox constraints — non-root user, read-only root filesystem, CPU/memory/wall-clock caps, egress restricted to the AI provider — in `engine-adapters/speckit/docker/sandbox.json`
- [ ] T090 [US3] Implement ephemeral workspace provisioning and teardown in `engine-adapters/speckit/src/workspace.ts` (unit test: T086)

## F-08.7 · Spec Kit invocation and parsing

*The five-step sequence from research R-001: `specify` scaffolds, an AI agent generates.*

- [ ] T087 [P] [US3] Unit tests for Spec Kit output parsing against recorded fixtures in `engine-adapters/speckit/tests/unit/parse.spec.ts`
- [ ] T090a [P] [US3] Unit tests for the five-step invocation sequence against a mocked container runtime, asserting correct ordering and that a failure at any step yields the right failure reason, in `engine-adapters/speckit/tests/unit/invocation.spec.ts`
- [ ] T091 [US3] Implement the five-step invocation (`git init` → `specify init --here --force --integration claude --script sh --ignore-agent-tools` → write input → headless agent run → read back) in `engine-adapters/speckit/src/speckit.adapter.ts` (unit test: T090a)
- [ ] T091a [P] [US3] Unit tests asserting the descriptor version changes when either the Spec Kit release or the AI model changes, in `engine-adapters/speckit/tests/unit/descriptor.spec.ts`
- [ ] T092 [US3] Implement descriptor version capturing both Spec Kit and AI model identity in `engine-adapters/speckit/src/descriptor.ts` (unit test: T091a)

## F-08.8 · Architecture enforcement

- [X] T047 Implement the architecture test failing the build if `backend/src/**` references any Spec Kit symbol, package, or string identifier, in `backend/tests/architecture/engine-independence.spec.ts`
- [ ] T142 [US8] Extend the architecture test to cover string identifiers and dynamic imports in `backend/tests/architecture/engine-independence.spec.ts`
- [ ] T137 [P] [US8] Integration test generating against both adapters and asserting identical platform behaviour in `backend/tests/integration/engine-swap.spec.ts`
- [ ] T142a Implement the architecture test failing the build if any `backend/src/modules/**/*.service.ts` imports an HTTP type, enforcing PC-1 service/transport separation, in `backend/tests/architecture/transport-independence.spec.ts`
