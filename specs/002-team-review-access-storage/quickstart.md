# Quickstart: Unattended Runs, Team Review, Access Control & External Storage

**Epic**: `EPIC-002` | **Date**: 2026-08-05 | **Plan**: [plan.md](./plan.md)

Nine validation scenarios, `V02-1` to `V02-9`. Numbered in their own `V02-` series to avoid colliding
with the platform quickstart (`V1`–`V14`) — this epic is held far behind that chain and its scenarios
should not renumber when the platform's do.

## Prerequisites

Platform quickstart **V1** passes; EPIC-004 (tenancy), EPIC-008 (generation), and EPIC-009 (lifecycle)
are available. **The fixture storage provider is used throughout** — no scenario here touches Google
Drive, Dropbox, or S3, which is what keeps this suite runnable in CI.

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

---

## V02-1 · An unattended run finishes without asking anything

**Proves**: FR-RUN-001 to FR-RUN-004, FR-RUN-007 · SC-001, SC-002

1. Create a project with requirements known to raise several questions.
2. Start a run with `mode=unattended`, `stopRange=after_specification`.
3. Walk away.

**Expected**: the run completes **without pausing**. Every question it would have asked is recorded
with its context, the options considered, and the platform's suggested answer.

**Then**: count the questions and open the review session. **Expected**: every question appears in
**exactly one** session — none lost, none duplicated. That is SC-002, and it is only checkable
because a question belongs to exactly one run.

**Then**: start the same work with `mode=interactive`. **Expected**: it pauses at each decision point,
as it does today. Unattended mode is additive.

---

## V02-2 · Provisional markings are per-question, and clear selectively

**Proves**: FR-RUN-005, FR-RUN-017 · SC-004 · research **R-002-5**

1. From V02-1, list artifacts marked provisional. **Expected**: each names the governing question.
2. Answer **one** question and submit.
3. Re-run.

**Expected**: markings governed by *that* question clear. Markings from other questions **remain**.

⚠️ This is the scenario that fails if a marking was implemented as a boolean — a boolean clears
everything or nothing. Confirm an artifact with two markings is still provisional after one clears.

---

## V02-3 · A run stops at its chosen point without failing

**Proves**: FR-RUN-008, FR-RUN-008a

1. Start a run with `stopRange=after_specification`.

**Expected**: on reaching that point it reports **`reached_stop_point`** — a success state, not a
failure.

**Then**: continue the run through task generation. **Expected**: it resumes from that point rather
than restarting.

**Then**: force an unrecoverable condition mid-run. **Expected**: the run stops, records why, and
**preserves everything completed up to that point**.

---

## V02-4 · Approving provisional work requires an explicit, attributed override

**Proves**: FR-RUN-005a to FR-RUN-005c · SC-005a · **PP-003**

1. Take a specification carrying provisional markings.
2. Attempt to approve it.

**Expected**: every provisional item and its governing question is **shown**, and approval is
**refused** without explicit acceptance.

**Then**: accept explicitly. **Expected**: approval proceeds, and the override records **who**,
**when**, and **which items**.

**Then**: answer the question later. **Expected**: the marking clears and the recorded override
**remains as history**.

**Then**: attempt approval as a user with no access to an artifact a provisional item concerns.
**Expected**: refused — someone with access must accept it.

---

## V02-5 · A review session submits atomically, or not at all

**Proves**: FR-RUN-009 to FR-RUN-015a · SC-003, SC-005, SC-006

1. Open the review session. **Expected**: every question with context, options, and suggestion.
2. Answer some questions; leave one blank. Attempt to submit.
   **Expected**: **refused**, naming the unanswered question.
3. Have a second user answer one question **differently**.
   **Expected**: a **conflict** is shown and submission stays blocked. Both answers survive — neither
   silently wins.
4. Resolve the conflict, answer everything, submit as the **project owner**.
   **Expected**: all answers commit **together**; the session closes to edits.
5. Attempt to submit as a third user who is neither owner nor initiator.
   **Expected**: **refused with a reason**, and their drafts are preserved.
6. View the submitted session. **Expected**: every answer attributable to a person and a time.

**Timing check (SC-003)**: 20 questions reviewed and submitted in one sitting under 60 minutes,
without leaving the review.

---

## V02-6 · Re-running applies the team's answers

**Proves**: FR-RUN-016 to FR-RUN-019

1. Submit answers that **differ** from the suggestions. Re-run.
   **Expected**: the team's answers are applied; provisional markings clear.
2. Include one answer that **matches** the suggestion.
   **Expected**: that work is **not needlessly repeated**.
3. Cause the re-run to raise a new question.
   **Expected**: it opens a **new** session — the submitted one is never reopened.
4. Change the underlying work, then re-run.
   **Expected**: a warning naming the answers that may no longer apply.

---

## V02-7 · An artifact without a grant is absent, not forbidden

**Proves**: FR-ACC-021 to FR-ACC-028 · SC-007, SC-008, SC-013 · research **R-002-2**

1. Restrict an artifact to one user. Sign in as another and list the collection.
   **Expected**: the artifact is **absent from the listing** — not shown as a locked placeholder.
2. Request it directly. **Expected**: **404**, and the attempt is **recorded**.
3. Grant `read`. **Expected**: viewable, not editable. Attempt a change → refused with a reason.
4. Revoke access while the user has it open. **Expected**: their next action is refused.
5. Check an artifact derived from a restricted one.
   **Expected**: **at least as restricted** as its source.
6. Attempt to revoke the **last** `edit` grant. **Expected**: **refused** — no artifact may become
   unmanageable.
7. Confirm every grant, revocation, and refusal appears in the audit record.

⚠️ **Run steps 1–2 against a real database, not a mock.** SC-007 is a claim about what the *database*
returns; a mocked repository passes while the real query leaks. This is gap **G-02.5**, currently
without a task.

---

## V02-8 · Publishing is one-way, and failures are named

**Proves**: FR-PUB-029 to FR-PUB-036, FR-PUB-040 · SC-009, SC-012

1. Connect the **fixture** provider and choose a destination.
   **Expected**: saved, reporting `healthy`.
2. Publish a project. **Expected**: artifacts appear at the destination organised by project, and the
   platform records what was published, when, and where.
3. Publish including an artifact the publishing user **cannot access**.
   **Expected**: that artifact is **excluded and the exclusion reported**.
4. Inject each failure in turn — unavailable, authorisation expired, quota, size limit, destination
   missing. **Expected**: each returns its **own named reason**. Zero generic failures.
5. Republish. **Expected**: the platform states what will be **added, replaced, or left alone
   before** changing anything.
6. Start two publishes of the same project at once.
   **Expected**: one proceeds; the other is told a publish is already running — **prevented, not
   queued**.
7. Delete a published file at the provider. **Expected**: the platform's own artifact is
   **unaffected**.

---

## V02-9 · Providers are interchangeable

**Proves**: FR-PUB-030, FR-PUB-037, FR-PUB-038, FR-PUB-039 · SC-010, SC-011 · **PP-015**

1. Publish to the fixture provider.
2. Connect a **second** provider and switch to it. Publish again.
   **Expected**: both publishes succeeded; **no platform artifact changed**.
3. View publish history. **Expected**: records from **both** providers remain viewable.
4. Attempt to connect a provider missing a required capability.
   **Expected**: **refused, naming the missing capability**.
5. Run `pnpm test:arch`.
   **Expected**: green — **no provider SDK or provider string appears in `backend/src/**`**.

⚠️ Step 5 is the scenario that keeps SC-011 honest. Without the architecture test, provider
independence is a claim that decays quietly, exactly as engine independence would have without
`T047`.

---

## Not covered here

- **Real provider integration.** Every scenario runs against the fixture, deliberately. A real
  Google Drive / Dropbox / S3 run is slow, costly, and non-deterministic — it belongs in a nightly
  suite alongside EPIC-015's `T146`.
- **Credential and token handling.** FR-PUB-029 requires authorisation but no mechanism is chosen; the
  data model flags it as owed before `T390`. Nothing here can validate it yet.
- **Review sessions at scale.** PP-018 records session scalability as untested; SC-003's 20-question
  target is a usability measure, not a load test.
