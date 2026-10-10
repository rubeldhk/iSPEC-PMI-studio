# Tasks: Engineering Experts

**Epic**: `EPIC-047` · **Branch**: `epic/047-engineering-experts` · **Generated**: 2026-10-09

**Inputs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/experts-api.md](./contracts/experts-api.md) ·
[quickstart.md](./quickstart.md)

**Task ID range**: `T1900`–`T1993`, **94 tasks**.

> `T1986`–`T1993` were added on 2026-10-09 to remediate [analysis.md](./analysis.md) findings C1, C2,
> U1 and I3. They sit out of numeric sequence within their phases, because identifiers are never
> renumbered once written. Findings I1, C3, C4, C5, A1 and P1 were remediated by amending the
> descriptions of not-yet-started tasks.

> **On the identifiers.** `G-26-15` requires identifiers unique across the corpus. The highest in
> use is `T1879` — on the unmerged `EPIC-038` branch, not on `main` — so allocation starts at
> `T1900`, leaving `T1880`–`T1899` for any convergence still to come on the three open PRs.

**Tests are not optional here.** Constitution V: every implementation task names the test task
that must precede it and fail first.

**Three dependencies are open PRs** (`EPIC-031` #4, `EPIC-032` #3, `EPIC-038` #5). Every phase
before Phase 9 builds against ports bound **refusing** (`R-047-13`); Phase 9 binds the real
adapters and is blocked until those PRs merge.

---

## Phase 1: Setup

- [X] T1900 Create `specs/047-engineering-experts/defects/README.md` — Constitution VI's sole defect intake, tracked in git so `DOR-11` can read it
- [X] T1901 [P] Write the failing reachability test in `backend/tests/integration/experts-reachability.spec.ts` importing the real `AppModule` and calling `GET /experts` — Constitution XI Tier 1; must fail before T1902
- [X] T1902 Create `backend/src/modules/experts/experts.module.ts` and register it in `backend/src/app.module.ts` in the same change (integration test: T1901) — `DEF-005-001` is what an unregistered module looks like

**Checkpoint**: an intake for defects, and a module the application actually builds.

---

## Phase 2: Foundational (blocking — no user story may start before this completes)

- [X] T1903 [P] Write failing unit tests for the Expert types in `backend/tests/unit/expert-types.spec.ts` — `RiskBand` is exactly `low | medium | high`; `memoryPolicy` admits only `none`; per-limit `onUnenforceable` is `refuse | proceed`; a version has **no** status field (`R-047-5`)
- [X] T1904 Implement `backend/src/modules/experts/expert.types.ts` (unit test: T1903) — `EngineeringExpert`, `ExpertContract`, `ContractVersion`, `DelegationPolicy`, `ExpertSession`, `SessionLimit`, `Assignment`, local `RiskBand` (`R-047-6`)
- [X] T1905 [P] Write failing unit tests for the ports in `backend/tests/unit/expert-ports.spec.ts` — each of `ExpertGateways`, `ContractApprovals`, `EvidenceContracts`, `ContextAssembler` bound refusing throws `GovernanceSeamUnboundError` naming itself; none answers permissively
- [X] T1906 Implement `backend/src/modules/experts/experts.tokens.ts` with the six ports and their refusing bindings (unit test: T1905) — `R-047-13`
- [X] T1907 [P] Write failing unit tests for the in-memory store in `backend/tests/unit/expert-store.spec.ts` — workspace scoping on every read; no method updates a contract version except `recordDecision`, which writes once; assignments are superseded, never updated
- [X] T1908 Implement `backend/src/modules/experts/experts.store.ts` (interface + in-memory, unit tests only) (unit test: T1907)
- [X] T1909 [P] Write the failing integration test for the schema in `backend/tests/integration/expert-constraints.spec.ts` — raw SQL around the services: an `UPDATE` of any contract-version column other than a null `decisionId` is rejected by the trigger (`R-047-14`); `(workspaceId, key)` is unique; `memoryPolicy <> 'none'` violates a `CHECK`; a limit row cannot read `enforced` and `unenforceable` at once
- [X] T1910 Write `backend/prisma/migrations/<ts>_epic047_experts/migration.sql` and the matching models in `backend/prisma/schema.prisma` (integration test: T1909) — six tables per [data-model.md](./data-model.md), `CHECK` constraints, and the immutability trigger; never `prisma format`
- [X] T1911 [P] Write failing integration tests for the Prisma store in `backend/tests/integration/expert-store-prisma.spec.ts` — the same behaviour as T1907 against PostgreSQL
- [X] T1912 Implement `backend/src/modules/experts/experts.store.prisma.ts` (integration test: T1911)
- [X] T1913 [P] Write a failing unit test in `packages/agent-contract/tests/unit/enforceable-limits.spec.ts` — `enforceableLimits` is optional, admits only `time | resource | tokens | cost`, and every existing descriptor still type-checks without it
- [X] T1914 Add `enforceableLimits?` to `AgentDescriptor` in `packages/agent-contract/src/index.ts` (unit test: T1913) — `R-047-1`, additive
- [X] T1915 [P] Write a failing unit test in `packages/execution-registry-contract/tests/expert-event.spec.ts` — `expert-governance-recorded` is a member of the union and `isExecutionEventType` accepts it; its payload `kind` admits exactly the twelve kinds in `R-047-4`, including `review-required`
- [X] T1990 [P] Write failing unit tests for authoring authority in `backend/tests/unit/expert-authoring-authority.spec.ts` — register, new version, submit, retire and delegation-policy changes refuse without an `EPIC-024` edit grant on `expert-registry`; reads refuse without read; assignment refuses without edit on the task; a fault in the access check propagates rather than allowing (`FR-EXP-009`, analysis U1)
- [X] T1991 Implement `backend/src/modules/experts/authoring.ts` over `ActorAccess` and apply it in every registry, policy and assignment path (unit test: T1990)
- [X] T1916 Add `expert-governance-recorded` and its payload union to `packages/execution-registry-contract/src/events.ts` (unit test: T1915) — and assert it in `backend/tests/integration/execution-parity.spec.ts`

**Checkpoint**: types that cannot hold a cached approval or a remembered session, ports that refuse, a store that cannot rewrite history, and the two contract-package additions.

---

## Phase 3: User Story 1 — An AI role is a registered, governed Expert (Priority: P1) 🎯 MVP

**Goal**: register Experts with complete contracts, version them immutably, submit for approval, retire.

**Independent test**: quickstart Q1–Q4 — an incomplete contract is refused naming every gap; a complete one is a draft no run can use; an approved version is immutable.

- [X] T1917 [P] [US1] Write failing unit tests for contract validation in `backend/tests/unit/expert-contract-validation.spec.ts` — a contract missing three elements is rejected naming all three; `memoryPolicy` other than `none` names Governed Learning; preferred model repeated as a fallback is rejected; capabilities outside `AGENT_CAPABILITIES` rejected (`FR-EXP-010`, `011`, `020`)
- [X] T1918 [US1] Implement `backend/src/modules/experts/contract.validation.ts` (unit test: T1917)
- [X] T1919 [P] [US1] Write failing unit tests for dangling references in `backend/tests/unit/expert-dangling-references.spec.ts` — an unknown Evidence Contract, an unknown delegate Expert key, each named; `EvidenceContracts` unbound refuses `503` rather than accepting unchecked (`FR-EXP-022`)
- [X] T1920 [US1] Implement reference checks in `contract.validation.ts` against `EvidenceContracts` and the store (unit test: T1919)
- [X] T1921 [P] [US1] Write failing unit tests for derived approval in `backend/tests/unit/expert-approval-status.spec.ts` — no decision → `draft`; pending → `submitted`; `approved` or `auto-executed` → `approved`; `refused` → `refused`; a decision later refused after a read of `approved` is read as `refused` next time (`R-047-5`)
- [X] T1922 [US1] Implement `backend/src/modules/experts/approval.ts` (unit test: T1921)
- [X] T1923 [P] [US1] Write failing unit tests for the registry in `backend/tests/unit/expert-registry.spec.ts` — register creates the Expert and version 1 as a draft; a new version is max + 1 and copies nothing silently; submit stores the `decisionId` once and refuses a second submit `409`; the effective version is the highest approved; retire is idempotent and keeps history; every act records actor and instant; every act passes through `authoring.ts` (`FR-EXP-001`…`009`)
- [X] T1924 [US1] Implement `backend/src/modules/experts/registry.service.ts` (unit test: T1923)
- [X] T1925 [P] [US1] Write failing route tests in `backend/tests/integration/experts-registry-route.spec.ts` against the composed module — an actor without the edit grant is refused `403` and still reads with read (US1/AC6); `POST /experts`, `GET /experts`, `GET /experts/:id`, `POST …/contract-versions`, `POST …/submit` (`503` naming `ContractApprovals` while unbound), `GET …/compare`, `POST …/retire`; a second workspace sees none of them (`FR-EXP-008`)
- [X] T1926 [US1] Implement the registry routes in `backend/src/modules/experts/experts.controller.ts` per [contracts/experts-api.md](./contracts/experts-api.md) (integration test: T1925)
- [X] T1927 [P] [US1] Write failing unit tests for version comparison in `backend/tests/unit/expert-compare.spec.ts` — element-by-element, all twelve, unchanged elements reported as unchanged rather than omitted (`FR-EXP-072`)
- [X] T1928 [US1] Implement comparison in `registry.service.ts` (unit test: T1927)

**Checkpoint**: Experts exist, are versioned and approvable; nothing can run yet.

---

## Phase 4: User Story 2 — A run cannot do what its contract forbids (Priority: P1)

**Goal**: dispatch checks every request against the effective contract before anything executes, and records every refusal.

**Independent test**: quickstart Q5–Q7 — a tool outside the contract and a prohibited action are refused before execution, each as an event on a registered execution; a fallback is used and recorded.

- [X] T1929 [P] [US2] Write failing unit tests for authority in `backend/tests/unit/expert-authority.spec.ts` — capability or tool outside the contract refused naming it; a prohibited action refused **even when also allowed**; a target the contract permits but the actor may not read or edit refused, and the reverse (`FR-EXP-012`…`014`)
- [X] T1930 [US2] Implement `backend/src/modules/experts/authority.ts` over `ActorAccess` (unit test: T1929)
- [X] T1931 [P] [US2] Write failing unit tests for model selection in `backend/tests/unit/expert-model-selection.spec.ts` — preferred available → preferred; preferred missing, fallback available → fallback with reason; none → refused; a gateway for an undeclared model is never chosen; `assertAgentCapabilities` is applied (`FR-EXP-017`, `018`, `023`)
- [X] T1932 [US2] Implement model selection in `backend/src/modules/experts/dispatch.service.ts` over `ExpertGateways` (unit test: T1931)
- [X] T1933 [P] [US2] Write failing unit tests for dispatch preconditions in `backend/tests/unit/expert-dispatch-preconditions.spec.ts` — retired Expert, no approved version, unmet workspace requirement, command outside `GOVERNED_COMMANDS`, and an Evidence Contract no longer resolvable through `EvidenceContracts` (retired after approval — analysis C4), each refused naming the reason (`FR-EXP-006`, `019`, `022`, `R-047-3`)
- [X] T1934 [US2] Implement the preconditions in `dispatch.service.ts` (unit test: T1933)
- [X] T1935 [P] [US2] Write failing unit tests for registration order in `backend/tests/unit/expert-dispatch-registration.spec.ts` — the execution is registered **before** the gateway is called; every refusal is an `expert-governance-recorded` event of kind `dispatch-refused` on that execution and the error carries its `executionId`; an `expert_sessions` row names the contract version the run started under (`FR-EXP-060`…`062`)
- [X] T1936 [US2] Implement registration and refusal recording in `dispatch.service.ts` over `ExecutionRegistry` (unit test: T1935)
- [X] T1937 [P] [US2] Write failing unit tests for tool observation in `backend/tests/unit/expert-tool-observation.spec.ts` — a gateway that reports no tool calls yields `toolObservation: unobserved` and a `tool-use-unobserved` event, never `observed`; a reported call outside the contract is a `tool-call-breach` and stops the run where the gateway allows (`FR-EXP-024`)
- [X] T1938 [US2] Implement tool observation in `dispatch.service.ts` (unit test: T1937)
- [X] T1939 [P] [US2] Write failing unit tests for expected outputs in `backend/tests/unit/expert-expected-outputs.spec.ts` — a run missing a required output ends `incomplete`, not `succeeded`, with an `outputs-incomplete` event (`FR-EXP-021`)
- [X] T1940 [US2] Implement the output check in `dispatch.service.ts` (unit test: T1939)
- [X] T1941 [P] [US2] Write failing unit tests for context in `backend/tests/unit/expert-dispatch-context.spec.ts` — the contract's context policy is passed to `ContextAssembler` with the run's objective and actor, the package is bound to the execution, and a refusal from assembly refuses the dispatch; unbound refuses `503` (`FR-EXP-015`)
- [X] T1942 [US2] Implement context assembly in `dispatch.service.ts` (unit test: T1941)
- [X] T1943 [P] [US2] Write failing route tests in `backend/tests/integration/experts-dispatch-route.spec.ts` — `POST /experts/:id/dispatch` through the composed module, with `ExpertGateways` and `ContractApprovals` overridden by **in-test bindings that record every call** (the module default stays refusing — analysis I1, `R-047-13`): Q5, Q6, Q7; `GET /experts/sessions/:executionId` returns the session and its events; `GET /experts/:id/sessions?limit=` returns recent runs newest first (analysis C3); without the overrides, dispatch refuses `503` naming the port
- [X] T1944 [US2] Implement the dispatch, session and recent-runs routes in `experts.controller.ts` (integration test: T1943)
- [X] T1988 [P] [US2] Write failing unit tests for unattended runs in `backend/tests/unit/expert-unattended-review.spec.ts` — a dispatch marked unattended records `unattended` and `reviewRequired`, emits `review-required`, and its completion goes through `ExecutionRegistry.proposeTransition` — never `complete` — so it cannot pass a release control by itself (`FR-EXP-063`, `BR-0061`, analysis C2)
- [X] T1989 [US2] Implement unattended handling in `dispatch.service.ts` (unit test: T1988)

**Checkpoint**: a contract is enforced, not just recorded.

---

## Phase 5: User Story 3 — Delegated work stays attributable (Priority: P1)

**Goal**: delegation under contract and policy, each delegate its own linked session, authority only ever narrowed.

**Independent test**: quickstart Q11–Q13 — intersection, cycle refusal, and a depth-2 tree read from the records alone.

- [X] T1945 [P] [US3] Write failing unit tests for the delegation policy in `backend/tests/unit/expert-delegation-policy.spec.ts` — no policy → refused; pair not allowed by policy or by the contract's `delegatesTo` → refused; depth and fan-out limits enforced; `*` honoured (`FR-EXP-030`, `033`)
- [X] T1946 [US3] Implement `backend/src/modules/experts/delegation.service.ts` policy checks (unit test: T1945)
- [X] T1947 [P] [US3] Write failing unit tests for cycles in `backend/tests/unit/expert-delegation-cycles.spec.ts` — A→A and A→B→A refused; a refusal is a `delegation-refused` event on the **parent** session (`FR-EXP-032`, `035`)
- [X] T1948 [US3] Implement cycle detection in `delegation.service.ts` (unit test: T1947)
- [X] T1949 [P] [US3] Write failing unit tests for authority across a chain in `backend/tests/unit/expert-delegation-authority.spec.ts` — a delegate allowed more than its parent gets the intersection; three levels intersect all three; the stored `effectiveAuthority` equals what was checked (`FR-EXP-034`)
- [X] T1950 [US3] Extend `authority.ts` with chain intersection (unit test: T1949)
- [X] T1951 [P] [US3] Write failing unit tests for linkage in `backend/tests/unit/expert-delegation-link.spec.ts` — the delegate is its own execution with `delegatedFromExecutionId` set and `EPIC-037`'s `parentExecutionId` **unset**; it names its own contract version; depth is parent + 1 (`FR-EXP-031`, `R-047-3`)
- [X] T1952 [US3] Implement delegated dispatch in `dispatch.service.ts` and `delegation.service.ts` (unit test: T1951)
- [X] T1953 [P] [US3] Write failing unit tests for parent end in `backend/tests/unit/expert-stopped-by-parent.spec.ts` — a parent cancelled or timed out stops its running delegates, recorded `stopped-by-parent` (`FR-EXP-037`)
- [X] T1954 [US3] Implement the stop cascade in `delegation.service.ts` (unit test: T1953)
- [X] T1955 [P] [US3] Write failing unit tests for the tree read in `backend/tests/unit/expert-delegation-tree.spec.ts` — ancestors to the root and descendants to the leaves, each node with Expert and version; a workspace boundary is never crossed
- [X] T1956 [US3] Implement the tree read in `delegation.service.ts` and include it in `GET /experts/sessions/:executionId` (unit test: T1955)
- [X] T1986 [P] [US3] Write failing route tests in `backend/tests/integration/experts-delegation-policy-route.spec.ts` — `GET /experts/delegation-policy` is `404` until one is set; `PUT` replaces it, records actor and instant, rejects depth or fan-out below 1, and refuses without the edit grant (`FR-EXP-009`, `FR-EXP-033`, analysis C1)
- [X] T1987 [US3] Implement the delegation-policy routes in `experts.controller.ts` and the store's policy read/write (integration test: T1986)
- [X] T1957 [P] [US3] Write failing route tests in `backend/tests/integration/experts-delegation-route.spec.ts` — Q11, Q12, Q13 through the real routes, with a policy set through `PUT` (T1987) and the in-test bindings of T1943

**Checkpoint**: any delegation tree is reconstructable, and none widens authority.

---

## Phase 6: User Story 4 — A session cannot spend more than it was given (Priority: P2)

**Goal**: limits narrowed to the contract, enforced where the gateway declares the control, recorded honestly where it does not.

**Independent test**: quickstart Q8–Q10.

- [X] T1958 [P] [US4] Write failing unit tests for narrowing and enforceability in `backend/tests/unit/expert-limits.spec.ts` — request above contract → contract value with `requested` kept and `limit-narrowed` event; `time` always `enforced`; tokens/cost/resource `enforced` only when in `enforceableLimits`, else `unenforceable`; default posture refuses for tokens and cost and proceeds for time and resource (`FR-EXP-040`…`044`)
- [X] T1959 [US4] Implement `backend/src/modules/experts/limits.ts` (unit test: T1958)
- [X] T1960 [P] [US4] Write failing unit tests for stopping in `backend/tests/unit/expert-limit-stop.spec.ts` — reaching the time limit aborts via the context `signal`, outcome `stopped-by-limit`, `reached: stopped`; a late report above a limit records `detected-late` with the instant, never `stopped` (`FR-EXP-041`, `046`)
- [X] T1961 [US4] Wire limit enforcement into `dispatch.service.ts` (unit test: T1960)
- [X] T1962 [P] [US4] Write failing unit tests for consumption in `backend/tests/unit/expert-consumption.spec.ts` — unreported consumption is null with a reason, never 0; a delegate's consumption is charged to every ancestor (`FR-EXP-036`, `045`)
- [X] T1963 [US4] Implement consumption recording in `limits.ts` (unit test: T1962)
- [X] T1964 [P] [US4] Write failing route tests in `backend/tests/integration/experts-limits-route.spec.ts` — Q8, Q9, Q10 through the real routes, with the in-test bindings of T1943; the `resource` limit (maximum tool calls) reads `unenforceable` on a gateway that reports no tool calls (`FR-EXP-040`, analysis A1)

**Checkpoint**: no limit reads *enforced* that a provider could not enforce.

---

## Phase 7: User Story 5 — Work goes to a human or an Expert by capability and policy (Priority: P2)

**Goal**: assignment with a recorded rule, a risk gate, history, and no dispatch.

**Independent test**: quickstart Q14–Q16.

- [X] T1965 [P] [US5] Write failing unit tests for assignment in `backend/tests/unit/expert-assignment.spec.ts` — capability mismatch refused naming it; retired Expert refused; a standing assignment records its rule; reassignment supersedes and keeps history; a standing assignment whose Expert is later retired reads `assignee-retired` and the task as needing reassignment, without the row changing (analysis C5); **nothing is dispatched** (`FR-EXP-050`…`053`, `055`)
- [X] T1966 [US5] Implement `backend/src/modules/experts/assignment.service.ts` over the `EPIC-046` `Task` table (unit test: T1965)
- [X] T1967 [P] [US5] Write failing unit tests for the risk gate in `backend/tests/unit/expert-assignment-risk.spec.ts` — a task band above `maxUnattendedBand` is `pending-decision` with a `decisionId`; it stands only when the decision resolves approved; `ContractApprovals` unbound refuses `503` (`FR-EXP-054`)
- [X] T1968 [US5] Implement the risk gate in `assignment.service.ts` (unit test: T1967)
- [X] T1969 [P] [US5] Write failing unit tests for dispatch by task in `backend/tests/unit/expert-dispatch-task.spec.ts` — dispatch with a `taskId` not assigned to this Expert, or assigned `pending-decision`, is refused
- [X] T1970 [US5] Implement the task check in `dispatch.service.ts` (unit test: T1969)
- [X] T1971 [P] [US5] Write failing route tests in `backend/tests/integration/experts-assignment-route.spec.ts` — `POST /tasks/:taskId/assignment` and `GET /tasks/:taskId/assignments`: Q14, Q15, Q16, with `ContractApprovals` overridden by an in-test binding for the risk gate (analysis I1)
- [X] T1972 [US5] Implement the assignment routes in `experts.controller.ts` (integration test: T1971)

**Checkpoint**: tasks can be held by an Expert, with the reason on the record.

---

## Phase 8: User Story 6 — A reviewer can see the roster (Priority: P3)

**Goal**: the view-only Engineering Experts area.

**Independent test**: quickstart Q17.

- [X] T1973 [P] [US6] Write failing component tests in `frontend/tests/unit/pages/Experts.spec.tsx` — list with role, risk class, effective version, status; an Expert's contract and version comparison; recent runs with the delegation tree inline (`UX-0032`); enforced and unenforceable limits visually distinct (`UX-0031`); **no** authoring controls (`FR-EXP-076`); readable at 360px (`UX-0040`)
- [X] T1974 [US6] Implement `frontend/src/pages/Experts.tsx` and its calls in `frontend/src/services/api.ts` (unit test: T1973)
- [X] T1975 [P] [US6] Update the failing shell tests in `frontend/tests/unit/shell/areas.spec.ts` and `frontend/tests/unit/shell/Navigation.spec.tsx` for `engineering-experts` delivered under `EPIC-047`
- [X] T1976 [US6] Set `engineering-experts` in `frontend/src/shell/areas.ts` to `epic: 'EPIC-047'`, element first, then `status: 'delivered'`, and update the area counts in `specs/036-application-shell/` (unit test: T1975)

**Checkpoint**: the journey exists end to end.

---

## Phase 9: Dependency adapters — **BLOCKED until `EPIC-031`, `EPIC-032` and `EPIC-038` merge**

- [ ] T1977 [P] Write failing unit tests in `backend/tests/unit/expert-adapter-decisions.spec.ts` — submission calls `DecisionEngine.decide` with `actionType: 'expert-contract.approve'`, the version as target and its risk class as `proposedClass`; resolution is read through `resolutionOf`; and an architecture assertion that the local `RiskBand` equals `packages/decision-contract`'s (`R-047-5`, `R-047-6`)
- [ ] T1978 Implement `backend/src/modules/experts/adapters/decisions.adapter.ts` and bind it in `experts.module.ts` (unit test: T1977)
- [ ] T1979 [P] Write failing unit tests in `backend/tests/unit/expert-adapter-evidence.spec.ts` — `exists(workClass, contractVersion)` answers through `ContractCatalog.get`; a catalog fault propagates rather than reading as absent (`R-047-11`)
- [ ] T1980 Implement `backend/src/modules/experts/adapters/evidence.adapter.ts` and bind it (unit test: T1979)
- [ ] T1981 [P] Write failing unit tests in `backend/tests/unit/expert-adapter-context.spec.ts` — the context policy maps onto `AssembleInput` field for field, and the package is bound with `bindExecution` (`R-047-10`)
- [ ] T1982 Implement `backend/src/modules/experts/adapters/context.adapter.ts` and bind it (unit test: T1981)

---

## Phase 10: Polish & cross-cutting

- [X] T1983 [P] Record mutation proofs in `specs/047-engineering-experts/mutation-proofs.md` and assert them in `backend/tests/architecture/experts-mutation-proofs.spec.ts` — removing the dispatch contract check fails the suite (`SC-EXP-003`); replacing the chain intersection with the delegate's own contract fails the suite (`SC-EXP-004`)
- [X] T1984 [P] Write the failing performance test in `backend/tests/integration/experts-performance.spec.ts` — dispatch check p95 < 300 ms; 156-session tree p95 < 500 ms; compare p95 < 200 ms; `GET /experts` at 100 Experts p95 < 1.2 s (`R-047-15`, analysis P1)
- [X] T1985 Write the closing report `specs/047-engineering-experts/closure.md` — work completed, work deferred (including that no current gateway can enforce token or cost limits, `R-047-7`), and the recommended next command — then `pnpm register:update`
- [ ] T1992 [P] Write the failing conformance check `backend/tests/architecture/experts-transcript.spec.ts` and generate `specs/047-engineering-experts/tier2-transcript.md` from a run against a running stack — Constitution XI Tier 2; known-red until the run produces it, never hand-written (analysis I3)
- [ ] T1993 Update the PMI-DOC-004 §6.11 owner annotations for `BR-0101` and `BR-0105` to `EPIC-047` in `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` — **requires the Project Owner's sign-off** (Constitution II: the SRS is the requirement source of truth) (analysis I3)

---

## Dependencies & execution order

- **Phase 1 → Phase 2 → stories.** Phase 2 blocks everything.
- **US1 (Phase 3) blocks US2–US6**: nothing dispatches, delegates or is assigned without an effective contract.
- **US2 blocks US3 and US4**: delegation and limits are properties of a dispatch.
- **US5** needs US1 only (and US2 for T1969–T1970). **US6** needs US1–US3 for content.
- **Phase 9** needs the three PRs merged; it can run in any order after that.
- **Phase 10** last.

## Parallel opportunities

Every test task marked `[P]` within a phase can be written together; implementation tasks touching
`dispatch.service.ts` (T1932, T1934, T1936, T1938, T1940, T1942, T1952, T1961, T1970) are sequential.
Example — Phase 3: T1917, T1919, T1921, T1923, T1927 together, then T1918 → T1920, T1922, T1924 → T1928, then T1925/T1926.

## Implementation strategy

**MVP = Phases 1–4** (registry, contract, approval, enforced dispatch): the smallest slice that
makes an Expert a governed role rather than a record. Delegation (Phase 5) is P1 too and follows
immediately; limits, assignment and the screen are incremental after it. Phase 9 lands whenever the
three PRs merge, and until then every route that needs them refuses `503`, which the integration
suites assert.

---

## Phase 11: Convergence

> Appended 2026-10-09 by `/speckit-converge` from an independent audit; every finding was verified against the code before it was written here. Identifiers start at `T2000`: `T1994`–`T1995` are taken on the unmerged `EPIC-032` branch (`G-26-15`).

- [X] T2000 [P] Write failing unit tests in `backend/tests/unit/expert-run-failure.spec.ts` — a runner that throws, and a failure after the run (settling, charging, proposing), ends the session `failed` with a recorded run failure — never `dispatch-refused` — closes the execution as failed, and leaves no session at `outcome = null` that could still accept delegates per FR-EXP-061, FR-EXP-037 (contradicts) — *5 cases; all 5 failed before T2001*
- [X] T2001 End the session and record a run failure on any error after `addSession` in `backend/src/modules/experts/dispatch.service.ts` (unit test: T2000) per FR-EXP-061, FR-EXP-037 (contradicts) — *`#failed`: ends `failed` unless already ended, records `run-failed`, completes `failed` unless already closed, stops delegates, rethrows with the execution id*
- [X] T2002 [P] Write failing unit tests in `backend/tests/unit/expert-stop-races.spec.ts` — a parent is marked ended before its delegates are stopped, so no delegate is admitted in between; a delegate admitted but not yet recorded re-checks its parent after `addSession` and stops; a child that settled first is not overwritten as `stopped-by-parent`, and a stopped child is not completed twice per FR-EXP-037, spec Edge Cases "a delegate outlives its parent" (partial) — *5 cases; all 5 failed before T2003*
- [X] T2003 Order the parent's end before the cascade, re-check the parent after `addSession`, and make `endSession` report whether it won in `backend/src/modules/experts/dispatch.service.ts`, `experts.store.ts` and `experts.store.prisma.ts` (unit test: T2002) per FR-EXP-037 (partial) — *`endSession` → `Promise<boolean>` (Prisma: `updateMany` count); `#stopOne` records and closes only on a win; settle before cascade*
- [X] T2004 [P] Write failing unit and integration tests in `backend/tests/unit/expert-delegation-actor.spec.ts` — a session records the actor who started its root run; a delegate's targets are checked against that actor; a different user cannot delegate under someone else's session per FR-EXP-034, US3/AC3, FR-EXP-014 (partial) — *4 unit cases (3 failed first; the targets case already held because the actor was the same user); integration case added to `tests/integration/expert-store-prisma.spec.ts`*
- [X] T2005 Store the originating actor on `expert_sessions` (migration `backend/prisma/migrations/<ts>_epic047_session_actor/migration.sql`, `schema.prisma`, both stores) and enforce it in `backend/src/modules/experts/delegation.service.ts` and `dispatch.service.ts` (unit test: T2004) per FR-EXP-034, US3/AC3 (partial) — *migration `20261009100000_epic047_session_actor`: pre-existing rows get `''`, which matches no user (fails closed); `CHECK … NOT VALID` binds new rows*
- [X] T2006 [P] Write failing unit tests in `backend/tests/unit/expert-consumption-paths.spec.ts` — a delegate stopped by its parent still charges its reported consumption up the chain and gives its limits a reason; concurrent sibling charges to one ancestor both land; the time limit records the elapsed time as consumed per FR-EXP-036, FR-EXP-045, US3/AC5 (missing) — *4 unit cases (3 failed first); the PostgreSQL atomicity case is in `tests/integration/expert-store-prisma.spec.ts`*
- [X] T2007 Charge consumption on every exit path and make the ancestor update atomic in `backend/src/modules/experts/limits.ts`, `dispatch.service.ts` and both stores (unit test: T2006) per FR-EXP-036, FR-EXP-045 (missing) — *new store methods `chargeLimit` (one `UPDATE … RETURNING` in PostgreSQL) and `noteUnreported`; stopped paths charge their report, or note the reason when there is none*
- [ ] T2008 [P] Write failing unit tests in `backend/tests/unit/expert-delegate-budget.spec.ts` — a delegate's token, cost and resource limits are capped at the smallest remaining budget across its ancestors, and the cap is recorded as a narrowing per R-047-7, FR-EXP-036, FR-EXP-044 (missing)
- [ ] T2009 Cap a delegate's limits by its chain's remaining budget in `backend/src/modules/experts/limits.ts` and `dispatch.service.ts` (unit test: T2008) per R-047-7, FR-EXP-036 (missing)
- [ ] T2010 [P] Write failing component tests in `frontend/tests/unit/pages/Experts.compare.spec.tsx` — any two versions can be compared (not only adjacent ones); every one of the twelve elements is shown, including context policy and workspace requirements; any version's contract can be read, including when none is approved per FR-EXP-072, US6/AC2, FR-EXP-071 (partial)
- [ ] T2011 Add a from/to version picker, the missing contract elements and a per-version contract view in `frontend/src/pages/Experts.tsx` (unit test: T2010) per FR-EXP-072, US6/AC2 (partial)
- [ ] T2012 [P] Write failing unit tests in `backend/tests/unit/expert-dispatch-early-faults.spec.ts` — a `ContractApprovals` fault or unbound port while reading the effective version is recorded as `dispatch-refused` on a registered execution, as every other refusal is per FR-EXP-061, contracts/experts-api.md (contradicts)
- [ ] T2013 Register before reading the effective version in `backend/src/modules/experts/dispatch.service.ts` (unit test: T2012) per FR-EXP-061 (contradicts)
- [ ] T2014 [P] Write failing unit and route tests in `backend/tests/unit/expert-request-limits.spec.ts` — request limits that are not finite positive numbers are refused `400` before registration per FR-EXP-044, FR-EXP-040 (partial)
- [ ] T2015 Validate request limits in `backend/src/modules/experts/dispatch.service.ts` (unit test: T2014) per FR-EXP-044 (partial)
