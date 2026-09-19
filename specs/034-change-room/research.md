# Research: Change Room

**Epic**: `EPIC-034` · **Phase**: 0 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Nine decisions. Two were settled at the 2026-08-22 clarification session; seven resolve
`NEEDS CLARIFICATION` items or choices those answers created.

**Two of these decisions changed after reading the code.** `R-034-1` and `R-034-2` were both drafted
from the spec's assumptions and both turned out to be wrong in the same direction — a capability the
spec treated as absent exists, and a capability it treated as reusable does not do what its name
suggests. Recorded at length because the second is a trap this Epic could fall into and satisfy its
own requirement while breaking `BR-0154`.

**Current-docs discipline**: Context7 was consulted for the two external frameworks named in
Technical Context; **no new external dependency is introduced by this Epic**, so no new library
decision was made. Library IDs are recorded below for `/speckit-implement`.

---

## `R-034-1` — Extend `ImpactService`; adopt its depth rather than inventing one

**Decision**: `BR-0044`'s impact view is assembled by calling `EPIC-020`/`dependencies`'
**existing `ImpactService`**, extended with the artifact classes it does not yet reach. This Epic
adds **no second traversal** (`FR-CHR-031`).

**Rationale — and the code is further along than the spec assumed.**
`backend/src/modules/dependencies/impact.service.ts` already provides:

| Exists | Consequence for this Epic |
|---|---|
| `ImpactService.impact(workspaceId, changed: ArtifactRef): Promise<FlaggedImpactResult>` | the traversal `FR-CHR-030` needs |
| **`DEFAULT_IMPACT_DEPTH = 25`** | a traversal depth **already decided**. `PP-018` asked for one; the answer is to adopt 25, not invent a second figure |
| `ArtifactStatusPort.statusOf(...)` | the seam for marking an impacted artifact's state |
| `FlaggedImpactResult extends ImpactResult` | flagging already exists as a concept |

`EPIC-020` is **built and closed** — 22 of 22 tasks, `closure.md` present — checked
case-insensitively after `EPIC-032`'s research got this wrong about `EPIC-015` by matching `- [x]`
against a file using `- [X]`.

`EPIC-011`'s `ChainTraversalService` (`ChainNode`, `ChainLinkShape`, `ChainTraversalResult`) is the
other half: it walks the `BR-0040` trace chain, which is how the impact view reaches specifications,
tasks, tests and releases.

**What this Epic adds** is the *view* — assembling those traversals into the eight artifact classes
`BR-0044` enumerates, and marking undeterminable ones **unknown** (`R-034-7`).

**Alternatives considered**: a Change-Room-local traversal — rejected by `FR-CHR-031`, and the code
shows it would duplicate a working service with a settled depth.

---

## `R-034-2` — The `TaskRegenerationService` trap

**Decision**: `FR-CHR-062` **MUST NOT** satisfy itself by calling `TaskRegenerationService.regenerate()`.
That service **replaces** a task list; `BR-0154` requires revision **without destroying
completed-work history**. Until `U-12` is declared, this Epic **records the re-plan requirement and
does not execute a destructive regeneration**.

**Rationale.** The spec assumed `BR-0154` was simply unbuilt. It is subtler than that, and the
subtlety is dangerous:

```ts
export interface RegenerationOutcome {
  requiresConfirmation: boolean;   // blocks when existing tasks are present
  existingTaskCount: number;
  replaced: boolean;               // ← replaces
  tasks: TaskRecord[];             // "existing when refused, the new list when replaced"
}
```

`EPIC-012` built regeneration as **replace-with-confirmation**. The confirmation gate makes the
replacement *deliberate*; it does not make it *non-destructive*. A comment in the service is explicit
that "a replaced task id resolving to its specification is history, not error."

**So the trap is this**: an implementer reading `FR-CHR-062` — *"downstream work MUST be updated…
through `BR-0154`'s mechanism"* — finds a service named exactly for the job, calls it, sees green
tests, and has destroyed the completed/incomplete state of every prior task. The requirement would
read satisfied and `BR-0154` would be violated.

**What this Epic does instead**: an approved change records a **re-plan obligation** against the
affected specification — what must change and why — and surfaces it. Executing a non-destructive
revision is `U-12`'s, and `FR-CHR-065` (*"re-plan MUST NOT silently discard work already completed"*)
is the requirement that forbids the shortcut.

**Alternatives considered**:
- *Call `regenerate()` with `confirmed: true`* — rejected; this is the trap.
- *Build a non-destructive merge here* — rejected; that is `BR-0154`, it belongs to `U-12`, and
  building it here is the `FR-CHR-002` boundary violation.

---

## `R-034-3` — Import the Room pattern; derive nothing

**Decision**: This Room imports **`packages/room-contract`** (`RoomShellProps`, `Epistemic`,
`RoomObjectRef`) and **`frontend/src/rooms/RoomShell.tsx`** from `EPIC-033`. It defines no region
vocabulary of its own.

**Rationale**: `EPIC-033`'s `R-033-3` made the six regions **required named JSX props**, so omitting
one does not compile and a seventh has nowhere to go. `UX-0035` is therefore enforced by the type
system rather than by three Epics agreeing — provided this Epic imports rather than re-derives.

**`EPIC-033` Phase 2 is a hard prerequisite of this Epic's implementation**, recorded in this Epic's
Assumptions on 2026-08-22 after `EPIC-033`'s analysis finding `C1` observed that neither Room named
the artifact it must import.

**Alternatives considered**: a Change-Room shell — rejected. It is the divergence `UX-0035` forbids,
and it would make `EPIC-033`'s compile-time guarantee decorative.

---

## `R-034-4` — The baseline delta is a set diff over version identifiers

**Decision**: `FR-CHR-063`'s *"readable as a delta, not only as two full versions"* is a structured
diff over the baseline's **member version ids** — added, removed, and version-changed — not a text
diff.

**Rationale**: `EPIC-033`'s `R-033-5` stores a baseline as member requirement **version ids** plus a
set hash, never copies of requirement text. A set diff over those ids is therefore exact, cheap, and
needs no diffing library. A text diff would re-derive from content the baseline deliberately does
not hold.

**Alternatives considered**: a text diff of rendered requirements — rejected; it would be
presentation-layer output masquerading as the delta, and it would disagree with the set hash.

---

## `R-034-5` — Explicit rebase, and what "re-decided" means

**Decision** *(clarified 2026-08-22)*: a change targeting a superseded baseline is **explicitly
rebased as a recorded act**, and **re-decided when the rebase changes its impact view**. The
comparison is between the impact view stored with the original decision and the impact view
recomputed against the new baseline.

**Rationale**: `FR-CHR-035` requires the impact view be retained with the change *"so the decision
can later be read against what was known at the time"* — which is exactly what makes
"has the impact changed?" answerable rather than a judgement. Without the stored view, re-decision
would be a human guess about whether anything material moved.

`EPIC-030`'s `FR-GEL-015` first-commit-wins is deliberately **not** inherited: it settles which
transition won, not what a decision was made against.

---

## `R-034-6` — Receiving a transfer from the Defect Room

**Decision**: `BR-0057` transfers arrive through a dedicated intake path that preserves the
originating defect's context and evidence **by reference**, and records the origin on the Change
Request. A transfer the Change Room refuses **returns** to the Defect Room with the refusal attached.

**Rationale**: `FR-CHR-012` requires context and evidence preserved and the origin visible.
Referencing rather than copying means `EPIC-032`'s evidence items keep their single identity — a
copied attestation would be a second artifact with the same digest and a different id, which is
precisely the provenance ambiguity `FR-EVS-013` exists to prevent.

`EPIC-035`'s `FR-DFR-074` already specifies the return path from its side; both halves are specified
in the same Wave so neither is built against a guess.

---

## `R-034-7` — Unknown impact is a member of the type, not an absence

**Decision**: An impact area the platform cannot determine is represented by an explicit
`unknown` state in the impact view's type, alongside `impacted` and `not-impacted`. It is never
omitted.

**Rationale**: `FR-CHR-032`. The spec states the failure mode precisely — *"an absent row and a
clean row must not look alike"* — and the only way to guarantee that is to make absence
unrepresentable. A three-member union does it; a nullable list does not.

This also covers `FR-CHR-034`: where `BR-0073`'s architecture-violation check is unowned, the view
carries `unknown` with the reason *"check not owned"* rather than a clean panel. **A check that has
not run must not be reported as passing** — Constitution IX's rule, applied to a screen.

---

## `R-034-8` — Performance and scale targets (`PP-018`, deferred here by the spec)

**Decision**:

| Target | Value |
|---|---|
| Impact view assembly | **p95 < 3 s** at depth 25 over a 500-artifact project |
| Traversal depth | **25** — `DEFAULT_IMPACT_DEPTH`, adopted from `EPIC-020`, not invented (`R-034-1`) |
| Baseline delta computation | **p95 < 500 ms** at 200 members |
| Room load, six regions populated | **p95 < 1.2 s** — the same figure `EPIC-033` set, because it is the same shell |
| Change closure evaluation | **p95 < 200 ms** excluding the `EPIC-032` Contract evaluation it calls |

**Rationale**: the impact view is the slowest surface and the one most likely to be abandoned if it
is slow, so it gets the loosest budget and an explicit project size. Room load reuses `EPIC-033`'s
figure deliberately — a shared shell with two different performance targets would be two shells.

---

## `R-034-9` — Constitution XI Tier 2 applies

**Decision**: Tier 1 through the real `AppModule`; **Tier 2 applies in full** — a **run-generated**
transcript of *request → impact → decision → re-baseline* against a running application.

**Rationale**: this Epic delivers a journey. The transcript must cover the **whole** chain because
the failure mode is a Room whose regions each work and whose flow does not — the same reasoning
`EPIC-033` recorded.

---

## Resolved `NEEDS CLARIFICATION` items

| Item | Resolved by |
|---|---|
| How the impact view is assembled, and at what depth | `R-034-1` (verified in code) |
| How re-plan works given `BR-0154` is unowned | `R-034-2` (verified in code — and it is a trap, not a gap) |
| Where the Room pattern comes from | `R-034-3` |
| What a baseline delta is | `R-034-4` |
| What "re-decided" compares | `R-034-5` |
| Performance and traversal depth | `R-034-8` |

**None remain.**

## Library IDs for downstream commands

| Dependency | Context7 library ID | Consulted for |
|---|---|---|
| NestJS (`^10.4.15`) | `/nestjs/docs.nestjs.com` | composed-graph e2e testing — `EPIC-030` `R-030-8`, reused unchanged |
| Prisma (`^5`) | `/prisma/web` | as `EPIC-030` `R-030-1` |
| React 18 | `/reactjs/react.dev/__branch__v18` | the required-slot layout pattern — `EPIC-033` `R-033-3`, **imported not re-derived** |

**No new external dependency, and no new library decision.** Every load-bearing choice in this Epic
is about an **existing in-repository service** — `ImpactService`, `ChainTraversalService`,
`TaskRegenerationService`, `RoomShell`. Recording "none needed" rather than manufacturing a lookup:
the discipline exists to prevent stale training knowledge from deciding, and nothing here is decided
by a library.
