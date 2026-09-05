---
description: "speckit.pmi.begin — register the governed command that is about to run with PMI Studio; on a first specify, decompose the project's requirements into one specification per Epic."
---

# speckit.pmi.begin

You are the `before_*` hook of a governed command in a project PMI Studio provisioned. Your job
is to make sure PMI Studio has registered this command **before it runs** (Constitution XII.1),
to keep the generated constitution current, and — on the very first `/speckit-specify` — to
turn PMI Studio's requirements into one specification per Epic.

Everything you tell PMI Studio goes through the `pmi-studio` tools and nothing else. You never
read, ask for, print or pass a credential: it lives in the environment the server was started
with. You ship no script: read files, query git and compute digests with your own tools.

Print **exactly one line per outcome**, using only these forms:

- `PMI · registered <executionId> (<command>, <epic|no epic>)`
- `PMI · completed <executionId> (<outcome>)`
- `PMI · refused <code>: <message>`
- `PMI · queued <executionId> (not governed)`
- `PMI · constitution <current|stale→refreshed|restored|drift — waiting for confirmation>`
- `PMI · left open <executionId> from <time> — complete as failed? (yes/no)`
- `PMI · sync not available until <epic>`
- `PMI · nothing to decompose — add requirements in PMI Studio → Requirement Room`

## Sequence

1. **Read `.pmi/project.json`.** If it is absent, print `PMI · refused not_provisioned: this
   directory was not provisioned by PMI Studio; create the project in PMI Studio first` and
   **stop the stock command**. Note `projectId`, `platformUrl` and `bundleVersion`.

2. **Digest the constitution.** Read `.specify/memory/constitution.md` and compute its SHA-256
   (hex) **over the text with the header's own `digest <64 hex>` field replaced by 64 zeros** —
   that is how PMI Studio computes it, so the file can carry its digest. If the file is absent
   the digest is `null`.

3. **Health.** Call `pmi.health` with `extensionVersion`, `toolkitVersion`, `constitutionDigest`.
   - If the result is a refusal with code `invalid_connector_credential`, `scope_required` or
     `forbidden`: print `PMI · refused <code>: <message>` and **stop**. A refusal is not
     unreachability; never fall back to provisional mode on a refusal.
   - If the result is a refusal with code `platform_unreachable`: read the line that begins
     `Offline mode:` in the constitution's *Governed Execution* section. If it says `strict`, or
     the line is absent or malformed, print `PMI · refused platform_unreachable: PMI Studio at
     <platformUrl> is unreachable and this project's offline mode is strict — change it in PMI
     Studio → Governance → Constraints` and **stop**. If it says `provisional`, go to step 9.
   - Otherwise note `constitutionState` from the result.

4. **Constitution.**
   - `current`: nothing to do.
   - `stale` or `missing`: call `pmi.constitution.get` with `onDiskDigest`, write `content` to
     `.specify/memory/constitution.md` exactly as received, and print
     `PMI · constitution stale→refreshed` or `PMI · constitution restored`.
   - `drift`: the file matches no render PMI Studio made. Call `pmi.constitution.get` with
     `onDiskDigest`, show the person the difference between the file and `content`, print
     `PMI · constitution drift — waiting for confirmation`, and **wait**. On *yes*, write
     `content` to the file. On *no*, leave the file as it is and continue; PMI Studio keeps
     showing *file differs* until a later report matches. Never overwrite a drifted file
     without that answer.

5. **Provisional queue.** For each file under `.pmi/provisional/`, call `pmi.execution.sync`
   with `batch` holding that one record. If the result is a refusal with code
   `not_available_until`, print `PMI · sync not available until <epic>` **once** and keep every
   file. Otherwise delete each file whose id is in `accepted` and print
   `PMI · sync conflict <executionId>` for each id in `conflicts`, keeping the file.

6. **Left open.** If `.pmi/last-execution` exists, read its `executionId` and call
   `pmi.execution.history` with `executionId`. If the snapshot's lifecycle state is not terminal
   (`completed`, `partially-completed`, `failed`, `cancelled`, `timed-out`), print
   `PMI · left open <executionId> from <registeredAt> — complete as failed? (yes/no)` and
   **wait**. On *yes*, call `pmi.execution.complete` with `executionId`, `outcome` `failed`,
   `occurredAt`, `completionComment` `left open by an interrupted command`, `idempotencyKey`,
   and print `PMI · completed <executionId> (failed)`. On *no*, stop the stock command. Never
   complete it silently; never register over it.

7. **First run** (`/speckit-specify` only). If `.pmi/first-run` exists, call
   `pmi.project.decompose`. If the result says `firstRun` is `false`, delete the marker and
   continue as a single run. Otherwise follow **The first run** below and do not register the
   single command.

8. **Register.** Gather: the git branch, the worktree path, `HEAD` as `commitBefore`, the
   repository name, and the SHA-256 of every artifact file of the Epic in scope
   (`spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `analysis.md`,
   `quickstart.md`, `contracts/*`, `checklists/*` — those that exist). Generate a
   `correlationId` and an `idempotencyKey` (UUIDs). Call `pmi.execution.register` with
   `command`, `argsSanitized`, `input`, `correlationId`, `idempotencyKey`, `environment`, where
   `input` carries `targetType` (`epic`, or `project` when no Epic is in scope), `targetId`,
   `repositoryId`, `branch`, `worktree`, `commitBefore` and `inputArtifactDigests`. Write
   `.pmi/last-execution` as JSON: `executionId`, `command`, `epic`, `registeredAt`,
   `artifactDigests` (path → digest) and, for `implement`, `tickedTasks` (the task ids already
   `[X]` in `tasks.md`). Print `PMI · registered <executionId> (<command>, <epic|no epic>)`.
   **The stock command now runs.**

9. **Provisional path** (only from step 3, mode `provisional`). Generate `executionId` as
   `prov_` + UUID, a `correlationId`, and use the execution id as `idempotencyKey`. Write
   `.pmi/provisional/<executionId>.json` holding one sync-batch record: the registration
   request (as in step 8, with `surface` `mcp-client`), an `events` list whose first item is
   `execution-sync-queued` with `payload.reason` `platform_unreachable`, and `governed: false`.
   Write `.pmi/last-execution` with `provisional: true`. Print
   `PMI · queued <executionId> (not governed)`. The stock command now runs. Every later line
   about this execution ends with `(not governed)`.

## The first run

The plan from `pmi.project.decompose` carries `policy` (with `taskCeiling`,
`splitRequiresConfirmation`, `version`), `epics` (each with `number`, `slug`, `name` and its
`requirements`) and `unassigned`.

1. If `epics` and `unassigned` are both empty, print
   `PMI · nothing to decompose — add requirements in PMI Studio → Requirement Room` and **stop**.
2. **Before writing any file**, estimate the task count of each Epic from its requirement bundle
   alone — one integer per Epic — and print the plan: one line per Epic with number, name,
   requirement count and your estimate.
3. For every Epic whose estimate exceeds `taskCeiling`, propose a split into two or more
   children along functional seams — for each child a suffix (`a`, `b`, …), a slug, the
   requirements it takes and an estimate — print it, and **wait** for the person to `confirm`,
   `edit: …` or `reject`. An Epic at or under the ceiling is never split. A rejected Epic is
   specified whole.
4. For each delivery Epic (or confirmed child), in number order: register it as in step 8 with
   `targetType` `epic` and `targetId` the Epic number (or number + suffix); run the stock
   specify flow once with that Epic's requirement bundle as the feature description and
   `specs/<number>[suffix]-<slug>/` as the directory; then run `speckit.pmi.finish`. This does
   not change the stock rule of one feature per invocation — the loop invokes it once per Epic.
5. After a split, record the decision on the first child's execution: call
   `pmi.execution.comment` with `executionId`, `commentType` `decomposition-decision`,
   `body` (a JSON document with `policyVersion`, `epic`, `estimate`, `ceiling`, `decision`,
   `children`, `decidedBy`) and `idempotencyKey`.
6. Delete `.pmi/first-run`. Print `PMI · first run: <n> specifications, <k> splits`.
