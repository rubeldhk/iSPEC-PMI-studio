# DEF-010-001 — five page components exist and nothing renders them

**Epic**: `EPIC-010` (owns the specification interface) · spans EPIC-012, EPIC-023, EPIC-025
**Raised**: 2026-08-21 | **Status**: **OPEN**
**Found by**: building the product screen inventory for the Figma brief — counting screens the
product has against screens a user can reach
**Severity**: **HIGH** — five delivered pages are unreachable; the capability behind them cannot be
used at all

## What it is

`frontend/src/pages/` holds nine page components. `main.tsx` imports **four**:

```ts
import { ProjectDetail, ProjectsPage } from './pages/Projects';
import { RequirementsPage } from './pages/Requirements';
import { TraceabilityPage } from './pages/Traceability';
import { SignIn } from './pages/SignIn';
```

The other five are imported by **nothing**, anywhere in `src/`:

| Page | Delivered by | Reachable |
|---|---|---|
| `Specification.tsx` | EPIC-010 | **No** |
| `SpecificationList.tsx` | EPIC-010 | **No** |
| `Tasks.tsx` | EPIC-012 | **No** |
| `ReviewSession.tsx` | EPIC-023 | **No** |
| `StorageConnections.tsx` | EPIC-025 | **No** |

The view switch in `main.tsx` resolves exactly four kinds — `loading`, `sign-in`, `projects`,
`project` — plus `traceability` reached from the project view. **There is no route to the other
five and no control that would set one.**

## How it survived

Grepping for the names is misleading, and that is worth recording because the next person will hit
it. `ReviewSession`, `StorageConnections` and `Tasks` each appear in `src/services/api.ts` — but as
**API types and methods**, not as components:

```ts
export interface ReviewSession { … }
async getReviewSession(id: string): Promise<ReviewSession> { … }
async listStorageConnections(workspaceId: string): Promise<StorageConnection[]> { … }
```

So a name search finds hits, a bundle search finds hits, and both are the API layer. Only asking
*"which module imports this component?"* gives the real answer, and the answer is none.

## Why every existing gate missed it

**This is the eighth built-but-never-wired defect, and the most consequential yet** — five whole
pages rather than one function.

| Gate | Why it passed |
|---|---|
| Unit tests | Each page is tested in isolation. A component renders perfectly when mounted directly by its own test |
| `T866a` | Asserts `main.tsx` imports the **stylesheets**. It does |
| `T899a` (Constitution XI Tier 1) | Asserts the app mounts and tokens reached the document. They did |
| `T900a` (Constitution XI Tier 2) | Walked sign-in → projects → requirements. Every page on **that** journey is wired; the run cannot miss a page it never visits |
| axe checks | Run against the components directly, not against the app's reachable graph |
| `/speckit-converge` | Sees a task claiming a page, and the page file exists |

**The common thread**: every check asks *"does this artifact exist and behave?"* and none asks
*"can a user get to it?"* Reachability of a **route** is a different claim from reachability of a
**module**, and `T913` proved the same point one layer down — a stylesheet arriving is not code
running.

## Remaining work

- Decide, per page, whether it should be routed or removed. Five unreachable pages may mean five
  missing routes, or it may mean work that landed ahead of its navigation and should wait.
- **The check this needs**: enumerate `frontend/src/pages/*.tsx` and assert every one is reachable
  from the application root — imported, and reachable through some sequence of view states.
  **Mutation-verify by removing a route** and confirming the check fails.
- That check belongs with `T899a` as Tier 1's missing half, and is evidence for the standing
  Constitution XI question raised 2026-08-21.
- **No code was changed by the session that found this.** The fix re-enters as tasks
  (Constitution VI).

## Not EPIC-029's defect

EPIC-029 restyles four pages by `FR-DS-050` and leaves the rest to their own Epics by `FR-DS-052`.
It is correct in doing so. This record exists because **"unstyled" and "unreachable" are different
problems**, and the design system's scope note was quietly masking the second — a page nobody can
open never looks wrong.

## Links

- `frontend/src/main.tsx` — the four imports and the view switch
- [`DEF-001-006`](../../001-platform-foundation/defects/DEF-001-006-the-error-filter-swallows-every-framework-exception.md), [`DEF-007-001`](../../007-requirement-intelligence/defects/DEF-007-001-project-scoped-lists-cannot-report-a-missing-project.md) — raised the same day, same family of unasked question
