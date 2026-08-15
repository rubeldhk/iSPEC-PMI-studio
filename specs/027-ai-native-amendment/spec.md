# Feature Specification: AI-Native Amendment Reconciliation

**Feature Branch**: `027-ai-native-amendment`

**Epic**: `EPIC-027` — AI-Native Amendment Reconciliation *(process, not product)*

**Created**: 2026-08-13

**Status**: **Clarified** — 4 questions answered 2026-08-14; zero unresolved markers. Ready for
`/speckit-tasks`.

**Input**: **Five** documents — four added to `SRS/August112026/` on 2026-08-11/12/13, and
`SRS/AUg142026/PMI_Studio_Augment_Cosmos_Learnings_Amendment.docx` added 2026-08-14 — plus the project owner's
instruction to *"analyze and incorporate changes in specs… it will impact the whole project plan.
Think about starting over for scope creep. Incorporate changes in existing spec if appropriate."*

**Parent product spec**: none. **This epic produces no product capability.** It produces the
reconciliation the amendment itself demands (§17, §18) — the analysis that must precede new
implementation tasks. The same category as EPIC-018 and EPIC-026.

**Delivery posture**: ▶ **PROCEEDING.** Analysis of held work is not held work. This epic reads the
amendment and the existing corpus; it neither builds product surface nor waits on `PMI-DOC-004`.

## The "start over" question — answered by the source, not by preference

The project owner asked whether to start over. **The amendment answers it, and under Constitution II
the SRS wins.** Three passages, all mandatory in tone:

| Source | Ruling |
|---|---|
| Plan Amendment §Purpose | *"Do NOT redesign PMI Studio from scratch. Do NOT discard, replace, or regenerate existing approved requirements, modules, epics, architecture decisions… This amendment SHALL be applied incrementally."* |
| Plan Amendment §19 | *"This amendment is evolutionary, not a product reset."* |
| Native Spec-Kit §28 | *"This plan MUST NOT invalidate already implemented EPIC-001 functionality without explicit justification. Prefer additive evolution."* — then names sixteen existing elements to preserve, matching `ADR-0003` exactly |

Starting over would also discard **598 tracked tasks across 24 task lists**, five ADRs, a working engine
contract with two adapters, and the entire `_shared/` design — to rebuild toward an architecture the
amendment describes as an *extension* of that same design.

**The recommendation is therefore: do not start over.** The scope-creep concern is real and is
addressed differently — by this epic being **analysis-only** (`FR-AMD-016`), so that the amendment's
**twenty** new capability areas enter the plan as a sequenced, decided backlog rather than as an
undifferentiated expansion of current work.

## Purpose

Four documents arrived that together restate what PMI Studio *is*: an AI-native engineering
operating system that owns workflow, governance, context and evidence, and integrates commodity
execution. They introduce an Agent Gateway, an Integration Hub, a Context Engine, Evidence Packages,
and three governed "Rooms" — Requirement, Change and Defect.

The amendment does not ask for these to be built next. It asks, in §17, for something to happen
**before** new implementation tasks exist: map the amendment against what is already specified,
classify every clause, preserve existing identifiers, and separate immediate corrections from
near-term work from later capability.

That mapping is this epic. Its output is the twenty-five-part impact report §18 requires, a
clause-level classification register, the ADRs §27 names, the research questions §26 raises, and a
proposed implementation sequence — plus the list of decisions only a human may take.

**The reconciliation is worth doing carefully because the corpus is large and the amendment assumes
parts of it that do not exist.** Two findings, both verified against the repository, are recorded
here rather than discovered during planning:

### Finding A — three of the "existing" Rooms were never specified

The amendment says *"Maintain and enhance the existing Change Room"* and *"the existing Defect
Room"*. Searching all 26 epic specifications:

| Concept | Occurrences in `specs/*/spec.md` |
|---|---|
| "Change Room" / "Change Request Room" | **0** |
| "Defect Room" | **0** |
| "Requirement Room" | **0** |
| "Decision Room" | **0** |
| "change request" (any casing) | **0** |
| Agent Gateway · AI Gateway · Integration Hub · Context Engine · Evidence Package | **0 each** |

The word *defect* appears in all 26 specs, but always as the Constitution VI obligation that
`specs/<epic>/defects/` hold no open records — a **repository process convention**, not a product
Defect Room. The two are unrelated and easily conflated.

So the amendment's premise is partly false: these are **new capabilities**, not enhancements of
shipped ones. That is a §17.3 *Conflicting* finding, and how it is resolved changes the size of the
programme materially — "enhance" and "build" are different budgets.

### Finding B — EPIC-007 "Requirement Intelligence" is a name collision

`specs/007-requirement-intelligence/spec.md` states its own scope plainly: *"The requirement
register… Structured records with history and retirement, not a wall of prose. **AI-assisted analysis
(REG) is Phase 2 and out of scope.**"* It owns six CRUD requirements (`FR-004`–`FR-009`).

The amendment's Requirement Intelligence Engine — ambiguity detection, duplicate finding, option
generation, trade-off analysis, risk identification, acceptance-criteria generation, MoSCoW/WSJF
prioritisation, a twelve-state requirement machine, baselines and a Decision Room — is a different
and far larger capability that happens to share a name.

Left unreconciled, this produces the worst kind of drift: two teams believing one epic covers both.

## Clarifications

### Session 2026-08-14 — four answers, two of them programme decisions

- Q: Does every substantive clause get a register row (~340 at the time of asking; ~470 since the
  fifth document arrived), or does the register collapse to one
  row per distinct capability (~90–120)? → **A: every clause gets a row; duplicates cross-link.**
  A clause stating the same thing in another document carries its own row with a `duplicates` list,
  and both resolve to the same owner. **This is the only form in which `SC-AMD-001` is provable** —
  a collapsed register cannot show what it collapsed, so a clause nobody read is indistinguishable
  from one that is not there. Sizes F-27.1 at roughly 340 rows.
- Q: Are the twelve Native §27 ADRs created now as records, or when each decision is taken?
  (`D-35`) → **A: all twelve now**, each either decided or explicitly `open` naming what it awaits.
  **Seven can be marked decided immediately** from the 2026-08-13 session. Native §26 forbids
  answering by assumption, and an ADR that exists as an open question is what stops someone
  assuming the answer later.
- Q: Does self-hosted remain a supported deployment after `D-31`? (`D-40`) → **A: out of scope now,
  but keep the seams abstracted.** Do not build, test, or claim self-hosted; keep the credential
  broker and egress enforcement behind ports so it stays reachable. The ports cost almost nothing —
  EPIC-028 is building them anyway — and deciding "SaaS only, forever" is what lets real coupling in.
- Q: Which of the fourteen conformance checks block CI? → **A: two block, twelve report**, matching
  EPIC-018's precedent. The two that block are `G-27-09` (zero product code changed) and `G-27-14`
  (no epic's posture changed without a recorded reason) — exactly the two constraints the project
  owner named as the scope-creep concern. A reporting-only check on either leaves the boundary
  defended by good intentions.

### Still open after this session

Seven decisions remain, all in [`srs-alignment.md`](../srs-alignment.md) Part 8, and **none blocks
`/speckit-tasks`**: `D-23` (18-module re-cut), `D-24` (`pgvector`), `D-30` (AI Gateway native vs
integrated), `D-34` (the `PMI-DOC-004` hold), `D-36` (`ADR-0002` extended vs superseded — effectively
settled by `D-28`), `D-37` (Human/AI register in `_shared/`), `D-39` (branch-vs-epic check for
EPIC-018). Each carries a recommendation.

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/August112026/PMI Studio Plan Amendment.docx` (and the `.md` of the same content) | §Purpose, §19 — evolutionary, not a reset | FR-AMD-001, FR-AMD-016 |
| ″ | §2 — native / integrated / hybrid capability classification | FR-AMD-004 |
| ″ | §17 — plan reconciliation instructions, five classification buckets | FR-AMD-002, FR-AMD-003, FR-AMD-005 |
| ″ | §18 — the twenty-five-part amendment impact report | FR-AMD-008 to FR-AMD-011 |
| ″ | §3–§16 — capability areas: Integration Hub, AI Gateway, Context Engine, Knowledge Graph, Evidence, Human/AI responsibility | FR-AMD-006, FR-AMD-007 |
| `SRS/August112026/Recommended PMI Studio lifecycle.docx` | §1–§4 — Requirement Intelligence, requirement state machine, Decision Room, baselines | FR-AMD-006, FR-AMD-013 |
| ″ | §5–§8, §12 — Change Room, AI impact analysis, decision evidence, risk-adaptive approval | FR-AMD-006, FR-AMD-013 |
| ″ | §9–§11 — RBAC/ABAC, AI requirement-drift control, knowledge graph | FR-AMD-006, FR-AMD-014 |
| `SRS/August112026/Defect Management governed intelligence workflow.docx` | Whole document — Defect Room, defect/change/gap triage, TDD remediation queue | FR-AMD-006, FR-AMD-013 |
| `SRS/August112026/Native Spec-Kit Execution Environment & AI Agent Integration Architecture.docx` | §2–§7 — engine independence extended to agents; Agent Gateway; ProjectExecutionEnvironment | FR-AMD-006, FR-AMD-012 |
| ″ | §26 — research items `R-AI-001` to `R-AI-014` | FR-AMD-014 |
| ″ | §27 — the twelve required ADRs | FR-AMD-012 |
| ″ | §28 — compatibility constraint; sixteen named elements to preserve | FR-AMD-001, FR-AMD-015 |
| ″ | §22, §30 — source-of-truth boundaries; core architectural invariant | FR-AMD-007, FR-AMD-015 |
| `SRS/AUg142026/PMI_Studio_Augment_Cosmos_Learnings_Amendment.docx` | §1, §11, §13 — evolutionary refinement; preserve existing rooms, IDs and decisions | FR-AMD-001, FR-AMD-003 |
| ″ | §3.1 Governed Engineering Loops · §3.2 Context Engine as four capabilities · §3.3 Engineering Expert model | FR-AMD-004, FR-AMD-006 |
| ″ | §3.4 **Governed Learning** · §3.5 **Specification Compliance Agent** — the two genuinely new capability areas | FR-AMD-006, FR-AMD-012 |
| ″ | §5 Capability Resolver · §6 Workspace Fabric · §7 risk-adaptive human-in-the-loop | FR-AMD-004, FR-AMD-007 |
| ″ | §8 build-vs-integrate table · §9 reconciliation instructions · §10 the seventeen-part impact report | FR-AMD-002, FR-AMD-009, FR-AMD-010 |
| `.specify/memory/constitution.md` | Principle II — SRS wins where spec and SRS disagree; Principle III — Epic decomposition | FR-AMD-001, FR-AMD-005 |
| `specs/srs-alignment.md` | The existing conflict/decision register (`C-01`–`C-18`, `D-1`–`D-19`) this epic extends rather than replaces | FR-AMD-003, FR-AMD-013 |

**Requirements not yet covered by SRS**: none. Every requirement below derives from one of the four
amendment documents or from the constitution's reconciliation duty. This epic is unusual in the
corpus for being **fully SRS-traced** — it exists only because the SRS asked for it.

## Principle Conformance — deltas *(PMI-DOC-003, decision D-6)*

The platform-wide register is in [`_shared/platform-spec.md`](../_shared/platform-spec.md). This epic
records only where it differs.

| Principle | Status in this epic |
|---|---|
| PP-002 Single Source of Truth | ⚠️ **The central risk.** The amendment restates capabilities that exist under other names in the corpus. Every classification must resolve to *one* owning requirement — `FR-AMD-003` forbids creating a new identifier where an existing one applies |
| PP-006 Engine Independence | ✅ **Extended here.** The amendment generalises the engine-adapter rule to AI providers (Native §2). This epic records the extension; `ADR-0001` is preserved, not superseded |
| PP-013 Knowledge-Driven Engineering | 🔶 Materially advanced by the amendment's Context Engine and Knowledge Graph. This epic classifies them; it builds neither |
| PP-016 Explainable AI | ✅ **Strengthened.** Decision Evidence Packages and auditable AI reasoning give PP-016 a concrete mechanism it previously lacked |
| PP-003 Human-in-the-Loop | ✅ **Strengthened.** The amendment's Human Decision / AI Recommendation / AI Execution split (§12) makes PP-003 checkable rather than aspirational |
| PP-020 Customer Value | ✅ Sharpened — §1 names the target market explicitly for the first time, and §14 states what the product must *not* become |

No other principle's platform status changes. **No principle is weakened by the amendment.**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every amendment clause has a recorded verdict (Priority: P1)

Someone reading the amendment alongside the repository can see, for each clause, whether it is
already covered, needs enhancement, is missing, conflicts with what exists, or should become an
integration rather than a native build — with the existing requirement or epic named in each case.

**Why this priority**: §17 makes this the precondition for all new implementation tasks. Nothing else
in this epic is safe without it, and it is what prevents the amendment being implemented twice
alongside requirements that already cover it.

**Independent Test**: Pick ten clauses spanning all five documents and confirm each carries a verdict
and a named existing artifact or an explicit "no existing coverage".

**Acceptance Scenarios**:

1. **Given** an amendment clause, **When** the register is consulted, **Then** exactly one of the five
   verdicts applies to it and the reasoning is recorded.
2. **Given** a clause verdicted *Already covered*, **When** it is read, **Then** it names the existing
   requirement or epic that covers it, and no new identifier is created.
3. **Given** a clause verdicted *Missing*, **When** it is read, **Then** it names the epic that will
   own it — existing or proposed — rather than leaving it unassigned.
4. **Given** a clause verdicted *Conflicting*, **When** it is read, **Then** the conflict is stated as
   a decision for a human, not resolved silently in favour of either side.
5. **Given** the full register, **When** it is checked against the four source documents, **Then**
   every substantive clause appears; zero clauses are silently dropped.

---

### User Story 2 - The false premise about existing Rooms is settled before anyone plans against it (Priority: P1)

The Requirement, Change and Defect Rooms are recorded as **new capability**, not enhancement, with
the evidence, and the project owner confirms or corrects that reading before any epic is created for
them.

**Why this priority**: P1 because the amendment instructs *"maintain and enhance the existing Change
Room"*, and a planner who takes that at face value will size the work as a modification when it is a
build. Three Rooms mis-sized is a programme-level estimate error, and it compounds into every
downstream sequence.

**Independent Test**: Search the corpus for each Room concept and confirm the register records the
occurrence count and the resulting verdict.

**Acceptance Scenarios**:

1. **Given** the amendment refers to an "existing" capability, **When** the corpus is searched,
   **Then** the search result is recorded as evidence — count and locations — rather than asserted.
2. **Given** a capability the amendment calls existing but the corpus does not contain, **When** it is
   classified, **Then** it is recorded as *Conflicting* and raised as an open decision.
3. **Given** a repository convention that shares a name with a product capability — `defects/` and
   the Defect Room — **When** either is referenced, **Then** the two are distinguished explicitly.
4. **Given** the EPIC-007 name collision, **When** it is recorded, **Then** both the existing scope
   and the amendment's scope are stated, and the resolution is a named decision.

---

### User Story 3 - Every capability is classified as native, integrated, or hybrid (Priority: P1)

Each capability in the corpus and in the amendment carries an ownership verdict — PMI Studio builds
it, integrates it, or owns the workflow while an external system executes — with the reason.

**Why this priority**: P1 because §2 makes this the amendment's central decision principle, and it is
the mechanism that keeps scope finite. Without it, "AI-native engineering operating system" reads as
a mandate to build everything.

**Independent Test**: Take five capabilities — source control, CI/CD, AI coding engines, requirement
approval, traceability — and confirm each has a verdict consistent with §2's test.

**Acceptance Scenarios**:

1. **Given** a capability, **When** it is classified, **Then** it is native, integrated, or hybrid,
   and the reason references whether PMI Studio must control it to maintain its end-to-end workflow.
2. **Given** an existing specified capability that an external product also provides, **When** it is
   classified, **Then** it is not removed solely for that reason (§2).
3. **Given** a capability classified as *integrated*, **When** it is recorded, **Then** the
   abstraction boundary is named, so no provider-specific logic is implied in core workflow.
4. **Given** any existing requirement that should become an integration rather than a native build,
   **When** the report is produced, **Then** it appears in the dedicated §18.9 list.

---

### User Story 4 - The impact report exists in the form the amendment specified (Priority: P1)

The twenty-five-part amendment impact report required by §18 is produced, ending with a proposed
updated implementation sequence.

**Why this priority**: P1 because it is the amendment's single named deliverable. Everything else
this epic produces is an input to it.

**Independent Test**: Check the report against §18's twenty-five numbered items and confirm each is
present and substantive.

**Acceptance Scenarios**:

1. **Given** the report, **When** it is checked against §18, **Then** all twenty-five sections are
   present; zero are placeholders.
2. **Given** the report, **When** its final section is read, **Then** it proposes an updated
   implementation sequence separating immediate architectural corrections, near-term implementation,
   and later platform capability (§17.11).
3. **Given** a section with nothing to report, **When** it is written, **Then** it states that
   explicitly with the reason, rather than being omitted.

---

### User Story 5 - Architectural decisions and open research are registered, not answered prematurely (Priority: P2)

The twelve ADRs §27 requires are created as records — including those whose decision is still open —
and the fourteen `R-AI-` research questions §26 raises are registered with owners.

**Why this priority**: P2 because it follows the classification rather than gating it. But it is what
stops the amendment's unresolved questions from being answered by assumption during planning, which
§26 forbids: *"Do not make unsupported assumptions where research is required."*

**Independent Test**: Confirm each of the twelve ADR subjects and fourteen research items has a
record, and that open ones are marked open rather than filled with a guess.

**Acceptance Scenarios**:

1. **Given** an ADR subject named by §27, **When** the ADR set is checked, **Then** a record exists,
   either deciding or explicitly recording the decision as open with what it awaits.
2. **Given** an existing ADR the amendment touches, **When** it is revisited, **Then** it is preserved
   and extended, or superseded with documented reasoning — never silently replaced (§27).
3. **Given** a research question from §26, **When** it is registered, **Then** it names what cannot be
   decided until it is answered.
4. **Given** a decision that only a human may take, **When** the report is produced, **Then** it
   appears in the open-decisions list with the options and the consequence of each.

---

### User Story 6 - Current work is not disturbed without cause (Priority: P2)

Work already in flight continues unless the amendment creates a genuine conflict with it, and every
disturbance is justified in writing.

**Why this priority**: P2 because it is a constraint on the other stories rather than a deliverable.
It matters because §17.10 says plainly *"Do not stop currently valid implementation work
unnecessarily"* and §28 requires justification for any change to the sixteen preserved elements.

**Independent Test**: List every epic whose status this epic changes and confirm each carries a
recorded reason referencing an amendment clause.

**Acceptance Scenarios**:

1. **Given** an epic in flight, **When** the reconciliation completes, **Then** its status is
   unchanged unless a named amendment clause conflicts with it.
2. **Given** one of the sixteen elements §28 preserves, **When** a change to it is proposed, **Then**
   the reason, affected requirement, migration impact, compatibility impact and rejected alternative
   are all recorded.
3. **Given** an approved decision in `srs-alignment.md`, **When** the amendment touches it, **Then**
   it is reopened only on genuine architectural conflict (§17.9), and the conflict is stated.
4. **Given** EPIC-026, mid-flight and unrelated to the amendment, **When** the reconciliation
   completes, **Then** it is unaffected.

### Edge Cases

- **The amendment asserts a capability exists and it does not** — Finding A. Recorded as
  *Conflicting* with the search evidence, and raised as an open decision. Not silently reinterpreted
  as either "enhance" or "build".
- **Two names, one concept** — the amendment's Requirement Intelligence Engine and EPIC-007. Both
  scopes are stated and the resolution is a named decision, not a merge by assumption.
- **One name, two concepts** — the product Defect Room and the Constitution VI `defects/` folder.
  Distinguished explicitly wherever either appears.
- **A clause is aspirational rather than specifiable** — "users SHOULD experience PMI Studio as a
  coherent engineering environment" (§13). Recorded as a design principle, not converted into a
  functional requirement it cannot support.
- **A clause conflicts with an approved decision** — reopening requires genuine architectural
  conflict (§17.9). A clause that merely differs in emphasis does not reopen `D-1` to `D-19`.
- **The amendment would unblock or re-block held epics** — nineteen epics are held pending
  `PMI-DOC-004`. The amendment is not the BRS and does not release them; any change to a hold is a
  decision, recorded.
- **A capability is both native and integrated** — that is the *hybrid* class (§2C), not an
  unresolved classification.
- **Research is required before a decision can be made** — the decision is recorded as open and
  blocked on the named `R-AI-` item, never filled with a plausible guess (§26).
- **The reconciliation itself grows into implementation** — the failure mode the project owner named.
  `FR-AMD-016` bounds this epic to analysis; every build lands in an epic this one names.
- **Two amendment documents disagree** — for example the lifecycle document's optimism about
  transferring a passing defect test to the Change Room, tightened by the Defect document §7 and
  Native §17. The later and more specific text governs, and the reconciliation records which.

## Requirements *(mandatory)*

> **Identifier scheme**: `FR-AMD-###` / `SC-AMD-###`. Namespaced per conflict **C-01**, and to keep
> reconciliation requirements visibly distinct from product requirements.

### Functional Requirements

#### Reconciliation method

- **FR-AMD-001**: Reconciliation MUST be **additive**. No existing approved requirement, module,
  epic, architecture decision or implementation may be discarded, replaced or regenerated except
  where the amendment creates a genuine conflict, and every such case MUST record the conflict.
- **FR-AMD-002**: Every substantive clause across all four amendment documents MUST receive exactly
  one verdict: **Already covered**, **Covered but requires enhancement**, **Missing**, **Conflicting**,
  or **Should become integration rather than native implementation**.
- **FR-AMD-003**: Existing requirement identifiers and traceability MUST be preserved. A new
  identifier MUST NOT be created where an existing requirement covers the clause; where a new one is
  genuinely necessary, the necessity MUST be stated.
- **FR-AMD-004**: Every capability — existing and introduced — MUST be classified as **native**,
  **integrated**, or **hybrid**, with the reason referencing whether PMI Studio must control it to
  maintain its end-to-end engineering workflow. Existing functionality MUST NOT be removed solely
  because an external product provides something similar.
- **FR-AMD-005**: Every clause verdict MUST name the affected epic, module and requirement, or state
  explicitly that no existing coverage was found.

#### Evidence and conflicts

- **FR-AMD-006**: Where the amendment refers to a capability as *existing*, the reconciliation MUST
  verify that claim against the corpus and record the evidence — occurrence count and locations —
  rather than accepting or rejecting the premise by assertion.
- **FR-AMD-007**: A product capability and a repository convention sharing a name MUST be
  distinguished explicitly wherever either is referenced. This applies at minimum to the product
  **Defect Room** and the Constitution VI **`defects/`** folder.
- **FR-AMD-008**: Every conflict — including a false premise, a name collision, and a disagreement
  between two amendment documents — MUST be raised as a decision for a human, with options and the
  consequence of each. It MUST NOT be resolved silently in favour of either side.

#### The impact report

- **FR-AMD-009**: The reconciliation MUST produce the amendment impact report specified in Plan
  Amendment §18, containing all twenty-five named sections. A section with nothing to report MUST say
  so with the reason rather than be omitted.
- **FR-AMD-010**: The report MUST identify every existing requirement that should change from native
  implementation to integration (§18.9).
- **FR-AMD-011**: The report MUST end with a proposed updated implementation sequence, separating
  **immediate architectural corrections**, **near-term implementation**, and **later platform
  capability** (§17.11).
- **FR-AMD-012**: The report MUST identify affected epics, modules and tasks, and MUST state for each
  new capability area whether it belongs in an existing epic, requires a new epic, is architectural
  preparation only, or remains deferred (Native §29).

#### Decisions and research

- **FR-AMD-013**: The reconciliation MUST create or update the architecture decision records named by
  Native Spec-Kit §27. An ADR whose decision is not yet takeable MUST be recorded as **open**, naming
  what it awaits. Existing ADRs MUST be preserved unless explicitly superseded with documented
  reasoning.
- **FR-AMD-014**: Every research question `R-AI-001` to `R-AI-014` (Native §26) MUST be registered
  with what it blocks and who owns it. A decision dependent on an unanswered research item MUST be
  recorded as blocked, never resolved by assumption.
- **FR-AMD-015**: Every proposed change to one of the sixteen elements Native §28 preserves MUST
  record the reason, the affected existing requirement or decision, the migration impact, the
  compatibility impact, and the alternative considered.

#### Scope discipline

- **FR-AMD-016**: This epic MUST be **analysis only**. It MUST NOT implement product capability,
  rewrite existing specifications in place, or generate implementation tasks for the capabilities it
  classifies. Every build it identifies MUST land in a named existing or proposed epic.
- **FR-AMD-017**: Work already in flight MUST continue unless a named amendment clause conflicts with
  it. Every epic whose status this reconciliation changes MUST carry a recorded reason citing the
  clause responsible.
- **FR-AMD-018**: An approved decision in `specs/srs-alignment.md` MUST be reopened only where the
  amendment creates a genuine architectural conflict, and the conflict MUST be stated. A difference in
  emphasis is not a conflict.

### Key Entities

- **Amendment Clause**: One substantive statement from one of the five documents. Attributes: source
  document, section, text, whether normative (SHALL/MUST) or advisory (SHOULD/MAY).
- **Clause Verdict**: The classification of one clause. Attributes: clause, one of the five verdicts,
  named existing requirement or epic, reasoning, resulting action.
- **Capability Classification**: Ownership of one capability. Attributes: capability, native /
  integrated / hybrid, reason, abstraction boundary where integrated.
- **Premise Check**: Verification of an "existing capability" claim. Attributes: claimed capability,
  search performed, occurrence count, locations, verdict.
- **Impact Report**: The §18 deliverable. Attributes: twenty-five sections, proposed sequence.
- **Open Decision**: A choice reserved for a human. Attributes: question, options, consequence of
  each, blocking research item, decision owner, status.
- **Research Item**: One `R-AI-###` question. Attributes: identifier, question, what it blocks, owner,
  status.
- **ADR Record**: One decision record from §27. Attributes: subject, status (decided or open), what it
  awaits, superseded ADR where applicable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-AMD-001**: 100% of substantive amendment clauses carry exactly one verdict; zero clauses are
  unclassified and zero carry two.
- **SC-AMD-002**: Every verdict names an existing requirement or epic, or states explicitly that no
  coverage was found; zero verdicts are unattributed.
- **SC-AMD-003**: Zero new requirement identifiers are created where an existing requirement covers
  the clause, and every genuinely new identifier records why it was necessary.
- **SC-AMD-004**: Every capability carries a native / integrated / hybrid verdict; zero are
  unclassified, and zero existing capabilities are removed solely because an external product
  provides something similar.
- **SC-AMD-005**: Every "existing capability" claim in the amendment is verified against the corpus,
  with the evidence recorded; zero are accepted or rejected by assertion.
- **SC-AMD-006**: The impact report contains all twenty-five §18 sections with zero placeholders, and
  ends with a sequence separating immediate, near-term and later work.
- **SC-AMD-007**: All twelve §27 ADR subjects have a record; every open one names what it awaits;
  zero existing ADRs are silently replaced.
- **SC-AMD-008**: All fourteen `R-AI-` research items are registered with what they block; zero
  decisions dependent on an unanswered item are recorded as resolved.
- **SC-AMD-009**: Zero product capability is implemented by this epic, and every build it identifies
  names its owning epic.
- **SC-AMD-010**: Zero epics in flight change status without a recorded reason citing a specific
  amendment clause.
- **SC-AMD-011**: A reader can determine, for any of the **seventeen** capability areas the amendment
  introduces, whether it is new, an enhancement, or already covered — and which epic owns it — from a
  single document. The twenty are enumerated in the plan's capability-area table; the count is
  asserted by `G-27-13`, so the criterion and the table cannot drift apart again.
- **SC-AMD-012**: Every conflict is presented as a decision with options; zero conflicts are resolved
  silently in the reconciliation itself.

## Assumptions

- **This is a reconciliation epic, not a product epic** (`FR-AMD-016`). It produces analysis,
  decisions and a sequence. It builds nothing. This is the direct answer to the project owner's
  scope-creep concern: the amendments' twenty new capability areas enter the programme as a
  decided, sequenced backlog rather than as an undifferentiated expansion of work already under way.
- **Starting over is rejected on the authority of the SRS**, not on preference — Plan Amendment
  §Purpose and §19, and Native §28. Constitution II makes the SRS binding where it and a spec
  disagree. Recorded above rather than assumed.
- **The amendment does not release the `PMI-DOC-004` hold.** Nineteen epics are held pending the
  Business Requirement Specification (decision D-10). The amendment is an architecture and positioning
  document, not the BRS, so the hold stands. Any change to it is an open decision.
- **The three Rooms are treated as new capability** pending the project owner's confirmation, because
  the corpus contains no trace of them (Finding A). The alternative reading — that they exist outside
  `specs/` — was checked and not supported.
- **EPIC-007 keeps its identifier and its current scope.** The amendment's Requirement Intelligence
  Engine is recorded as a distinct, larger capability whose ownership is an open decision. Renaming or
  re-scoping an epic mid-programme is itself a decision, not a tidy-up.
- **Existing ADRs are extended, not superseded.** `ADR-0001` (Spec Kit behind an engine adapter) and
  `ADR-0002` (container sandbox) are the exact seams the amendment builds on; the Agent Gateway
  generalises `ADR-0001`'s rule to AI providers rather than replacing it.
- **`ADR-0003`'s stack is preserved.** Native §28's sixteen named elements match it — React, NestJS,
  TypeScript, PostgreSQL, Prisma, BullMQ, Redis/Valkey, the SpecificationEngine contract, adapters,
  the worker composition root, Docker isolation, workspace identity, append-only audit, traceability,
  architecture tests, OpenTelemetry.
- **Advisory clauses are recorded as principles, not requirements.** The documents mix SHALL with
  SHOULD and with narrative recommendation; converting an aspiration into a functional requirement
  produces an untestable requirement, which the quality gate would reject anyway.
- **The five documents are read as one amendment.** They overlap substantially — the Rooms appear in
  four of them, and the Cosmos amendment (2026-08-14) is explicitly a *refinement* of the August-11
  set rather than a competing direction (§1, §11). Where they differ in detail, the more specific and later text governs, and the
  reconciliation records which was used.
- **The two `~$` files in `SRS/August112026/` are editor lock files**, not source documents, and the
  `.docx` and `.md` copies of the Plan Amendment carry identical content — verified.

## Dependencies

- **None blocking.** This epic reads documents that already exist and a corpus already committed.
- **Depended on by**: every implementation epic the amendment implies. §17 makes this reconciliation
  the precondition for creating new implementation tasks, so no epic for the Agent Gateway,
  Integration Hub, Context Engine, Evidence Packages or the three Rooms should be specified until this
  one reports.
- **Advisory — EPIC-026** is mid-flight (specified, clarified, planned, tasked) and unrelated to the
  amendment. It continues unaffected (`FR-AMD-017`).
- **Advisory — decision D-13** (the deferred 18-module re-cut) touches how new capability areas would
  be assigned to modules. This epic must record the dependency rather than resolve it.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every artifact task has a **passing executable conformance check** — which satisfies
      Constitution V for documentation outputs (constitution v1.2.0). Manual review does not count
- [ ] 100% of substantive amendment clauses carry exactly one verdict (`SC-AMD-001`)
- [ ] Every capability carries a native / integrated / hybrid classification (`SC-AMD-004`)
- [ ] The §18 impact report is complete with all twenty-five sections (`SC-AMD-006`)
- [ ] All twelve §27 ADR subjects and all fourteen `R-AI-` research items are registered
      (`SC-AMD-007`, `SC-AMD-008`)
- [ ] Zero product capability was implemented by this epic (`SC-AMD-009`)
- [ ] Every open decision is presented with options and a named decision owner (`SC-AMD-012`)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/027-ai-native-amendment/defects/` contains no open defect records
- [ ] A closing report was published: work completed, work deferred, and the recommended next task
      named as a concrete Spec Kit command (Constitution IX)
- [ ] Epic closure recorded in `closure.md`
