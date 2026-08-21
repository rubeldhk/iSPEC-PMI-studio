# Contract: Platform API (Phase 1)

**Epic**: `EPIC-001` | **Date**: 2026-08-02

The platform's external interface. REST over HTTP, JSON bodies, session cookie authentication
(research R-008).

> **Two governance notes (2026-08-03)**
>
> **All paths are versioned** (decision **D-8**, satisfying **PP-012**). Every endpoint below is
> served under **`/v1`** — `/v1/projects`, `/v1/specifications/{id}`, and so on. The prefix is
> omitted from the tables for readability.
>
> *Compatibility policy*: within a major version, additive change only — new optional fields, new
> endpoints, new enum members appended. Removing a field, renaming one, tightening validation, or
> changing a status code requires `/v2`. Enum members are additive because clients must tolerate
> unknown values; the one exception is `job_failure_reason`, where a new member is a genuine
> behavioural change and must be documented in this contract before release.
>
> **This is one transport, not the capability surface.** PP-007 ("API & MCP First") was deferred to
> Phase 3 on condition that MCP can be added without redesign. Every endpoint here therefore
> delegates to a service that is callable without HTTP — see `system-design.md` **PC-1**. Do not
> place business logic in a controller.

## Universal rules

| Rule | Requirement |
|------|-------------|
| Every request resolves a workspace from the session; every query is workspace-filtered | FR-002 |
| A resource in another workspace returns **404, not 403** — existence is not disclosed | FR-002, SC-004 |
| Every refused access is recorded before the response is sent | FR-033, SC-004 |
| Errors carry a machine-readable `code`; a generic error is a defect | FR-026, SC-005 |
| Mutations are audited in the same transaction as the change | FR-033, SC-012 |

### Error shape

```json
{
  "error": {
    "code": "specification_not_approved",
    "message": "Tasks can only be generated from an approved specification.",
    "details": { "currentState": "draft", "requiredState": "approved" }
  }
}
```

Validation failures **name the missing or invalid field** (FR-007):

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Requirement cannot be saved.",
    "details": { "fields": [{ "field": "description", "reason": "required" }] }
  }
}
```

---

## Authentication

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/auth/sign-in` | Establish a session. Returns user and workspace identity |
| `POST` | `/auth/sign-out` | End the session |
| `GET` | `/auth/me` | Current user and workspace |

Sessions are HTTP-only cookies. Passwords are Argon2id-hashed and never returned by any read path.

---

## Projects — US1

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/projects` | Workspace-scoped list |
| `POST` | `/projects` | `name` required, unique within workspace |
| `GET` | `/projects/{id}` | |
| `PATCH` | `/projects/{id}` | Rename, change description, change selected engine |
| `POST` | `/projects/{id}/archive` | Content preserved intact (FR-001) |

---

## Requirements — US2

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/projects/{id}/requirements` | Filter by `type`, `priority`, `status`; sortable (FR-008) |
| `POST` | `/projects/{id}/requirements` | `description` required — refused naming it if absent (FR-007) |
| `GET` | `/requirements/{id}` | |
| `PATCH` | `/requirements/{id}` | Creates a version; prior text stays retrievable (FR-009) |
| `POST` | `/requirements/{id}/retire` | Marks retired; **never deletes** (FR-006) |
| `GET` | `/requirements/{id}/versions` | Edit history (FR-009) |

---

## Specifications — US3, US5, US6

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/projects/{id}/specifications` | |
| `GET` | `/specifications/{id}` | Includes `isOutOfDate`, engine and engine version (FR-022, FR-032) |
| `PATCH` | `/specifications/{id}` | Creates a new version (FR-013) |
| `GET` | `/specifications/{id}/versions` | |
| `GET` | `/specifications/{id}/versions/{a}/diff/{b}` | Version comparison (FR-015) |
| `POST` | `/specifications/{id}/submit-for-review` | `draft → review` |
| `POST` | `/specifications/{id}/reject` | `review → draft` — returns it for rework |
| `POST` | `/specifications/{id}/approve` | `review → approved`. Returns outstanding validation findings before proceeding (US6 scenario 3) |
| `POST` | `/specifications/{id}/baseline` | `approved → baselined`. **The baseline is immutable** — a later edit forks a new version in `draft` (FR-011a) |
| `POST` | `/specifications/{id}/mark-implemented` | `baselined → implemented` |
| `POST` | `/specifications/{id}/archive` | From `approved`, `baselined`, or `implemented`. Retains the specification and its traceability links (FR-011b) |
| `GET` | `/specifications/{id}/findings` | Each finding carries a location (FR-023) |

Lifecycle states follow SRS module specification **M08 §8** (decision D-14):

```text
draft → review → approved → baselined → implemented → archived
```

Eight transitions are permitted; every other is refused with `invalid_lifecycle_transition` and the
permitted set named (FR-011):

```json
{
  "error": {
    "code": "invalid_lifecycle_transition",
    "message": "An approved specification cannot return to draft.",
    "details": { "from": "approved", "to": "draft", "permitted": ["baselined", "archived"] }
  }
}
```

Editing a **baselined** specification is not a transition — it forks a new version in `draft`,
leaving the baseline retrievable unchanged (FR-011a).

---

## Generation jobs — US3, US4, US6

Generation is **always asynchronous** — an AI agent run, not a function call (research R-001).
Every one of these returns `202 Accepted` with a job.

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/projects/{id}/jobs/generate-specification` | Body: `requirementIds[]`. Empty array → `empty_selection` |
| `POST` | `/specifications/{id}/jobs/generate-tasks` | Refused unless `approved` (FR-020) |
| `POST` | `/specifications/{id}/jobs/validate` | |
| `GET` | `/jobs/{id}` | State, progress, failure reason |
| `POST` | `/jobs/{id}/cancel` | FR-024 — no partial artifact stored |
| `GET` | `/projects/{id}/jobs` | Recent jobs |

**Job response**:

```json
{
  "id": "job_...",
  "kind": "generate_specification",
  "state": "running",
  "failureReason": null,
  "startedAt": "2026-08-02T10:00:00Z",
  "resultRef": null
}
```

`state` ∈ `queued` · `running` · `succeeded` · `failed` · `cancelled` · `timed_out`

`failureReason` ∈ `engine_unavailable` · `engine_error` · `malformed_output` · `empty_output` ·
`timeout` · `cancelled` · `input_too_large` · `empty_selection` — never null on a non-success
terminal state (FR-026, SC-005).

Submitting an identical request while one is in flight returns the **existing** job, not a second one.

---

## Tasks — US4

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/specifications/{id}/tasks` | |
| `PATCH` | `/tasks/{id}` | Status: `not_started` \| `in_progress` \| `done` |
| `GET` | `/projects/{id}/progress` | Aggregate task progress (US4 scenario 3) |

---

## Traceability — US7

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/requirements/{id}/trace` | Everything derived from it — forward (FR-030) |
| `GET` | `/tasks/{id}/trace` | Back through specification to requirements — reverse (FR-030) |
| `GET` | `/specifications/{id}/trace` | Both directions |
| `GET` | `/projects/{id}/coverage` | Uncovered requirements, specifications with no tasks (FR-031, SC-010) |

Links to retired requirements are returned and **flagged as retired**, not omitted (US7 scenario 4).

---

## Engines — US8

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/engines` | Registered engines with capabilities (FR-019) |
| `PATCH` | `/projects/{id}` | Selecting a project's engine (see Projects) |

Registration is a composition-time concern, not a runtime endpoint in Phase 1 — an engine is
registered by supplying a provider. Attempting to register one lacking a required capability fails at
startup, naming it (FR-021).

---

## Architecture Decision Records — FR-034

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/projects/{id}/decisions` | |
| `POST` | `/projects/{id}/decisions` | `title`, `context`, `decision`, `consequences` required |
| `GET` | `/decisions/{id}` | Includes the specifications the decision affects |
| `PATCH` | `/decisions/{id}` | Includes status changes |
| `POST` | `/decisions/{id}/links` | Link to affected specifications (FR-034) |

---

## Audit — FR-033

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/audit` | Workspace-scoped, filterable by target, actor, action. **Read-only — no write or delete path exists** |

---

## Status codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `202` | Job accepted — generation is always asynchronous |
| `400` | Validation failed; fields named |
| `401` | No valid session |
| `404` | Not found **or** in another workspace — deliberately indistinguishable |
| `409` | Lifecycle conflict, or a concurrent edit |
| `422` | Well-formed but semantically refused (e.g. tasks from an unapproved specification) |
