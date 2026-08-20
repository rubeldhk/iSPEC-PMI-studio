---

description: "Task list for EPIC-013 — Engine API & Selection"
---

# Tasks: Engine API & Selection

**Epic**: `EPIC-013` | **Module**: M-08 | **Tasks**: **9** *(8 + `T138`, routed in 2026-08-17)*

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (BR-0030; scope ruling
> T-106). The prior hold (decision D-10) is discharged; posture authority is
> [spec.md](./spec.md).


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-08.9 · Engine API and interface

- [X] T138 [US8] Implement per-project engine selection endpoint in `backend/src/modules/projects/projects.controller.ts` (unit test: T135) *(routed from EPIC-003, 2026-08-17)*

  > **Routed in, not reissued** — the identifier travels with the task, as `T646`/`T647`/`T648` did
  > from this same parent epic to EPIC-028 (the `D-19` precedent). EPIC-003's row is struck through
  > and its closure is not reopened. Conflict **`C-29`**.
  >
  > **Why it belongs here.** This epic owns `FR-019` — *"register additional engines and select one
  > per project"* — and EPIC-003 does not; its owned set is FR-016, FR-017, FR-018, FR-021, FR-022,
  > FR-023. EPIC-013 was split out of EPIC-003 *"because it touches `projects.controller.ts` and
  > therefore the held product surface"*, and `T138` is the one row that split missed. It sat in
  > F-08.3 while every sibling moved to F-08.9.
  >
  > **The behaviour is already built and tested** — `EngineResolverService` (`T035`) resolves a
  > project's selection and refuses one naming an unregistered engine, with `T034a` and `T135`
  > covering it. Only the HTTP surface waits, and it waits on `PMI-DOC-004` like the rest of this
  > epic. **No engineering is blocked by this routing.**
  >
  > ⚠️ Note for whoever unblocks this epic: `projects.controller.ts` is **EPIC-006's** file. Decide
  > then whether this endpoint lands there or as a project-scoped route on
  > `engines.controller.ts` (`T140`), which this epic already owns. Recorded rather than pre-decided.

- [X] T139a [P] [US8] Unit tests for the `/engines` listing endpoint asserting capabilities are returned in `backend/tests/unit/engines/engines.controller.spec.ts`
- [X] T140 [US8] Implement `/engines` listing endpoint in `backend/src/modules/engines/engines.controller.ts` (unit test: T139a)
- [X] T140a [P] [US8] Component unit tests for the engine selection control in `frontend/tests/unit/components/EngineSelector.spec.tsx`
- [X] T141 [P] [US8] Implement engine selection control in `frontend/src/components/EngineSelector.tsx` (unit test: T140a)

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/013-engine-api-selection/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T209 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/013-engine-api-selection/closure.md`
- [X] T210 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/013-engine-api-selection/closure.md`
- [X] T211 Triage `specs/013-engine-api-selection/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/013-engine-api-selection/closure.md`
- [X] T212 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/013-engine-api-selection/closure.md`
