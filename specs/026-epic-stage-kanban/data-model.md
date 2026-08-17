# Artifact Model: Epic Stage Register & Definition of Ready

**Epic**: `EPIC-026` | **Date**: 2026-08-09 | **Plan**: [plan.md](./plan.md)

No database. Like EPIC-018, the "model" here is documents and the rules that relate them. The one
structural idea worth stating up front:

```text
    DERIVED (from the file tree)          DECLARED (by a person)
    ────────────────────────────          ──────────────────────
    Stage        ─┐                    ┌─  Epic Kind
    DOR results  ─┤                    ├─  Posture
                  │                    ├─  Waiver
                  └──────► REGISTER ◄──┘
                          (generated)
```

**Nothing crosses that line.** A person never writes a stage; a machine never infers intent. The
register is the join, and it is generated — which is why it can be trusted and why it must never be
hand-edited.

---

## 1 · Stage

An ordered position in the journey. Seven, fixed by `FR-ESK-001`, configured under `FR-ESK-015`.

| Order | Stage | Evidence (all paths relative to `specs/<epic>/`) | Next command |
|---|---|---|---|
| 1 | `Specified` | `spec.md` exists | `/speckit-clarify` |
| 2 | `Clarified` | `spec.md` contains `## Clarifications` **and** ≥1 `### Session <date>` | `/speckit-checklist` |
| 3 | `Checklisted` | ≥1 file in `checklists/` **and** zero unchecked items across them | `/speckit-plan` |
| 4 | `Planned` | `plan.md` exists | `/speckit-tasks` |
| 5 | `Tasked` | `tasks.md` exists | `/speckit-analyze` |
| 6 | `Analyzed` | `analysis.md` exists | DOR evaluation |
| 7 | `Ready` / `Ready (waived)` | every DOR condition passes, or is waived | `/speckit-implement` |

**Derivation rule** — the stage is the **highest contiguous** stage whose evidence is present,
starting from 1. Evidence present above a gap does not count and is reported separately as an
out-of-order finding (`FR-ESK-006`, edge case).

```text
spec ✓  clarif ✓  checklist ✓  plan ✗  tasks ✓   →  stage = Checklisted
                                                     finding = tasks.md present without plan.md
```

**Terminal stage depends on Epic Kind** (§2): a `delivery` Epic runs to `Ready`; a `parent-design`
Epic completes at `Planned` and is never evaluated for readiness.

**Zero-stage case**: a directory matching the Epic pattern with no `spec.md` is reported as an
invalid Epic directory, not given stage 0. An Epic without a specification is not an early-stage
Epic; it is a mistake.

---

## 2 · Epic Kind *(declared — `FR-ESK-024`)*

| Kind | Meaning | Terminal stage | DOR evaluated? |
|---|---|---|---|
| `delivery` | Produces tasks and is implemented. The default when nothing is declared | `Ready` | yes |
| `parent-design` | Holds requirements and design for child Epics; deliberately carries no tasks | `Planned` | **no** |

**Required with `parent-design`**: `children` — a non-empty list of Epic identifiers. A parent design
naming no children is reported as incomplete.

**Known parent designs**: `EPIC-002` (children: 023, 024, 025 — ruling D-19) and `EPIC-017`
(children: 019, 020, 021, 022 — ruling D-18).

**Contradiction**: a `parent-design` Epic holding `tasks.md` is reported. Either the declaration is
wrong or the tasks belong to a child.

---

## 3 · Posture *(declared — `FR-ESK-004`, `FR-ESK-005`, `FR-ESK-020`)*

Why an Epic has deliberately stopped. Exactly three kinds; **all three block readiness**.

| Kind | Meaning | Required field |
|---|---|---|
| `Held` | Awaiting a named input | `awaiting` — the document or decision |
| `Blocked` | Awaiting another Epic | `blockedBy` — an Epic identifier |
| `Superseded` | Replaced by another Epic | `replacedBy` — an Epic identifier |

Every posture also carries a free-text `reason`. A posture missing its kind-specific field is
reported as incomplete (`FR-ESK-005`); a kind outside the three is reported as invalid.

**Absence is not a posture.** An Epic that has stopped with nothing declared reads `stalled` — a
derived observation, never a declaration (`FR-ESK-006`).

**Known postures**: `EPIC-009` and `EPIC-012` — `Held`, awaiting `PMI-DOC-004` (decision D-10).

**Referential rule**: `blockedBy` and `replacedBy` must name an Epic that exists on disk.

---

## 4 · DOR Condition

Twelve conditions, each a predicate over one Epic. `FR-ESK-011` requires every one to be mechanically
checkable — a condition needing human judgement is rejected from the set, not softened into it.

| ID | Condition | Evidence read | Principle |
|---|---|---|---|
| `DOR-01` | Specification exists | `spec.md` | III |
| `DOR-02` | No unresolved clarification markers | `spec.md` — no `[NEEDS CLARIFICATION` outside inline code | — |
| `DOR-03` | SRS traceability populated; uncovered requirements name a back-fill owner | `spec.md` §SRS Traceability | II |
| `DOR-04` | Principle conformance position recorded | `spec.md` §Principle Conformance | PMI-DOC-003, D-6 |
| `DOR-05` | Requirements checklist present and fully resolved | `checklists/*.md` — zero `- [ ]` | — |
| `DOR-06` | Plan exists and its Constitution Check records no FAIL | `plan.md` §Constitution Check | I–IX |
| `DOR-07` | Task list exists | `tasks.md` | III |
| `DOR-08` | Every implementation task pairs with a test or conformance check | `tasks.md` | **V** |
| `DOR-09` | Analysis recorded with zero blocking findings | `analysis.md` | — |
| `DOR-10` | Epic Exit Criteria stated | `spec.md` §Epic Exit Criteria | IV, V, VI, IX |
| `DOR-11` | `defects/` exists with no open records | `defects/` | VI |
| `DOR-12` | No blocking posture declared | declarations | D-10 |

**Evaluation is total, not short-circuiting** (`FR-ESK-013`): every condition is evaluated and every
failure listed, so one pass tells a reader everything outstanding.

**Evaluation is fresh, never stamped**: readiness is a function of current state. Amending a spec
after the DOR passed withdraws readiness on the next run, with no explicit invalidation step.

---

## 5 · Waiver *(declared — `FR-ESK-022`, `FR-ESK-023`)*

An owned, expiring exception covering **exactly one** DOR condition for one Epic.

| Field | Rule |
|---|---|
| `epic` | Must exist on disk |
| `condition` | Exactly one `DOR-nn`; must be a condition currently in the set |
| `owner` | One of `tech-lead`, `product-owner`, `project-owner` — reused from `governance.config.json` |
| `reason` | Non-empty |
| `expires` | `YYYY-MM-DD`, and in the future at check time |

**Invalid** — reported and grants nothing: no owner, an owner outside the three roles, more than one
condition, no expiry, or a condition no longer in the DOR set.

**Expired** — **fails the build** (`FR-ESK-023`), and the Epic ceases to be Ready by any reading.

**Effect on readiness**:

```text
all conditions pass                                  →  Ready
failures, all covered by valid waivers               →  Ready (waived)
any failure uncovered, or any waiver expired/invalid →  Not ready
```

There is no combination producing an unqualified `Ready` while a waiver is active. That is what
stops waivers becoming a second, weaker DOR.

---

## 6 · Stage Record

One row of the register — the join of derived and declared for one Epic. **Not authored.**

| Field | Source |
|---|---|
| `epic` | directory name |
| `title` | first heading of `spec.md` |
| `kind` | declared (§2), default `delivery` |
| `stage` | derived (§1) |
| `posture` | declared (§3), or none |
| `readiness` | derived (§4, §5) — `Ready`, `Ready (waived)`, `Not ready`, or `n/a` for a parent design |
| `next` | derived — the next Spec Kit command, or `—` at a terminal stage |
| `findings` | derived — out-of-order artifacts, incomplete declarations, invalid waivers |

---

## 7 · Register

The generated, committed document. Format in
[contracts/register-format.md](./contracts/register-format.md).

| Property | Rule |
|---|---|
| Coverage | Every directory matching the Epic pattern; no registration step (`FR-ESK-008`) |
| Exclusion | `specs/_shared/` and any non-`NNN-` directory, by the stated pattern rule — not a maintained list |
| Ordering | By Epic identifier ascending, always |
| Determinism | No timestamps, no aggregates; identical input yields an identical file (`SC-ESK-004`) |
| Authority | Generated. A hand edit is overwritten and reported, never adopted |
| Drift | A committed copy disagreeing with the repository **fails the build** (`FR-ESK-021`) |

**Self-inclusion**: `EPIC-026` appears in its own register, at whatever stage it has reached. The
register is not a special case in its own output — the alternative is a document with a footnote
explaining why one row is missing.

---

## 8 · Files

| Path | Kind | Authored or generated | Constitution I |
|---|---|---|---|
| `governance/epic-stage-register.md` | Register (§7) | **generated** | exempt (`governance/**`) |
| `governance/epic-declarations.json` | Kinds, postures, waivers (§2, §3, §5) | authored | exempt |
| `governance/epic-stage.config.json` | Stages, evidence, DOR set, roles, exclusion rule | authored | exempt |
| `specs/<epic>/analysis.md` | Analysis record (`FR-ESK-019`) | generated by `/speckit-analyze` | exempt (`specs/**`) |
| `tests/governance/epic-stage/derive.ts` | Pure derivation | authored | **not exempt** |
| `tests/governance/epic-stage/*.spec.ts` | Checks `G-26-01`…`G-26-10` | authored | **not exempt** |

Three existing files change: `governance/repository-layout.md` (map row plus the `G-05d`
registration), `governance/README.md` (index rows), and `specs/README.md` (status removed, register
linked).

---

## 9 · Rules that hold across the model

1. **Derive what the tree knows; declare only what it cannot.** Stage and DOR results are derived.
   Kind, posture and waivers are intent or authorisation, which no artifact carries.
2. **Evidence records that a step ran, not that it found something** (`FR-ESK-017`). A clean
   clarification session and a clean analysis both leave a record.
3. **Absence is never a decision.** No posture means stalled; no declaration means `delivery`; no
   analysis means not Analyzed.
4. **Every declaration names its object.** A posture names its releasing input, a parent design names
   its children, a waiver names its condition and owner. A declaration pointing at nothing is
   incomplete.
5. **Reaching a stage and passing a gate are different claims.** An `analysis.md` full of blocking
   findings still makes an Epic `Analyzed`; it just is not `Ready`.
