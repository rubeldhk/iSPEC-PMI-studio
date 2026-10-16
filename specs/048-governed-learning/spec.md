# Feature Specification: Governed Learning

**Feature Branch**: `epic/048-governed-learning`

**Epic**: `EPIC-048` — Governed Learning

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "EPIC-048 Governed Learning — rank 7 of `specs/brs-v2-gap-ranking.md`.
An agent observation enters as an untrusted Learning Candidate, never directly as trusted
organizational knowledge (`BR-0114`); a candidate retains its source, supporting evidence,
confidence and scope (`BR-0115`); policy may auto-approve explicitly low-risk categories, all other
learning requires authorized human review (`BR-0116`); approved knowledge retains history, scope
and supersession or deprecation status (`BR-0117`); approved knowledge is reused across projects
only according to tenant, classification and scope policy (`BR-0118`)."

> **Ownership.** PMI-DOC-004 v2.0 §6.12 marks `BR-0114`–`BR-0118` **no owner**, and the `EPIC-027`
> register (`specs/027-ai-native-amendment/register/capability-areas.md`) still reads Governed
> Learning as **UNOWNED** — the oldest open finding in the programme (Cosmos amendment,
> 2026-08-14; reconciliation `U-15`). `ADR-0021` is **Open**, awaiting exactly this Epic. This Epic
> owns all five requirements. The BRS owner annotations, the register row and `ADR-0021`'s status
> are updated when this Epic is accepted into the stage register, not before.
>
> **This Epic is declared from a PROPOSED ranking.** `specs/brs-v2-gap-ranking.md` ranks it 7th
> because a learning candidate needs evidence provenance (`EPIC-032`, rank 1), a decision path
> (`EPIC-031`, rank 2) and an actor that learns (`EPIC-047`, rank 5). All three, and `EPIC-038`
> (rank 4, the context that approved knowledge flows into), are open on sibling branches. This
> specification consumes their published contracts as they stand on those branches; it reinvents
> none of them.

## Clarifications

### Session 2026-10-09

- Q: Does this Epic add a memory-policy value to `EPIC-047`'s Expert contract, or leave
  `memoryPolicy` at `none` with learning independent of it? → A: **Add `governed-knowledge`.** An
  Expert whose approved contract declares it may submit Learning Candidates and receive approved
  knowledge through context; `none` may do neither. No private per-Expert memory. The amendment to
  `EPIC-047` `FR-EXP-020` and its database `CHECK` is a cross-Epic dependency, not made here
  (`FR-LRN-055`, `FR-LRN-056`).
- Q: Where do the candidate review queue and the knowledge browser live, given PMI-DOC-006 §4.1 has
  no learning area? → A: **Candidate review in `EPIC-031`'s Decision Inbox; the knowledge browser
  as a view in `EPIC-038`'s Context area.** No new navigation area; PMI-DOC-006 §9 is back-filled
  only (`FR-LRN-070`).
- Q: Does this Epic deliver reuse across workspaces (tenants), or only across projects within one
  workspace? → A: **Only across projects within one workspace.** Reuse across workspaces is
  **deferred** as `DEFER-048-01`; until then no entry crosses a workspace at all (`FR-LRN-043`).

## SRS Traceability *(mandatory — Constitution II)*

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.12 `BR-0114` — Learning candidate | FR-LRN-001 to FR-LRN-008 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.12 `BR-0115` — Evidence and provenance | FR-LRN-010 to FR-LRN-018 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.12 `BR-0116` — Learning decision | FR-LRN-020 to FR-LRN-030 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.12 `BR-0117` — Supersession | FR-LRN-031 to FR-LRN-039 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.12 `BR-0118` — Reuse | FR-LRN-040 to FR-LRN-047 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §7 `RULE-03`, `RULE-04`, `RULE-07`, `RULE-11` | FR-LRN-001, FR-LRN-020, FR-LRN-022, FR-LRN-027 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.10 `BR-0094`, `BR-0095` (consumed, not owned) | FR-LRN-050 to FR-LRN-054 |
| `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md` | §6.11 `BR-0102`, `BR-0104`; `BR-0173` (consumed, not owned) | FR-LRN-011, FR-LRN-018, FR-LRN-055, FR-LRN-056, FR-LRN-060 |
| `SRS/PMI-DOC-004A_V2_Gap_Analysis_and_Amendment_Package_v1.1.md` | `G-11`; §8 Amendment D — *candidate → evidence → confidence → policy/human decision → approved knowledge* | User Stories 1–4 |
| `SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` | §4.1 area map; `UX-0031`, `UX-0032`, `UX-0040`, `UX-0060` | FR-LRN-070 to FR-LRN-075 |
| `adr/ADR-0021-governed-learning.md` | Decision (Open) — the recorded flow, and *provenance, source, confidence, approval status and supersession history* | FR-LRN-001, FR-LRN-010, FR-LRN-031 |
| `adr/ADR-0025-risk-adaptive-policy-engine.md` | Three bands; classification is policy-declared, never model-inferred | FR-LRN-021, FR-LRN-023 |
| `.specify/memory/constitution.md` | XII — Execution Registration (rules 1, 2, 6, 7) | FR-LRN-005, FR-LRN-027, FR-LRN-060 to FR-LRN-063 |

**Requirements not yet covered by SRS**: the review and knowledge screens (`FR-LRN-070`–`075`).
PMI-DOC-006 §4.1 has **no area** for learning or knowledge — its eighteen areas predate this Epic.
The screens are placed inside existing areas *(clarified 2026-10-09)*: review in the Decision
Inbox (Overview group, `EPIC-031`), the knowledge browser in Context (Platform group, `EPIC-038`).
PMI-DOC-006 §9 needs a back-fill naming `EPIC-048` against those two areas (owner: Project Owner,
at this Epic's acceptance); §4.1 is unchanged.

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | Satisfied | This document precedes any learning implementation; nothing today feeds agent output back into knowledge (`ADR-0021` Consequences) |
| PP-002 | Single Source of Truth | Satisfied | `FR-LRN-012` — evidence is referenced in `EPIC-032`'s store, not copied; `FR-LRN-021` — the decision is `EPIC-031`'s record, not a second one |
| PP-003 | Human-in-the-Loop | Satisfied | `BR-0116` is owned here — `FR-LRN-020`–`FR-LRN-030`; no AI approves knowledge it proposed (`FR-LRN-027`) |
| PP-004 | End-to-End Traceability | Satisfied | `FR-LRN-010`, `FR-LRN-060` — every approved knowledge entry traces to a candidate, a registered execution, its evidence and its decision |
| PP-005 | Modular Architecture | Satisfied | Evidence, decisions, context, Experts and execution are ports owned elsewhere; this Epic owns the candidate, the knowledge entry and their lifecycle |
| PP-006 | Engine Independence | Satisfied | A candidate's source is a registered execution, whatever agent or provider ran it (`FR-LRN-005`) |
| PP-007 | API & MCP First | Satisfied | Every capability is callable without the screen; agents submit candidates through the same contract people use |
| PP-008 | Security by Design | Satisfied | `FR-LRN-001` — untrusted by default; `FR-LRN-040`–`FR-LRN-047` — reuse stays inside one workspace and never widens scope without a decision; `FR-LRN-016` — evidence access is never read around |
| PP-009 | Quality by Design | Satisfied | `SC-LRN-001` and `SC-LRN-003` are mutation-tested |
| PP-010 | Observability by Default | Partial | Submission, decision, supersession and reuse refusals are recorded events; learning-volume and approval-rate dashboards → `EPIC-040` |
| PP-011 | Documentation as Code | Satisfied | Knowledge entries and learning categories are versioned, reviewable records |
| PP-012 | Everything Versioned | Satisfied | `FR-LRN-031` — an approved entry is immutable; change is a superseding version |
| PP-013 | Knowledge-Driven Engineering | Satisfied | This Epic *is* `PP-013`'s write half; `EPIC-038` is its read half (`FR-LRN-050`) |
| PP-014 | Configuration over Customization | Satisfied | Learning categories, scopes and auto-approval eligibility are policy (`FR-LRN-023`) |
| PP-015 | Open Standards | Partial | Supporting evidence uses `EPIC-032`'s in-toto envelope; no external knowledge-representation standard is adopted |
| PP-016 | Explainable AI | Satisfied | `FR-LRN-024` — every decision, automatic or human, carries `EPIC-031`'s explanation; context items name the knowledge entry and version they came from (`FR-LRN-052`) |
| PP-017 | Cost-Aware AI | Not applicable | Learning adds no model calls of its own; candidate submission is bounded (`FR-LRN-007`) |
| PP-018 | Scalability First | Partial | Submission is rate-bounded per execution (`FR-LRN-007`); volume targets land in `plan.md` |
| PP-019 | Continuous Improvement (DORA/SPACE) | Deferred | Measuring whether approved knowledge improves outcomes → `EPIC-040` (Metrics & Reporting) |
| PP-020 | Customer Value | Satisfied | `SC-LRN-006` — a reviewer answers *"where did this come from, who approved it, and what does it replace?"* from the record alone |

**Deferral count**: 1 — `PP-019` → `EPIC-040`, restated in the closing report. Scope deferral
`DEFER-048-01` (reuse across workspaces) is recorded under Assumptions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - What an agent noticed is a candidate, not a fact (Priority: P1)

**`BR-0114`, `RULE-07`.** During a governed session an agent — typically an Engineering Expert —
observes something it believes is worth keeping: *"this repository's integration tests need the
local database started first"*. It submits that observation. The platform records it as a
**Learning Candidate**, untrusted, and nothing anywhere treats it as knowledge until it is decided.

**Why this is P1 and the MVP**: the prohibition is the valuable half (`ADR-0021`) and the only one
that cannot be walked back — once an assertion has been served to other sessions as fact, nobody
can say which later work relied on it. With only this story built, the platform can already
*collect* what agents learn while guaranteeing none of it is trusted.

**Independent test**: have an agent session submit an observation, then assemble context for a
later session on the same subject and confirm the observation does not appear as knowledge — and
that no route exists that writes approved knowledge without a recorded decision.

**Acceptance scenarios**

1. **Given** a registered agent execution, **When** it submits an observation, **Then** a Learning
   Candidate is recorded in state **proposed**, linked to that execution, and the submission is an
   event on the execution.
2. **Given** a proposed candidate, **When** context is assembled for any session, **Then** the
   candidate is not included as knowledge.
3. **Given** a submission that does not name a registered execution, **When** it is made, **Then**
   it is refused — an observation with no source session is not a candidate.
4. **Given** any caller, **When** it attempts to create or change approved knowledge directly,
   **Then** it is refused; the only way in is a candidate and a decision.
5. **Given** an agent session that ended, **When** a late submission arrives naming it, **Then** it
   is accepted only within the configured grace period, and recorded as submitted after the
   session's end.

### User Story 2 - A candidate carries where it came from and how sure it is (Priority: P1)

**`BR-0115`.** Every candidate records its source (the execution, the agent or Expert and the
contract version it ran under), the supporting evidence, a confidence with its basis, and the scope
it claims to hold for. A candidate missing any of them is refused.

**Why P1**: without provenance, *"the platform learned it"* is indistinguishable from *"an agent
asserted it once"* (`ADR-0021`). A reviewer cannot decide a candidate they cannot trace.

**Independent test**: submit a candidate with no evidence and confirm it is refused naming the
missing element; submit a complete one and reconstruct its source, evidence, confidence and scope
from the record alone.

**Acceptance scenarios**

1. **Given** a submission missing source, evidence, confidence or scope, **When** it is made,
   **Then** it is refused, naming every missing element.
2. **Given** a submission citing evidence, **When** it is recorded, **Then** each citation is a
   reference to evidence held in the Evidence Store — by identity and digest — never a pasted copy.
3. **Given** a candidate whose cited evidence later fails its integrity check, **When** the
   candidate is read, **Then** it shows that evidence as **integrity-failed** and the candidate is
   ineligible for automatic approval.
4. **Given** a reviewer without read access to an artifact a candidate's evidence attests,
   **When** they open the candidate, **Then** that evidence is withheld from them as absent, and the
   candidate shows that some evidence is not visible to them.
5. **Given** a candidate claiming a scope wider than the source execution's own project, **When**
   it is submitted, **Then** it is recorded with that **claimed** scope, which is a proposal for the
   decision — not a grant.

### User Story 3 - Knowledge is approved by policy or by a person, never by the agent that proposed it (Priority: P1)

**`BR-0116`, `RULE-03`, `RULE-04`.** A candidate becomes approved knowledge only through a decision
on `EPIC-031`'s decision path. Policy may auto-approve categories explicitly declared low-risk;
everything else waits in the Decision Inbox for an authorized human.

**Why P1**: this is the gate itself. Story 1 keeps candidates out of knowledge; this story is the
only way anything gets in, and it must be neither a rubber stamp nor a bottleneck on trivia.

**Independent test**: submit two candidates — one in a category policy declares low-risk, one
not. Confirm the first is approved automatically with an explanation and an audit record, and the
second waits for a human, and that the submitting agent cannot approve it.

**Acceptance scenarios**

1. **Given** a candidate in a category policy explicitly declares low-risk, at project scope, with
   no integrity-failed evidence, **When** it is decided, **Then** it is approved automatically,
   with the policy rule that permitted it recorded in the explanation and an audit record written.
2. **Given** a candidate in any category not explicitly declared low-risk — including one with no
   classification at all — **When** it is decided, **Then** it waits for authorized human review.
3. **Given** a pending candidate, **When** the agent or Expert that submitted it — or any AI actor
   — attempts to approve it, **Then** it is refused.
4. **Given** a human reviewer, **When** they reject a candidate, **Then** it is recorded as
   **rejected** with their reason and remains inspectable; it is never deleted.
5. **Given** a reviewer, **When** they approve a candidate, **Then** they may **narrow** its scope
   or edit its statement, and the approved entry records both what was proposed and what was
   approved.
6. **Given** an auto-approval rule, **When** a candidate claims a scope wider than one project,
   **Then** automatic approval does not apply; human review is required.

### User Story 4 - Approved knowledge keeps its history (Priority: P2)

**`BR-0117`.** Knowledge changes. A later observation can supersede an approved entry; an entry can
be deprecated when it stops being true. Neither erases the earlier entry: its history, scope and
status remain readable, and anyone relying on it can see that it was replaced and by what.

**Why P2**: P1 stories keep bad knowledge out; this one stops good knowledge going stale silently.
It depends on approved entries existing (Story 3).

**Independent test**: approve an entry, approve a superseding candidate, and confirm the original
reads **superseded**, names its successor, and that context assembled afterwards serves only the
successor.

**Acceptance scenarios**

1. **Given** an approved entry, **When** a candidate proposing to supersede it is approved,
   **Then** a new entry version is created, the earlier reads **superseded** naming its successor,
   and the earlier version is unchanged.
2. **Given** an approved entry, **When** an authorized person deprecates it, **Then** it reads
   **deprecated** with reason, actor and instant, and is no longer supplied as current knowledge.
3. **Given** a superseded or deprecated entry, **When** a context package that included it earlier
   is inspected, **Then** the package still shows the version as supplied, with a note that it has
   since been superseded or deprecated.
4. **Given** any entry, **When** its history is opened, **Then** every version, the candidate and
   decision behind each, and each status change are listed in order.
5. **Given** a superseding candidate, **When** it is decided, **Then** the decision always requires
   human review — supersession is never auto-approved.

### User Story 5 - Knowledge travels only as far as policy lets it (Priority: P2)

**`BR-0118`, `BR-0095`.** An entry approved in one project may be useful in others. It is reused
only where its approved scope, its security classification and the workspace's reuse policy all
permit it — and never into another workspace (tenant): reuse across workspaces is deferred
*(clarified 2026-10-09)*.

**Why P2**: reuse is the payoff of learning, and also its leak. It is P2 because a platform that
reuses nothing (Stories 1–4 alone) is safe; one that reuses carelessly is not.

**Independent test**: approve an entry at project scope and confirm it is absent from another
project's context; widen it to workspace scope through a decision and confirm it appears; confirm
it never appears in another workspace.

**Acceptance scenarios**

1. **Given** an entry approved at project scope, **When** context is assembled for another project
   in the same workspace, **Then** it is not included.
2. **Given** an entry approved at workspace scope with a classification the receiving project
   permits, **When** context is assembled there, **Then** it is included and marked with the entry,
   version and scope it came from.
3. **Given** an entry whose classification exceeds what the receiving project permits, **When**
   context is assembled there, **Then** it is excluded, and the exclusion names classification.
4. **Given** any entry, **When** context is assembled in another workspace, **Then** it is excluded
   — even where a reusable-knowledge authorisation exists for other sources — and the exclusion
   names the workspace boundary.
5. **Given** a request to widen an approved entry's scope, **When** it is made, **Then** it is a new
   decision requiring human review; scope is never widened by editing.

### User Story 6 - A reviewer can work the queue and read the knowledge base (Priority: P3)

A reviewer sees pending candidates with everything needed to decide them on one screen — statement,
source session, evidence, confidence, claimed scope, and any existing entry it would supersede or
duplicate. Anyone with read access can browse approved knowledge, its scope and history.

**Independent test**: open a pending candidate with evidence and a superseding target, decide it
without opening another screen, then find the resulting entry and read its history.

**Acceptance scenarios**

1. **Given** pending candidates, **When** the reviewer opens the queue, **Then** each shows its
   category, claimed scope, confidence and age.
2. **Given** a candidate that would supersede an entry, **When** it is opened, **Then** the current
   entry and the proposed statement are shown side by side.
3. **Given** approved knowledge, **When** it is browsed, **Then** current, superseded and
   deprecated entries are visually distinguishable, and filterable by project, scope, category and
   status.

### Edge Cases

- **The same observation is submitted many times** (by one session, or by several). A submission
  matching an open candidate's subject is attached to it as **corroboration** — another source and
  its evidence — not a second candidate. Corroboration is shown to the reviewer; it never by
  itself approves anything.
- **A candidate contradicts an approved entry without claiming to supersede it.** It is flagged as
  conflicting, names the entry, and requires human review whatever its category.
- **Approved knowledge contradicts an approved specification or steering rule.** Knowledge never
  overrides authoritative content: context marks knowledge as *approved knowledge*, distinct from
  the authoritative specification, and the conflict is reported to the reviewer.
  *Deferred in part (analysis finding `C1`): the distinction holds through `FR-LRN-052`; detecting
  the conflict and reporting it to the reviewer needs semantic comparison and is open as
  `DEF-048-001`, discharged by `T2420`–`T2421` once `EPIC-039`'s `Embed` capability is on `main`.*
- **A pending candidate is never decided.** After the configured review window it reads **expired**
  — not rejected, not approved — and drops out of the queue; it remains inspectable and can be
  resubmitted.
- **The source execution is later marked invalid or its work reverted.** Candidates from it are
  flagged for review; approved entries derived from it are flagged, not automatically deprecated.
- **A candidate's evidence is retired or becomes integrity-failed after approval.** The entry is
  flagged *evidence changed since approval*; deprecation is a human decision.
- **The decision path is unavailable.** Submission still records the candidate as **proposed**;
  nothing is approved — an unreachable decision engine is never an approval.
- **Approval succeeds but the entry cannot yet be indexed for retrieval** (e.g. `EPIC-038`'s
  embedding capability is unbound). The entry is approved and reads **not yet retrievable** with the
  reason; it is never reported as available to context when it is not.
- **An entry's project is archived.** Project-scoped entries become unavailable to context;
  wider-scoped entries are unaffected; history remains.
- **A candidate contains a secret.** Submission is screened with `EPIC-037`'s secret detection
  (`BR-0173`); a match is refused naming the rule — never stored and redacted later.

## Requirements *(mandatory)*

### Functional Requirements

**Learning candidate (`BR-0114`)**

- **FR-LRN-001**: Every agent observation intended to be kept MUST enter as a **Learning
  Candidate** in state **proposed**. No agent, Expert, connector or person MUST be able to create or
  change approved knowledge except by a decision on a candidate (`FR-LRN-021`).
- **FR-LRN-002**: A candidate MUST NOT be supplied to any session as knowledge, in any state other
  than approved.
- **FR-LRN-003**: A candidate MUST carry a statement, a category and a subject; the category MUST be
  one the workspace's learning policy defines.
- **FR-LRN-004**: A candidate's lifecycle states MUST be exactly **proposed**, **pending review**,
  **approved**, **rejected**, **expired** and **withdrawn**. No other state MUST lead to approved
  knowledge.
- **FR-LRN-005**: A candidate MUST name the registered execution (`EPIC-037`) it came from. A
  submission naming no registered execution MUST be refused. A submission arriving after that
  execution's terminal event MUST be accepted only within a configured grace period and recorded as
  late.
- **FR-LRN-006**: People MAY submit candidates through the same path, under the same rules; a
  person's candidate names the person as its source instead of an execution.
- **FR-LRN-007**: Submissions per execution MUST be bounded by configuration; a submission over the
  bound MUST be refused and recorded on the execution.
- **FR-LRN-008**: Candidates MUST be isolated by workspace; a candidate from one workspace MUST NOT
  be visible in another.

**Evidence and provenance (`BR-0115`)**

- **FR-LRN-010**: A candidate MUST retain its **source**, **supporting evidence**, **confidence**
  and **scope**. A submission missing any of them MUST be refused, naming every missing element.
- **FR-LRN-011**: Source MUST identify the execution and, where the submitter is an Engineering
  Expert, the Expert and the contract version it ran under (`EPIC-047`).
- **FR-LRN-012**: Supporting evidence MUST be at least one reference to evidence held in
  `EPIC-032`'s Evidence Store, by identity and digest. Evidence MUST NOT be copied into the
  candidate.
- **FR-LRN-013**: Confidence MUST be recorded as the submitter's stated level together with its
  basis. The platform MUST NOT raise a stated confidence, and confidence alone MUST NOT approve a
  candidate.
- **FR-LRN-014**: Scope MUST be one of **project**, **workspace**, or a named set of projects, and is
  recorded as **claimed** — a proposal for the decision, not a grant.
- **FR-LRN-015**: A candidate's cited evidence MUST be shown with its current state from the
  Evidence Store; evidence that is integrity-failed or unresolvable MUST make the candidate
  ineligible for automatic approval.
- **FR-LRN-016**: Evidence a reader may not see under `EPIC-024`'s access rules MUST be withheld as
  absent, and the candidate MUST show that evidence is withheld. This Epic MUST NOT read around
  artifact access.
- **FR-LRN-017**: A submission matching an open candidate's subject MUST be attached as
  **corroboration** — its source and evidence retained — rather than recorded as a second
  candidate.
- **FR-LRN-018**: Submissions MUST be screened for secrets with the same detection `EPIC-037` applies
  to execution events (`BR-0173`) before they are stored; a match MUST be refused naming the rule.

**Learning decision (`BR-0116`)**

- **FR-LRN-020**: A candidate MUST become approved knowledge only through a decision.
- **FR-LRN-021**: That decision MUST be requested through `EPIC-031`'s decision path, and recorded
  with `EPIC-031`'s decision-authority record. This Epic MUST NOT keep a second approval record.
- **FR-LRN-022**: Automatic approval MUST apply only to categories the workspace's policy
  **explicitly** declares low-risk, at project scope, with no integrity-failed or unresolvable
  evidence, and no conflict with an approved entry. Everything else MUST require authorized human
  review.
- **FR-LRN-023**: A candidate's risk band MUST be assigned by policy (`EPIC-031`, steering via
  `EPIC-019`), never by the submitting agent. An agent MAY propose a band; the proposal MUST be
  retained separately from the effective band.
- **FR-LRN-024**: Every decision — automatic or human — MUST carry `EPIC-031`'s explanation: policy
  version, matched rule, band and authority applied.
- **FR-LRN-025**: An automatically approved candidate MUST still produce an audit record and an
  approval attestation in the Evidence Store.
- **FR-LRN-026**: Out of the box, no category MUST be declared low-risk; a workspace opts categories
  in by policy.
- **FR-LRN-027**: An AI actor MUST NEVER approve a candidate — its own or another's (Constitution
  XII rule 6). Whether a person may approve a candidate they submitted MUST follow the workspace's
  separation-of-duties policy.
- **FR-LRN-028**: A reviewer MAY narrow a candidate's scope and edit its statement when approving;
  the approved entry MUST retain both the proposed and the approved form. A reviewer MUST NOT widen
  scope beyond what was claimed in the same decision.
- **FR-LRN-029**: A rejected candidate MUST be retained with its reviewer and reason; it MUST NOT be
  deleted.
- **FR-LRN-030**: A candidate not decided within the configured review window MUST read **expired**,
  distinct from rejected. When the decision path is unavailable, a candidate MUST remain proposed —
  never approved.

**Supersession (`BR-0117`)**

- **FR-LRN-031**: An approved knowledge entry version MUST be immutable. Change MUST be a new version
  created by an approved superseding candidate.
- **FR-LRN-032**: A superseded version MUST read **superseded** and name its successor.
- **FR-LRN-033**: An authorized person MUST be able to deprecate an entry, recording reason, actor
  and instant. A deprecated entry MUST NOT be supplied as current knowledge.
- **FR-LRN-034**: Supersession, deprecation and scope widening MUST each require human review; none
  MUST be automatically approved.
- **FR-LRN-035**: An entry's full history — every version, the candidate and decision behind each,
  each status change — MUST be retained and readable in order.
- **FR-LRN-036**: A candidate that contradicts an approved entry without proposing to supersede it
  MUST be flagged as conflicting, naming the entry, and MUST require human review.
- **FR-LRN-037**: When evidence behind an approved entry becomes integrity-failed, retired or
  unresolvable, or its source execution is marked invalid, the entry MUST be flagged for review. It
  MUST NOT be automatically deprecated.
- **FR-LRN-038**: An entry MUST carry its approved scope and classification on every version.
- **FR-LRN-039**: Approved knowledge MUST NOT be deleted. Retention follows the workspace's audit
  retention.

**Reuse (`BR-0118`)**

- **FR-LRN-040**: An entry MUST be supplied to a project only where its approved scope includes that
  project, its classification is permitted there, and the workspace's reuse policy allows it.
- **FR-LRN-041**: A project-scoped entry MUST NOT be supplied to any other project.
- **FR-LRN-042**: Widening an entry's scope MUST be a new decision requiring human review; scope MUST
  NOT be widened by editing.
- **FR-LRN-043**: An entry MUST NOT be supplied outside the workspace (tenant) it was approved in.
  Reuse is between projects of one workspace only *(clarified 2026-10-09)*. Knowledge entries MUST
  NOT be registered as reusable knowledge sources under `EPIC-038`'s authorisation
  (`FR-CTX-051`–`FR-CTX-054`) in this Epic; reuse across workspaces is deferred (`DEFER-048-01`).
  When it is delivered it MUST use that authorisation, adjudicated by `EPIC-024`, and MUST NOT
  introduce a second authorisation model.
- **FR-LRN-044**: An entry whose classification cannot be determined MUST be treated as not
  reusable outside its originating project.
- **FR-LRN-045**: Every reuse refusal at assembly MUST appear as an exclusion in the context
  package, naming scope, classification or boundary as the reason. A scope refusal is recorded with
  `EPIC-038`'s reason `boundary` and a detail beginning `scope:` — the record names scope without
  a new reason code *(reworded 2026-10-09, analysis finding `A1`; `R-048-11`)*.
- **FR-LRN-046**: When a project is archived, entries scoped only to it MUST stop being supplied;
  their history MUST remain.
- **FR-LRN-047**: The workspace's reuse policy MUST be configuration, versioned and recorded with
  actor and instant when changed.

**Consumption by context and Experts (`BR-0094`, `BR-0095`, `BR-0102` — consumed)**

- **FR-LRN-050**: Approved knowledge MUST reach sessions only through `EPIC-038`'s context assembly,
  as an approved source class. This Epic MUST NOT assemble context itself.
- **FR-LRN-051**: Approval, supersession, deprecation and scope change MUST each trigger the
  incremental re-index `EPIC-038` provides for the affected entry.
- **FR-LRN-052**: A context item drawn from knowledge MUST identify the entry, its version and its
  status (`BR-0094`), and MUST be distinguishable from authoritative specification content.
- **FR-LRN-053**: An entry approved but not yet retrievable MUST read **not yet retrievable** with
  the reason; it MUST NOT be reported as available to context.
- **FR-LRN-054**: Context packages already assembled MUST NOT be altered by later supersession or
  deprecation; inspection shows them as supplied (`FR-CTX-063`), with a drift note.
- **FR-LRN-055**: What an Engineering Expert may contribute to and draw from governed learning MUST
  be declared in its contract's memory policy (`EPIC-047` `FR-EXP-020`), which gains the value
  **`governed-knowledge`** *(clarified 2026-10-09)*. Only an Expert whose approved contract version
  declares it MAY submit candidates or receive approved knowledge through context; a submission
  from an Expert declaring `none` MUST be refused and recorded on its execution, and its context
  packages MUST contain no knowledge entries.
- **FR-LRN-056**: `governed-knowledge` MUST NOT confer any memory beyond governed learning: no
  per-Expert private store, and nothing retained across sessions except approved knowledge supplied
  through `EPIC-038`. Changing an Expert's memory policy MUST be a new contract version approved
  through `EPIC-047`'s existing path. This Epic depends on `EPIC-047` amending `FR-EXP-020` and its
  database `CHECK` to admit the value, and MUST NOT bypass that check.

**Execution record and audit (Constitution XII — consumed)**

- **FR-LRN-060**: Candidate submission, refusal and corroboration MUST be recorded as events on the
  source execution (`EPIC-037`), not in a separate log.
- **FR-LRN-061**: Agents and connectors MUST submit through the authenticated, versioned integration
  contract with idempotency and correlation controls; a retried submission MUST NOT create a second
  candidate.
- **FR-LRN-062**: Every decision, supersession, deprecation and scope change MUST be written to the
  immutable audit record (`EPIC-004`). A reuse-policy change MUST be recorded immutably with actor
  and instant; it is a new version of the `EPIC-019` steering document (`FR-LRN-047`), whose
  append-only history is that record *(narrowed 2026-10-09, analysis finding `I2`: `EPIC-019`'s
  steering edit writes no `EPIC-004` row, and this Epic does not perform the edit; raised to
  `EPIC-019` as a follow-up, `R-048-3`)*.
- **FR-LRN-063**: A provisional (offline) execution MAY submit candidates; they MUST remain
  **proposed** and ineligible for any decision until the execution is reconciled as governed.

**Screens** *(PMI-DOC-006 shell pattern; placement clarified 2026-10-09)*

- **FR-LRN-070**: Pending candidates MUST be reviewed in `EPIC-031`'s **Decision Inbox**, as decision
  items it lists and routes by role; approved knowledge MUST be browsed in a view within
  `EPIC-038`'s **Context** area. This Epic MUST NOT add a navigation area and MUST NOT declare a
  workflow beyond `EPIC-031`'s decision path. Both views MUST be reachable from primary navigation
  through those areas (`UX-0003`).
- **FR-LRN-071**: A candidate MUST show statement, category, source session, evidence with state,
  confidence and basis, claimed scope, corroborations, and any entry it supersedes or conflicts
  with — without opening another screen (`UX-0032`).
- **FR-LRN-072**: A superseding candidate MUST be shown side by side with the entry it replaces.
- **FR-LRN-073**: Approved knowledge MUST be browsable and filterable by project, scope, category and
  status, with each entry's history readable.
- **FR-LRN-074**: Current, superseded, deprecated and not-yet-retrievable entries, and agent-proposed
  versus approved content, MUST be visually distinguishable (`UX-0031`).
- **FR-LRN-075**: Statement, status, provenance and scope MUST remain readable at a 360px viewport
  (`UX-0040`).

### Key Entities

- **Learning Candidate** — an untrusted observation: statement, category, subject, source, evidence
  references, confidence and basis, claimed scope, proposed band, lifecycle state. Never knowledge.
- **Corroboration** — a further source and its evidence attached to an open candidate.
- **Learning Category** — workspace policy: a named kind of learning and whether it is explicitly
  low-risk (auto-approvable). Declared through steering; none is low-risk by default.
- **Knowledge Entry** — the stable identity of one piece of approved knowledge in a workspace.
- **Knowledge Entry Version** — an immutable approved statement with its approved scope,
  classification, the candidate and decision it came from, and its status: **current**,
  **superseded** (naming its successor) or **deprecated**.
- **Reuse Policy** — workspace configuration: which scopes and classifications may be supplied to
  which projects.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-LRN-001**: **Zero** approved knowledge entries exist without a candidate and a recorded
  decision — mutation-tested by adding a direct write path and observing the suite fail.
- **SC-LRN-002**: **100%** of candidates record source, evidence, confidence and scope; **zero**
  candidates are ever supplied to a session as knowledge.
- **SC-LRN-003**: **Zero** automatic approvals outside an explicitly low-risk category at project
  scope, and **zero** approvals by an AI actor — mutation-tested by removing the category check and
  observing the suite fail.
- **SC-LRN-004**: **100%** of approved entries have a reconstructable history; **zero** superseded or
  deprecated versions are supplied to new context as current.
- **SC-LRN-005**: **Zero** entries are supplied outside their approved scope or classification, and
  **zero** are supplied in any workspace other than the one they were approved in.
- **SC-LRN-006**: A reviewer can answer *"where did this come from, who approved it, and what does it
  replace?"* from the record alone, without asking the agent's operator.
- **SC-LRN-007**: A reviewer can decide a candidate from a single view in under 2 minutes for a
  candidate with up to five evidence items.
- **SC-LRN-008**: With no categories opted in, **100%** of candidates route to human review —
  learning is safe by default.
- **SC-LRN-009**: **Zero** candidates are accepted from, and **zero** knowledge entries supplied to,
  an Expert whose contract version declares memory policy `none`.

## Assumptions

1. **This Epic owns `BR-0114`–`BR-0118` outright.** No Epic has ever cited them; there is nothing to
   take over.
2. **Workspace is the tenant** (`BR-0001`). *Across projects* in `BR-0118` therefore means between
   projects of one workspace, which this Epic delivers in full. Crossing a workspace is deferred
   *(clarified 2026-10-09)*: the local-first focus (PMI-DOC-007) gives it no user yet, and
   `EPIC-038`'s reusable-knowledge authorisation is the mechanism it must use when delivered.
3. **The decision is `EPIC-031`'s.** A candidate decision is a `DecisionRequest` with an opaque
   target; the band comes from policy (`FR-DPE-003`); an unclassified category gets the most
   restrictive band (`FR-DPE-004`), which is why `FR-LRN-022` holds by construction. No workflow
   type is declared here. Supersession, deprecation and scope widening are human-reviewed by this
   Epic's own rule (`FR-LRN-034`) rather than by asking `EPIC-031` to add them to its
   non-configurable high band; that request is recorded as a follow-up.
4. **Evidence is `EPIC-032`'s.** Supporting evidence is referenced as typed attestations; the
   automatic approval itself is evidenced with the `approval/v1` predicate `EPIC-032` already
   defines. No new predicate type is introduced in this specification; if planning finds one is
   needed (e.g. an *observation* predicate), it is proposed to `EPIC-032`.
5. **Context is `EPIC-038`'s.** Approved knowledge is a source class to its assembly, re-indexed
   through its incremental re-index; isolation, classification and inspection are its rules.
6. **The source is `EPIC-037`'s execution**, whichever agent or provider ran it; an Expert source
   additionally names its `EPIC-047` contract version.
7. **Confidence is stated, not computed.** The platform records what the submitter claims and its
   basis; scoring confidence from evidence is deferred (no `BR-` requires it).
8. **Defaults**: grace period for late submissions 24 hours; review window 30 days before
   **expired**; submission bound 20 candidates per execution. All configuration.
9. **People may submit candidates** (`FR-LRN-006`) — one governed path is simpler and safer than a
   second, ungoverned one for human-authored knowledge.
10. **Deferred — `DEFER-048-01`, reuse across workspaces** *(clarified 2026-10-09)*. No owning Epic
    exists yet; it is restated in this Epic's closing report and recorded against Governed Learning
    in the `EPIC-027` register as the remainder of `BR-0118`. Discharge requires an Epic that
    registers knowledge entries as `EPIC-038` reusable knowledge sources.
11. **Who may do what** *(stated 2026-10-09, analysis finding `U1`)*. Every route is
    workspace-scoped through the session; a caller with no session is `401`, and another
    workspace's candidate or entry is `404`, never `403`. Within the workspace: **any member** may
    read a candidate (its evidence filtered per reader, `FR-LRN-016`), browse knowledge and read
    history, and submit a candidate as a person — including a `supersede`, `deprecate` or
    `widen-scope` candidate, because each still needs a human decision (`FR-LRN-034`). **Only the
    submitter** may withdraw. **Deciding** is `EPIC-031`'s authority, plus this Epic's rule that the
    decider is a human and none of the candidate's AI source identities (`FR-LRN-027`). Agents
    submit only through the connector route with scope `learning.submit`. No other permission is
    introduced.
12. **Out of scope**: automatic extraction of observations from transcripts (agents submit
    explicitly); confidence scoring; per-Expert private memory; knowledge export or a public
    knowledge marketplace (Expansion Plane); measuring the effect of knowledge on outcomes
    (`EPIC-040`).

**Dependencies**: `EPIC-031` (decision path and Decision Inbox — **open branch**), `EPIC-032`
(Evidence Store and attestations — **open branch**), `EPIC-038` (context assembly, source classes,
host of the knowledge view in its Context area — **open branch**), `EPIC-047` (Engineering Experts —
**open branch**; **cross-Epic amendment required**: `FR-EXP-020` and its database `CHECK` must admit
`memoryPolicy = governed-knowledge` before `FR-LRN-055` can be delivered), `EPIC-031` also hosts
the candidate review in its Decision Inbox, `EPIC-037` (execution registry), `EPIC-024` (access), `EPIC-019`
(steering for learning categories), `EPIC-004` (audit), `EPIC-036` (application shell).

**Prerequisites made by their owning Epics** *(back-filled 2026-10-09 from `plan.md` and
`contracts/learning-contract.md` §6; analysis finding `I3`)*:
- **`A-031-1`** (`EPIC-031`): `DecisionEngine.refuse` and `POST /decisions/:id/refuse`, and a Reject
  control in the Inbox. **Hard prerequisite, no workaround** — rejection, withdrawal and expiry
  (`FR-LRN-029`, `FR-LRN-030`) cannot be recorded without a second approval record, which
  `FR-LRN-021` forbids.
- **`A-031-2`** (`EPIC-031`): the Decision Inbox detail-renderer registry keyed by `objectRef.type`,
  into which this Epic registers the candidate view (`FR-LRN-070`, `FR-LRN-071`).
- **`A-038-1`** (`EPIC-038`): `FR-CTX-015` amended to admit `knowledge-entry` to the approved source
  set (`FR-LRN-050`).
- **`A-047-1`** and **`A-047-2`** (`EPIC-047`): `FR-EXP-020` and its `CHECK` admit
  `governed-knowledge`, and the Expert provenance read is exported (`FR-LRN-011`, `FR-LRN-055`).
  Hard prerequisite, no workaround.

**Follow-ups on acceptance** (not done by this specification): update the `EPIC-027` register row
for Governed Learning from `UNOWNED` to `EPIC-048` and run `pnpm register:build`; set the
PMI-DOC-004 §6.12 owner annotations; move `ADR-0021` from Open to Decided; back-fill PMI-DOC-006
§9 with `EPIC-048` against the Decision Inbox and Context areas; raise the `EPIC-047` amendment
admitting `governed-knowledge` (`FR-EXP-020`, its `CHECK`, and its quickstart case Q2, which today
expects any non-`none` value to be refused); record `DEFER-048-01` in the register; ask `EPIC-031` whether knowledge supersession belongs in
`FR-DPE-012`'s non-configurable high band.

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test — or, for document/configuration outputs,
      a passing executable conformance check (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/048-governed-learning/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next
      task named as a concrete Spec Kit command (Constitution IX)
- [ ] Constitution XI **Tier 1**: candidate submission, decision, supersession and reuse are each
      driven through their real entry point against the composed module graph; **Tier 2**: a
      run-generated transcript of the review screen deciding a candidate
- [ ] **`FR-LRN-001` is mutation-tested**: a direct knowledge write path is added and the suite
      observed failing (`SC-LRN-001`)
- [ ] **`FR-LRN-022` is mutation-tested**: the explicit-category check is removed and the suite
      observed failing (`SC-LRN-003`)
- [ ] The `EPIC-027` register, PMI-DOC-004 §6.12 owner annotations and `ADR-0021` name `EPIC-048`
- [ ] `EPIC-047`'s `FR-EXP-020` admits `governed-knowledge` (`A-047-1`). This is a hard
      prerequisite with no deferral: `FR-LRN-055`/`FR-LRN-056` may not be deferred to another Epic.
      *(Amended 2026-10-09: the Project Owner made the amendment a hard prerequisite, `R-048-10`;
      analysis finding `I4`.)*
- [ ] `DEFER-048-01` (reuse across workspaces) is restated in the closing report
