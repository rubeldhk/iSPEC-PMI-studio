---

description: "Task list for EPIC-010 — Specification Interface"
---

# Tasks: Specification Interface

**Epic**: `EPIC-010` | **Module**: M-04 | **Tasks**: 19

**Spec**: [spec.md](./spec.md) | **Shared design**: [../_shared/](../_shared/)

> ▶ **PROCEEDING** — released 2026-08-20 by **PMI-DOC-004 v1.0** (scope ruling T-106). The
> prior hold (decision D-10) is discharged; posture authority is [spec.md](./spec.md).


**Tests**: MANDATORY (Constitution V). Every task producing or changing application code has a
paired unit-test task, written to fail first.

**Task IDs are invariant** — unchanged by the epic split of 2026-08-03. Cross-references such as
`(unit test: T0nn)` may point at a task in another epic; that is expected and correct.

---

## F-04.11 · Specification interface

- [X] T083c [P] [US3] Component unit tests for the specification list page in `frontend/tests/unit/pages/SpecificationList.spec.tsx` (**FR-012**)
- [X] T083d [P] [US3] Implement specification list page in `frontend/src/pages/SpecificationList.tsx` (**FR-012**; unit test: T083c)
- [X] T083e [P] [US3] Component unit tests for the specification detail view in `frontend/tests/unit/pages/Specification.spec.tsx`
- [X] T084 [P] [US3] Implement specification view showing engine, version, and out-of-date state in `frontend/src/pages/Specification.tsx` (unit test: T083e)
- [X] T084a [P] [US3] Component unit tests asserting the job progress indicator polls without blocking interaction in `frontend/tests/unit/components/JobProgress.spec.tsx`
- [X] T085 [P] [US3] Implement job progress indicator that does not block the rest of the UI in `frontend/src/components/JobProgress.tsx` (unit test: T084a)
- [X] T113a [P] [US5] Component unit tests for the version history view in `frontend/tests/unit/components/VersionHistory.spec.tsx`
- [X] T114 [P] [US5] Implement version history view in `frontend/src/components/VersionHistory.tsx` (unit test: T113a)
- [X] T114a [P] [US5] Component unit tests for the version comparison view in `frontend/tests/unit/components/VersionDiff.spec.tsx`
- [X] T115 [P] [US5] Implement version comparison view in `frontend/src/components/VersionDiff.tsx` (unit test: T114a)
- [X] T115a [P] [US5] Component unit tests asserting invalid transitions are not offered and the permitted set is shown in `frontend/tests/unit/components/LifecycleControls.spec.tsx`
- [X] T116 [P] [US5] Implement lifecycle transition controls in `frontend/src/components/LifecycleControls.tsx` (unit test: T115a)
- [X] T123a [P] [US6] Component unit tests asserting each finding renders its location and severity in `frontend/tests/unit/components/ValidationFindings.spec.tsx`
- [X] T124 [P] [US6] Implement findings panel in `frontend/src/components/ValidationFindings.tsx` (unit test: T123a)

## F-04.18 · SC-001 journey measurement

*This epic **owns** SC-001 but had no task measuring it — the only timing run was T153, inside held EPIC-014. Added by `/speckit-analyze` finding **G2**.*

- [X] T124a [P] [US3] Measure the SC-001 journey — sign-in to holding a generated specification linked to its requirements — asserting completion in under 15 minutes with no external help, in `e2e/tests/sc-001-journey.spec.ts`

## Phase Z · Epic closure (MANDATORY — Constitution IV, V, VI, IX)

*Per-epic gate, discharged by this epic **alone** — it waits on no other epic. Each task writes to
`specs/010-specification-interface/closure.md`, which is the record [EPIC-014 F-11.2](../014-devops-release/tasks.md)
confirms. Platform promotion `local → dev → stage → prod` is a separate, platform-wide gate and is
NOT part of this phase.*

- [X] T197 Confirm every implementation task in this epic has a passing unit test (Constitution V); record the result in `specs/010-specification-interface/closure.md`
- [X] T198 Run `/speckit-converge` for this epic; append and complete any remaining unbuilt work, then record the clean result in `specs/010-specification-interface/closure.md`
- [X] T199 Triage `specs/010-specification-interface/defects/`; close every record or defer it to a named epic, and record the outcome in `specs/010-specification-interface/closure.md`
- [X] T200 Confirm this epic's principle deltas still hold and every deferral retains a valid owner (decision D-6), then publish the epic closing report — work completed, work deferred, recommended next task (Constitution IX) — in `specs/010-specification-interface/closure.md`

---

## Phase C · Convergence — `DEF-010-001` *(appended 2026-08-23, when every Epic branch reached `main`)*

**Why this phase exists**: `frontend/src/pages/` holds nine page components and `main.tsx` imports
**four**. `Specification.tsx`, `SpecificationList.tsx`, `Tasks.tsx`, `ReviewSession.tsx` and
`StorageConnections.tsx` are imported by nothing, anywhere in `src/` —
[`DEF-010-001`](./defects/DEF-010-001-five-pages-exist-and-nothing-renders-them.md) has the import
lines and the view switch beside them. Five delivered capabilities cannot be used at all.

**The common thread across eight built-but-never-wired defects**: every gate asks *"does this
artifact exist and behave?"* and none asked *"can a user get to it?"* `T899a` mounts the real entry
module and a delivered page renders, so it passes; `T883` renders pages directly, so each works
alone; `T900a` walked sign-in → projects → requirements, and a browser run cannot miss a page it
never visits.

- [X] T200a Write the failing module-reachability check in `frontend/tests/unit/design/page-reachability.spec.ts` — enumerate `frontend/src/pages/*.tsx`, assert each is in the import graph reachable from `frontend/src/main.tsx`, **and** that each exported component is rendered rather than merely imported (`DEF-010-001`). It reports the five by deriving them, not by listing them. *Expected to FAIL until `T200b` is decided — the check exists to keep the ninth instance from happening, not to be silenced. It states in its own header what it does **not** cover: reachability of a **route**, which needs `T900a`'s driven browser tier.*
- [X] T200b **DECISION, per page — ROUTE ALL FIVE, and build the missing parent** *(decided 2026-08-23 by the project owner)*. Route it or remove it. Five unreachable pages may mean five missing routes, or work that landed ahead of its navigation and should wait. `SpecificationList` → `Specification` → `Tasks` chain naturally off the existing `project` view and need `projectId`/`specificationId`, which that view already holds; `StorageConnections` needs `workspaceId` and `projectId`; **`ReviewSession` needs a `runId` and there is no run list anywhere in the product**, so it has no parent to hang from. Spans `EPIC-012` (Tasks), `EPIC-023` (ReviewSession) and `EPIC-025` (StorageConnections) — each owner confirms its own page (unit test: T200a, which goes green as each is routed or removed). **Outcome**: all five routed; the run list was built as `T200d` because the alternative — the shell inventing a run id — is not a route, it is a guess. Delivered by `T200e`
- [X] T200c Mutation-verify `T200a` by removing one wired route from `frontend/src/main.tsx` and observing the check fail, then restore it (unit test: `T200a` — this task verifies that check and produces no application code of its own); record the observation in `specs/010-specification-interface/closure.md` (`DEF-010-001`, Constitution V)
- [X] T200d Build the run list at `frontend/src/pages/Runs.tsx` and add `listRuns` to `frontend/src/services/api.ts` (unit test: `frontend/tests/unit/pages/Runs.spec.tsx`) — `EPIC-023`'s surface, delivered here because `ReviewSessionPage` takes a `runId` and nothing in the product produced one. `GET /projects/:projectId/runs` has served since `EPIC-023` with **no caller**; the missing half was never the endpoint
- [X] T200e Route all five from the project view in `frontend/src/main.tsx` (unit test: `frontend/tests/unit/shell/area-reachability.spec.tsx`) — `specifications` → `specification` → `tasks`, plus `storage` and `runs` → `review-session`, each with a way back. `T863`/`T864` is the precedent: the same defect one Epic earlier, one page at a time. **Superseded 2026-08-24 by `EPIC-036` (`R-036-5`, `T437g`/`T437o`)**: the four buttons are replaced by primary navigation and `shell-page-routes.spec.tsx` by the shell's own route coverage. The five pages are still reachable and still asserted — by `FR-SHL-016` driving the real `App`, which is a stronger check than the one it replaces. `T200a` is untouched
