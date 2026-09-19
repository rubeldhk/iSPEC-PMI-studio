# Data Model: Unattended Runs, Team Review, Access Control & External Storage

**Epic**: `EPIC-002` | **Date**: 2026-08-05 | **Plan**: [plan.md](./plan.md)

Extends [`../_shared/data-model.md`](../_shared/data-model.md); it does not replace it. Universal
rules apply unchanged: every row carries `workspace_id`, `created_at/by`, `updated_at/by`, and every
read passes through the workspace-scoping helper (EPIC-004 `T014`).

**12 new entities, 2 new enums, 1 new link table.**

> ⚠️ **Identifier warning.** Every `FR-###` below is **EPIC-002's own**. They collide with the
> platform set (`_shared/platform-spec.md` FR-001–FR-034) — conflict **C-01**, resolved 2026-08-20 by typed prefixes (`FR-RUN/ACC/PUB-`) — was unresolved pending
> decision **D-1**. `FR-RUN-002` here is submission-authority; `FR-RUN-002` there is workspace isolation.

---

## The two-layer authorisation rule

**This is the most important rule in the epic and applies to every entity below.**

```text
read request
   └─► layer 1: workspace scoping   (EPIC-004, unchanged)   → wrong tenant? absent
          └─► layer 2: access grant  (this epic, new)        → no grant?     absent
```

Both layers refuse identically: the artifact is **absent from the result**, never shown as forbidden
(FR-ACC-024, mirroring EPIC-004's 404-not-403). Layer 1 is never modified by this epic — see
[research.md](./research.md) **R-002-2**.

---

## Unattended runs

### Run

Distinct from EPIC-001's `GenerationJob`, which remains one engine invocation (**R-002-1**).

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `project_id` | ref → Project | required |
| `mode` | enum `run_mode` | `interactive` \| `unattended` (FR-RUN-001, FR-RUN-002) |
| `stop_range` | enum `run_stop_range` | `after_specification` \| `through_tasks` (FR-RUN-001) |
| `state` | enum | `running` \| `reached_stop_point` \| `failed` \| `cancelled` |
| `access_snapshot` | json | resolved grants at start (FR-ACC-028, **R-002-4**) |
| `initiated_by` | ref → User | required |
| `started_at`, `ended_at` | timestamp | |
| `outcome_reason` | text | why it stopped, when not a clean stop point |

**Relationships**: has many `GenerationJob` (EPIC-001), many `RecordedQuestion`, at most one
`ReviewSession`.

**Rules**: `reached_stop_point` is a **success** state, not a failure (FR-RUN-008a). An unrecoverable
stop preserves all completed work (FR-RUN-008). A cancelled run keeps the questions recorded so far.

**State transitions**: `running → reached_stop_point | failed | cancelled`. Terminal states are final.

### RecordedQuestion

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `run_id` | ref → Run | required |
| `context` | text | required — enough for someone who did not start the run (FR-RUN-007) |
| `options_considered` | json | required (FR-RUN-003) |
| `suggested_answer` | text | required (FR-RUN-003) |
| `provisional_answer_applied` | text | what the run actually proceeded on (FR-RUN-004) |
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
(FR-RUN-005, FR-RUN-017). Clearing is selective — answering one question clears only its markings.

### ProvisionalApprovalOverride

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `approval_ref` | ref → the specification approval | required |
| `approver` | ref → User | required |
| `approved_at` | timestamp | required |
| `items_accepted` | json | the specific provisional items (FR-RUN-005b) |

**Rules**: **append-only**. Approval of a provisional specification is refused without one
(FR-RUN-005a), and `SC-005a` requires zero un-overridden provisional approvals. Approval is *not*
otherwise blocked (FR-RUN-005c) — the EPIC-001 approval gate is unchanged.

---

## Team review

### ReviewSession

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `run_id` | ref → Run | required, unique — one session per run |
| `state` | enum | `open` \| `submitted` |
| `opened_at`, `submitted_at` | timestamp | |

**Rules**: a submitted session is **closed to edits** (FR-RUN-015); new questions from a re-run open a
**new** session rather than reopening it (FR-RUN-018). Retained permanently (FR-RUN-020). A run raising zero
questions creates **no session** (edge case).

**State transitions**: `open → submitted`. One way.

### Answer

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `question_id` | ref → RecordedQuestion | required |
| `value` | text | selected suggestion or the author's own (FR-RUN-010) |
| `author` | ref → User | required (FR-RUN-012) |
| `recorded_at` | timestamp | required |
| `note` | text | optional (FR-RUN-010) |
| `state` | enum | `draft` \| `committed` (FR-RUN-011) |
| `conflict` | boolean | set when two users answer one question differently (FR-RUN-013) |

**Rules**: drafts save without committing the session (FR-RUN-011). **Conflicting answers both survive**
and block submission until resolved (FR-RUN-013) — they are not merged and last-write does not win
(**R-002-6**). Submission requires every question answered (FR-RUN-014), commits atomically (FR-RUN-015), and
is restricted to the **project owner or the run's initiator** (FR-RUN-015a). Answering stays open to
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

- A derived artifact is **at least as restricted as every source** (FR-ACC-025) — evaluated on read, not
  copied on write, so a later restriction on any source propagates. Where sources differ, **the most
  restrictive wins**: a user needs a sufficient grant on *all* sources (clarified 2026-08-08).
  Derivation never widens access, which is what stops a multi-source artifact laundering it.
- **No artifact may reach a state with no user holding `edit`** (FR-ACC-027, SC-008). This is a system
  invariant enforced **in the same transaction as the revoke**, not a pre-check — otherwise
  concurrent revocations race past it.
- Revocation is a timestamp, not a delete: the audit trail survives.

### AccessAttemptRecord

| Field | Type | Rules |
|---|---|---|
| `user_id`, `artifact_id`, `action` | | required |
| `attempted_at` | timestamp | required |
| `reason` | text | required |

**Rules**: every refusal is recorded (FR-ACC-023, SC-007, SC-013). Written in the **same transaction** as
the refusal, matching EPIC-004's audit interceptor — an action cannot be refused without its record.

---

## External storage

### StorageConnection

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `workspace_id` | ref → Workspace | required — connections are workspace-level |
| `provider_type` | ref → StorageProviderType | required |
| `destination` | text | folder or bucket (FR-PUB-029) |
| `status` | enum `connection_status` | `healthy` \| `needs_reauthorisation` \| `unavailable` (FR-PUB-031) |
| `authorised_by`, `last_checked_at` | | |
| `refresh_token` | encrypted at rest | never returned by any endpoint; discarded on disconnect (FR-PUB-029b) |

**Rules**: an unreachable provider reports `unavailable`, **never `healthy`** (FR-PUB-031). Disconnection
must not touch any platform artifact (FR-PUB-037, FR-PUB-038, SC-010, SC-012). **Credentials are not modelled
here** — see Out of scope below.

### StorageProviderType

| Field | Type | Rules |
|---|---|---|
| `name` | text | e.g. `google-drive`, `dropbox`, `s3`, `fixture` |
| `capabilities` | json | what it provides |
| `limits` | json | size, quota |

**Rules**: a provider missing a required capability is **refused at connection time, naming the
capability** (FR-PUB-039) — mirroring the engine registry's `FR-ACC-021`.

### PublishRecord

| Field | Type | Rules |
|---|---|---|
| `id` | id | |
| `project_id`, `connection_id`, `initiated_by` | | required |
| `artifacts_included` | json | |
| `artifacts_excluded` | json | each with a reason (FR-PUB-033) |
| `state` | enum | `running` \| `succeeded` \| `partial` \| `failed` |
| `failure_reason` | enum `publish_failure_reason` | closed set, **no `unknown`** (FR-PUB-035, **R-002-7**) |
| `destination_locations` | json | where it landed (FR-PUB-034) |
| `published_at` | timestamp | |

**Rules**: `publish_failure_reason` ∈ {`provider_unavailable`, `authorisation_expired`,
`quota_exceeded`, `size_limit_exceeded`, `destination_missing`}. Deliberately **no `unknown`
member**, matching `job_failure_reason` in `_shared/schema.sql` — a generic failure is a defect
(SC-009). Two concurrent publishes of one project are **prevented**, not queued (FR-PUB-040,
**R-002-6**).

### PublishedFileReference

| Field | Type | Rules |
|---|---|---|
| `artifact_id`, `connection_id` | | required |
| `destination_location` | text | required |
| `published_version` | text | which artifact version was published |
| `published_at` | timestamp | required |

**Rules**: retained through a provider switch (FR-PUB-038, SC-010). Deleting the file at the provider has
**zero effect** on the platform artifact (FR-PUB-037, SC-012) — the reference simply becomes stale.
On **disconnection** the reference is retained and marked no longer tracked; the file itself is left
untouched at the provider (FR-PUB-038, clarified 2026-08-08).

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

1. Conflict detection over an answer set (FR-RUN-013)
2. Submission-completeness and authority gates (FR-RUN-014, FR-RUN-015a)
3. Provisional-marking clearance given an answered question (FR-RUN-017)
4. Derived-artifact restriction inheritance (FR-ACC-025)
5. Publish failure-reason mapping from provider error to the closed taxonomy (FR-PUB-035)
6. Republish preview — added / replaced / unchanged (FR-PUB-036)

**Requires a real database** (Testcontainers), and mocking would produce a false pass — this is
**G-02.5**, currently an open gap:

1. Access enforcement returning artifacts as *absent* (FR-ACC-023, FR-ACC-024, SC-007)
2. The last-editor invariant under concurrent revocation (FR-ACC-027, SC-008)
3. Concurrent-publish prevention via advisory lock (FR-PUB-040)

## Out of scope for this data model

- **Provider credentials** — ✅ **resolved 2026-08-08**: delegated OAuth-style authorisation, with a
  **refresh token encrypted at rest** on `StorageConnection` and no password ever accepted
  (FR-PUB-029, FR-PUB-029a, FR-PUB-029b). The token is never returned by an endpoint and is discarded on
  disconnection. Key management for the encryption itself remains a deployment concern.
- **Roles, groups, inherited permissions, SSO** — Phase 3 by clarification.
- **Two-way sync**, import-back, and external editing — permanently out (ADR-0004).
