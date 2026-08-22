# BRS v2.0 Reconciliation — Wave 0

**Date**: 2026-08-21 · **Scope**: repository-wide · **Status**: **Wave 0 complete** — decisions 1–5
signed 2026-08-22; Epic declarations pending
**Actions**: PMI-DOC-004A §13 Wave 0 — *"approve BRS v2 target scope; retain currently released
Epics and identifiers; map new BRs to existing modules/Epics where possible; create new Epics only
where no owner exists."*

Companion to [`srs-alignment.md`](./srs-alignment.md), which records the PMI-DOC-000 conflicts
(`C-01`, `C-02`) that remain open and are **not** resolved here.

Constitution Principle II applies throughout: *"Where a spec and the SRS disagree, the SRS wins and
the spec MUST be corrected."*

---

## 1. What Wave 0 was required to do, and what it did

| Wave 0 instruction | Outcome |
|---|---|
| Approve BRS v2 target scope | [PMI-DOC-004 v2.0](../SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md) **APPROVED 2026-08-22** — decisions 1–5 signed as proposed |
| Retain currently released Epics and identifiers | **Zero Epic directories changed. Zero `BR-` citations changed.** See §2 |
| Map new BRs to existing modules/Epics where possible | 52 of 123 requirements mapped to declared Epics. See §3 |
| Create new Epics only where no owner exists | **No Epics created.** 71 unowned requirements recorded as gaps against the `EPIC-027` capability-area register. See §4 |

**No epic's delivery posture changed.** `governance/epic-stage-register.md` is untouched, and
`epic-declarations.json` is untouched. This mirrors `FR-AMD-017` / `G-27-14`, the assertion
`EPIC-027` used to prove its own reconciliation changed no posture — the same discipline applies
here and for the same reason.

---

## 2. The identifier decision — R-01

**The single most consequential finding of this reconciliation.**

The v2.0 draft circulated in the review package reused **ten** approved v1.0 `BR-` identifiers with
different meanings:

| Identifier | v1.0 meaning (approved, cited) | Circulated draft meaning |
|---|---|---|
| `BR-0040` | Trace chain → `EPIC-011` | Change intake |
| `BR-0041` | Product structure → `EPIC-022` | Change clarification |
| `BR-0050` | Task decomposition → `EPIC-012` | Defect intake |
| `BR-0060` | Review gates → `EPIC-021` | Governed Engineering Loop |
| `BR-0061` | Unattended agents → `EPIC-023` | Explicit workflow states |
| `BR-0062` | Artifact access snapshot → `EPIC-024` | Risk classification |
| `BR-0063` | External publishing → `EPIC-025` | Risk-adaptive approval |
| `BR-0080` | QA validation → `EPIC-015` | Trace chain |
| `BR-0090` | Environment promotion → `EPIC-014` | Semantic retrieval |
| `BR-0100` | ADRs → `EPIC-016` | Expert registry |

**Why this mattered.** PMI-DOC-000 §3 makes `BR-xxxx` identifiers corpus-wide — as
`srs-alignment.md` §C-01 puts it, *"identifiers are corpus-wide, so `FR-0012` must mean exactly one
thing."* At the time of the finding, **50 citations of 21 distinct `BR-` identifiers** existed
across `specs/`, `governance/`, `adr/` and `docs/`. Ten of those identifiers were about to change
meaning underneath the documents citing them, with no diff in those documents to show it. This is
the failure mode `DS-2` guards against for task identifiers, applied to requirements.

**Ruling R-01 (Project Owner, 2026-08-21): preserve v1.0 identifier meanings.** Where v2.0 keeps a
v1.0 concept, it keeps the v1.0 identifier; every genuinely new requirement takes a free identifier.

**Consequences.**

- *Positive* — no file in `specs/`, `governance/`, `adr/` or `docs/` needs to change. The 19 Epic
  SRS Traceability tables that cite `BR-` identifiers remain correct as written. Verified: see §6.
- *Positive* — v2.0 `RULE-16` now states the invariant explicitly, so the next revision cannot
  repeat this by accident.
- *Negative* — §6 of v2.0 is not strictly section-aligned in its numbering. `BR-0041` sits in the
  project-structure section, `BR-0100` in the architecture section, `BR-0040` in the traceability
  section. The crosswalk in v2.0 §14 exists to make this navigable, and seven draft identifiers
  (`BR-0011`, `0130`, `0145`, `0150`, `0160`, `0170`, `0172`) are reserved unused so they can never
  be reassigned to a different meaning later.

**Rejected alternatives.** Adopting the draft numbering and rewriting ~18 citations was rejected
because it changes what published identifiers mean rather than what they point to — a reviewer who
approved `BR-0063` as external publishing would find they had approved risk-adaptive approval.
Issuing v2 in a fresh, non-overlapping identifier block above the v1.0 range was rejected because
it creates two live identifier spaces and makes every current citation read as legacy.

---

## 3. Coverage — every declared Epic has an upstream BR

The circulated draft dropped three v1.0 requirements, which would have orphaned three declared
Epics against the draft's own acceptance criterion 2. All three are restored in v2.0.

| Restored | Requirement | Epic | Where in v2.0 |
|---|---|---|---|
| `BR-0063` | External publishing under the same access rules | `EPIC-025` | §6.17 |
| `BR-0112` | Repository navigable from a single index | `EPIC-018` | §6.21 |
| `BR-0113` | Epic readiness derived, never declared | `EPIC-026` | §6.21 |

`BR-0112` and `BR-0113` govern the programme's own repository rather than the customer-facing
product, which is why v2.0 gives them their own section outside the Core Control Plane inventory.
They remain approved requirements with owning Epics; dropping them to keep §3.1 tidy would have cost
two Epics their upstream trace.

### 3.1 Declared Epic → BR map

All 29 declared Epics, each with at least one implementing requirement. `EPIC-002` and `EPIC-017`
are parent designs and inherit through their children.

| Epic | Title | Implementing `BR-` |
|---|---|---|
| EPIC-001 | Platform Foundation | `BR-0001` |
| EPIC-002 | *(parent design)* | via `EPIC-023`/`024`/`025` |
| EPIC-003 | Specification Engine & Sandbox | `BR-0110`, `BR-0134` |
| EPIC-004 | Workspace Tenancy & Audit | `BR-0001`, `BR-0111` |
| EPIC-005 | Identity & Sign-in | `BR-0002` |
| EPIC-006 | Project Management | `BR-0010` |
| EPIC-007 | Requirement Intelligence | `BR-0020`, `BR-0021` |
| EPIC-008 | Spec Authoring & Generation | `BR-0030`, `BR-0034` |
| EPIC-009 | Spec Lifecycle & Versioning | `BR-0031` |
| EPIC-010 | Specification Interface | `BR-0032` |
| EPIC-011 | Traceability | `BR-0040`, `BR-0081`, `BR-0082`, `BR-0162` |
| EPIC-012 | Workflow & Tasks | `BR-0050`, `BR-0065`, `BR-0151` |
| EPIC-013 | Engine API & Selection | `BR-0030`, `BR-0034`, `BR-0035`, `BR-0122` |
| EPIC-014 | DevOps & Release | `BR-0090`, `BR-0161`, `BR-0162`, `BR-0164` |
| EPIC-015 | QA & Validation | `BR-0080`, `BR-0161` |
| EPIC-016 | Architecture Decision Records | `BR-0100` |
| EPIC-017 | *(parent design)* | via `EPIC-019`–`EPIC-022` |
| EPIC-018 | Repository Governance | `BR-0112` |
| EPIC-019 | Steering Engine | `BR-0070`, `BR-0071`, `BR-0072` |
| EPIC-020 | Living Specifications & Impact | `BR-0033` |
| EPIC-021 | Review Gates & Roles | `BR-0003`, `BR-0060`, `BR-0072` |
| EPIC-022 | Product Structure & Traceability | `BR-0041`, `BR-0151` |
| EPIC-023 | Unattended Runs & Team Review | `BR-0061` |
| EPIC-024 | Artifact Access Control | `BR-0003`, `BR-0062`, `BR-0124` |
| EPIC-025 | External Storage Publishing | `BR-0063` |
| EPIC-026 | Epic Stage Register & DOR | `BR-0113` |
| EPIC-027 | AI-Native Amendment Reconciliation | *(reconciliation epic — produced the register this document maps against)* |
| EPIC-028 | Agent & Execution Seam | `BR-0103`, `BR-0104`, `BR-0110`, `BR-0124`, `BR-0126`, `BR-0135`, `BR-0153`, `BR-0171`, `BR-0173` |
| EPIC-029 | Design System | `BR-0190`, `BR-0193`, `BR-0194`, `BR-0195` |

No orphan in either direction: every declared Epic traces up, and every mapped requirement traces
down.

---

## 4. The 71 unowned requirements

Under v2.0 §3.5 an in-scope requirement with no declared Epic is a **recorded gap**, not an absence.
This is the substantive change v2.0 makes: under v1.0 these capabilities were invisible to the BRS
because no Epic had been declared for them.

**They are not blocked by PMI-DOC-004.** They are blocked on Epic declaration, which happens through
`/speckit-specify` and the stage register — deliberately not done here, per the Wave 0 instruction
and per this repository's rule that a machine never infers intent (`epic-declarations.json`).

The table below covers **all 71 unowned requirements**, plus two — `BR-0184` (advanced reporting)
and `BR-0191` (the Room interaction pattern) — which v2.0 gives a nominal home (Expansion Plane and
PMI-DOC-006 respectively) but which still have no delivery Epic. They appear as `U-20` and `U-21` so
that the gap list is complete for planning; they are **not** counted among the 71.

The mapping uses the **`EPIC-027` capability-area register** as its authority
([`027-ai-native-amendment/register/capability-areas.md`](./027-ai-native-amendment/register/capability-areas.md)),
because that register already assigned each amendment capability a home. This document does not
re-decide those assignments; it connects them to requirement identifiers.

| # | Capability area | Unowned `BR-` | `EPIC-027` assignment | Release slice |
|---|---|---|---|---|
| U-01 | Requirement Room | `BR-0022`–`BR-0027` | new epic — **explicitly not `EPIC-007`** (`D-33`) | R2 |
| U-02 | Stakeholder access & decision authority | `BR-0004`, `BR-0005` | new epic | R2 |
| U-03 | Portfolio & project health | `BR-0012`, `BR-0013` | new epic | R2 |
| U-04 | Change Room | `BR-0042`–`BR-0048` | new epic | R3 |
| U-05 | Defect Room | `BR-0051`–`BR-0058` | new epic | R3 |
| U-06 | Governed Engineering Loop | `BR-0064` | **UNOWNED in the register** | R3 |
| U-07 | Risk & policy engine, Decision Inbox | `BR-0066`–`BR-0069`, `BR-0174`, `BR-0192` | new epic — Decision Center, shared by three Rooms | R3 |
| U-08 | Evidence store & Evidence Contracts | `BR-0140`–`BR-0142`, `BR-0144`, `BR-0146` | new epic, or `EPIC-015` extension | R3 |
| U-09 | Specification compliance verdict | `BR-0036`, `BR-0143` | **UNOWNED in the register** | R3 |
| U-10 | Engineering Context | `BR-0091`–`BR-0096` | new epic — Engineering Context Engine | R4 |
| U-11 | Engineering Experts | `BR-0101`, `BR-0102`, `BR-0105`, `BR-0106` | new epic | R4 |
| U-12 | Task assignment & re-plan | `BR-0152`, `BR-0154` | `EPIC-012` extension | R4 |
| U-13 | Capability Hub & resolver | `BR-0120`, `BR-0121`, `BR-0123`, `BR-0125` | new epic — M-16 | R5 |
| U-14 | Workspace Fabric | `BR-0131`–`BR-0133` | new epic | R5 |
| U-15 | Governed Learning | `BR-0114`–`BR-0118` | **UNOWNED in the register** | R6 |
| U-16 | Metrics & cost attribution | `BR-0180`–`BR-0183` | deferred in v1.0; Core Control Plane in v2.0 | R6 |
| U-17 | Architecture impact & rationale | `BR-0073`, `BR-0083` | `EPIC-016` / `EPIC-020` extension | R3 |
| U-18 | Spec extension governance | `BR-0037` | `EPIC-008` / `EPIC-013` extension | R2 |
| U-19 | Operational feedback loop | `BR-0163` | new epic — depends on U-04, U-05 | R6 |
| U-20 | Application shell & Room pattern | `BR-0191` | PMI-DOC-006; `EPIC-029` extension | R2 |
| U-21 | Advanced reporting | `BR-0184` | Expansion Plane — no Epic expected before R7 | R7 |

**The three areas marked UNOWNED are the finding that survives from `EPIC-027`.** Governed
Engineering Loops, Governed Learning and the Specification Compliance Agent arrived with the Cosmos
amendment on 2026-08-14, are genuinely new, and have never had an owning Epic. That register said
in plain terms what would happen next:

> *"when `PMI-DOC-004` lands, three capability areas will have nowhere to go until someone creates
> epics for them."*

PMI-DOC-004 v2.0 is that landing. The prediction is now current, and U-06, U-09 and U-15 are where
it comes due.

---

## 5. Findings recorded, not fixed

Reported rather than folded into this reconciliation — reaching a finding and having authority to
fix it are different claims.

| ID | Finding | Why not fixed here |
|---|---|---|
| **F-03** | `027-ai-native-amendment/register/capability-areas.md` contained its `## The twenty areas` heading and the three paragraphs beneath it **twice, duplicated verbatim** | **FIXED 2026-08-22.** 21 duplicated lines removed after asserting the two blocks were byte-identical apart from line endings, then `pnpm register:build` re-derived the digest |
| **F-04** | The same register assigned *Persistent project state* to **"EPIC-029 (proposed)"**, but `EPIC-029` was subsequently declared as **Design System**, so the area pointed at a home something else had taken | **FIXED 2026-08-22.** Home is now **Workspace Fabric** (`U-14`) — see §5.1 for the reasoning. Posture unchanged |
| **F-05** | v1.0 `RULE-05` required a version bump and re-approval for scope changes; v2.0 splits this into MAJOR for target scope and MINOR for release slices (`RULE-15`) | Intentional, recorded here so the change in governance strength is visible rather than buried in a rule rewrite |
| **F-06** | The `EPIC-027` register counts **45 capabilities across 20 capability areas**; v2.0 states **123 requirements**. These are different units and must not be reconciled by count | Recorded to prevent a future check asserting a false equivalence between the two figures |


### 5.1 Why *Persistent project state* went to Workspace Fabric (`F-04`)

The stale home was a forward-looking guess: on 2026-08-17 the register assumed the next epic number
would carry this area. `EPIC-029` then went to Design System, and the guess became wrong rather than
merely provisional.

The correction is evidence-led, not arbitrary:

- **`ADR-0009` is Accepted and already decided the substrate** — the git remote is durable, volumes
  are cache and always reconstructible, the `WorkspaceBinding` discriminated union makes the
  dangerous state unrepresentable, and the Docker provider declares `supportedLifecycles:
  ['ephemeral']` and **refuses** a persistent binding with `policy_refused`.
- **So what is unbuilt is not a decision — it is a provider that supports the persistent
  lifecycle.** `EPIC-028` delivered the ephemeral half and is closed.
- **Under PMI-DOC-004 v2.0, non-ephemeral execution is Workspace Fabric**: `BR-0131`
  customer-cloud execution, `BR-0132` controlled local connector, `BR-0133` uniform governance
  across modes, governed by `ADR-0024`. A persistent workspace binding is a Workspace Fabric
  execution mode.
- `ADR-0017` (interactive developer workspace versus autonomous agent sandbox) is **Open** in the
  same space and should converge in that epic.

**Two things deliberately left alone.** The posture stays `proceeds — unspecified`: this area was
never held behind `PMI-DOC-004`, and the register's own prose already says *"the fourth, persistent
project state, is still unspecified."* And the home is written as a **new epic**, not `UNOWNED` —
marking a fourth area UNOWNED would contradict the register's prominent count of *three* unowned
areas, which `G-27-13` and the surrounding narrative both depend on.

**Reversible.** This is a home assignment, not an architecture decision. If Workspace Fabric is the
wrong owner, changing the cell and re-running `pnpm register:build` is the whole cost.

---

## 6. Verification

Run against the repository on 2026-08-21, after PMI-DOC-004 v2.0 was written:

| Assertion | Method | Result |
|---|---|---|
| v2.0 requirement count matches its own §1 | distinct `BR-` identifiers in §6 | **123** — matches |
| No `BR-` identifier defined twice | duplicate scan over §6 | **zero duplicates** |
| Every v1.0 identifier survives in v2.0 | set difference v1.0 → v2.0 | **zero missing** (25 of 25) |
| Every surviving v1.0 identifier is annotated `(v1.0)` | annotation scan | **zero unannotated** |
| Every `BR-` cited in the repo resolves in v2.0 §6 | citations in `specs/`, `governance/`, `adr/`, `docs/` vs v2.0 | **zero unresolved** (excluding the §2 reserved-identifier list) |
| Epic posture unchanged | `epic-stage-register.md`, `epic-declarations.json` | **unmodified** |

These are the checks v2.0 §12 names `G-BRS-01` to `G-BRS-04`. They are **now in CI**, implemented
in [`../tests/governance/brs-identifiers.spec.ts`](../tests/governance/brs-identifiers.spec.ts) and
run by `pnpm test:governance` — 8 tests, green within the 829-test suite on 2026-08-22.

That matters more than it sounds. Ruling `R-01` protects ten identifiers whose meanings nothing else
guards: a re-meaned `BR-` produces **no diff** in the documents that cite it, so review of those
documents cannot detect it. Until the checks ran in CI, the guarantee in §2 held for the repository
as it stood on one afternoon. It now holds for every commit.

The checks were mutation-tested rather than merely observed to pass — the stated count falsified, a
v1.0 identifier deleted, a `(v1.0)` annotation stripped, a reserved identifier un-reserved. All four
mutations failed the suite. Deleting `BR-0063` additionally tripped `G-BRS-03` on the citation it
orphaned, which is the `EPIC-025` regression of §3 caught automatically.

The checks found four defects between them, each missed by review — `G-BRS-01` a wrong gap count in
v2.0 §13 (the `G-36` defect class, reproduced while closing it); `G-BRS-03` two false positives that
were faults in the check definition and in prose, both corrected without weakening the check; and
`G-BRS-04` the identifier `BR-0074`, vacated by the renumbering but never reserved, and therefore
free to acquire a second meaning. The full record is in v2.0 §12.1.

---

## 7. Decisions requiring the Project Owner

Six from PMI-DOC-004A §14, plus one this reconciliation added.

| # | Decision | Status |
|---|---|---|
| 1 | Approve BRS v2 as a **major** revision, not an amendment patch | **SIGNED 2026-08-22** — v2.0 §17 |
| 2 | Approve Core Control Plane / Integrated Execution Plane / Expansion Plane as the product boundary | **SIGNED 2026-08-22** — v2.0 §3 |
| 3 | Move context curation, Engineering Experts, Change Room, Defect Room, evidence/compliance, capability abstraction and Workspace Fabric into target-product core | **SIGNED 2026-08-22** — v2.0 §3.1 |
| 4 | Keep public marketplace, billing/licensing and broad SDK outside the core MVP | **SIGNED 2026-08-22** — v2.0 §3.3 |
| 5 | Treat "enterprise-ready" as an architecture/governance quality while targeting teams needing a ready-to-use platform | **SIGNED 2026-08-22** — v2.0 `BG-10` |
| 6 | Create a companion Application UX Architecture specification; keep PMI-DOC-005 screen-agnostic | **done** — [PMI-DOC-006](../SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md) created; the document's **own v1.0 status is still PROPOSED** and needs a separate signature |
| **7** | **Preserve v1.0 `BR-` identifier meanings (R-01)** | **decided 2026-08-21** — applied throughout v2.0, asserted by `G-BRS-02` |
| **8** | **Confirm `EPIC-027` Finding A — the three Rooms are builds, not enhancements** | **CONFIRMED 2026-08-22** — `ADR-0015` Open → Accepted; sizing basis for `U-01`, `U-04`, `U-05` |

### 7.1 What the signature did and did not do

**Did** — made target-product scope, the three-plane boundary and the core/expansion split the
approved product definition; superseded PMI-DOC-004 v1.0 **for target scope only**, leaving it
authoritative as the Phase-1 release record (`RULE-12`); and discharged the PMI-DOC-004 dependency
in five ADRs — `ADR-0010`, `ADR-0015`, `ADR-0018`, `ADR-0021`, `ADR-0022` — each of which had been
**Open** partly on this document. All five remain Open on their other blocker, which is an owning
epic in four cases.

**Did not** — declare any Epic, change any delivery posture, or alter
`governance/epic-stage-register.md`. `RULE-14` and `ADR-0029` keep those acts separate, and this is
the same discipline `G-27-14` asserts for `EPIC-027`. The register is byte-identical after the
approval.

**Still unsigned** — PMI-DOC-006 v1.0 carries its own `PROPOSED — REQUIRES PROJECT OWNER APPROVAL`
status. Decision 6 approved *creating* it; approving it *as a standard* is a separate act.

**Since signed** — decision 8, `EPIC-027` Finding A, confirmed 2026-08-22. It was not part of the
BRS approval and is recorded separately because it settles a question of **fact** (whether the
Rooms exist), not a question of scope.

---

## 8. What happens next

**Wave 0 is complete.** Decisions 1–5 were signed on 2026-08-22.

Wave 1 (PMI-DOC-004A §13) is now open: declare Epics for the product-control backbone — `U-01`
Requirement Room, `U-04` Change Room, `U-05` Defect Room, `U-06` Governed Engineering Loop, `U-07`
risk/policy engine and Decision Inbox, `U-08` evidence store — through the normal `/speckit-specify`
flow, which is the only mechanism that may write to the stage register.

**`EPIC-027` Finding A was confirmed by the project owner on 2026-08-22.** The three Rooms do not
exist and are **builds, not enhancements** — `ADR-0015` moved Open → Accepted on that confirmation,
and it is the sizing basis for `U-01`, `U-04` and `U-05`. Any estimate that assumed enhancement of
existing Rooms is wrong by the size of the Rooms.

One item remains worth taking before Wave 1:

- **Register defects `F-03` and `F-04`** (§5) — `F-04` in particular needs a decision on where the
  *Persistent project state* capability area goes, now that `EPIC-029` was declared as Design
  System. Neither blocks Wave 1; both feed it.

Nothing in this document declares an Epic, changes a posture, or edits a spec.

---

## 9. Related documents

- [`../SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md`](../SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md) — the requirements this reconciles
- [`../SRS/PMI-DOC-004A_V2_Gap_Analysis_and_Amendment_Package_v1.1.md`](../SRS/PMI-DOC-004A_V2_Gap_Analysis_and_Amendment_Package_v1.1.md) — why the revision was necessary
- [`../SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md`](../SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md) — the companion UX architecture
- [`srs-alignment.md`](./srs-alignment.md) — PMI-DOC-000 conflicts `C-01`/`C-02`, still open
- [`027-ai-native-amendment/register/`](./027-ai-native-amendment/register/) — authoritative capability-area assignments
- [`../governance/epic-stage-register.md`](../governance/epic-stage-register.md) — declared delivery scope, unchanged by this document
