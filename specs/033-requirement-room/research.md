# Research: Requirement Room

**Epic**: `EPIC-033` · **Phase**: 0 · **Date**: 2026-08-22 · **Plan**: [plan.md](./plan.md)

Nine decisions. Two were settled at the 2026-08-22 clarification session; seven resolve
`NEEDS CLARIFICATION` items or choices those answers created.

**This is the first Room.** Three of the decisions below — `R-033-3`, `R-033-4`, `R-033-6` — set
patterns `EPIC-034` and `EPIC-035` inherit rather than re-decide. They are argued at more length
than their local cost justifies, for that reason.

**Current-docs discipline**: Context7 MCP was available and was used for `R-033-3`. Library IDs are
recorded for `/speckit-implement` and `/speckit-converge`.

---

## `R-033-1` — Consume `EPIC-007`'s register; baseline the **set**

**Decision**: This Room reads and writes requirements through `EPIC-007`'s existing
`RequirementsService`. It adds **no second requirement store**. What it adds is the **baseline** —
an approved, immutable *set* — which does not exist today.

**Rationale, and the code confirms the boundary is clean.** `backend/src/modules/requirements/`
already provides:

| Exists | What it gives this Room |
|---|---|
| `RequirementsService` — `create`, `get`, `list`, `edit`, `versions` | the register `D-33` says to consume |
| `RequirementVersionService` — `append`, `listForRequirement` | **per-requirement** version history |
| `requirement-hash.ts` | content hashing, reused for baseline integrity (`R-033-5`) |
| `requirement-retire.service.ts` | retirement, distinct from supersession |

**What does not exist is a baseline.** Versions are tracked per requirement; nothing represents *an
approved set of requirements, frozen together*. That is `BR-0026`, and it is precisely the
capability `D-33` said EPIC-007 does not have — confirmed by reading rather than assumed from the
decision.

The boundary is therefore sharper than the spec could state it: **EPIC-007 owns the requirement;
this Room owns the set, and the act of approving one.**

**Alternatives considered**: a Room-local requirement store — rejected by `FR-RQR-002` and `D-33`,
and the code shows it would duplicate four working services.

---

## `R-033-2` — AI analysis runs through `EPIC-028`'s agent gateway

**Decision**: Clarification questions, conflict and gap analysis, and option generation invoke
`packages/agent-contract`'s **`AgentGateway`** with the existing **`analyze`** capability. **No new
AI seam, no new provider dependency.**

**Rationale**: `AGENT_CAPABILITIES` already contains `analyze` — the capability this Room needs
exists and is unused by any Room. The gateway also supplies three things this Room would otherwise
have specified badly:

- **`AgentExecutionRecord`** — the durable session record `BR-0104` requires, so every AI
  clarification is attributable without this Room inventing a log.
- **`AgentResult<T>`** — a discriminated result rather than a thrown error. This is the **third**
  such type in the repository, after `StorageResult` and the loop's transition result. A Room that
  threw on a failed analysis would be the odd one out.
- **`WallClockOutcome<T>`** and `ContextLimitExceededError` — partial budget infrastructure. `BR-0106`
  cost limits are `U-11` and unowned, and the spec forbids this Room building its own; this is what
  it consumes in the meantime.

**Alternatives considered**: calling a model provider directly — rejected by `RULE-08` and
`BR-0103`; it would put a vendor in a Room's business logic, which is the coupling `EPIC-028` exists
to remove.

---

## `R-033-3` — `UX-0035` as a compile error, not a review comment

**Decision**: A shared **`RoomShell`** component taking **six required, named JSX props** —
`objectState`, `loopProgress`, `aiAnalysis`, `decision`, `evidence`, `activityTimeline` — rather
than `children`. It lives in `frontend/src/rooms/RoomShell.tsx` and all three Rooms compose it.

**Rationale**: `UX-0030` requires six regions and `UX-0035` forbids the three Rooms diverging in
region vocabulary. Expressed as `children`, both are conventions a reviewer must notice. Expressed
as six required named props:

- a Room omitting a region **does not compile**;
- a Room inventing a seventh has nowhere to put it;
- the region vocabulary **is** the prop names, defined once in one file.

React's own documentation states the mechanism plainly: a component takes `children` when the hole
may be filled with arbitrary JSX, and *"you can also make `title` a separate prop if you want every
`Card` to always have a title."* Six always-required regions is that case, six times.

**This is the decision `EPIC-034` and `EPIC-035` inherit.** `EPIC-033` is the first Room, so the
vocabulary it names is the vocabulary the other two are built against — which is why `UX-0035` is
worth making mechanical here rather than trusting three Epics to agree.

**Docs consulted**: `/reactjs/react.dev/__branch__v18` — *passing JSX as props to build a layout
component with named slots instead of arbitrary children*.

**Alternatives considered**:
- *`children` plus a lint rule* — rejected; a lint rule can be disabled per file and does not
  constrain the vocabulary, only its use.
- *An architecture test scanning for region names* — kept **in addition**, not instead: it catches a
  Room that stops using `RoomShell` altogether, which the type system cannot.

---

## `R-033-4` — An unlabelled AI output is unrepresentable

**Decision**: AI output is a **discriminated union** on an `epistemic` field —
`fact | inference | recommendation | open-question` — with no default and no optional variant. The
type lives in the Room contract package; the visual distinction (`UX-0031`) is a `EPIC-029` token
mapping over that field.

**Rationale**: `FR-RQR-011` says an unlabelled element **MUST NOT be presentable**. A required
discriminant makes that a compile error rather than a runtime check that a component could forget.
`UX-0031` states the failure mode as a design rule — *"a recommendation that renders identically to
an approved decision is a governance failure expressed as a styling choice"* — and a governance
failure that can be introduced by a styling choice should not be prevented only by styling.

**Alternatives considered**: an optional `label` with a runtime guard — rejected; the guard is
exactly what gets omitted under delivery pressure, and the omission looks like nothing.

---

## `R-033-5` — Baseline immutability, and what a baseline is made of

**Decision**: A baseline stores the **requirement version identifiers** it froze, plus a
**content hash over that set**, computed with the existing `requirement-hash.ts`. It is append-only;
supersession is a new row pointing at the prior one.

**Rationale**: storing version ids rather than copies means the baseline cannot drift from the
register, and `FR-RQR-052`'s *"a superseded baseline remains readable"* holds without duplicating
requirement text. The set hash is what makes `FR-RQR-051` checkable: an in-place edit changes the
hash, and the mismatch is detectable rather than argued about.

Reusing `requirement-hash.ts` matters beyond convenience — two hashing schemes over the same content
would eventually disagree, and the disagreement would surface as a baseline that cannot be verified.

**Alternatives considered**: copying requirement content into the baseline — rejected; it doubles
the storage of every requirement and creates a second place for text to be edited.

---

## `R-033-6` — The Room is a distinct loop workflow type

**Decision**: `packages/loop-contract/workflows/requirement-room.json` declares this Room's stages,
authorities and gates. It is a **distinct workflow type**, not a variant (clarified 2026-08-22).

**Rationale**: `ADR-0018`'s only decided constraint, and `EPIC-030`'s `T944a`/`T944b` enforce it.
The Room's flow — intake, extraction, clarification, options, criteria, decision, baseline, handoff —
maps onto the eight loop stages with `Execute` and `Verify` omitted, which `FR-GEL-008` requires be
**visible as omitted** rather than absent.

**This is the second pattern the other Rooms inherit**: each Room owns a workflow file, and the
stage vocabulary is `EPIC-030`'s.

---

## `R-033-7` — Performance and scale targets (`PP-018`, deferred here by the spec)

**Decision**:

| Target | Value |
|---|---|
| Room load — six regions, populated | **p95 < 1.2 s** at 200 requirements in the set |
| Baseline creation | **p95 < 2 s** at 200 requirements |
| Unmet-blocker query for the Room header (`UX-0032`) | **p95 < 200 ms** |
| AI clarification round | bounded by `EPIC-028`'s wall-clock outcome, **not by this Room** |
| Requirement set size | designed for **500**; degradation above that is a recorded limit, not a surprise |

**Rationale**: the Room is a working surface, not a batch job, so the number that matters is time to
a usable screen. The AI round is deliberately **not** given a target here — it is `EPIC-028`'s
`WallClockOutcome`, and inventing a second budget would be the `BR-0106` mistake the spec forbids.

---

## `R-033-8` — Constitution XI Tier 2 applies, and what the transcript must show

**Decision**: Tier 1 drives the Room's HTTP routes through the real `AppModule` (`EPIC-030`'s
pattern). **Tier 2 applies in full**: a **run-generated** transcript of *unstructured intent →
approved baseline* against a running application.

**Rationale**: this Epic delivers a journey a person works in, which is exactly what Principle XI
Tier 2 was ratified over — `DEF-005-001`, *"sign-in impossible in the running application"*, found by
a human opening a browser after closure. The transcript must show the **whole** journey, because the
failure mode here is a Room whose regions each work and whose flow does not.

`SC-RQR-008` additionally requires that journey be completable **using only a keyboard**, so the
transcript is a keyboard transcript or it does not discharge the criterion.

---

## `R-033-9` — The PMI-DOC-006 dependency, stated as a risk rather than a footnote

**Decision**: Proceed, and record that `FR-RQR-070`–`FR-RQR-075` rest on a document whose status is
**`PROPOSED — REQUIRES PROJECT OWNER APPROVAL`**.

**Rationale**: `BR-0191` — the shared Room pattern — is a **SHOULD** in PMI-DOC-004. Most of the
pattern's binding force therefore comes from PMI-DOC-006, which is unapproved. `R-033-3` makes the
pattern mechanical, which **raises** the cost of the pattern later changing: a `RoomShell` with six
named props is cheap to write and expensive to re-cut once three Rooms compose it.

**This is the strongest argument for discharging the approval before `EPIC-034` plans**, and it is
recorded here rather than in a closing report because the decision to proceed was taken now.

**Alternatives considered**: waiting for approval — rejected; it would block Wave 1's largest Epic
on an act nobody has scheduled, and `R-033-3` is reversible at the cost of one file if the pattern
changes.

---

## Resolved `NEEDS CLARIFICATION` items

| Item | Resolved by |
|---|---|
| Relationship to `EPIC-007`'s register | `R-033-1` (verified in code) |
| Where AI analysis runs | `R-033-2` |
| How `UX-0030`/`UX-0035` are enforced | `R-033-3` |
| How epistemic labelling is guaranteed | `R-033-4` |
| What a baseline stores | `R-033-5` |
| Performance and set-size targets | `R-033-7` |

**None remain.**

## Library IDs for downstream commands

| Dependency | Context7 library ID | Consulted for |
|---|---|---|
| React 18 | `/reactjs/react.dev/__branch__v18` | named JSX props versus `children` for a required-slot layout (`R-033-3`) |
| NestJS (`^10.4.15`) | `/nestjs/docs.nestjs.com` | composed-graph e2e testing — `EPIC-030` `R-030-8`, reused |
| Prisma (`^5`) | `/prisma/web` | as `EPIC-030` `R-030-1` |

**No new runtime dependency.** The AI seam is `EPIC-028`'s existing `AgentGateway`; the design system
is `EPIC-029`'s; the register is `EPIC-007`'s.
