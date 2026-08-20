---

description: "Task list for EPIC-022 — Product Structure & Traceability"
---

# Tasks: Product Structure & Traceability

**Epic**: `EPIC-022` | **Module**: M-04 | **Tasks**: 17

**Spec**: [spec.md](./spec.md) | **Parent design**: [../017-enhancement-model/](../017-enhancement-model/) | **Shared design**: [../_shared/](../_shared/)

> ⏸ **HELD** under decision D-10, pending `PMI-DOC-004` Business Requirement Specification and
> approved business scope. Split from EPIC-017 on 2026-08-04 (ruling **D-18**).

**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — allocated `T296`–`T311` at the split, plus **`T827`** added 2026-08-20
by the EPIC-017 family re-task pass for `SC-ENH-010`, which no task asserted. Allocated from the
corpus maximum rather than inside the split's range, so the invariant holds.

> 🔀 **Fold candidate.** This epic extends **EPIC-011**'s link model rather than standing fully
> apart, and the split recorded it as a candidate for folding into EPIC-011 instead of remaining a
> separate epic. It is kept separate for now because EPIC-011 is held and already reviewed; folding
> stays available and cheap while neither epic has been implemented.

> ⚠️ **This epic breaks a test in another epic — by design.** EPIC-011 `T077a` asserts
> `TraceabilityLink` permits **only** the two Phase 1 edge types. It fails the build the moment T301
> widens the enumeration. **T302 updates it**, so the break is a planned task rather than a runtime
> surprise (research **R-017-7**).

---

## F-17.9 · Product specification structure

*A **validation rule** over a versioned structure definition, not a stored document skeleton
(research **R-017-6**). A skeleton makes every generated specification carry twenty-one headings
whether or not they apply — which is how box-ticking documents get made.*

- [ ] T296 [P] [US5] Write failing unit tests for structure conformance as a pure function, asserting a missing required section produces a finding that names it, in `backend/tests/unit/specifications/structure-conformance.spec.ts`
- [ ] T297 [US5] Define `StructureDefinition` model — versioned, ordered sections with required flags, `applies_to = product outputs` — in `backend/prisma/schema.prisma` (unit test: T296)
- [ ] T298 [US5] Seed the twenty-one-section structure from the source document — the standard shape for specifications PMI Studio generates or manages, never this repository's own documents (**FR-ENH-020**) — in `backend/prisma/seed-structures.ts` (unit test: T296)
- [ ] T299 [US5] Implement structure conformance checking, reusing the existing validation-finding shape (FR-023), in `backend/src/modules/specifications/structure-conformance.service.ts` (unit test: T296)
- [ ] T827 **HUMAN** [US5] — perform the `SC-ENH-010` walkthrough: give a specification author new to the organization the structure definition and nothing else, ask them to produce a conforming specification unaided, and record the outcome in `specs/022-product-traceability/closure.md`. **Owner: project-owner.** Added 2026-08-20 by the EPIC-017 family re-task pass: every other criterion in this Epic is asserted by a unit test, but this one claims a *person* succeeds without help — a conformance checker passing proves the rule is enforceable, not that anyone can follow it. Only the walkthrough can verify it, exactly as `T666` verified `SC-RGP-001`

## F-17.10 · Product traceability chain

*Satisfies **FR-ENH-021** and **FR-ENH-022**. Recorded by `T687` — `traceability-convention.md` makes the
Feature → requirement link mandatory, carried in this framing note.*

*The twelve-link chain **widens** `TraceabilityLink` rather than adding a second table — the chain
**is** derivation, extended (research **R-017-7**). Note this is the opposite conclusion to
`DependencyEdge` in EPIC-020, and deliberately so: the distinguishing test is not "is it a link?" but
"does it behave like derivation?"*

- [ ] T300 [P] [US5] Write failing unit tests asserting `TraceabilityLink` accepts all twelve chain link types, rejects unknown types by name, and remains acyclic, in `backend/tests/unit/traceability/chain-link-types.spec.ts`
- [ ] T301 [US5] Widen the `TraceabilityLink` link-type enumeration from the two Phase 1 types to the twelve chain types in `backend/prisma/schema.prisma` (unit test: T300)
- [ ] T302 [US5] Update EPIC-011's `T077a` assertion in `backend/tests/unit/traceability/link-constraints.spec.ts` from "only the two Phase 1 edge types" to the twelve chain types — **this test fails the build until updated** (depends on T301)
- [ ] T303 [P] [US5] Write failing unit tests for full-chain traversal in both directions, asserting every intermediate link returns in order and that an artifact with multiple parents returns all of them, in `backend/tests/unit/traceability/chain-traversal.spec.ts`
- [ ] T304 [US5] Implement twelve-link bidirectional chain traversal in `backend/src/modules/traceability/chain-traversal.service.ts` (unit test: T303; extends EPIC-011 `T130`)
- [ ] T305 [P] [US5] Write failing unit tests asserting traversal reports the **first missing link type** by name rather than returning a silently shortened chain, in `backend/tests/unit/traceability/chain-gaps.spec.ts`
- [ ] T306 [US5] Implement first-missing-link reporting in `backend/src/modules/traceability/chain-gap.service.ts` — so a traversal from any operational artifact either reaches its originating vision statement or names the link that breaks the chain (**SC-ENH-007**, with T304) — (unit test: T305)
- [ ] T307 [US5] Extend the traceability endpoints to expose full-chain traversal and gap reporting per `contracts/platform-api.md` in `backend/src/modules/traceability/traceability.controller.ts` (unit tests: T303, T305; extends EPIC-011 `T133`)

---

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/022-product-traceability/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [ ] T308 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/022-product-traceability/closure.md`
- [ ] T309 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/022-product-traceability/closure.md`
- [ ] T310 Triage `specs/022-product-traceability/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/022-product-traceability/closure.md`
- [ ] T311 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/022-product-traceability/closure.md`

---

## Dependencies & Execution Order

**Within this epic**: F-17.9 is independent of F-17.10 and the two may run in parallel. Inside
F-17.10 the order is strict: **T301 → T302** before anything else touches traceability, because the
build is red between them.

**Blocked by**: EPIC-011 (the link model being widened), EPIC-019 (organization tier), EPIC-009
(validation-finding shape reused by structure conformance).
**Blocks**: nothing.

**Parallel opportunities**: T296 with T300/T303/T305. The `schema.prisma` tasks (T297, T301) must not
run in parallel with each other.

## Independent test criteria

Structure: check a specification missing a required section and confirm the finding names it.
Chain: link an artifact along all twelve types, traverse from either end, then delete one link and
confirm the traversal reports that specific link type as the break.

⚠️ **No quickstart scenario exists for the chain.** Most of its link types — code, tests, release,
operations — belong to epics not yet built and have nothing to point at. A partial scenario would
assert a partial chain and pass for the wrong reason. It joins the platform quickstart once those
epics land, as recorded in [../017-enhancement-model/quickstart.md](../017-enhancement-model/quickstart.md).

## Notes

- **D-16 scope**: the twenty-one-section structure and twelve-link chain govern **PMI Studio's product
  outputs only**. This repository's own documents follow `PMI-DOC-000`, and nothing here makes an
  existing repository specification non-conformant.
- **PP-004 closes here for the product**, not for the repository — repository traceability still
  awaits decision **D-2**.
- If the fold into EPIC-011 is taken, these sixteen tasks move with their IDs unchanged; the
  invariant-ID convention makes that a regrouping, not a renumbering.
- Never edit code outside a Spec Kit command (Constitution I); defects become new tasks (Constitution VI).
- Every command run ends with a closing report (Constitution IX).
