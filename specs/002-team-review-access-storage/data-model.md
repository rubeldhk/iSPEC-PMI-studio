# Data Model: Unattended Runs, Team Review, Access Control & External Storage

**Epic**: `EPIC-002` | **Date**: 2026-08-05 | **Plan**: [plan.md](./plan.md)

Extends [`../_shared/data-model.md`](../_shared/data-model.md); it does not replace it. Universal
rules apply unchanged: every row carries `workspace_id`, `created_at/by`, `updated_at/by`, and every
read passes through the workspace-scoping helper (EPIC-004 `T014`).

**12 new entities, 2 new enums, 1 new link table.**

> ⚠️ **Identifier warning.** Every `FR-###` below is **EPIC-002's own**. They collide with the
> platform set (`_shared/platform-spec.md` FR-001–FR-034) — conflict **C-01**, unresolved pending
> decision **D-1**. `FR-002` here is submission-authority; `FR-002` there is workspace isolation.

---

## The two-layer authorisation rule

**This is the most important rule in the epic and applies to every entity below.**

```text
read request
   └─► layer 1: workspace scoping   (EPIC-004, unchanged)   → wrong tenant? absent
          └─► layer 2: access grant  (this epic, new)        → no grant?     absent
```

Both layers refuse identically: the artifact is **absent from the result**, never shown as forbidden
(FR-024, mirroring EPIC-004's 404-not-403). Layer 1 is never modified by this epic — see
[research.md](./research.md) **R-002-2**.

---

## Unattended runs

### Run

Distinct from EPIC-001's `GenerationJob`, which remains one engine invocation (**R-002-1**).

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `project_id` | ref → Project | required |
| `mode` | enum `run_mode` | `interactive` \| `unattended` (FR-001, FR-002) |
| `stop_range` | enum `run_stop_range` | `after_specification` \| `through_tasks` (FR-001) |
| `state` | enum | `running` \| `reached_stop_point` \| `failed` \| `cancelled` |
| `access_snapshot` | json | resolved grants at start (FR-028, **R-002-4**) |
| `initiated_by` | ref → User | required |
| `started_at`, `ended_at` | timestamp | |
| `outcome_reason` | text | why it stopped, when not a clean stop point |

**Relationships**: has many `GenerationJob` (EPIC-001), many `RecordedQuestion`, at most one
`ReviewSession`.

**Rules**: `reached_stop_point` is a **success** state, not a failure (FR-008a). An unrecoverable
stop preserves all completed work (FR-008). A cancelled run keeps the questions recorded so far.

**State transitions**: `running → reached_stop_point | failed | cancelled`. Terminal states are final.

### RecordedQuestion

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `run_id` | ref → Run | required |
| `context` | text | required — enough for someone who did not start the run (FR-007) |
| `options_considered` | json | required (FR-003) |
| `suggested_answer` | text | required (FR-003) |
| `provisional_answer_applied` | text | what the run actually proceeded on (FR-004) |
| `restricted` | boolean | true when the asker's grants hide the artifact it concerns |

**Rules**: every question belongs to exactly one run and appears in exactly one review session —
`SC-002` ("none lost or duplicated") is checkable only because of this. A question the reviewer
cannot access is **shown as restricted rather than silently omitted** (edge case).

### ProvisionalMarking

A **link, not a flag** (**R-002-5**).

| Field | Type | Rules |
|---|---|---|
| `artifact_id` + `artifact_type` | polymorphic ref | required |
| `question_id` | ref → RecordedQuestion | required — *which* question made it provisional |
| `cleared_at` | timestamp | null while unanswered |

**Rules**: one artifact may hold several markings; it stops being provisional only when **all** clear
(FR-005, FR-017). Clearing is selective — answering one question clears only its markings.

### ProvisionalApprovalOverride

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `approval_ref` | ref → the specification approval | required |
| `approver` | ref → User | required |
| `approved_at` | timestamp | required |
| `items_accepted` | json | the specific provisional items (FR-005b) |

**Rules**: **append-only**. Approval of a provisional specification is refused without one
(FR-005a), and `SC-005a` requires zero un-overridden provisional approvals. Approval is *not*
otherwise blocked (FR-005c) — the EPIC-001 approval gate is unchanged.

---

## Team review

### ReviewSession

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `run_id` | ref → Run | required, unique — one session per run |
| `state` | enum | `open` \| `submitted` |
| `opened_at`, `submitted_at` | timestamp | |

**Rules**: a submitted session is **closed to edits** (FR-015); new questions from a re-run open a
**new** session rather than reopening it (FR-018). Retained permanently (FR-020). A run raising zero
questions creates **no session** (edge case).

**State transitions**: `open → submitted`. One way.

### Answer

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `question_id` | ref → RecordedQuestion | required |
| `value` | text | selected suggestion or the author's own (FR-010) |
| `author` | ref → User | required (FR-012) |
| `recorded_at` | timestamp | required |
| `note` | text | optional (FR-010) |
| `state` | enum | `draft` \| `committed` (FR-011) |
| `conflict` | boolean | set when two users answer one question differently (FR-013) |

**Rules**: drafts save without committing the session (FR-011). **Conflicting answers both survive**
and block submission until resolved (FR-013) — they are not merged and last-write does not win
(**R-002-6**). Submission requires every question answered (FR-014), commits atomically (FR-015), and
is restricted to the **project owner or the run's initiator** (FR-015a). Answering stays open to
everyone with access.

---

## Access control

### AccessGrant

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `artifact_id` + `artifact_type` | polymorphic ref | required |
| `user_id` | ref → User | required |
| `level` | enum `access_level` | `read` \| `edit` |
| `granted_by`, `granted_at` | | required |
| `revoked_at` | timestamp | null while active |

**Rules**:

- A derived artifact is **at least as restricted as every source** (FR-025) — evaluated on read, not
  copied on write, so a later restriction on any source propagates. Where sources differ, **the most
  restrictive wins**: a user needs a sufficient grant on *all* sources (clarified 2026-08-08).
  Derivation never widens access, which is what stops a multi-source artifact laundering it.
- **No artifact may reach a state with no user holding `edit`** (FR-027, SC-008). This is a system
  invariant enforced **in the same transaction as the revoke**, not a pre-check — otherwise
  concurrent revocations race past it.
- Revocation is a timestamp, not a delete: the audit trail survives.

### AccessAttemptRecord

| Field | Type | Rules |
|---|---|---|
| `user_id`, `artifact_id`, `action` | | required |
| `attempted_at` | timestamp | required |
| `reason` | text | required |

**Rules**: every refusal is recorded (FR-023, SC-007, SC-013). Written in the **same transaction** as
the refusal, matching EPIC-004's audit interceptor — an action cannot be refused without its record.

---

## External storage

### StorageConnection

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `workspace_id` | ref → Workspace | required — connections are workspace-level |
| `provider_type` | ref → StorageProviderType | required |
| `destination` | text | folder or bucket (FR-029) |
| `status` | enum `connection_status` | `healthy` \| `needs_reauthorisation` \| `unavailable` (FR-031) |
| `authorised_by`, `last_checked_at` | | |
| `refresh_token` | encrypted at rest | never returned by any endpoint; discarded on disconnect (FR-029b) |

**Rules**: an unreachable provider reports `unavailable`, **never `healthy`** (FR-031). Disconnection
must not touch any platform artifact (FR-037, FR-038, SC-010, SC-012). **Credentials are not modelled
here** — see Out of scope below.

### StorageProviderType

| Field | Type | Rules |
|---|---|---|
| `name` | text | e.g. `google-drive`, `dropbox`, `s3`, `fixture` |
| `capabilities` | json | what it provides |
| `limits` | json | size, quota |

**Rules**: a provider missing a required capability is **refused at connection time, naming the
capability** (FR-039) — mirroring the engine registry's `FR-021`.

### PublishRecord

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `project_id`, `connection_id`, `initiated_by` | | required |
| `artifacts_included` | json | |
| `artifacts_excluded` | json | each with a reason (FR-033) |
| `state` | enum | `running` \| `succeeded` \| `partial` \| `failed` |
| `failure_reason` | enum `publish_failure_reason` | closed set, **no `unknown`** (FR-035, **R-002-7**) |
| `destination_locations` | json | where it landed (FR-034) |
| `published_at` | timestamp | |

**Rules**: `publish_failure_reason` ∈ {`provider_unavailable`, `authorisation_expired`,
`quota_exceeded`, `size_limit_exceeded`, `destination_missing`}. Deliberately **no `unknown`
member**, matching `job_failure_reason` in `_shared/schema.sql` — a generic failure is a defect
(SC-009). Two concurrent publishes of one project are **prevented**, not queued (FR-040,
**R-002-6**).

### PublishedFileReference

| Field | Type | Rules |
|---|---|---|
| `artifact_id`, `connection_id` | | required |
| `destination_location` | text | required |
| `published_version` | text | which artifact version was published |
| `published_at` | timestamp | required |

**Rules**: retained through a provider switch (FR-038, SC-010). Deleting the file at the provider has
**zero effect** on the platform artifact (FR-037, SC-012) — the reference simply becomes stale.
On **disconnection** the reference is retained and marked no longer tracked; the file itself is left
untouched at the provider (FR-038, clarified 2026-08-08).

---

## Entity relationship summary

```text
Project 1──n Run 1──n RecordedQuestion 1──n Answer
              │            └──n ProvisionalMarking ──► any artifact
              │                       (link + cleared_at, NOT a boolean)
              ├──n GenerationJob        (EPIC-001, unchanged)
              ├──1 ReviewSession        (none when zero questions)
              └── access_snapshot       (resolved grants at start)

any artifact ──n AccessGrant ──► User          + AccessAttemptRecord on refusal
Workspace 1──n StorageConnection ──► StorageProviderType
                    └──n PublishRecord 1──n PublishedFileReference ──► artifact
```

## Constitution V testability note

**Pure functions** — unit-testable with no database and no provider:

1. Conflict detection over an answer set (FR-013)
2. Submission-completeness and authority gates (FR-014, FR-015a)
3. Provisional-marking clearance given an answered question (FR-017)
4. Derived-artifact restriction inheritance (FR-025)
5. Publish failure-reason mapping from provider error to the closed taxonomy (FR-035)
6. Republish preview — added / replaced / unchanged (FR-036)

**Requires a real database** (Testcontainers), and mocking would produce a false pass — this is
**G-02.5**, currently an open gap:

1. Access enforcement returning artifacts as *absent* (FR-023, FR-024, SC-007)
2. The last-editor invariant under concurrent revocation (FR-027, SC-008)
3. Concurrent-publish prevention via advisory lock (FR-040)

## Out of scope for this data model

- **Provider credentials** — ✅ **resolved 2026-08-08**: delegated OAuth-style authorisation, with a
  **refresh token encrypted at rest** on `StorageConnection` and no password ever accepted
  (FR-029, FR-029a, FR-029b). The token is never returned by an endpoint and is discarded on
  disconnection. Key management for the encryption itself remains a deployment concern.
- **Roles, groups, inherited permissions, SSO** — Phase 3 by clarification.
- **Two-way sync**, import-back, and external editing — permanently out (ADR-0004).
