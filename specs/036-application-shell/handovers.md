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

**What clears it.** One line in `frontend/src/shell/areas.ts`: change `status` from
`'declared-not-delivered'` to `'delivered'` and give the entry an `element`. Nothing else, in any
file. That is not a hope — `T437q` asserts it by construction, and `frontend/tests/unit/shell/registry-extensibility.spec.ts`
uses **Governance itself** as the worked example.

**What must not clear it.** Building any of these four screens inside the shell. `FR-SHL-003`
forbids the shell implementing an area's content, and a placeholder is worse than an absence: it
claims the product has a working area when it does not.

> **Why this is a handover and not a defect.** The registry's `declared-not-delivered` state exists
> so this obligation has a debtor rather than disappearing. Filing it as a defect against this Epic
> would move the debt onto the shell, which is exactly the mistake the third state was added to
> prevent (see [analysis.md](./analysis.md) `C1`).

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
