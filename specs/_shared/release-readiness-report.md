# Platform Release Readiness Report

**Epic**: EPIC-014 (`specs/014-devops-release/`) · **Session**: 2026-08-25
**Gate tasks consolidated here**: `T151`, `T151a`, `T152`, `T152a`, `T152b`, `T153`, `T154`, `T155`, `T155a`

> **Verdict: the platform release gate does NOT pass today.** One gate task passes outright
> (`T152`). Three are blocked by conditions no implementation session can discharge. Three are
> blocked by **closure records that disagree with the repository**, and those are the substance of
> this report — the gate exists to find exactly this, and it did.

---

## `T152` — engine independence · **PASS**

`pnpm test:arch` — **84 tests across 8 files, all passing**, run 2026-08-25.

| Constraint | File | Result |
|---|---|---|
| **PC-1** transport separation | `tests/architecture/transport-independence.spec.ts` | 7 passed |
| **PC-2** engine independence | `tests/architecture/engine-independence.spec.ts` | 10 passed |
| supporting | storage-, agent-, loop-, handoff-, room-contract-independence, loop-config-conformance | 67 passed |

PC-1 and PC-2 are intact. This is the only gate task in this report that is unconditionally green.

---

## `T151` / `T154` — closure records across the fifteen epics · **BLOCKED, and one record is wrong**

**Coverage.** Of the fifteen platform epics, **thirteen** carry a `closure.md` recording
Constitution V and a convergence result. Two do not, for different reasons:

| Epic | State | Assessment |
|---|---|---|
| **EPIC-002** `002-team-review-access-storage` | no `tasks.md`, no `closure.md` | **Correct by design.** A `parent-design` epic (register: stage *Clarified*, posture *stalled*) whose journey completes at Planned. It was decomposed into EPIC-023/024/025, whose names reproduce its title exactly. It has no implementation tasks to close. |
| **EPIC-014** `014-devops-release` | 14 open tasks, no `closure.md` | **The gating epic itself.** `T151` and `T154` cannot report "all fifteen" until `T213`–`T216` produce this epic's own closure. A genuine ordering dependency, not an oversight. |

Two closure formats are in use and both satisfy Constitution IX: **task-keyed**
(`005`–`013`, `015` — `## T<id> — …`) and **narrative** (`001`, `003`, `004` —
`## Work Completed` / `## Verified` / `## Not verified` / `## Epic Exit Criteria`).
Neither is preferred; the gate reads both.

### Finding R-1 — `EPIC-004`'s closure reports open work that is complete · **HIGH**

`specs/004-workspace-tenancy-audit/closure.md` carries a `## Still open` table listing
`T052`, `T455`/`T456`, and `T173`–`T176` (Phase Z closure). **All seven are marked `[x]` in that
epic's `tasks.md`**, and its `## Convergence — T174` section — later in the same document —
describes the convergence those Phase Z tasks performed.

The table is stale rather than wrong in substance: the work was done after the section was written
and the section was never annotated. `EPIC-003` faced the same situation and handled it correctly,
striking the superseded text through and adding *"Superseded — see the addendum at the foot of this
document"*. `EPIC-004` did not.

**Why it matters to the gate**: `T151` and `T154` consolidate closure records *without re-running
the per-epic checks* — that instruction is explicit. A gate trusting the record would report
EPIC-004 as carrying seven open tasks. It reads correctly here only because this pass went behind
the record to `tasks.md`, which the gate is told it should not have to do.

---

## `T155` — defect triage · **FAIL**

**Thirteen defect records exist across seven of the fifteen epics.** Every one carries a `**Status**`
field. **Eleven are CLOSED** (fixed, or deferred to a named epic). **Two are OPEN, both HIGH, and
neither is mentioned anywhere in its epic's closure.**

> *Method note, recorded because it changed the conclusion.* This report's first draft stated that
> no record carried a status field, and graded EPIC-010 a HIGH finding on that basis. **That was
> wrong.** The status sits inline — `**Raised**: … | **Status**: **OPEN**` — and the survey pattern
> required it at line start, so it matched nothing and the silence was read as absence. The
> corrected survey **downgrades** the EPIC-005 and EPIC-010 findings and **surfaces two genuinely
> open defects the first pass missed entirely**. A search that cannot fail is not evidence.

### Finding R-2 — two HIGH defects were open and unrecorded in any closure · **one FIXED, one remains**

| Record | Severity | Status | Mentions in its epic's closure |
|---|---|---|---|
| [`DEF-001-006`](../001-platform-foundation/defects/DEF-001-006-the-error-filter-swallows-every-framework-exception.md) — the error filter reports every framework exception as a server error | **HIGH**, affected **every route in the API** | ✅ **CLOSED — FIXED 2026-08-25** (`T1009`–`T1011`) | 0 at the time of this finding |
| [`DEF-007-001`](../007-requirement-intelligence/defects/DEF-007-001-project-scoped-lists-cannot-report-a-missing-project.md) — a project-scoped list cannot tell "no such project" from "project is empty" | **HIGH** | **OPEN**, raised 2026-08-21 | **0** |

`DEF-001-006` was the more serious: *"every mistyped URL is reported as a server error, and real
404s are indistinguishable from crashes."* It was found while investigating `DEF-007-001` — it was
the control test, not the target. The two are one defect and its cause, and `DEF-001-006` had to
land **first**, because `DEF-007-001`'s remedy is to raise a not-found that the broken filter would
have converted back into a 500.

**`DEF-001-006` fixed and verified end to end, 2026-08-25.** Re-entered as tasks `T1009`–`T1011`
per Constitution VI. Against the rebuilt container: `GET /v1/no-such-route` returns **404
`not_found`** where it previously returned **500 `internal_error`**; `/v1/engines` and
`/v1/projects` still return **401 `unauthenticated`**, so the `PlatformError` path is untouched;
`/` still serves the SPA. Unit 7/7, architecture 84/84 with PC-1 intact.

The sweep (`T1011`) answers why it survived: `backend/src/` contains **0** throws of any Nest
`*Exception` and **118** throws of `PlatformError` subclasses. Every *deliberate* error path mapped
correctly, so every test of an intended failure passed. Only exceptions the framework raises by
itself took the broken branch, and nothing exercised those.

**`DEF-007-001` remains open** and is the next fix. `T155` still cannot be marked complete.

**This is what blocks `T155`**, and it is a product defect rather than a bookkeeping one. `T155`'s
condition is "empty, **or** deferred to a named epic"; these are neither closed nor deferred, and
their epics' closures do not name them at all. Both closures were written **before** the records were
filed (EPIC-007's closure predates its record by one day), so nothing was concealed — but a gate that
consolidates closures without reading `defects/` would ship with both open.

### Finding R-3 — three closures describe their `defects/` folder as empty when a file exists · **LOW**

| Epic | Closure says | Folder holds | Is the claim substantively true? |
|---|---|---|---|
| **005** identity-signin | *"contains no records (only `.gitkeep`). 0 open, 0 raised, 0 deferred."* | `DEF-005-001` — **FIXED** | **"0 open" is true.** Only "contains no records" is stale. |
| **010** specification-interface | *"contains no records. 0 open."* | `DEF-010-001` — **CLOSED — FIXED 2026-08-23** (`T200a`–`T200e`) | **"0 open" is true.** Only "contains no records" is stale. |
| **007** requirement-intelligence | *"contains no records (only `.gitkeep`). 0 open."* | `DEF-007-001` — **OPEN** | **No** — counted under R-2 above, not here. |

For 005 and 010 the substance holds and only the phrasing rotted; both need a dated annotation, not
a correction of fact. The four other epics with records (`001`, `004`, `008`, `014`) account for
theirs — `004` routes `DEF-004-001` to EPIC-005 for actor propagation, `008` defers `DEF-008-001` to
EPIC-003, and `001`'s five closed records are accounted for. `DEF-001-006` is the exception, above.

---

## `T155a` — SRS back-fill for FR-024 / FR-025 · **BLOCKED — project owner**

`specs/_shared/platform-spec.md` line 112 still reads:

> **Requirements not yet covered by SRS**: FR-024 and FR-025 (generation job cancellation and
> timeout)

The back-fill has **not** landed, so the confirmation this task asks for cannot be made. Amending
`PMI-DOC-004 v2.0` — an APPROVED SRS — is the project owner's act and requires a §17
revision-history entry. This is the same constraint EPIC-030 `T988` records for `BR-0065`, and the
same rule applies: **until it lands, the SRS wins (Constitution II)**.

---

## Not attempted in this session, and why

| Task | Status | Reason |
|---|---|---|
| `T151a` Principle Conformance baseline review | **not done** | Requires reviewing all 20 principles and every deferral's owner in `platform-spec.md` against decision D-6. Substantial, and more honest to leave undone than to rubber-stamp. |
| `T152a` architecture review | **not done** | A review against `system-design.md`, the ADRs and PC-1–PC-3 is a judgement exercise; `T152`'s green suite is evidence *for* it, not a substitute for it. |
| `T152b` security review | **not done** | Sandbox isolation, workspace scoping, credential handling, audit immutability. Note `EPIC-004`'s own closure records that **no audit entry has ever been written by the running API** — the persistence adapter is absent and the default writer refuses. A security review cannot conclude while that is true. |
| `T153` quickstart V1–V12, **V11a**, V14, V15 | **not done** | `EPIC-015`'s closure records that `T145` is *authored, not run*: V2 and V5–V12 are `test.fixme`, deliberately, because an empty Playwright body reports green and a vacuous green would claim seven scenarios measured. They were gated on the frontend app shell (owner EPIC-014 F-11.2). **That blocker may now be lifted** — EPIC-036 delivered the shell and F-11.3 containerised the stack — making this the highest-value gate task to attempt next. `V11a` has never been run at all (`T153a`). |
| `T156` promote `local → dev` | **BLOCKED** | No reachable environment beyond `local`. Constitution VII forbids skipping an environment, and a promotion is an outward-facing act requiring explicit authorisation. |

---

## What the gate needs before it can pass

1. **Fix or defer `DEF-001-006` and `DEF-007-001`** (R-2). These are open HIGH defects, not
   paperwork. `DEF-001-006` makes every 404 indistinguishable from a crash across every route, and
   `DEF-007-001` is the symptom that led to it. Nothing else on this list matters as much.
2. **Annotate the stale closure records** — `004`'s `## Still open` table (R-1), and the
   empty-`defects/` phrasing in `005`, `007` and `010` (R-3) — following `EPIC-003`'s
   strike-and-annotate precedent. Do not delete: the record of what was believed on the day is
   itself evidence.
3. **Close EPIC-014 itself** (`T213`–`T216`), without which `T151` and `T154` cannot say "all fifteen".
4. **Attempt `T153`** now that the shell and the container stack exist.
5. **Project owner**: the FR-024/FR-025 SRS back-fill (`T155a`), and `BR-0065` (EPIC-030 `T988`).
6. **Then** `T156`, once an environment beyond `local` is reachable.

---

## Delivery baseline — adopted 2026-08-25 (Constitution XII Steps A and B)

The seven-dimension reporting rule replaces task and test counts as the measure of delivery.
**Screen status and Epic status are reported separately and never substituted for one another.**

| Dimension | Value |
|---|---|
| **Prototype screens** | **2 delivered · 2 partly delivered · 13 declared-not-delivered · 0 unowned** (17 V2 prototype pages; the registry holds 18, adding Workspace & Administration) |
| **Epics & features** | 27 complete · 4 partial · 5 not started · 3 newly declared (EPIC-038/039/040, ownership only) |
| **User-reachable workflows** | Sign in · list and create projects · browse specifications · view runs · workspace administration · Home attention items |
| **Open implementation tasks** | 411 (389 in the five Room epics) |
| **Open human decisions** | 6 — 4 human walkthroughs, 2 project-owner SRS transcriptions (PMI-DOC-001 and Native Spec-Kit `.docx`) |
| **Test status** | governance 993/995; the 2 failures are `T885`'s pending accessibility record |
| **Known deviations** | Home missing 2 of 3 prototype panels · `DEF-007-001` open · EPIC-037 not yet specified · two `.docx` clarifications awaiting transcription |

**Why the screen count differs from earlier figures in this session.** Two were published: *"four
built"* read the registry's `delivered` flag, which answers *"does a screen render"*; *"3 built, 5
partial, 9 unbuilt"* mixed screen state with Epic progress. Both are superseded. The registry now
carries a fourth state, `partly-delivered`, so the vocabulary can express the distinction that
caused the disagreement — and `T1014` asserts both denominators so a future count cannot omit
which it means.
