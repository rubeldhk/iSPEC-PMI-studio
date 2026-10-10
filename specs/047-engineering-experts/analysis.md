# Specification Analysis: EPIC-047 Engineering Experts

**Session**: 2026-10-09

**Artifacts analysed**: [spec.md](./spec.md) · [plan.md](./plan.md) · [tasks.md](./tasks.md)
(with [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/experts-api.md](./contracts/experts-api.md), [quickstart.md](./quickstart.md))

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage | HIGH | contracts/experts-api.md "Delegation policy"; tasks.md Phase 5 | `GET`/`PUT /experts/delegation-policy` have no task. With no policy, delegation is refused (data-model §3), so no delegation can ever be permitted through the product, and T1957's route tests cannot reach a success path | Add a test/impl pair for the delegation-policy routes in Phase 5, before T1957 |
| C2 | Coverage | HIGH | spec.md FR-EXP-063 | Unattended Expert output entering verification and review (`BR-0061`, `EPIC-023`) has no task | Add a test/impl pair: a session run unattended is marked for review and cannot satisfy a completion gate by itself; or defer explicitly to `EPIC-023` with a defect record |
| U1 | Underspecification | HIGH | spec.md FR-EXP-001…007, FR-EXP-050, contracts/experts-api.md | Who may register, version, submit, retire, configure delegation policy, or assign is unstated. The platform has no admin role (`DEF-038-005`); without a rule, any workspace member can author an Expert's permissions | Require an `EPIC-024` edit grant on a named artifact (e.g. `expert-registry`) for authoring and policy, with read for viewing; add it to FR-EXP-007 and a test to T1923/T1925 |
| I1 | Inconsistency | MEDIUM | research.md R-047-13; tasks.md T1943, T1957, T1964, T1971 | R-047-13 says ports bind refusing and tests "never a permissive stub", but route tests for dispatch, delegation, limits and assignment need an approved contract — impossible while `ContractApprovals` refuses until Phase 9 | State in those tasks that the route tests override `ContractApprovals` (and `ExpertGateways`) with **in-test** bindings that record calls, distinct from the module's refusing default |
| C3 | Coverage | MEDIUM | contracts/experts-api.md `GET /experts/:id/sessions`; tasks.md T1944, T1974 | The recent-runs route the screen needs has no task | Fold it into T1943/T1944 explicitly |
| C4 | Coverage | MEDIUM | spec.md Edge Cases — Evidence Contract retired after approval | No task re-checks the Evidence Contract at dispatch, so a run could proceed under a retired one | Add the check to T1933/T1934 |
| C5 | Coverage | MEDIUM | spec.md Edge Cases — assignee Expert retired | No task marks the assignment as pointing at a retired Expert or the task as needing reassignment | Add to T1965/T1966 |
| A1 | Ambiguity | MEDIUM | spec.md FR-EXP-040; data-model.md §2 `budget.resource` | "Resource" limit is never defined (memory? CPU? concurrent tools?) — untestable as written | Define it (e.g. maximum concurrent delegates + wall-clock CPU where the provider reports it) or drop it to the provider descriptor only |
| I2 | Inconsistency | LOW | spec.md Key Entities "Assignment … Lives with the task in EPIC-046's store"; research.md R-047-12 | The spec says assignment lives in the task store; the plan adds a separate `task_assignments` table beside `tasks` | Reword the entity: "recorded beside the task, in the same database, referencing `EPIC-046`'s task" |
| I3 | Inconsistency | LOW | tasks.md T1985 | One task bundles the closing report, the Tier 2 transcript and an SRS owner-annotation edit; the SRS edit is a requirements-document change that should carry owner sign-off (Constitution II) | Split into three tasks; mark the SRS edit as needing the Project Owner |
| P1 | Coverage | LOW | research.md R-047-15; tasks.md T1984 | The screen-load target (p95 < 1.2 s at 100 Experts) is not measured | Add it to T1984 or drop it from R-047-15 |

## Coverage summary

| Requirement group | Has task? | Task IDs | Notes |
|---|---|---|---|
| FR-EXP-001…008 Registry | Yes | T1923–T1926 | Authoring authority unstated (U1) |
| FR-EXP-010…024 Contract & dispatch | Yes | T1917–T1922, T1929–T1944 | Evidence re-check missing (C4) |
| FR-EXP-030…037 Delegation | Partial | T1945–T1957 | Policy routes missing (C1) |
| FR-EXP-040…046 Limits | Yes | T1958–T1964 | "Resource" undefined (A1) |
| FR-EXP-050…056 Assignment | Yes | T1965–T1972 | Retired assignee (C5) |
| FR-EXP-060…062 Execution record | Yes | T1935–T1936, T1951 | |
| FR-EXP-063 Unattended review | **No** | — | C2 |
| FR-EXP-070…076 Screen | Yes | T1973–T1976 | Recent-runs route (C3) |
| SC-EXP-001…008 | Yes | T1921, T1917, T1983, T1951, T1955, T1958, T1965 | |

**Constitution alignment**: no MUST violation. V (paired tests) — every implementation task names
its test; XI — Tier 1 route tests and a Tier 2 transcript are planned; XII — dispatch registers
before execution.

**Unmapped tasks**: none.

**Metrics**: 56 functional requirements, 8 success criteria · 86 tasks · coverage 55 / 56 FRs
(98%) with one partial · ambiguities 1 · duplications 0 · critical 0 · high 3.

## Remediation

Applied on 2026-10-09 at the Project Owner's request, after this analysis:

- **C1** → `T1986`/`T1987` (delegation-policy routes) · **C2** → `T1988`/`T1989`, and `FR-EXP-063`
  made testable · **U1** → `FR-EXP-009`, US1/AC6, `T1990`/`T1991` · **I3** → `T1985` split into
  `T1985`, `T1992`, `T1993`.
- **I1, C3, C4, C5, A1, P1** → descriptions of unstarted tasks amended (`T1925`, `T1933`, `T1943`,
  `T1957`, `T1964`, `T1965`, `T1971`, `T1984`); `R-047-13` states the in-test binding rule;
  "resource" defined as maximum tool calls in `FR-EXP-040`.
- **I2** → the Assignment entity reworded in `spec.md`.
