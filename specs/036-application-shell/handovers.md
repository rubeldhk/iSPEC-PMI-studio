# Handovers: `EPIC-036` Application Shell & Dashboard

**Session**: 2026-08-24 · Tasks `T441n`, `T441p` · Closure: [closure.md](./closure.md)

Two obligations this Epic **cannot discharge** and must not leave implicit. Both are recorded with
their owner, their measurement, and the exact change that clears them.

---

## `T441p` — the remainder of `UX-0003`, owed by four Epics

`UX-0003` (PMI-DOC-006 §4.1, scoped by `D-44`) requires every area whose Epic is **declared** to be
reachable from primary navigation. This Epic satisfies it for **five** areas. Four are declared,
owned, and have no screen to reach — so navigation offers nothing, and offering a destination that
leads nowhere is `DEF-010-001` through the front door.

| Area | Owner | Why it is not in navigation |
|---|---|---|
| **Plan & Tasks** | `EPIC-012` | The screen **exists** and is specification-scoped: `Tasks.tsx` needs a `specificationId`, so the area's only address is `/specifications/:id/tasks`. Navigation renders a link to `Area.path`, and `:id` is not an address. PMI-DOC-006 §4.1 describes a **project-level** plan; that view has no entry point |
| **QA & Releases** | `EPIC-014`, `EPIC-015` | No component in `frontend/src/pages/`, and no task in any `tasks.md` builds one |
| **Architecture & Decisions** | `EPIC-016` | As above |
| **Governance** | `EPIC-019`, `EPIC-021`, `EPIC-024` | As above |

Every one of those Epics is at stage **`Ready`** — planned and tasked, nothing implemented.

**What clears it.** Two edits in `frontend/src/shell/`, and no more than two:

1. `areas.ts` — change `status` from `'declared-not-delivered'` to `'delivered'` and give the
   entry an `element`;
2. `area-views.tsx` — the binding that `element` points at, which reads workspace and project from
   `ShellContext` and hands them to the page the owning Epic built.

`T437q` asserts the **derivation** is total — navigation and the route tree are functions of the
registry, so a delivered entry cannot fail to reach them — using Governance as its worked example
in `frontend/tests/unit/shell/registry-extensibility.spec.ts`. **No shell logic changes.**

> **Corrected 2026-08-24 (`T441w`, convergence `F6`).** This section, and `quickstart.md` §2, both
> said *one* file. `SC-SHL-004` measures **shell code changes** at zero and that still holds — a
> binding is a prop hand-off, not shell logic — but *"`git diff --name-only` shows one path"* was
> simply not true of the code, and a claim that specific is worth being right about.

**What must not clear it.** Building any of these four screens inside the shell. `FR-SHL-003`
forbids the shell implementing an area's content, and a placeholder is worse than an absence: it
claims the product has a working area when it does not.

> **Why this is a handover and not a defect.** The registry's `declared-not-delivered` state exists
> so this obligation has a debtor rather than disappearing. Filing it as a defect against this Epic
> would move the debt onto the shell, which is exactly the mistake the third state was added to
> prevent (see [analysis.md](./analysis.md) `C1`).

---

## `T441w` — the workspace half of `FR-SHL-020`, owed by `EPIC-004`

**The shell shows the workspace and offers no way to change it, and nothing says why.**

`FR-SHL-020` asks for an explicit workspace **and** project selection; `FR-SHL-022` asks that
switching **either** keeps the current area. The project half is built. The workspace half is not,
and the reason is the same shape as Home's two missing sections: **there is no endpoint behind it.**

| What exists | What does not |
|---|---|
| `GET /v1/auth/me` → `workspace.id` — the one workspace an identity has | Anything that **enumerates** workspaces. `frontend/src/services/api.ts` has no `listWorkspaces`; the only workspace-scoped route is `/workspaces/:id/storage-connections` |

`FR-SHL-025` is explicit that `EPIC-004` owns scoping and supplies the selectable set, and that the
shell **may not invent its selector**. With no set to render, there is nothing for the shell to
build — so this is a dependency, not an omission.

**Why it is recorded rather than rendered.** Home names `EPIC-031` and `EPIC-032` on screen because
a user looking at Home would otherwise read *"nothing is blocked"* — a false conclusion they would
act on. Nobody draws a false conclusion from the absence of a control they never saw, and putting a
permanent *"you cannot switch workspace"* notice on every screen would be noise about a capability
that has exactly one possible value today. **The absence is unexplained in the artifacts, which is
where this fixes it.**

**What clears it**: an endpoint that enumerates the workspaces an identity may use. The shell then
renders a second control beside the project one, on the same terms — `FR-SHL-022` already requires
the area to survive the switch, and the address is untouched by selection, so it will.

## `T442g` — `SC-SHL-009` on two addresses, owed by `EPIC-023`

**`SC-SHL-009`**: a user asked *"which workspace and project am I in?"* answers from the screen in
under five seconds, without opening a menu. **Satisfied on seven of the nine addresses this Epic
routes. Not on two.**

`/runs/:runId` and `/specifications/:specificationId` scope themselves by their own identifier, and
the breadcrumb reads **"Scoped by this link"** rather than naming a project (`T442e`). That is the
honest answer of three:

| Option | Why not |
|---|---|
| Name the selected project | A guess. The run may belong to a different project entirely — `F1` again with better odds |
| Say "No project selected" | Implies the page is unscoped when it is scoped, by the address the user followed |
| Require a project first | Makes *"send me the link"* unanswerable, which is what `FR-SHL-017` exists to fix |

**Honest is not the same as satisfied.** The user still cannot answer the question, and the shell
cannot tell them: `GET /v1/runs/:id/review` returns
`{ id, runId, state, openedAt, submittedAt, questions }` — **no project** — and `FR-SHL-003` forbids
the shell fetching domain data to work it out.

**What clears it.** The run or review response carrying the project it belongs to. The shell then
names it in the breadcrumb and the criterion holds on all nine addresses. `listRuns(projectId)`
already goes the other way, so the association exists; it is simply not on the response a deep link
lands on.

**Owner: `EPIC-023`**, which owns runs and review sessions.

---

### A smaller one in the same place

**A failed project fetch has no state of its own.** `frontend/src/main.tsx` clears
`projectsLoading` in a `finally`, so a request that *failed* renders as *"No projects in this
workspace"* — the third thing `T441u` just separated from the other two, minus its own name.
Bounded, and wrong. `FR-SHL-062` says a failed section reports as failed, and the selector is a
shell-owned surface. **Not fixed here**: it needs an error state on the control and a decision about
what a user does next when the set cannot be loaded at all, which is a larger question than this
task. Recorded so the next converge run finds it written down rather than rediscovering it.

---

## `T441n` — the task-identifier decision, owed by `EPIC-026`

**999 of 999 three-digit prefixes are allocated.** There are none left.

`EPIC-034` `T995y` — **still open** — measured this at 992 and handed `EPIC-026` a choice between
two fixes. Neither has been made, and `EPIC-036` is the first Epic to need identifiers with no free
prefix at all.

`T995y` states the distinction exactly, and it still holds:

- **The identifier space is not exhausted.** `G-26-15` requires unique *identifiers*, and the block
  `T436`–`T442` alone held 182 unused ones.
- **The prefix-block convention is.** `EPIC-029` records the letter suffix as meaning *"a later
  addition adjacent to what it pairs with"*. `T437c` is not an addition to `EPIC-024`'s `T437`.

**What this Epic did**: took a contiguous block, one base identifier per phase, verified by corpus
scan that no lettered identifier under `T436`–`T442` appeared anywhere before allocating.
`EPIC-032`'s header describes the same pattern for `T855`–`T864`.

**What this Epic did NOT do**: choose between `T995y`'s two options. It worked around needing to.

**The two options, unchanged, both `EPIC-026`'s:**

1. **Widen `T\d{3}[a-z]?` to four digits** in `tests/governance/epic-stage/task-ids.spec.ts`,
   `tests/governance/epic-stage/dor.ts` and `tests/governance/epic-stage/task-paths.spec.ts`. Note
   that a four-digit id is currently **invisible** to all three — `T1000` matches none of them — so
   until the widening lands, a four-digit id is silently unchecked, which is worse than a collision.
2. **Retire the adjacency meaning of the suffix**, and say so where the convention is written down
   (`specs/029-design-system/tasks.md`).

**This is a blocker on `EPIC-037`, not a warning.** `EPIC-034` said the same about `EPIC-035`, and
the count has gone from 992 to 999 since.
