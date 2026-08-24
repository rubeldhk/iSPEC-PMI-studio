# Data Model: Application Shell & Dashboard

**Epic**: `EPIC-036` · **Phase**: 1 · **Date**: 2026-08-24 · **Plan**: [plan.md](./plan.md)

**Nothing here is persisted.** The shell adds no table, no migration and no store. One entity is
**committed source**, two are **session state**, and one is **derived on every read**. That is the
organising rule, and it is what `FR-SHL-034` and `FR-SHL-003` both turn on.

---

## 0. The one structural idea

```text
   COMMITTED SOURCE              SESSION STATE            DERIVED PER READ
   ────────────────              ─────────────            ────────────────
   AreaRegistry ──┬──► Navigation
                  ├──► Routes            ShellContext        AttentionItem
                  └──► FR-SHL-016 check  (workspace,          (from EPIC-023
                                          project, area)       today; EPIC-031
                                                               and EPIC-032
                                                               when they exist)
```

Three consumers, **one list**. `FR-SHL-002` requires a declared area to reach navigation with no
shell code change, and `SC-SHL-004` measures that at zero — which is only true if navigation, the
route tree and the reachability check are all derived from the same declaration. Three
hand-maintained lists that must agree is precisely the shape `DEF-010-001` took: nine pages, four
imported, every check green.

---

## 1. `Area` — a navigable destination

Committed source. Not a database row.

| Field | Rules |
|---|---|
| `id` | stable, unique across the registry. Never reused — an address outlives a rename |
| `group` | one of `overview` · `intent-and-control` · `delivery` · `platform` (`UX-0001`). A closed union, so a mistyped group fails at compile time rather than at render |
| `label` | what navigation shows |
| `path` | the address (`FR-SHL-017`). Unique; leading `/` |
| `epic` | the Epic that owns the area's content — `EPIC-###`, or `null` for an area PMI-DOC-006 names with no owner |
| `declared` | **`true` only when `epic` is a declared Epic.** Drives `UX-0060` |
| `element` | what renders. Absent for an undeclared area, because there is nothing to render |

**An area MUST NOT appear in two groups** (`FR-SHL-011`). The registry is a flat ordered list and
`group` is a field, so a second membership is unrepresentable rather than forbidden by review.

**`declared: false` areas stay in the registry.** They are how PMI-DOC-006 §4.1's eighteen are
recorded, and how `FR-SHL-017` answers *not found* for an address that names one — deleting them
would make an undeclared area indistinguishable from a typo. `FR-SHL-003` keeps them out of
navigation; it does not keep them out of the list.

### The eighteen, and the nine

| Group | Areas | Declared |
|---|---|---|
| **Overview** | Home · Projects · Decision Inbox | Home, Projects |
| **Intent & Control** | Requirement Room · Specifications · Change Room · Defect Room · Architecture & Decisions | Specifications, Architecture & Decisions |
| **Delivery** | Plan & Tasks · Engineering Experts · Runs · Evidence & Compliance · QA & Releases | Plan & Tasks, Runs, QA & Releases |
| **Platform** | Context · Integrations · Reports · Governance · Workspace & Administration | Governance, Workspace & Administration |

**Nine declared, nine not.** The Rooms are `EPIC-033`–`EPIC-035`: `EPIC-033` is 68 of 102 and the
other two are 0 — none is *delivered*, so none is declared here. When one is, it becomes a registry
edit and nothing else (`SC-SHL-004`).

---

## 2. `AreaGroup` — four, and only four

```ts
type AreaGroup = 'overview' | 'intent-and-control' | 'delivery' | 'platform';
```

Ordered as PMI-DOC-006 §4.1 orders them. **Grouping is the requirement, not a presentation choice**:
§4.1 says *"grouping is what keeps eighteen areas navigable; a flat eighteen-item list is not"*, so
the group is a field on the area rather than a rendering decision made downstream.

---

## 3. `ShellContext` — what the user is looking at

Session state. Lost on sign-out, which is correct: it is scoped to an identity.

| Field | Rules |
|---|---|
| `workspaceId` | from the signed-in identity (`GET /v1/auth/me`). `BR-0001` |
| `projectId` | the current project, or null |
| `areaId` | derived from the address, never stored separately — the URL is the source (`FR-SHL-017`) |

**`areaId` is derived and not held.** Holding it beside the URL is two answers to *"where am I"*,
and they disagree the first time someone uses the back button. The same reasoning `EPIC-033` applied
to `BaselineReadiness` and `EPIC-031` to its Inbox: derive, so there is no invalidation path.

**The selectable set is not modelled here** (`FR-SHL-025`). `EPIC-004` owns scoping and supplies
what may be selected; the shell renders the control. `prototype-parity.md` declines the selector to
the shell precisely because *"the shell may not invent its selector"*, and a list of selectable
workspaces in this model would be inventing one.

---

## 4. `AttentionItem` — derived, never stored

`FR-SHL-030`–`FR-SHL-034`, `BR-0192`.

| Field | Rules |
|---|---|
| `kind` | `pending-approval` · `policy-block` · `missing-evidence` |
| `subject` | what it is about, in the user's words |
| `projectId` | which project it belongs to (`FR-SHL-031`) |
| `href` | the address of the thing needing action — an `Area.path`, never an invented route |
| `detail` | for a `policy-block`, **the policy that produced it** (`FR-SHL-033`, `BR-0174`) |

**No store, and no aggregation endpoint** (`FR-SHL-034`). Home calls the same endpoints any other
client could.

### `SourceStatus` — the part that is unusual, and deliberate

| Field | Rules |
|---|---|
| `kind` | which of the three |
| `state` | `available` · `unavailable` · `failed` |
| `reason` | why, when not `available` — names the Epic that will supply it |

Two of the three sources **do not exist**: `EPIC-031` (0 of 92) supplies policy blocks and
`EPIC-032` (0 of 83) supplies evidence. Only pending approvals has an endpoint today —
`GET /v1/projects/:projectId/runs` filtered to `awaiting_review`, then `GET /v1/runs/:id/review`.

So Home renders **one real section and two that say why they are empty**. `FR-SHL-062` forbids
rendering a failure as an empty state, and an *absent source* is the same claim: a Home that quietly
showed one section would read as *"nothing is blocked"* — the confident blank screen this Epic
exists to stop repeating. `EPIC-033`'s unbound `AgentGateway` degrades the same way, and says so in
its payload rather than in a comment.

---

## 5. Derived views

| View | Derivation | Requirement |
|---|---|---|
| `NavigationModel` | the registry, filtered to `declared`, grouped by `group`, in registry order | `FR-SHL-010`–`FR-SHL-013` |
| `Breadcrumb` | `workspace / project / area` from `ShellContext` + the matched area | `FR-SHL-023`, `UX-0012` |
| `RouteTree` | the registry, filtered to `declared`, mapped to `path` → `element` | `FR-SHL-017` |

All three are functions of the registry and the context. None is stored, and none can drift from
another.

---

## 6. What this Epic deliberately does not model

| Not here | Owner |
|---|---|
| Which identity may use which area | **deferred** — `FR-SHL-014`, owner `EPIC-024`. Nothing maps an identity to an *area*, and inventing it here is a second authorization model (`FR-SHL-003`) |
| The selectable workspace/project set | `EPIC-004` — consumed via `FR-SHL-025`, never defined |
| Project health | **out of scope** — `BR-0013`, owner `U-03` (clarification, 2026-08-24) |
| Any area's content | the Epic that owns it. `FR-SHL-003` |
| The Room regions | `EPIC-033`'s `packages/room-contract` — adopted, never re-derived (`FR-SHL-040`–`FR-SHL-043`) |
| Anything persisted | nothing. No table, no migration, no store |
