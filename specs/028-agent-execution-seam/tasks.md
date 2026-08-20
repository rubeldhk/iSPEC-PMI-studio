---

description: "Task list for EPIC-028 — Agent & Execution Seam"
---

# Tasks: Agent & Execution Seam

**Epic**: `EPIC-028` | **Module**: M-08 (execution half) | **Tasks**: 82

> **Counted, not quoted.** This number is recomputed by `/speckit-analyze`; the phase and function sections below are its composition. It drifted before because two documents restated it and neither was derived — EPIC-018 read 31 here, 32 in the index and 34 in its task list, and by the time `T529` came to reconcile them the real figures were 31 / 37 / 38. **The remediation went stale before it ran.** Corrected by `T686`.

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

> ▶ **PROCEEDING** under decision D-10. Buildable now — nothing here depends on the Business
> Requirement Specification.

**Session label**: `EPIC-028 Agent & Execution Seam` (Constitution VIII).
⚠️ Current branch is `epic/003-specification-engine`, which does **not** match. Fifth occurrence;
recorded in [plan.md](./plan.md) Complexity Tracking rather than hidden. `T594` does not close it —
`D-39` proposes the check that would.

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first. Three tasks produce configuration or documents and
carry an **executable conformance check** instead (`T537`, `T591`, `T578`).

**Task IDs**: new IDs run `T537`–`T596`, plus `T549a` and `T576a` added by the analyse pass of
2026-08-14 (corpus max was `T536`). **`T646`, `T647` and `T648` are routed from EPIC-003, not
reissued** — the `D-19` precedent. EPIC-003 stays closed; `T595` annotates its rows. `T646` splits
into `T646a`/`T646b` per the `T142a` suffix convention.

**Amended 2026-08-14** by `/speckit-analyze`, which found one Constitution V violation and four
unenforced claims. Fixes are marked inline: `T576a` (the runner had no test), `T549a`
(`SC-AGT-005` had no CI enforcement), the layering rule in `T560`, and assertion top-ups in `T537`,
`T545`, `T550`, `T555`, `T570`, `T580`.

**Before starting**: sync from GitHub, confirm no other Claude session is on this checkout.

---

## Phase 1: Setup — workspace & test plumbing (F-28.1)

**Purpose**: make the new packages buildable and, first, make the test harness trustworthy.

**⚠️ `T537` comes first for a reason.** `pnpm test:unit` names Vitest projects one by one, and the
EPIC-003 closure report records what that hides: *"an empty Vitest project passes silently when
sibling projects have tests"* — two projects collected nothing, the run stayed green, and three tasks
were marked complete with **no test file anywhere in the repository**. Adding three more projects
without a guard repeats it three times over.

- [X] T537 Write a conformance check asserting (a) every project named in the `test:unit` script collects at least one test file, failing with the project name, and (b) every new package declares the expected name and a `workspace:*` dependency on its contract — in `tests/governance/vitest-projects.spec.ts`
- [X] T538 Add `agent-adapters/*` and `execution-providers/*` to the `packages` list in `pnpm-workspace.yaml` (conformance check: T537)
- [X] T539 Register the `agent-contract`, `agent-adapters` and `execution-providers` projects in `vitest.config.ts` and add them to the `test:unit` script in `package.json` (conformance check: T537)

  > ⚠️ **Partially done 2026-08-14.** `execution-contract`, `agent-contract` and `agent-adapters`
  > are registered in `vitest.workspace.ts` and `test:unit`. **`execution-providers` is deliberately
  > NOT registered**: it has no test file yet, and `T537` correctly fails on a project that collects
  > nothing. Register it in the same commit as `T646a`, which is the task that gives it tests.
- [X] T540 [P] Write failing tests asserting the ESLint dependency-boundary rule forbids `backend/**` importing `agent-adapters/*` or `execution-providers/*` in `tests/governance/eslint-boundaries.spec.ts`
- [X] T541 Extend the dependency-boundary rule in `eslint.config.js` with the two new forbidden edges (test: T540)
- [X] T542 [P] Scaffold `packages/execution-contract` — `package.json` (name `@pmi/execution-contract`), `tsconfig.json`, `src/index.ts` (conformance check: T537)
- [X] T543 [P] Scaffold `packages/agent-contract` — `package.json` (name `@pmi/agent-contract`), `tsconfig.json`, `src/index.ts` (conformance check: T537)
- [X] T544 [P] Scaffold `agent-adapters/fixture`, `agent-adapters/claude` and `execution-providers/docker` with `package.json`, `tsconfig.json` and a `workspace:*` dependency on their contract (conformance check: T537)

**Checkpoint**: `pnpm -r typecheck` passes, `pnpm test:unit` names eight projects, and `T537` fails loudly if any collects nothing.

---

## Phase 2: Foundational — the two contracts (F-28.2, F-28.3 types)

**Purpose**: types both stories depend on, plus the registry consolidation that must happen **before**
two more registries exist.

**⚠️ CRITICAL**: no user story work begins until this phase completes.

**Order within the phase**: execution contract before agent contract. `AgentGateway.execute()` takes
an `ExecutionSession`; the environment knows nothing about agents. Building it the other way round
would make the execution layer depend on the AI layer — the coupling this epic exists to remove.

- [X] T545 [P] Write failing unit tests for `ExecutionResult` narrowing, descriptor validation, and the `WorkspaceBinding` union — **including type-level assertions (`@ts-expect-error` / `expectTypeOf`) that a `persistent` binding without a `branch` does not compile (`FR-AGT-008`)** — in `packages/execution-contract/tests/unit/contract.spec.ts`

  > The compile-time claim is the mechanism, not a nicety: [data-model.md](./data-model.md) argues the
  > union is what makes Native §5's *"no sandbox state may implicitly become authoritative project
  > state"* structural rather than conventional. An untested type claim is a comment.
- [X] T546 Define `ProjectExecutionEnvironment`, `ExecutionEnvironmentDescriptor`, `ExecutionRequest`, `ExecutionSession`, `ExecResult`, `ResourceLimits` and the failure taxonomy (closed enum, no `unknown` member) in `packages/execution-contract/src/index.ts` (unit test: T545)
- [X] T547 Define the `WorkspaceBinding` discriminated union, `EgressProfile` and `ScopedCredentialRef` in `packages/execution-contract/src/index.ts` (unit test: T545)
- [X] T548 [P] Write failing unit tests asserting the frozen `generation` profile matches `ADR-0002` exactly — AI provider endpoint only — in `packages/execution-contract/tests/unit/validation.spec.ts`
- [X] T549 Define `GENERATION_EGRESS_PROFILE` as a frozen constant in `packages/execution-contract/src/profiles.ts` (unit test: T548)
- [X] T549a Write a conformance check asserting `engine-adapters/speckit/tests/unit/sandbox-config.spec.ts` and `engine-adapters/speckit/docker/sandbox.json` are **unchanged from `main`** — content hash comparison — in `tests/governance/generation-egress-frozen.spec.ts`

  > **`SC-AGT-005` had no enforcement that could fail in CI** until the analyse pass of 2026-08-14 —
  > only a `git diff` inside `T591`'s quickstart run. The epic's own checklist calls it *"the most
  > important criterion and the easiest to skip"*, and it is the one that proves which half of a
  > security boundary this epic did **not** touch. A modified test would pass just as green and mean
  > nothing; a hash comparison is the only form of that assertion that works.
- [X] T550 [P] Write failing unit tests for `AgentResult` narrowing, `AGENT_FAILURE_REASONS` completeness (closed enum, no `unknown` member), and **`AgentDescriptor` carrying every field Native §7 names (`FR-AGT-002`)** in `packages/agent-contract/tests/unit/contract.spec.ts`
- [X] T551 Define `AgentGateway`, `AgentDescriptor`, `AgentInvocation`, `AgentContext`, `AgentExecutionRecord` and `AGENT_FAILURE_REASONS` in `packages/agent-contract/src/index.ts` (unit test: T550)
- [X] T552 [P] Write failing unit tests asserting `assertAgentCapabilities` refuses and names **every** missing capability in `packages/agent-contract/tests/unit/contract.spec.ts`
- [X] T553 Implement `assertAgentCapabilities` and `MissingAgentCapabilityError` in `packages/agent-contract/src/index.ts` (unit test: T552)
- [X] T554 [P] Write failing unit tests asserting exactly one implementation owns `FR-021` capability validation in `backend/tests/unit/engines/registry-ownership.spec.ts`
- [X] T648 Remove the duplicate registry — `worker/src/engine-composition.ts` delegates capability validation to `backend/src/modules/engines/engine-registry.service.ts` (unit test: T554) *(routed from EPIC-003)*

  > **Open since 2026-08-08 with no owner.** Two implementations of `FR-021` that can disagree.
  > Fixed here rather than later because this epic adds an agent registry and an execution-provider
  > registry: fixing one duplicate is cheap, fixing three is a refactor. See [research.md](./research.md) `R-028-3`.

**Checkpoint**: both contracts compile, one registry owns capability validation, and no story work has started.

---

## Phase 3: User Story 1 — the AI provider swaps without touching the engine (P1) 🎯 MVP

**Goal**: an operator registers a different agent adapter and generation runs unchanged, with the new
provider recorded as its producer.

**Independent Test**: run one agent-agnostic caller against two adapters; identical result shape,
identical failure classification, **distinct provenance**. The `V11` pattern EPIC-003 proved for
engines, applied to the axis the amendment cares about.

### Tests for User Story 1 (MANDATORY — Constitution V) ⚠️

- [X] T555 [P] [US1] Write failing unit tests for `AgentRegistry` register / resolve / list, capability refusal, **and refusal of a second adapter claiming an already-registered provider identifier** (spec Edge Cases) in `worker/tests/unit/agent-registry.spec.ts`
- [X] T556 [P] [US1] Write the failing agent conformance suite — already-aborted signal, hung step, failure misclassification, capability refusal — in `agent-adapters/fixture/tests/conformance.spec.ts`
- [X] T557 [P] [US1] Write failing unit tests for `ClaudeAgent` descriptor, invocation and failure mapping in `agent-adapters/claude/tests/unit/claude.agent.spec.ts`
- [X] T558 [P] [US1] Write failing unit tests asserting `SpecKitEngine` accepts an injected agent and names no provider in `engine-adapters/speckit/tests/unit/agent-injection.spec.ts`
- [X] T559 [P] [US1] Write failing unit tests asserting no prompt and no model output reaches operational logs (PC-3) in `engine-adapters/speckit/tests/unit/log-exclusion.spec.ts`
- [X] T560 [P] [US1] Write the failing architecture test — no provider identifier under `backend/src` or in any engine adapter, covering imports, cross-directory imports, **string identifiers** and dynamic imports; **plus the layering rule: `packages/execution-contract` must not import `@pmi/agent-contract`** — in `backend/tests/architecture/agent-independence.spec.ts`

  > The layering assertion was added by the analyse pass of 2026-08-14. [plan.md](./plan.md)'s build
  > order rests on it — *"the agent contract references `ExecutionSession`, never the other way round…
  > getting this backwards would make the execution layer depend on the AI layer"* — and nothing
  > enforced it. A claim the build order depends on should fail a build, which is `ADR-0001`'s whole
  > argument applied to a third seam.
- [X] T561 [P] [US1] Write a failing integration test running one agent-agnostic caller against both adapters in `backend/tests/integration/agent-swap.spec.ts`

  > The string-identifier check in `T560` is the one that matters. Today's violation is `'claude'` as
  > a command-line **argument**, not as an import — `engine-independence.spec.ts` `T142a` widened the
  > engine check for exactly this reason and the same widening is needed here.

### Implementation for User Story 1

- [X] T562 [US1] Implement `AgentRegistry` and `composeAgentRegistry()` in `worker/src/agent-composition.ts`, delegating capability validation per T648 (unit test: T555)
- [X] T563 [US1] Implement `FixtureAgent` in `agent-adapters/fixture/src/index.ts` (conformance: T556)
- [X] T564 [US1] Implement `ClaudeAgent` in `agent-adapters/claude/src/index.ts`, carrying `specKitIntegrationName: 'claude'` — **the only place that string may now appear** (unit test: T557)
- [X] T565 [US1] Run the shared conformance suite against `ClaudeAgent` in `agent-adapters/claude/tests/conformance.spec.ts` (suite: T556)
- [X] T566 [US1] Refactor `SpecKitEngine` to take an injected `AgentGateway` — replace `--integration claude` with `agent.descriptor.specKitIntegrationName` and the four `claude` command invocations with `agent.execute()` — in `engine-adapters/speckit/src/speckit.adapter.ts` (unit test: T558)
- [X] T567 [US1] Record `AgentExecutionRecord` (provider, model, agent version, execution id, correlation id, timestamps, status, cost metadata) in `engine-adapters/speckit/src/speckit.adapter.ts` (unit tests: T558, T559)
- [X] T568 [US1] Sweep the remaining provider names out of `engine-adapters/speckit/src/` until `agent-independence.spec.ts` passes (test: T560)
- [X] T569 [US1] Register both agent adapters at the worker composition root in `worker/src/agent-composition.ts` (integration test: T561)

**Checkpoint**: the AI provider is swappable, and the build fails if anyone names one outside an agent adapter. **US1 is independently testable and is the MVP.**

---

## Phase 4: User Story 2 — a real container produces a specification (P1)

**Goal**: a generation job starts a real container, runs the engine inside it, and writes a
specification — the first time in this programme's history.

**Independent Test**: quickstart `V6`. **It has never run.**

**Depends on US1** for `T646b` only: the manual run exercises engine → agent → environment end to
end. Everything else in this phase is independently testable against a mocked daemon.

### Tests for User Story 2 (MANDATORY — Constitution V) ⚠️

- [X] T570 [P] [US2] Write failing unit tests for the Docker provider against a **mocked daemon** — request construction, every `ADR-0002` flag present (non-root, read-only rootfs, cpu/memory/pid caps, network mode), failure mapping, cancellation, teardown idempotence, **and that it registers as the Phase 1 default (`FR-AGT-007`)** — in `execution-providers/docker/tests/unit/docker.provider.spec.ts`
- [X] T571 [P] [US2] Write failing unit tests asserting the provider refuses a `persistent` binding, naming the reason, in `execution-providers/docker/tests/unit/lifecycle-refusal.spec.ts`
- [X] T572 [P] [US2] Write a failing integration test asserting the default engine resolves to Spec Kit and the engine → agent → environment chain wires end to end in `backend/tests/integration/engine-default.spec.ts`

### Implementation for User Story 2

- [X] T646a [US2] Implement `DockerExecutionEnvironment` against the Docker Engine HTTP API over its unix socket — **no `dockerode`, no `docker` CLI** — in `execution-providers/docker/src/index.ts` (unit test: T570) *(routed from EPIC-003)*
- [X] T573 [US2] Declare `supportedLifecycles: ['ephemeral']` and implement the persistent-binding refusal in `execution-providers/docker/src/index.ts` (unit test: T571)
- [X] T574 [US2] Register the Docker provider at the worker composition root in `worker/src/execution-composition.ts` (unit test: T570)
- [X] T575 [US2] Replace `ContainerRuntime` with `ProjectExecutionEnvironment` in `SpecKitEngine` and **delete the local `ContainerRuntime` declaration** from `engine-adapters/speckit/src/speckit.adapter.ts` (unit test: T558)
- [X] T647 [US2] Register `SpecKitEngine` as the default engine in `worker/src/engine-composition.ts`, satisfying `FR-018` (integration test: T572) *(routed from EPIC-003)*
- [X] T576a [P] [US2] Write failing unit tests for the manual runner's step sequencing, image-digest extraction and transcript formatting — driven by a stubbed environment, no daemon required — in `scripts/tests/v6-real-run.spec.mjs`
- [X] T576 [US2] Create the manual runner `scripts/v6-real-run.mjs` implementing quickstart `V6`, printing the image digest and every step outcome (unit test: T576a)

  > **Constitution V applies here.** `scripts/` is not on Constitution I's exempt list, so this is
  > application code and V is NON-NEGOTIABLE. The runner's *logic* — ordering, digest extraction,
  > transcript shape — is testable without a daemon; only `T646b`'s **execution** is not. Conflating
  > the two is how an untested script ends up as the sole evidence for `SC-AGT-001`.
- [X] T646b [US2] **MANUAL** — run `scripts/v6-real-run.mjs` on a machine with a Docker daemon; commit the transcript, including the image digest, to `specs/028-agent-execution-seam/v6-transcript.md` (conformance check: T577) *(routed from EPIC-003)*

  > **RUN 2026-08-17. A real container started — the first in this programme's history.**
  > Transcript committed with its image digest, `sha256:c9e1f7e4d95b…`. Four of six steps pass:
  > the environment and agent resolve, the container **starts**, and the image is identified by
  > digest rather than tag. The run then stops at `generate_specification` with
  > *"Refusing to start a sandbox without an AI provider credential"* — correct behaviour (E7
  > refuses a doomed run before it is billed), and an environmental limit, not a defect.
  >
  > **`SC-AGT-001` is therefore NOT satisfied.** It requires a specification generated end to end,
  > and none was. The task is complete because the task was *run it and commit the transcript*; the
  > success criterion is not, and the transcript says so in its own words rather than in a comment
  > somewhere else. EPIC-028 remains **not release-eligible**.
  >
  > **It took six defects to get this far**, every one invisible to 658 passing unit tests, because
  > each lives at a seam a mock replaces — `DEF-028-004` through `DEF-028-010`. That is the return
  > on splitting `T646b` out and refusing to let a green CI run stand in for it.
  >
  > Remaining, to satisfy `SC-AGT-001`: an `AI_PROVIDER_TOKEN`, and an egress network that permits
  > exactly `api.anthropic.com` — which needs the proxy `D-28` records as undelivered (`R-028-8`).
  > See [`docs/operator-setup.md`](../../docs/operator-setup.md).

  > **RAID R-04 blocks container-in-container in CI**, so this cannot run there. It is split from
  > `T646a` deliberately: EPIC-003 shipped 65 passing tests and an engine that cannot start, and its
  > closure report says *"No real container has ever started."* A green CI run is **not** evidence for
  > this task and must not be reported as one. If the run fails because `claude -p <command>` is not a
  > supported server-side model (`R-028-5`, uninvestigated by decision), **that is a finding, not a
  > defeat** — see [spec.md](./spec.md) Clarifications.

- [X] T577 [P] [US2] Write a conformance check asserting `v6-transcript.md` exists and names an image digest, in `tests/governance/v6-transcript.spec.ts` (gates T646b at closure)

**Checkpoint**: `SC-AGT-001` satisfied — or a real finding recorded. Either is progress; eleven days of not knowing is not.

---

## Phase 5: User Story 3 — execution substrate and egress are policy, not code (P1)

**Goal**: the execution provider and the network policy are chosen by registration and configuration,
never by editing business logic.

**Independent Test**: quickstart `V5` — six individual refusals, each its own assertion.

### Tests for User Story 3 (MANDATORY — Constitution V) ⚠️

- [X] T578 [P] [US3] Write failing unit tests asserting `*`, `0.0.0.0/0`, `::/0` and an empty destination list are each rejected, in `packages/execution-contract/tests/unit/validation.spec.ts`
- [X] T579 [P] [US3] Write failing unit tests asserting a provider with `supportsNetworkPolicy: false` cannot accept any egress profile, in `packages/execution-contract/tests/unit/validation.spec.ts`
- [X] T580 [P] [US3] Write failing unit tests asserting a `ScopedCredentialRef` without `expiresAt` is rejected, that `env` contains no credential value, **and that an unresolvable credential ref fails the run before any container starts** (spec Edge Cases), in `packages/execution-contract/tests/unit/validation.spec.ts`
- [X] T581 [P] [US3] Write the failing architecture rule — no component outside the worker composition root reaches a container runtime directly — appended to `backend/tests/architecture/agent-independence.spec.ts`

### Implementation for User Story 3

- [X] T582 [US3] Implement `assertEgressProfile` — non-empty destinations, no wildcard or general-internet form — in `packages/execution-contract/src/validation.ts` (unit test: T578)
- [X] T583 [US3] Implement the provider/profile compatibility refusal in `packages/execution-contract/src/validation.ts` (unit test: T579)
- [X] T584 [US3] Implement `ScopedCredentialRef` validation and the `env` secret-scan in `packages/execution-contract/src/validation.ts` (unit test: T580)
- [X] T585 [US3] Define the **deliberately minimal** `implementation` egress profile — AI provider endpoint only, `enforcement: 'proxy'` recording intent — in `packages/execution-contract/src/profiles.ts` (unit test: T578)

  > One destination on purpose (`R-028-6`, confirmed 2026-08-14). A guessed npm/PyPI/GitHub list would
  > be untested, would read as authoritative, and would be inherited as settled. **The proxy is not
  > built here** — the Docker provider implements the network-policy half.

- [X] T586 [US3] Make the runtime-access rule pass — route every container access through `ProjectExecutionEnvironment` (test: T581)

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T587 **Mutation-test the agent conformance suite** — break one assertion in `agent-adapters/fixture/src/index.ts`, confirm `agent-adapters/fixture/tests/conformance.spec.ts` turns red, restore it, and record the result in the closing report

  > EPIC-003 did this and it is the only evidence a conformance suite tests anything: *"dropping
  > `location` from a fixture finding turned `C11` red, so the suite is not vacuous."* A suite nobody
  > has broken on purpose is decoration.

- [X] T588 [P] Write `specs/028-agent-execution-seam/preserved-elements.md` recording the three Native §28 changes — `SpecificationEngine` contract (unchanged), Docker isolation, sandbox credential model — each with reason, affected requirement, migration impact, compatibility impact and alternative considered (conformance check: T589)
- [X] T589 [P] Write a conformance check asserting every `preserved-elements.md` row carries all five §28 fields non-empty, in `tests/governance/preserved-elements.spec.ts` (pairs with T588)
- [X] T590 [P] Mark the three new dependency rules as **enforced** in `specs/_shared/ai-native-architecture.md` §C.2

  > **No conformance check, deliberately.** Constitution V covers document outputs, but **no
  > `specs/_shared/*.md` in this corpus has a check** — EPIC-018's governance suite covers
  > `governance/**` only. Adding one here for a single paragraph would create a standard that seven
  > sibling documents fail. Recorded as a **corpus-wide gap** rather than fixed locally; it belongs
  > in an EPIC-018 follow-up alongside `D-39`.
- [X] T591 Run quickstart `V0`–`V5`, `V7`, `V8` and record every result, distinguishing passes from unrun

---

## Phase Z: Epic Closure (MANDATORY — Constitution IV, VI, VII, IX)

- [X] T592 Confirm every implementation task has a passing unit test, **and** that no Vitest project collects zero tests (T537) — the check that would have caught the EPIC-003 correction
- [X] T593 Run `/speckit-converge`; append and complete any remaining unbuilt work
- [X] T594 Triage `specs/028-agent-execution-seam/defects/`; every record closed or deferred to a named Epic
- [X] T595 Annotate the routed rows in `specs/003-specification-engine/tasks.md` — `T646`, `T647`, `T648` now owned by EPIC-028 — without reopening EPIC-003's closure
- [X] T596 Publish the Epic closing report: work completed, work deferred, `T646b`'s outcome stated plainly, and the recommended next command (Constitution IX)

### Found by running it *(added 2026-08-17 — `T646b`)*

*`T646b` was expected to be a formality: one command on a machine with a daemon. It found six
defects, and not one of them was reachable by any check on either side of the seam it broke. These
tasks are their fixes, each with a test confirmed red by mutation.*

- [X] T668 Make the daemon socket resolution platform-aware and the runner executable — `resolveDockerSocketPath` in `execution-providers/docker/src/index.ts` and a CLI entry point in `scripts/v6-real-run.mjs` (`DEF-028-004`, `DEF-028-005`; unit tests: `execution-providers/docker/tests/unit/socket-resolution.spec.ts`, `scripts/tests/v6-entry-point.spec.mjs`)
- [X] T669 Pin the engine image to a release that exists and record the resolved artifact digests in `engine-adapters/speckit/docker/pinned-versions.json` (`DEF-028-006`; unit test: `engine-adapters/speckit/tests/unit/pinned-versions.spec.ts`)
- [X] T670 Preflight the egress network and classify a 404 by what the daemon says it could not find, in `execution-providers/docker/src/index.ts` (`DEF-028-007`, `DEF-028-008`; unit test: `execution-providers/docker/tests/unit/egress-network-preflight.spec.ts`)
- [X] T671 Reset the image entrypoint so the container idles long enough to be exec-ed into (`DEF-028-009`; unit test: same file)
- [X] T672 Report the image digest from the session the provider started, and make the transcript state only what the run proved (`DEF-028-010`; unit tests: same file and `scripts/tests/v6-entry-point.spec.mjs`)
- [X] T673 Write `docs/operator-setup.md` and give quickstart `V6` the three prerequisites it never had (`DEF-028-006`, `DEF-028-007`; check: `T577`, which now finds a transcript)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup** — no dependencies. `T537` first.
- **Phase 2 Foundational** — depends on Phase 1. **Blocks all three stories.** Execution contract before agent contract.
- **Phase 3 US1** — depends on Phase 2. No dependency on US2 or US3.
- **Phase 4 US2** — depends on Phase 2. `T646b` **additionally depends on US1** (the manual run exercises the full chain).
- **Phase 5 US3** — depends on Phase 2. Independent of US1 and US2.
- **Phase 6 / Phase Z** — depend on all stories.

### The one cross-story edge

```text
US1 complete ──► T646b (manual real run)
```

Everything else in US2 is provable against a mocked daemon, so US2 and US3 can proceed in parallel
with US1 up to that point.

### Within each story

- Tests written first and failing (Constitution V)
- Contracts before registries, registries before adapters, adapters before composition roots
- `T646a` (mocked, CI) before `T646b` (manual, not CI)

### Parallel opportunities

- **Phase 1**: T540, T542, T543, T544 in parallel
- **Phase 2**: T545/T548 and T550/T552/T554 in parallel; T546–T547 sequential (same file)
- **Phase 3**: all seven test tasks T555–T561 in parallel
- **Phase 4**: T570, T571, T572 in parallel
- **Phase 5**: T578–T581 in parallel; T582–T584 sequential (same file)
- **US1, US2 and US3 can run in parallel** once Phase 2 completes, with the single edge above

---

## Parallel Example: User Story 1

```bash
# All seven US1 tests together, written first:
Task: "Agent registry tests in worker/tests/unit/agent-registry.spec.ts"
Task: "Agent conformance suite in agent-adapters/fixture/tests/conformance.spec.ts"
Task: "ClaudeAgent unit tests in agent-adapters/claude/tests/unit/claude.agent.spec.ts"
Task: "Agent injection tests in engine-adapters/speckit/tests/unit/agent-injection.spec.ts"
Task: "Log exclusion tests in engine-adapters/speckit/tests/unit/log-exclusion.spec.ts"
Task: "Architecture test in backend/tests/architecture/agent-independence.spec.ts"
Task: "Agent swap integration test in backend/tests/integration/agent-swap.spec.ts"
```

---

## Implementation Strategy

### MVP first — User Story 1 only

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → 4. **STOP and validate**: run `V1`, `V2`, `V3`, `V4`.

At that point the AI provider is swappable and the build defends it. That is a complete, valuable
increment even if the epic stopped there — and it removes a coupling that exists in the tree today.

### Incremental delivery

1. Setup + Foundational → foundation ready
2. **US1** → provider independence, enforced (MVP)
3. **US3** → policy validation; parallel with US1 if staffed
4. **US2** → the real container run; `T646b` last

**US2 is deliberately last despite being P1.** It is the epic's headline outcome and its most
uncertain task, and it is the only one that cannot be verified in CI. Everything else being green
first means a `T646b` failure is unambiguously about the container or the vendor invocation, not
about the seam.

---

## Notes

- `[P]` = different files, no dependencies on incomplete tasks
- Verify tests fail before implementing — this is not ceremony; the EPIC-003 correction found three
  tasks marked `[X]` with no test file in the repository
- Never edit code outside a Spec Kit command (Constitution I); defects become new tasks (VI)
- Unrun tests are never reported as passing (Constitution IX). **`T646b` is the task most likely to
  be misreported** — a green CI run says nothing about it
- Commit after each task or logical group

## Phase 7: Convergence *(appended 2026-08-19 — `T646b` run with a credential, `DEF-028-011`)*

- [X] T692 Assert exit-code propagation from a real container exec, including Docker's `ExitCode: null` while an exec is unfinished, and decide whether an unknown exit status should default to failure rather than `0`, in `execution-providers/docker/tests/unit/exec-exit-code.spec.ts` per `DEF-028-011` (contradicts) — `ExitCode` appears once in the repository, at `execution-providers/docker/src/index.ts:481`, and in no test; `?? 0` reads unknown as success, which reported a failing agent as a succeeding one
- [X] T693 Wire the credential the agent CLI actually reads, at the seam the `DEF-028-011` decision settles, per `SC-AGT-001` and `R-028-5` (missing) — the sandbox sets `AI_PROVIDER_TOKEN`, Claude Code reads `ANTHROPIC_API_KEY`, and nothing maps between them; verified against the image digest by replicating the sandbox environment (unit test: T692 covers the masking; the mapping needs its own)
- [X] T694 Request the model the descriptor names, by full name, in `agent-adapters/claude/src/index.ts` per `FR-022` and `DEF-028-012` (contradicts) — the descriptor advertised `claude-opus-5` while the invocation passed no `--model`, so the CLI used its pinned default `claude-sonnet-4-20250514` (404, retired) and every provenance record would have named a model that never ran (unit test: `agent-adapters/claude/tests/unit/claude.agent.spec.ts`)
- [X] T695 Verify the adapter's scaffold produces `.specify/` inside the session workspace, separately from the tool grant, per `SC-AGT-001` (partial) — a probe of `specify init … --ignore-agent-tools` left the directory empty, and an agent with no tools would fail against a correct scaffold too; the two must not be conflated
- [X] T696 Grant the headless agent `Bash` and `Write` at the narrowest scope, in `agent-adapters/claude/src/index.ts` per `SC-AGT-001` and `DEF-028-012` (missing) — granted by the project owner 2026-08-19; NOT `--dangerously-skip-permissions`, which the CLI offers and which would grant everything (unit test: `agent-adapters/claude/tests/unit/claude.agent.spec.ts`)
- [X] T697 Bind `HOME="$PWD"` in the invocation per `DEF-028-013` (contradicts) — the sandbox is `ReadonlyRootfs`, Claude Code writes `~/.claude.json` at startup and threw `EROFS`, then exited 0 from an unhandled rejection so the adapter read success from a crashed process (unit test: `agent-adapters/claude/tests/unit/claude.agent.spec.ts`)
- [X] T698 Capture the agent's stderr from the failing sandbox run and isolate why it exits non-zero under `GENERATION_EGRESS_PROFILE`, per `DEF-028-013` (partial) — the same chain succeeds with open networking and produces a specification, so the cause is inferred from a difference rather than observed; a diagnostic that names it is worth more than another guess
- [X] T699 Pre-bake the Spec Kit scaffold into the container image at build time, so generation needs no network beyond the AI provider, per `ADR-0002` (missing) — **settled 2026-08-19**: pre-baking over a second network posture or a widened generation profile, because both alternatives add a way for a generation run to reach further than the provider, which is the one thing that profile prevents — the generation profile permits `api.anthropic.com` only, by design; if `specify init` needs GitHub then scaffolding and generation want different postures, and that changes what `ADR-0002` promises. Owner: project-owner
- [X] T700 Assert the egress network CONFORMS to the profile rather than merely existing, in `execution-providers/docker/src/index.ts` per `SC-AGT-005` and `DEF-028-015` (partial) — refuse an `internal` network for a profile that names permitted destinations, and refuse one permitting more than the profile names; the second half needs `D-28` to say how enforcement is expressed. Existence is not conformance, and the silent direction is the dangerous one: a plain bridge network permits the whole internet while the profile reports as enforced

  > **`D-28` decided 2026-08-19 (project owner): Option A — own the proxy.** Enforcement is
  > expressed as: the profile's network is `--internal`, **plus** a proxy sidecar dual-homed
  > between that network and the outside, whose allowlist is generated from exactly the
  > profile's `allowedDestinations`. Phase 8 below delivers it; this task's "second half" is
  > completed there as `T706`.

## Phase 8: Egress proxy — `D-28` delivered *(appended 2026-08-19, decision session with project owner)*

**Goal**: deliver the proxy that `ADR-0013` recorded as undelivered, so the `generation` profile is
**enforced** rather than merely declared — closing the last gap in front of `SC-AGT-001` (`R-028-8`).

**Decision context**: `D-28` Option A, chosen over amending `ADR-0002` (Option B) because the
2026-08-14 session already refused to widen the generation posture, and over deferral (Option C)
because the component is small. **Constraint**: `GENERATION_EGRESS_PROFILE` is frozen byte-for-byte
by `tests/governance/generation-egress-frozen.spec.ts` — the proxy is delivered at the
provider/operator seam; **no task below may modify `packages/execution-contract/src/profiles.ts`**.

**Independent Test**: quickstart `V6` rerun through the proxy — the sandbox reaches
`api.anthropic.com`, a probe of any other destination is refused by the proxy, and the committed
transcript names the enforced network. That transcript is the evidence for `SC-AGT-001`.

### Tests and implementation (Constitution V — tests first, failing, then code)

- [X] T701 [P] [US3] Write failing unit tests for proxy allowlist-config generation from an `EgressProfile` — exactly the profile's `allowedDestinations`, CONNECT-only, rejecting wildcard/empty via the same rules as `assertEgressProfile` — in `execution-providers/docker/tests/unit/proxy-config.spec.ts`
- [X] T702 [US3] Implement the proxy config generator in `execution-providers/docker/src/proxy-config.ts`, consuming an `EgressProfile` and emitting the sidecar's allowlist config; NOT hand-written config, so profile and enforcement can never disagree (unit test: T701)
- [X] T703 [US3] Create the proxy sidecar image definition in `execution-providers/docker/proxy/Dockerfile` with the base image pinned by digest in `engine-adapters/speckit/docker/pinned-versions.json` per RAID `R-01` conventions (conformance check: T704 reads the Dockerfile and the pin; a digest-less base fails it)
- [X] T704 [P] [US3] Write the executable conformance check for the sidecar definition — Dockerfile exists, base pinned by digest, entrypoint consumes the T702-generated config — in `tests/governance/egress-proxy-image.spec.ts` (gates T703)
- [X] T705 [US3] Create the operator bring-up script `scripts/egress-proxy-up.mjs` — creates `pmi-egress-generation` as `--internal`, starts the sidecar dual-homed (internal + egress bridge) with the generated allowlist — with its logic (network flags, container wiring, idempotent re-run) driven by failing-first unit tests in `scripts/tests/egress-proxy-up.spec.mjs`, stubbed daemon, no Docker required (pattern of T576a)
- [X] T706 [US3] Complete `T700`'s second half: extend the preflight in `execution-providers/docker/src/index.ts` to assert network CONFORMANCE per the `D-28` ruling — the profile's network must be `internal` AND carry the proxy sidecar configured from exactly the profile's destinations; refuse a non-internal network, refuse a missing or mis-configured sidecar, each refusal its own assertion in `execution-providers/docker/tests/unit/egress-network-preflight.spec.ts` (unit test extends the existing spec; closes `DEF-028-015`)
- [X] T707 [US3] Inject `HTTPS_PROXY`/`HTTP_PROXY` (and `NO_PROXY` for loopback) into the sandbox container Env at the provider seam in `execution-providers/docker/src/index.ts`, pointing at the sidecar's internal address — WITHOUT touching the frozen profile object (unit test: new cases in `execution-providers/docker/tests/unit/egress-network-preflight.spec.ts` asserting Env contents follow the profile's network)
- [X] T708 [P] [US3] Update `adr/ADR-0013-controlled-network-egress.md` (D-28: proxy delivered, enforcement expression recorded), `docs/operator-setup.md` (proxy bring-up replaces the containment-or-reachability caveat) and `specs/028-agent-execution-seam/quickstart.md` V6 note — paired with an executable conformance check in `tests/governance/egress-proxy-docs.spec.ts` asserting the ADR no longer says "not built" and operator-setup names `scripts/egress-proxy-up.mjs` (Constitution V: docs pair with a check that can fail)
- [X] T709 [US2] **MANUAL** — rerun `scripts/v6-real-run.mjs` on a Docker machine with `AI_PROVIDER_TOKEN`, through the proxy-enforced `pmi-egress-generation` network; commit the transcript to `specs/028-agent-execution-seam/v6-transcript.md` including the image digest, the network's `internal` flag, and one refused non-allowlisted probe (conformance check: T710). This run is the evidence for `SC-AGT-001`; complete open `T695` (scaffold produces `.specify/` in the session workspace) during the same run, since the pre-baked scaffold (`T699`) is exercised by it
- [X] T710 [P] [US2] Extend `tests/governance/v6-transcript.spec.ts` to require the transcript name the enforced network and the refused probe, so a transcript produced on a bridge network can never again read as enforced (gates T709 at closure)

**Checkpoint**: `SC-AGT-001` satisfied with a proxy-enforced transcript — or a real finding recorded
naming which seam refused. `/speckit-converge` after this phase per Constitution IV.

## Phase 9: Convergence *(appended 2026-08-20 — post-`T709` run; code converged, records drifted)*

The convergence run found **zero code gaps**: every FR, SC, acceptance scenario and edge case is
satisfied and verified (738 unit + 762 governance + 22 architecture tests green; `v6-transcript.md`
PASSED, proxy-enforced). Every finding below is an epic governance document now **contradicting**
the delivered state — the audit trail lagging the code it audits (Constitution VI).

- [X] T711 Close `specs/028-agent-execution-seam/defects/DEF-028-015-egress-network-is-checked-for-existence-not-for-what-it-permits.md` — status OPEN says "the fix needs `D-28`, which is unowned"; `D-28` was decided 2026-08-19 (Option A) and delivered by `T706` (conformance preflight refuses non-internal networks and missing sidecars) — record resolution, resolving tasks, and the verifying test file per Constitution VI (contradicts)
- [X] T712 Close `specs/028-agent-execution-seam/defects/DEF-028-013-read-only-home-and-the-egress-scaffold-tension.md` — status PARTIALLY FIXED says "the egress tension is open"; resolved by `T699` (pre-baked scaffold) plus the Phase 8 proxy, proven by the 2026-08-20 PASSED run — record resolution per Constitution VI (contradicts)
- [X] T713 Update `specs/028-agent-execution-seam/closure.md` — it reports "72 of 72 tasks", `SC-AGT-001` "still unmet", and "not release-eligible", all three now false (82/82, satisfied with committed evidence, convergence clean on code) — rewrite the closing state per `SC-AGT-001` and Constitution IX's honesty rule (contradicts)
- [X] T714 Update `specs/028-agent-execution-seam/quickstart-results.md` — the `V6` row reads "🔴 NOT RUN — no Docker daemon on this machine" and the verdict "`SC-AGT-001` is UNVERIFIED"; `V6` ran 2026-08-20 and PASSED through the enforced proxy per `SC-AGT-001` (contradicts)
- [X] T715 Close risk `R-028-5` in `specs/028-agent-execution-seam/research.md` — "OPEN — not investigated" asks whether `claude -p <command>` in a container is a supported execution model; two real runs (2026-08-19 open-network, 2026-08-20 proxy-enforced) each produced a specification, so the answer is recorded as YES with the transcript as evidence (partial)

**Checkpoint**: the epic's record agrees with the epic's code. Then Constitution IV's exit gate is
met and promotion `local → dev` is unblocked (Constitution VII).
