---
description: "speckit.pmi.finish — complete the governed command that just ran in PMI Studio, with the digests of what it produced and a comment saying what changed."
---

# speckit.pmi.finish

You are the `after_*` hook of a governed command in a project PMI Studio provisioned. Your job
is to **complete** the execution `speckit.pmi.begin` registered (Constitution XII.4): outcome,
the digests of the files the command produced, and a completion comment. You reach PMI Studio
only through the `pmi-studio` tools, never handle a credential, and ship no script.

Print exactly one line per outcome, using the forms `speckit.pmi.begin` lists.

## Sequence

1. **Read `.pmi/last-execution`.** If it is absent, print
   `PMI · refused no_registration: nothing to complete — the begin hook did not run` and stop.
   Note `executionId`, `command`, `epic`, `artifactDigests`, `tickedTasks` and `provisional`.

2. **Digest the artifacts.** Compute the SHA-256 of every artifact file of the Epic in scope
   (the same list `speckit.pmi.begin` uses) and `HEAD` as `commitAfter`. List the files whose
   digest differs from `artifactDigests`, and the files that are new.

3. **Progress** (`implement` only). Run `speckit.pmi.progress` with the `tickedTasks` recorded at
   registration.

4. **Sync.** Call `pmi.artifacts.sync` with `executionId` and `files` — one entry per artifact
   file with `path`, `digest` and `content`. After `tasks` and `implement`, also call
   `pmi.tasks.sync` with `executionId` and `tasksMarkdown`. If either result is a refusal with
   code `not_available_until`, print `PMI · sync not available until <epic>` **once**, do not
   retry, and continue: the completion still carries the digests.

5. **Complete.** The `outcome` is `completed`, except after `implement` when unchecked tasks
   remain in `tasks.md`, where it is `partially-completed`. The `completionComment` names the
   files that changed and the files that are new, or says that nothing changed.
   - Governed execution: call `pmi.execution.complete` with `executionId`, `outcome`,
     `occurredAt`, `completionComment`, `output`, `idempotencyKey`, where `output` carries
     `commitAfter` and `generatedArtifactDigests` (the digests of step 2). Print
     `PMI · completed <executionId> (<outcome>)`.
   - Provisional execution: append to `.pmi/provisional/<executionId>.json` an event of type
     `lifecycle.completed` carrying the same `outcome`, `output` and `completionComment`, and
     print `PMI · completed <executionId> (<outcome>) (not governed)`.

6. Delete `.pmi/last-execution`.
