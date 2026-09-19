# Contract: Platform API — EPIC-002 additions

**Epic**: `EPIC-002` | **Date**: 2026-08-05 | **Extends**:
[`../../_shared/contracts/platform-api.md`](../../_shared/contracts/platform-api.md)

**Closes gap G-02.2.** `_shared/contracts/platform-api.md` is EPIC-001's surface. This epic adds four
endpoint groups that appeared in no contract — while `T364` was already written to contract-test
review endpoints that nothing defined.

All paths are versioned under `/v1` (decision **D-8**, satisfying PP-012), consistent with the base
contract.

## Authorisation applies to every endpoint below

Two layers, in order (see [data-model.md](../data-model.md)):

1. **Workspace scoping** — EPIC-004, unchanged. Wrong tenant → **404**.
2. **Access grant** — this epic. No grant → **404**, never 403 (FR-ACC-024).

An artifact a caller may not see is **absent from collection responses**, not returned as a locked
placeholder. Every refusal writes an `AccessAttemptRecord` in the same transaction (FR-ACC-023).

---

## Runs — FR-RUN-001 to FR-RUN-008a

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/projects/{id}/runs` | `mode` (`interactive` \| `unattended`) and `stopRange` (`after_specification` \| `through_tasks`) required |
| `GET` | `/v1/projects/{id}/runs` | |
| `GET` | `/v1/runs/{id}` | Includes state, stop reason, and access-snapshot exclusions (FR-ACC-028) |
| `POST` | `/v1/runs/{id}/cancel` | Questions recorded so far are preserved |
| `POST` | `/v1/runs/{id}/continue` | Continues past a `reached_stop_point` run (FR-RUN-008a) |

**`202 Accepted`** with a run resource — runs are asynchronous, matching the generation-job pattern.
**`reached_stop_point` is a success state**, not an error (FR-RUN-008a).

---

## Review sessions — FR-RUN-006, FR-RUN-009 to FR-RUN-020

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/runs/{id}/review` | Every question with context, options, suggested answer (FR-RUN-009). Questions the caller cannot access are marked `restricted`, **not omitted** |
| `PUT` | `/v1/review/{id}/answers/{questionId}` | Saves a **draft**; does not commit (FR-RUN-011) |
| `POST` | `/v1/review/{id}/submit` | Atomic batch commit (FR-RUN-015) |
| `GET` | `/v1/review/{id}` | Post-submission record: each answer, author, time, note (FR-RUN-020) |

**Refusals with named reasons**:

| Condition | Response |
|---|---|
| Unanswered questions remain | **422**, naming them (FR-RUN-014) |
| Unresolved conflict | **409**, naming the conflicting questions (FR-RUN-013) |
| Caller is neither project owner nor run initiator | **403** with a stated reason; their drafts survive (FR-RUN-015a) |
| Session already submitted | **409** — a new session must be opened (FR-RUN-018) |

⚠️ **403 here is deliberate and differs from the artifact rule.** The session's *existence* is not
secret to someone who can already see it; what is refused is the *authority to submit*. Absence would
be misleading — the user can see the session and needs to know why they cannot submit.

---

## Access grants — FR-ACC-021 to FR-ACC-028

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/artifacts/{type}/{id}/grants` | Requires `edit` on the artifact |
| `POST` | `/v1/artifacts/{type}/{id}/grants` | `userId`, `level` (`read` \| `edit`) required (FR-ACC-021) |
| `DELETE` | `/v1/artifacts/{type}/{id}/grants/{grantId}` | Revoke (FR-ACC-022) |
| `GET` | `/v1/artifacts/{type}/{id}/access-attempts` | Refused attempts (FR-ACC-023, SC-013) |

**Refusals**:

| Condition | Response |
|---|---|
| Revoking the last `edit` grant | **409** — the last-editor invariant (FR-ACC-027, SC-008), enforced **in the revoke transaction** |
| Granting on an artifact the caller cannot edit | **404** — absence, per the artifact rule |

⚠️ **`G-02.4`**: no task currently implements these endpoints. `F-02.5` builds five services and no
controller, while `T400` builds a UI that would call them.

---

## Storage connections and publishing — FR-PUB-029 to FR-PUB-040

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/workspaces/{id}/storage-connections` | |
| `POST` | `/v1/workspaces/{id}/storage-connections` | `providerType`, `destination`; refused naming a missing capability (FR-PUB-039) |
| `GET` | `/v1/storage-connections/{id}/health` | `healthy` \| `needs_reauthorisation` \| `unavailable` (FR-PUB-031) |
| `DELETE` | `/v1/storage-connections/{id}` | Disconnect; no platform artifact affected (FR-PUB-037, FR-PUB-038) |
| `POST` | `/v1/projects/{id}/publishes` | Publish (FR-PUB-032) |
| `GET` | `/v1/projects/{id}/publishes` | History, retained across provider switches (FR-PUB-038, SC-010) |
| `GET` | `/v1/publishes/{id}` | Included, excluded-with-reason, destinations (FR-PUB-033, FR-PUB-034) |
| `GET` | `/v1/projects/{id}/publishes/preview` | Added / replaced / unchanged — **computed before any write** (FR-PUB-036) |

**`202 Accepted`** for publish — asynchronous, like generation.

**Failure body** carries `failureReason` from the closed taxonomy — `provider_unavailable`,
`authorisation_expired`, `quota_exceeded`, `size_limit_exceeded`, `destination_missing`. **No
`unknown` member exists** (FR-PUB-035, SC-009).

| Condition | Response |
|---|---|
| A publish is already running for this project | **409** — prevented, not queued (FR-PUB-040) |
| Provider unreachable | **502** with `provider_unavailable`, reported **before** anything is sent |

⚠️ **`G-02.4`**: no task currently implements these endpoints either.

---

## Contract test coverage

`T364` covers review endpoints only. Runs, access grants, and storage/publish have **no contract
tests and no implementation tasks** — gaps **G-02.3** and **G-02.4**, both open and both needing a
`/speckit-tasks` pass.
