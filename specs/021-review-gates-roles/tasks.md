---

description: "Task list for EPIC-021 — Review Gates & Roles"
---

# Tasks: Review Gates & Roles

**Epic**: `EPIC-021` | **Module**: M-04 | **Tasks**: 23

**Spec**: [spec.md](./spec.md) | **Parent design**: [../017-enhancement-model/](../017-enhancement-model/) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification and
> approved business scope. Split from EPIC-017 on 2026-08-04 (ruling **D-18**).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — allocated `T273`–`T295` at the split.

> ⚠️ **This epic carries the entire PP-017 cost exposure.** Twelve reviewing roles per gate against a
> single model, with M-07's optimisation controls deferred by the 2026-08-04 phase-authority ruling.
> Containment is the platform's per-job caps alone (FR-025). **T291 re-scores RAID R-02 and is a
> blocking task, not a formality.**

> ⚠️ **Open dependency — finding A1.** `ReviewGate.transition` must be one of the permitted
> transitions of the M08 six-state lifecycle, but **that permitted set is not enumerated in any
> specification**. T277 cannot be fully validated until it is. See the Notes.

---

## F-17.11 · Reviewing and authoring roles

*Roles precede gates. A gate names the roles that must run; building gate configuration against roles
that do not exist produces a configuration model with nothing to configure.*

- [ ] T273 [P] [US4] Write failing unit tests asserting each of the twelve roles declares a responsibility and its permitted artifact types, and that a role acting outside them is refused, in `backend/tests/unit/reviews/role.spec.ts`
- [ ] T274 [US4] Define `Role` model and seed the twelve roles named by the source document in `backend/prisma/schema.prisma` (unit test: T273)
- [ ] T275 [P] [US4] Write failing unit tests for the `reviewSpecification` contract shape, asserting the role is echoed by the **platform** and never trusted from the adapter, in `packages/engine-contract/tests/unit/review-input.spec.ts`
- [ ] T276 [US4] Add the `reviewSpecification` capability per `../017-enhancement-model/contracts/review-role-contract.md` in `packages/engine-contract/src/index.ts` (unit test: T275)

## F-17.7 · Gate configuration

- [ ] T277 [P] [US4] Write failing unit tests asserting a gate binds only to a permitted M08 lifecycle transition and that an unknown transition is refused by name, in `backend/tests/unit/reviews/gate-config.spec.ts`
- [ ] T278 [US4] Define `ReviewGate` model with `transition`, `required_roles`, and `blocking` in `backend/prisma/schema.prisma` (unit test: T277)
- [ ] T279 [P] [US4] Write failing unit tests asserting a gate configured against an engine lacking `reviewSpecification` fails at gate time with a named reason — and that such an engine still **registers** successfully (contract rule E-R5), in `backend/tests/unit/reviews/gate-capability.spec.ts`
- [ ] T280 [US4] Implement gate configuration and capability checking in `backend/src/modules/reviews/gate-config.service.ts` (unit tests: T277, T279)

## F-17.8 · Gate execution, findings and human decision

*Gate arbitration is a pure function — "does this outcome permit advancement?" — which is what makes
`SC-ENH-004` testable without invoking a model.*

- [ ] T281 [P] [US4] Write failing unit tests asserting every finding carries a `location` and a `role_id`, and that a finding missing either is treated as `malformed_output` rather than stored, in `backend/tests/unit/reviews/review-finding.spec.ts`
- [ ] T282 [US4] Define `ReviewFinding` model bound to a gate outcome in `backend/prisma/schema.prisma` (unit test: T281)
- [ ] T283 [P] [US4] Write failing unit tests asserting **empty findings is a pass**, distinguishable from a failed call — the deliberate divergence from the base contract's empty-output rule (contract rule E-R4) — in `backend/tests/unit/reviews/empty-findings.spec.ts`
- [ ] T284 [P] [US4] Write failing unit tests asserting an unavailable or malformed reviewing role **fails** the gate and never passes by default (contract rule E-R3), in `backend/tests/unit/reviews/role-unavailable.spec.ts`
- [ ] T285 [US4] Implement gate execution invoking each required role concurrently through the engine contract, bounded by the platform's per-job caps, in `backend/src/modules/reviews/gate-execution.service.ts` (unit tests: T283, T284)
- [ ] T286 [P] [US4] Write failing unit tests for gate arbitration as a pure function — a null `human_decision` **blocks** advancement regardless of findings — in `backend/tests/unit/reviews/gate-arbitration.spec.ts`
- [ ] T287 [US4] Define append-only `GateOutcome` model with a database trigger rejecting `UPDATE` and `DELETE`, matching the `audit_entries` treatment, in `backend/prisma/schema.prisma` (unit test: T286)
- [ ] T288 [US4] Implement gate arbitration and the human-decision requirement in `backend/src/modules/reviews/gate-arbitration.ts` (unit test: T286)
- [ ] T289 [P] [US4] Write failing unit tests asserting approval over outstanding findings records the approver and the **overridden findings**, in `backend/tests/unit/reviews/override.spec.ts`
- [ ] T290 [US4] Implement the human decision path recording approver, decision, and overridden findings in `backend/src/modules/reviews/gate-decision.service.ts` (unit test: T289)

## F-17.12 · Cost re-scoring

- [ ] T291 Re-score RAID **R-02** against the twelve-role gate profile — twelve model invocations per gate, M-07 optimisation deferred, containment limited to per-job caps — and record the new score, the accepted exposure, and any configuration guidance in `specs/_shared/raid-log.md`

---

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/021-review-gates-roles/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T292 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/021-review-gates-roles/closure.md`
- [ ] T293 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/021-review-gates-roles/closure.md`
- [ ] T294 Triage `specs/021-review-gates-roles/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/021-review-gates-roles/closure.md`
- [ ] T295 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/021-review-gates-roles/closure.md`

---

## Dependencies & Execution Order

**Within this epic**: F-17.11 → F-17.7 → F-17.8. T291 may run any time after T285, when the real
invocation profile is known.

**Blocked by**: EPIC-019 (organization tier), EPIC-009 (the six-state lifecycle these gates bind to),
EPIC-003 (the engine contract being extended).
**Blocks**: nothing.

**Parallel opportunities**: T273/T275 together; T277/T279 together; T281/T283/T284 together, then
T286/T289 together. Tasks touching `schema.prisma` (T274, T278, T282, T287) must not run in parallel.

**Conformance additions**: cases **C-17** to **C-20** from the review-role contract are added to the
shared suite by T283, T281, T284, and T279 respectively — each asserted at unit level here and
promoted into `packages/engine-contract/tests/conformance/` when the fixture adapter gains injectable
review failures.

## Independent test criteria

Submit a specification with a known defect, confirm the relevant role reports it, confirm the
transition is refused until a human decides, then approve over the findings and confirm the override
is recorded. Quickstart **V17-7** and **V17-8**.

## Notes

- ⚠️ **A1 blocks full validation of T277.** FR-011 requires refusing transitions "outside the permitted
  set, naming the permitted ones", but the permitted set is enumerated nowhere — it exists only as
  "eight permitted transitions" in EPIC-009 `T106` against "six lifecycle transition endpoints" in
  `T108`. `/speckit-clarify` on EPIC-009 resolves it. T277 can be written against the six endpoints
  meanwhile, and **will need revisiting** if the set turns out to be eight.
- **Gates should be configured with the roles a transition actually needs.** Twelve is the maximum,
  not the default. This is the single most effective cost control available in this epic.
- Roles within a gate run **concurrently**. Sequential execution makes a gate unusably slow without
  reducing spend.
- Never edit code outside a Spec Kit command (Constitution I); defects become new tasks (Constitution VI).
- Every command run ends with a closing report (Constitution IX).
