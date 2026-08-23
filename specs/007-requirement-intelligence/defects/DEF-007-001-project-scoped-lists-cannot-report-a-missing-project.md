# DEF-007-001 — a project-scoped list cannot tell "no such project" from "project is empty"

**Epic**: `EPIC-007` (raised here; the fix spans **seven modules**) · affects **8 endpoints**
**Raised**: 2026-08-21 | **Status**: **OPEN**
**Found by**: local UAT probing, 2026-08-20; contract decided 2026-08-21
**Severity**: **MEDIUM** — no data leaks, but a mistyped or stale URL returns a convincing empty
state instead of an error

## What it does

`GET /v1/projects/{projectId}/requirements` filters requirements by `workspaceId + projectId` and
never checks that the project exists or belongs to the caller. A bad projectId is therefore
indistinguishable from a real project with nothing in it:

```
GET /v1/projects/does-not-exist/requirements   ->  200  []
```

**Not a cross-tenant leak.** Requirements are workspace-scoped, so a foreign projectId returns
nothing rather than someone else's rows. The failure is one of *meaning*, not of exposure.

## The survey — all eight share it

Every project-scoped `GET` was probed against a nonexistent project on `049806a`:

| Endpoint | Result |
|---|---|
| `/requirements` | `200 []` |
| `/decisions` | `200 []` |
| `/runs` | `200 []` |
| `/jobs` | `200 []` |
| `/specifications` | `200 {"rows":[],"total":0,…}` |
| `/publishes` | `200 []` |
| `/progress` | `200 {"total":0,"done":0,…}` |
| `/coverage` | `200 {"uncoveredRequirementIds":[],…}` |

**They are already consistent** — consistently unable to report a missing project. So "make the
siblings consistent" is satisfied today; what changes is *what* they are consistent about.

> **A false start worth recording.** The first survey reported `/runs` and `/publishes` as **500**,
> and read that as the new EPIC-023/025 code failing. It was neither. The API under test had been
> started before those epics landed, so those routes did not exist in it — and the control,
> `/v1/no-such-route`, returned 500 as well. The 500 was the *unknown-route* path, which is
> [`DEF-001-006`](../../001-platform-foundation/defects/DEF-001-006-the-error-filter-swallows-every-framework-exception.md).
> Re-surveyed against a restarted API on current code, all eight return 200. **A survey against a
> stale process is not a survey**, and the control test is what caught it.

## Expected vs actual

| | |
|---|---|
| **Expected** (decided 2026-08-21) | An unknown project — or one outside the caller's workspace — returns **404** |
| **Actual** | `200` with an empty collection |

## The decision

**404, across all eight**, taken by the project owner on 2026-08-21. Rejected alternatives:

- **Keep `200`** — zero work and already consistent, but a stale bookmark keeps looking like real
  data and the Requirements page shows an empty state for a URL that names nothing.
- **404 only where a user navigates** — smaller, and reintroduces exactly the inconsistency this
  work exists to remove.

**A foreign project must return 404, not 403.** Confirming that a project exists but is not yours is
itself a disclosure; the two cases must be indistinguishable from outside.

## Ordering — this is blocked

[`DEF-001-006`](../../001-platform-foundation/defects/DEF-001-006-the-error-filter-swallows-every-framework-exception.md)
**must land first.** The global error filter converts every framework exception to `500`, so a
not-found raised here would reach the client as a server error. Fixing these endpoints first would
produce work that is correct and looks broken.

## Remaining work

- A shared project-existence check, scoped to the caller's workspace, rather than eight copies of
  it. Whichever module owns it, the check is one thing and should be written once.
- Apply to all eight endpoints.
- **Mutation-verify** per endpoint: an unknown projectId MUST produce 404, a foreign one MUST
  produce 404 and not 403, and a real project with no rows MUST still return `200` with an empty
  collection — that last case is what a naive fix breaks.
- Consider the cost: one extra existence query per list request.
- **No code was changed by the session that found this.** The fix re-enters as tasks
  (Constitution VI).

## Links

- `backend/src/modules/requirements/requirements.controller.ts:44` — the reported instance
- Seven further modules: decisions, runs, specifications (×2), storage/publish, tasks, traceability
