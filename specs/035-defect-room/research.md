# Phase 0 Research: Defect Room

**Epic**: `EPIC-035` · **Date**: 2026-08-23 · **Plan**: [plan.md](./plan.md)

Twelve decisions. **Three came from reading code and specifications rather than from reasoning about
them**, and all three contradict something this Epic's specification assumes. They are `R-035-1`
(the collaborator that does not exist), `R-035-2` (the service named for the requirement that does
the wrong thing) and `R-035-4` (the destination that has not been told it is one).

`EPIC-034` found one trap. This Epic found three, and the reason is arithmetic: it is the last of
six, so it depends on more Epics than any of them, and every dependency is a chance for a
specification to name something that is not there.

---

## R-035-1 — Test execution has **no callable owner**, and this Epic must not become one

**Decision**: define a `TestExecution` port, implement **nothing** behind it, and **refuse** when it
is absent. Verification consumes a passing run as `EPIC-032` evidence; this Room never executes.
Record product-side test execution as a **named unowned dependency** in the closing report.

**Rationale**. `FR-DFR-062` says *"Test execution MUST be requested from `EPIC-015` (`BR-0080`); this
Epic MUST NOT build a second test runner."* Both halves were checked.

`BR-0080` in PMI-DOC-004 v2.0 §6.15 reads: *"Every delivered Epic and release scope MUST be
validated against its acceptance criteria before promotion, with the validation evidence
retained."* → `EPIC-015`. That is a **gate on promotion**, not a service that runs tests on request.

And `EPIC-015` built the gate, not a service. Its own specification says, under *Requirements
owned*: **"*None directly.* This epic delivers infrastructure or governance rather than a numbered
functional requirement."** Under *User stories owned*: **"*None* — no user-facing behaviour
originates here."** Its closure record (2026-08-20, 5/5) lists what it produced: a scale
measurement, a job-outcome-rate measurement, a test-completeness assertion, an axe-core sweep, a
worker timeout fix, and an authored-but-unexecuted journey spec. Every one is a test **about this
repository**. None is an API a Room could call.

The register agrees and does not notice: `brs-v2-reconciliation.md` maps `BR-0080` → `EPIC-015` and
has **no `U-` capability area** for on-demand test execution — so nothing is recorded as missing.

So `FR-DFR-062` names a collaborator that exists as an Epic and not as a surface. The Room cannot
build one (`FR-DFR-002` forbids it, and it would be a second test runner in the exact words of the
requirement it was trying to satisfy), and it cannot pretend one is there.

**Absent behaviour is refusal, and the asymmetry is the point.** `EPIC-033`'s `AgentGateway` and
`EPIC-034`'s `ImpactSource` degrade because a missing analysis is a missing input. A missing test
run is different: **"we could not run the tests" must never resolve to "the tests passed."** That is
`BR-0144` and `FR-DFR-063` in one sentence, and it is the whole reason this Room exists.

**Alternatives considered**. *Build a minimal runner here* — rejected by `FR-DFR-002` and by the
plain text of `FR-DFR-062`. *Treat a human-entered "tests passed" as sufficient* — rejected by
`FR-DFR-063` and `BR-0144`; a declaration is what evidence exists to replace. *Read CI results
directly* — rejected as a bespoke per-tool path, which is what `EPIC-032`'s `AttestationSource`
(`FR-EVS-040`, `BR-0125`) already refuses on this programme's behalf.

**Docs consulted**: none needed — the finding is internal to this repository.

---

## R-035-2 — `GenerateTasksService` is a trap of the same family as `EPIC-034`'s, and is banned

**Decision**: repair work is created through a narrow `RepairTaskPort` whose only permitted backing
is `EPIC-012`'s `TaskStore.createMany` plus `EPIC-011`'s `LinkWriterService`. **`GenerateTasksService`
and `TaskRegenerationService` are both import-banned by architecture test.**

**Rationale**. `backend/src/modules/tasks/generate-tasks.service.ts` is named for `FR-DFR-050`
— "a confirmed defect MUST be convertible into traceable implementation tasks" — and does something
else. Read:

- it takes a `SpecificationEngine` and calls `engine.generateTasks({ specificationContent })`, so
  the tasks are derived from **specification text**, not from a defect and the test that proved it;
- it gates on `assertTaskGenerationPermitted(spec.lifecycleState)`, a lifecycle rule about
  generating a specification's task list, which is not the rule governing repair work;
- it stamps `engineName` and `engineVersion` **from the engine's own result descriptor**, so every
  row it writes claims an engine produced it.

Calling it would satisfy `FR-DFR-050`'s wording, produce a plausible list of tasks, and attribute
repair work to an engine that never saw the defect. `EPIC-034` found `TaskRegenerationService`
under exactly this description and banned it; the ban is inherited here and widened by one name.

**Alternatives considered**. *Call `generate()` and post-process* — rejected: the engine call is
non-deterministic and the provenance is written before this Room could correct it. *A Room-local
task model* — rejected by `FR-DFR-051` in terms.

**Docs consulted**: none needed.

---

## R-035-3 — `TaskRecord` has nowhere to put a defect, so the link lives on this Room's side

**Decision**: repair tasks are `EPIC-012` `TaskRecord` rows, unmodified. The link from task to
defect and to the failing test is a `RepairLink` row **owned by this Room**, and the traceability
chain is written through `EPIC-011`'s `LinkWriterService` — no second link store, the same move
`EPIC-034` made.

**Rationale**. `TaskRecord` is `{ id, workspaceId, specificationId, description, status, engineName,
engineVersion, createdAt, updatedAt }`. There is **no provenance field** — no defect reference, no
test reference, no origin. `BR-0151` provenance is `EPIC-012`'s and `U-12`'s, and `FR-DFR-002`
forbids implementing the task model here, so extending `TaskRecord` from this Epic is out.

**And `engineName`/`engineVersion` are not optional.** A repair task authored from a defect has no
engine. Whatever this Room writes into those two fields is a claim about provenance, and
`'defect-room'` in a column named `engineName` is a lie that `BR-0058`'s analytics would later read
as an engine.

**This is recorded as a handover, not solved here.** The port writes a documented sentinel, the
sentinel is asserted by test so it cannot drift into looking like a real engine name, and the
closing report states that **`TaskRecord` provenance for non-engine-authored tasks is `BR-0151`,
`U-12`, and unowned.** Inventing a provenance model here would cross `FR-DFR-002` in the same breath
as `R-035-2`.

**Alternatives considered**. *Add the columns* — that is `EPIC-012`'s model and `U-12`'s work.
*Encode the defect id in `description`* — rejected: a link that only a regular expression can follow
is not a link, and `FR-DFR-050` says "traceable".

**Docs consulted**: none needed.

---

## R-035-4 — The Requirement Gap destination does not know it is a destination

**Decision**: a `RequirementIntake` port, **refuse** when absent, and a **cross-Epic handover
recorded for `EPIC-033`** — it needs an inbound route for a routed Requirement Gap, and it does not
have one.

**Rationale**. This Epic's clarification of 2026-08-22 gave the third outcome a destination:
`FR-DFR-076` routes a Requirement Gap to the Requirement Room as new intent. Its Assumptions then
claim *"both outbound routes are specified from both ends."* **One is. The other is not.**

`EPIC-034` receives transfers explicitly: `FR-CHR-012`, a `TransferIntake` port, and
`POST /rooms/change/requests/:id/transfer-intake` in its contract.

`EPIC-033` has neither. Its contract's intake route is `POST /rooms/requirement/intake` serving
`FR-RQR-010`, which reads *"The system MUST generate targeted clarification questions from
submitted intent and from candidate requirements"* — question generation, not the reception of a
routed item carrying reproduction context and evidence. Searched for *"Requirement Gap"*,
*"defect room"* and *"EPIC-035"* across `EPIC-033`'s specification: the only hits are the
boundary clause `FR-RQR-003` (*"MUST NOT implement … the Defect Room"*) and the shared clarification
note.

The cause is ordinary and worth naming: `FR-DFR-076` was **added by a clarification after `EPIC-033`
was planned**. Its own note says *"the third outcome previously had no destination"* — it now has
one, and the destination has not been told. This is the identical shape to `EPIC-033`'s analysis
finding `C1`, where a shared artifact existed and nothing instructed the two consuming Rooms to use
it, and it is caught here at plan time rather than at analysis.

**Alternatives considered**. *Route gaps to the Change Room* — rejected by `FR-DFR-076` in terms,
and rightly: there is no approved baseline to change, and that absence is what makes it a gap.
*Create the requirement here* — rejected by `FR-DFR-002`; `U-01` is `EPIC-033`'s.

**Docs consulted**: none needed.

---

## R-035-5 — Three outcomes and three destinations, as a total function

**Decision**:

```ts
export const CLASSIFICATION_OUTCOMES = ['confirmed-defect', 'change-request', 'requirement-gap'] as const;
export type ClassificationOutcome = (typeof CLASSIFICATION_OUTCOMES)[number];

export const DESTINATIONS: Record<ClassificationOutcome, Destination> = { … };
```

**Rationale**. `FR-DFR-077` says an item *"MUST NOT be able to rest in a classified state with
nowhere to go."* A `Record` keyed by the outcome union makes that a **compile error** rather than a
runtime check: a fourth outcome without a destination does not typecheck, and a destination cannot be
omitted. This is `EPIC-034`'s eight-area `Record` applied to a smaller set for the same reason — an
absent row and a handled row must not look alike.

`ADR-0016` says *"Three outcomes, not two"*, and the specification's own exit criteria call two
outcomes *"the shape this Epic is most likely to ship by accident."* A tuple of three and a total
map is the cheapest way to make the accident impossible.

**Alternatives considered**. A `switch` with a `default` — rejected: `default` is where the third
outcome goes to die quietly. A nullable `destination` column alone — kept as the database belt
(`R-035-8`), but not as the only guard.

**Docs consulted**: none needed.

---

## R-035-6 — A passing reproduction test resolves to an evidence check, and `reclassify` has no default

**Decision**: `EvidenceCheckPath = 'refine-test' | 'investigate' | 'reclassify'`, **required, no
default**. The transition out of a passing reproduction run goes to the evidence check and
**nowhere else** — there is no edge from PASS to a classification.

**Rationale**. `ADR-0016` states the failure mode in the imperative: *"Do NOT blindly classify every
passing reproduction test as a Change Request"* — a test may pass because it was wrong, because the
environment differed, or because the defect is intermittent. `FR-DFR-044` and `SC-DFR-004` restate
it. The specification's exit criteria call this *"the easiest of the eight requirements to
'simplify' into a defect."*

So it is not left to a code path. The loop configuration has no PASS → classification transition to
take, the path taken is recorded (`US4` scenario 2), and `FR-DFR-031` keeps a single passing run
from closing or reclassifying an intermittent defect.

**Alternatives considered**. Defaulting to `investigate` — rejected: a default is a decision nobody
made, and the requirement is that a person chose which of the three happened.

**Docs consulted**: none needed.

---

## R-035-7 — Reproduction evidence and its access rules are one composition, not two mechanisms

**Decision**: reproduction evidence is stored through `EPIC-032` (`POST /evidence`). No Room-local
attachment path exists, and one is import-banned.

**Rationale**. `FR-DFR-032` requires the evidence store; `FR-DFR-033` requires evidence readable
only under the access rules of the artifact it concerns (`BR-0062`). Reading `EPIC-032`'s contract,
the second is already discharged by the first: its `AccessPolicy` port is filled by `EPIC-024` and
its absent behaviour is **refuse** — *"evidence must not read around artifact access
(`FR-EVS-015`)"*.

So this Room writes no access logic. That matters more here than in the other two Rooms, because
reproduction detail is the one place in the product where a user is actively encouraged to paste a
payload that reproduces a failure, and `PP-008` says so.

**Alternatives considered**. A Room-local attachment with an access check — rejected twice over: by
`FR-DFR-032`, and because a second access check is a second thing that can be wrong.

**Docs consulted**: none needed.

---

## R-035-8 — Two `CHECK` constraints, in hand-edited migration SQL, guarded by tests that watch for their removal

**Decision**: two database-level constraints —

1. a fix cannot be accepted for an automatable defect with no failing test on record
   (`FR-DFR-041`), and
2. a classification row cannot exist without a destination (`FR-DFR-077`)

— written as `ALTER TABLE … ADD CONSTRAINT … CHECK (…)` in hand-edited migration SQL, **each with an
integration test asserting it rejects.**

**Rationale**. Prisma Schema Language cannot express a `CHECK` constraint, so it belongs in edited
migration SQL — and the current documentation carries a warning worth acting on: a hand-added check
constraint is seen as **an extra** by destructive migration planning, which *"generates a drop
operation"* for it. `migrate diff` compares only Prisma-supported surface area.

That is a silent regression waiting: a later `migrate dev` on another Epic could drop the constraint
that keeps a fix from being accepted without a failing test, and nothing would say so. The test that
asserts the constraint **rejects** is what turns that into a red suite. `EPIC-034` took the same
shape for its human-decider constraint; the reason is recorded here because the hazard is now known
and shared.

**Alternatives considered**. Application-level validation only — rejected: it is the braces, and
`SC-DFR-001`'s mutation test exists precisely because a caller can bypass a service. Prisma-native
constraints — not available.

**Docs consulted**: Context7 `/prisma/prisma` — *CHECK constraints in migrations; PSL
representability*. Recorded so `/speckit-implement` can query the same source without re-resolving.

---

## R-035-9 — Performance targets

**Decision**: triage classification **p95 < 1.5 s** excluding model time; reproduction evidence
write **p95 < 800 ms** excluding the `EPIC-032` storage call; escape/origin aggregation over 5,000
closed defects **p95 < 2 s** without opening individual records (`SC-DFR-008`); Room load **p95 <
1.2 s** — deliberately the same figure `EPIC-033` set and `EPIC-034` adopted, because it is the same
shell; close-path evaluation **p95 < 300 ms** excluding the test run itself.

**Rationale**. `PP-018` is Partial and defers these to this plan. The close path is the one the
specification says is bounded by regression-suite runtime — which is `EPIC-015`'s, and per `R-035-1`
not callable, so **the figure excludes the run**. Quoting a close-path target that included a test
run would be quoting a number this Epic cannot influence.

**Docs consulted**: none needed.

---

## R-035-10 — Constitution XI: Tier 1 always, Tier 2 in full, and the keyboard journey inside it

**Decision**: Tier 1 is an integration test importing the real `AppModule` and driving the Room
through its real HTTP routes. Tier 2 applies in full — the report-to-closure journey against a
running application, with a **run-generated** transcript. `SC-DFR-009`'s keyboard-only journey is
exercised **inside** the Tier 2 run, not as a separate hand-checked pass.

**Rationale**. This Epic delivers a user-facing journey, so Tier 2 is not optional. `SC-DFR-009`
(`BR-0193`, `EPIC-029`) requires a person to carry a defect from report to closure using only a
keyboard with focus visible at every step — which is the same journey Tier 2 already runs. Running
it twice would produce two transcripts that could disagree; running it once with the keyboard
constraint applied produces one that cannot.

**Docs consulted**: none needed.

---

## R-035-11 — Three task-identifier bases for seven user stories, and what that forces

**Decision**: this Epic's task list is written on the corpus's **last three** free prefixes —
`T997`, `T998`, `T999` — giving **81 identifiers** (27 per prefix: the bare form plus `a`–`z`).
Recorded here because it is a **plan-level constraint on Phase 2**, not a detail of Phase 2.

**Rationale**. 996 of 999 prefixes are in use. `EPIC-033` used five bases for 100 tasks over six user
stories; `EPIC-034` used four for 99 over six, and had to put three phases on one base to fit. This
Epic has **seven** user stories and 46 requirements, and 81 identifiers for eleven phases.

**It fits only if the task list is written to fit.** The consequence is stated so `/speckit-tasks`
does not discover it: phases share bases, and where two tasks would otherwise be written for a test
and its implementation of the same small type, they stay two — **pairing is not what gets
compressed**, because `DOR-08` and Constitution V both read it. What compresses is the confirmation
tasks in Polish, which are checks rather than work.

`EPIC-032` raised the ceiling as a warning, `EPIC-033` as a blocker, `EPIC-034` as a blocker that
changed the document. **This is the Epic where it binds**, and `EPIC-034`'s handover already states
the two fixes `EPIC-026` must choose between: widen `T\d{3}[a-z]?` to four digits, or retire the
adjacency meaning of the suffix. Neither is this Epic's to make.

**Docs consulted**: none needed.

---

## R-035-12 — No new runtime dependency

**Decision**: none. NestJS `^10.4.15`, Prisma `^5`, React 18 and Vitest 2.1.8 are inherited, and
every load-bearing choice above concerns an existing in-repository service or an existing sibling
contract.

**Rationale**. The Room composes: `EPIC-030`'s loop, `EPIC-031`'s policy, `EPIC-032`'s evidence,
`EPIC-033`'s Room pattern and baselines, `EPIC-034`'s change intake, `EPIC-012`'s tasks,
`EPIC-011`'s links, `EPIC-028`'s agent gateway. The only genuinely external question was how to
express a database constraint Prisma's schema language cannot, and that is `R-035-8`.

**Docs consulted**: Context7 `/prisma/prisma` (see `R-035-8`). Context7 **was available** in this
session; no decision here is marked unverified against current docs.
