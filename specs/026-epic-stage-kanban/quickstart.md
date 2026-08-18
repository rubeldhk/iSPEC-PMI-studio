# Quickstart & Validation: Epic Stage Register & Definition of Ready

**Epic**: `EPIC-026` | **Date**: 2026-08-09 | **Plan**: [plan.md](./plan.md)

Eight scenarios proving the epic delivered what it specified. Every one runs against the repository
itself — no database, no server, no fixtures beyond a temporary directory.

## Prerequisites

```bash
pnpm install          # already satisfied in a working checkout
```

Nothing else. The derivation reads the file tree; the checks run under the existing `governance`
Vitest project.

## Commands

```bash
pnpm test:governance          # all checks, including G-26-01 to G-26-10
pnpm register:update          # regenerate governance/epic-stage-register.md
pnpm typecheck:governance     # type-check the derivation and checks
```

---

## V26-1 · The register exists, covers every Epic, and is readable

**Proves**: `FR-ESK-007`, `FR-ESK-008`, `FR-ESK-021` · `SC-ESK-001`, `SC-ESK-002`, `SC-ESK-013`

```bash
cat governance/epic-stage-register.md
ls -d specs/[0-9][0-9][0-9]-*/ | wc -l    # count Epic directories
```

**Expect**: one table row per Epic directory, ordered by identifier, each naming a stage and a next
command. The row count equals the directory count. `specs/_shared/` does not appear. `EPIC-026`
appears in its own register.

**Fails if**: any Epic is missing, `_shared` is present, or a row has a blank Stage.

---

## V26-2 · The stage is derived and cannot be hand-set

**Proves**: `FR-ESK-003` · `SC-ESK-004`

```bash
pnpm register:update && git diff --exit-code governance/epic-stage-register.md   # expect: no change
# now edit one Stage cell in the register by hand, then:
pnpm register:update && git diff --stat governance/epic-stage-register.md        # expect: edit reverted
```

**Expect**: regeneration with no repository change produces no diff. A hand edit is overwritten.

**Fails if**: regeneration is non-deterministic (a timestamp, a count, an ordering that varies), or a
hand edit survives.

---

## V26-3 · A stale committed register fails the build

**Proves**: `FR-ESK-021`, `FR-ESK-016` · `SC-ESK-009`, `SC-ESK-013`

```bash
mkdir -p specs/099-scratch-epic && printf '# Feature Specification: Scratch\n' > specs/099-scratch-epic/spec.md
pnpm test:governance                       # expect: FAIL — G-26-04 drift
rm -rf specs/099-scratch-epic
pnpm test:governance                       # expect: back to green
```

**Expect**: adding an Epic without regenerating fails, naming the disagreement.

**Note**: this also trips EPIC-018's `G-05d`, which requires the new directory in
`governance/repository-layout.md`. Two independent checks catching one omission is the intended
behaviour, not redundancy.

---

## V26-4 · Out-of-order artifacts are reported, not rewarded

**Proves**: `FR-ESK-006` · stage contiguity (data-model §1)

```bash
# in a scratch Epic: create spec.md and tasks.md, but no plan.md
pnpm register:update && grep -A5 '## Findings' governance/epic-stage-register.md
```

**Expect**: the Epic reads **Specified** — the highest stage it can prove without a gap — and a
finding records `tasks.md` present without `plan.md`. The finding does **not** raise the stage.

**Fails if**: the Epic reads Tasked, which would reward skipping the Development Workflow.

---

## V26-5 · Deliberate stops read differently from stalls, and parent designs from both

**Proves**: `FR-ESK-004` to `FR-ESK-006`, `FR-ESK-020`, `FR-ESK-024` · `SC-ESK-005`, `SC-ESK-010`

```bash
grep -E 'EPIC-(002|009|012|017)' governance/epic-stage-register.md
```

**Expect**:

| Epic | Reads |
|---|---|
| EPIC-009, EPIC-012 | `Held — awaiting PMI-DOC-004`, Not ready |
| EPIC-002, EPIC-017 | `parent-design`, Planned, Readiness `n/a`, children named |

Then remove `posture.awaiting` from EPIC-009 in `governance/epic-declarations.json` and regenerate:
the posture is reported as incomplete.

**Fails if**: a parent design reads as stalled, or a posture with no named object is accepted.

---

## V26-6 · The Definition of Ready blocks, and reports every failure at once

**Proves**: `FR-ESK-010` to `FR-ESK-014` · `SC-ESK-006`, `SC-ESK-007`

```bash
pnpm test:governance 2>&1 | grep -A20 'G-26-06'
```

**Expect**: for an Epic failing several conditions, **all** failing `DOR-nn` identifiers are listed
in one evaluation — not the first encountered. No Epic failing an uncovered condition reads `Ready`.

Then confirm the negative case: no DOR condition rests on human judgement. Every one of the twelve
names the file it reads (data-model §4).

**Fails if**: evaluation short-circuits, or a condition cannot be evaluated without a person.

---

## V26-7 · Waivers are visible, scoped, owned, and expire

**Proves**: `FR-ESK-022`, `FR-ESK-023` · `SC-ESK-014`

```bash
# add a waiver for one condition on one Epic with a future expiry, then:
pnpm register:update && grep -A5 '## Active waivers' governance/epic-stage-register.md
```

**Expect**: the Epic reads **`Ready (waived)`** — never plain `Ready` — and the waiver appears with
its condition, owner, reason and expiry.

Then, in turn: set `expires` to a past date → **build fails**. Remove `owner` → reported invalid,
grants nothing. Give `condition` two values → reported invalid.

**Fails if**: a waived Epic reads plain `Ready`, or an expired waiver is tolerated.

---

## V26-8 · Every journey step leaves evidence, and nothing duplicates the README

**Proves**: `FR-ESK-017` to `FR-ESK-019`, `FR-ESK-009` · `SC-ESK-008`, `SC-ESK-011`, `SC-ESK-012`

```bash
grep -c 'Clarifications' specs/026-epic-stage-kanban/spec.md      # evidence a clarify run happened
ls specs/*/analysis.md 2>/dev/null                                 # evidence analysis runs happened
grep -nE '⏸|▶ Proceeding|Held —|[0-9]+ tasks' specs/README.md      # expect: no status content
```

**Expect**: a clarification session is recorded even when no questions were asked; `analysis.md`
exists for every re-analysed Epic; `specs/README.md` carries narrative and build order but **no**
stage, posture, or task counts, and links to the register instead.

**Fails if**: `specs/README.md` still groups Epics by status — the PP-002 duplication this epic must
remove rather than add to.

---

## What these scenarios deliberately do not prove

**That an agent obeys the skill instruction.** `G-26-08` asserts the recording instruction exists in
`.claude/skills/speckit-clarify/` and `.claude/skills/speckit-analyze/`; nothing asserts it was
followed. Non-compliance is instead self-punishing — the Epic stays at a lower stage and fails
`DOR-09`, visibly. Recorded here rather than papered over; see [research.md](./research.md)
**R-026-4**.

**That the register is correct about intent.** It is correct about artifacts. Whether an Epic
*should* be held is a judgement the register records and never makes.

---

## Results — run 2026-08-18 (`T527`)

All eight scenarios **executed**, not asserted. Each was run against the real repository, with
faults injected and reverted where the scenario calls for one.

| Scenario | Result | What was observed |
|---|---|---|
| **V26-1** register exists, covers every Epic | ✅ pass | **28 rows, 28 Epic directories**, ordered by identifier, `_shared` absent (0 mentions) |
| **V26-2** the stage is derived, not hand-set | ✅ pass | Regeneration on an unchanged tree produced a **byte-identical** file. A hand edit of `Not ready` → `Ready` was **overwritten** by the next `pnpm register:update`, not adopted |
| **V26-3** a stale register fails the build | ✅ pass | A new `specs/099-scratch/` without regenerating failed **4 assertions** across `G-26-03` and `G-26-04`, including the row count and the byte-for-byte comparison |
| **V26-4** out-of-order artifacts are reported, not rewarded | ✅ pass | `099-scratch` with `spec.md` + `tasks.md` and no `plan.md` read **`Specified`**, and the finding *"Tasked evidence present without the stage before it — stage held at Specified"* appeared in the Findings section. The stage did **not** advance |
| **V26-5** deliberate stops read differently from stalls | ✅ pass | EPIC-009 and EPIC-012 read **`Held — awaiting PMI-DOC-004…`**; EPIC-014 reads **`stalled`**; EPIC-017 reads **`parent-design · Planned · — · n/a`**. Three distinct readings, as `SC-ESK-005` requires |
| **V26-6** the DOR reports every failure at once | ✅ pass | EPIC-014 returned **`DOR-05 DOR-08 DOR-09` — 3 failures out of 12 conditions evaluated**. No short-circuit: conditions after the first failure were still evaluated and reported |
| **V26-7** waivers are visible, scoped, owned, expiring | ✅ pass | A valid waiver on `DOR-09` yielded **`Ready (waived)`** — never plain `Ready`. The same waiver with a past expiry yielded **`Not ready`** and **1 blocking** problem |
| **V26-8** every step leaves evidence, nothing duplicates the README | ✅ pass | Both skill files carry their recording instruction. `specs/README.md` matched **0** stage/posture/task-count patterns and **1** link to the register |

### What the run showed that the checks do not

**`V26-5` is the scenario worth reading.** Before Phase 5 every Epic in this repository read the
same way, and the three that now read differently do so because somebody declared an intent. That is
the entire argument for the derived/declared split, visible in three rows.

**`V26-6` returned three failures, not one.** `DOR-09` fails for every Epic in the repository —
no `analysis.md` exists yet — so a short-circuiting evaluator would have reported EPIC-014 as one
condition away from ready. It is three.

### Not verified

- **No Epic has ever reached `Ready` against the real corpus.** All 26 delivery Epics fail `DOR-09`.
  `Ready` and `Ready (waived)` are verified against fixtures only, in `readiness.spec.ts` and
  `V26-7` above.
- **No real waiver exists.** `V26-7` was run against a constructed one; `governance/epic-declarations.json`
  declares an empty `waivers` array.
