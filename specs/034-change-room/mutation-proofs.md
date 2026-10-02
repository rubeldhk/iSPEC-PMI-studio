# EPIC-034 — Mutation proofs

**Session**: 2026-08-31 · Phase N (`T995a`–`T995d`, `T995l`)

A check that has never been seen to fail is a check nobody has tested. Each entry below applies a
mutation to production source, records the test names that failed while it stood, and reverts it.
Every one was re-run green after reverting.

The mutation scripts are reproducible: `scratchpad/mut.py <task> apply|revert`.

---

## `T995a` — `FR-CHR-011`, `SC-CHR-001`

*"No implementation-changing request bypasses traceable change control once the baseline is
approved."*

**Mutation** (`intake.service.ts`, two edits):

1. `fromRefusedEdit` targets `b_whatever_is_current` / v999 instead of the baseline the refusal
   named — a silent retarget at intake.
2. `openAgainst` returns `[]` — the change is recorded and invisible.

**Observed failing** (`change-room-baseline-gate.spec.ts`, 2 failed | 5 passed):

- `T996e · the gate closes on an approved baseline > the refusal leads to a Change Request against
  that same baseline`
- `T996e · the gate closes on an approved baseline > and the change is visible as traceable change
  control`

**Reverted**: 7 passed.

Both halves matter. A change recorded against the wrong baseline and a change recorded where nobody
can query it are different ways of failing `SC-CHR-001`, and each has its own assertion.

---

## `T995b` — `FR-CHR-032`, `SC-CHR-002`

*"An impact area the platform cannot determine MUST be marked unknown, never omitted."*

**Mutation** (`impact.composer.ts`): an undeterminable area is skipped rather than written as
`unknown` — it renders as absent.

**Observed failing** (`change-room-impact-unknown.spec.ts`, 6+ failed):

- `T996l · one area undeterminable, the rest answered > marks that area unknown and says why`
- `T996l · one area undeterminable, the rest answered > and still carries all eight`
- `T996l · unknown never degrades to clean > for requirements` (and for every other area — the case
  is parameterised over all eight)

**Reverted**: 14 passed.

A second mutation was run in Phase 4 for the other direction — rendering the area as
`not-impacted` rather than omitting it — and failed nine cases. Both are recorded because they are
different mistakes: one loses the row, the other keeps it and lies.

---

## `T995c` — `FR-CHR-062`, `R-034-2`

*The `TaskRegenerationService` trap.* This is the one `R-034-2` exists to prevent, and the only way
to know the ban holds is to try it.

**Mutation** (`replan.recorder.ts`): `TaskRegenerationService` is imported and `regenerate`
referenced.

**Observed failing** (2 failed | 28 passed):

- `T406l · no TaskRegenerationService, at all > never imports it` — the architecture test
- `T994j · R-034-2 — it executes nothing > never imports TaskRegenerationService`

**Reverted**: 24 passed.

### What did NOT fail, and why that is the finding

`T994l` — the re-plan safety test — **did not fail under this mutation**, and the task expected it
to. The reason is worth recording rather than working around:

`RePlanRecorder`'s constructor takes a `ChangeRoomStore` and an optional link writer. **It has no
task store.** Importing `TaskRegenerationService` therefore cannot destroy a task, because there is
nothing for it to destroy through. Making `T994l` fail from this mutation would have required also
giving the recorder a dependency nobody supplies — which is a larger change than the proof, and is
itself the structural fact: the boundary is held by the absence of a capability, not only by the
absence of an import.

`T994l` was separately proven live by a mutation producing `regenerate`'s **effect** — deleting one
completed task row during the re-plan:

- `T994l · a re-plan destroys no completed work > and not one task row changed`
- `T994l · a re-plan destroys no completed work > no task was replaced by one with a new id`

So both checks named by the task are demonstrated live. What is not demonstrated is the single
mutation failing both at once, and the reason it cannot is a stronger guarantee than the one the
task asked for.

---

## `T995d` — Constitution XI Tier 1

**Mutation** (`app.module.ts`): `ChangeRoomModule` removed from the composition root.

**Observed failing** (`change-room-reachability.spec.ts`, 4 failed | 3 passed):

- `T406u · registers ChangeRoomModule in the composition root`
- `T406u · resolves ChangeRoomService from the graph the application actually builds`
- `T406u · declares its six ports, five refusing and one degrading`
- `T406u · serves the route the Requirement Room refusal advertises`

**Reverted**: 7 passed.

`DEF-005-001` is what the alternative looks like: fifteen of fifteen tasks green and the feature
unreachable in the running application, found by a human opening a browser after closure.

---

## `T995l` — `FR-CHR-054`, `SC-CHR-009`

**The one the spec singles out**: an approval that referred to a baseline no longer in force.

**Mutation** (`rebase.service.ts`): the `decidedAgainstVersion !== current.version` guard is
disabled, so a change applies to whatever baseline happens to be current.

**Observed failing** (`change-room-rebase.spec.ts`, 2 failed | 12 passed):

- `T994h · SC-CHR-009 — no silent retarget > refuses to re-baseline onto a version the decision was
  not taken against`
- `T994h · SC-CHR-009 — no silent retarget > and writes nothing when it refuses`

**Reverted**: 14 passed.

This mutation is not hypothetical. The first draft of `rebaseline` had no such guard, and `T994h`
caught it producing baseline `b_3` for a change decided against v1 — the defect arriving before the
proof did.
