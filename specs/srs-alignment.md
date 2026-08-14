# SRS Alignment Assessment

**Date**: 2026-08-02 | **Scope**: repository-wide (all Epics) | **Status**: assessment — decisions pending

Five new documents entered `SRS/`. Two of them (**PMI-DOC-000** and the module/backlog catalogs)
change how specifications must be written and how work must be decomposed, not merely what must be
built. This document records what changed, what it conflicts with, and what must be decided.

Constitution Principle II applies throughout: *"Where a spec and the SRS disagree, the SRS wins and
the spec MUST be corrected."*

## New source documents

| Document | Date | Type | Impact |
|---|---|---|---|
| `PMI-DOC-000_Product_Documentation_and_Specification_Standard_v1.0.docx` | Aug 2 23:42 | **Governing standard** | **HIGH — changes identifier scheme, traceability chain, and document structure** |
| `PMI-DOC-001_Executive_Product_Vision.docx` | Aug 2 23:43 | Strategy | Low — confirms existing direction, adds measurable targets |
| `PMI-DOC-002_Product_Charter.docx` | Aug 2 23:43 | Governance | Medium — adds stakeholders, milestones, governance bodies |
| `PMI_Studio_Module_Based_Requirements_and_Epics.docx` | Aug 2 07:57 | **Epic catalog** | **HIGH — 16 modules, ~82 named epics** |
| `PMI_Studio_Enterprise_Product_Backlog_v1.docx` | Aug 2 23:40 | **Backlog** | **HIGH — 12 groups, ~67 epics, target scale** |
| `PMI-DOC-003_Product_Principles_v1.0.docx` | Aug 3 00:06 | **Mandatory principles** | **HIGH — 20 principles binding on all specs, designs, and implementations** |
| `PMI-TASK-001_Master_Implementation_Task_Breakdown.docx` | Aug 3 00:28 | **Programme backlog** | **HIGH — 38 tasks over 6 phases; places EPIC-001 in the last of them** |
| `PMI-PLAN-001_Engineering_Execution_Plan_v1.0.docx` | Aug 3 02:11 | Execution plan | **Validates D-10** — independently defines the same proceed/blocked lanes |
| `PMI_Studio_Master_Product_Specification_Release_Structure_v1.0.docx` | Aug 3 02:23 | **MPS structure** | **CRITICAL — declares the MPS "the single authoritative source of truth"; 90 chapters, new `REQ-0001` ID scheme** |
| `SRS/new/PMI_Studio_MPS_v1.0_Volume_1–6` (6 files) | Aug 3 02:49 | **Master Product Specification** | **CRITICAL — supersedes prior structure; 12 functional domains; 8-level decomposition** |
| `SRS/new/M01–M18_*_Implementation_Specification_v1.0` (18 files) | Aug 3 02:39–02:49 | **Module specifications** | **CRITICAL — fourth module taxonomy; module-scoped ID scheme; 6-state specification lifecycle** |

---

## Part 1 — PMI-DOC-000 is now the governing standard

It states plainly: *"Every future document in the repository shall conform to this standard."*
Four of its rules conflict with what this repository currently does.

### C-01 · Requirement identifier scheme — CONFLICT

**Standard (§3)** mandates **typed, four-digit** identifiers:

| Prefix | Meaning | | Prefix | Meaning |
|---|---|---|---|---|
| `BR-xxxx` | Business Requirements | | `AI-xxxx` | AI |
| `FR-xxxx` | Functional Requirements | | `API-xxxx` | API |
| `NFR-xxxx` | Non-functional Requirements | | `DB-xxxx` | Database |
| `SEC-xxxx` | Security | | `UI-xxxx` | UI |
| `TC-xxxx` | Test Cases | | | |

**Current state**: EPIC-001 uses `FR-001`–`FR-034` and EPIC-002 uses `FR-001`–`FR-040` — three
digits, single untyped prefix, and **the two Epics reuse the same numbers**. Under the standard,
identifiers are corpus-wide, so `FR-0012` must mean exactly one thing.

Several current `FR-` items are not functional requirements at all under the new taxonomy:

| Current | Belongs to | Why |
|---|---|---|
| EPIC-001 FR-002 (workspace isolation), FR-033 (audit) | `SEC-xxxx` | Security requirements |
| EPIC-001 FR-005 (requirement fields), FR-013 (versions) | `DB-xxxx` | Data requirements |
| EPIC-001 FR-016 (engine contract) | `API-xxxx` | Interface contract |
| EPIC-001 SC-009 (500 specs), SC-011 (95% within limit) | `NFR-xxxx` | Non-functional |
| EPIC-002 FR-021–FR-028 (access control) | `SEC-xxxx` | Security |

**Cost of conforming**: renumber and reclassify 74 requirements across two Epics, then update every
downstream citation — `plan.md`, `data-model.md`, both contracts, `quickstart.md`, `raid-log.md`,
and 197 task descriptions in EPIC-001 plus EPIC-002's spec.

### C-02 · Traceability chain — CONFLICT

**Standard (§5)**:

```text
Business Goal → Requirement → Epic → Feature → User Story → Task → Code → Test → Release
```

*"Every artifact must reference upstream and downstream IDs."*

**Constitution III** currently mandates a shorter chain: `Epic → Feature → Task`.

| Level | Standard | Repository today |
|---|---|---|
| Business Goal | Required | ❌ absent |
| Requirement | Required, above Epic | ⚠️ present but *below* Epic — inverted |
| Epic | Required | ✅ EPIC-001, EPIC-002 |
| Feature | Required | ✅ Functions `F-0n.m` in tasks.md |
| User Story | Required | ✅ `[US1]`–`[US8]` labels |
| Task | Required | ✅ `T###` |
| Code | Required | ❌ no task→code link recorded |
| Test | Required | ⚠️ tests paired to tasks, not identified as `TC-xxxx` |
| Release | Required | ❌ absent |

**The structural problem**: the standard places **Requirement above Epic** — requirements are
corpus-level and Epics implement them. This repository treats requirements as *contents of* an Epic
spec. That is an inversion, not a naming difference, and it is the deepest conflict here.

**Constitution III would need amending** to adopt the longer chain. That is a `/speckit-constitution`
action, not something to change silently.

### C-03 · Standard document structure — CONFLICT

**Standard (§4)** mandates 13 sections. Our `spec-template.md` provides some and omits six:

| Required section | Present? |
|---|---|
| Executive Summary | ❌ |
| Business Objective | ❌ |
| Scope | ⚠️ as "Out of Scope" only |
| Stakeholders | ❌ |
| Definitions | ❌ |
| Requirements | ✅ |
| Business Rules | ❌ |
| Constraints | ❌ |
| Dependencies | ⚠️ in plan/RAID, not the spec |
| Acceptance Criteria | ✅ as acceptance scenarios |
| Traceability | ✅ SRS Traceability table |
| Related Documents | ❌ |
| Revision History | ❌ |

Conforming means amending `.specify/templates/spec-template.md` and back-filling both Epic specs.

### C-04 · Markdown is authoritative — INTERNAL SRS CONTRADICTION

**Standard (§7)**: *"Markdown is the authoritative source."*

**But every document in `SRS/` is a `.docx`.** The standard that mandates Markdown is itself a Word
file. This is a contradiction inside the SRS, not between the SRS and this repository — and
Constitution II gives no way to resolve an SRS self-conflict.

**Recommendation**: convert `SRS/` to Markdown. This is the very work rejected as EPIC-001 scope in
the first clarification session (Q1, option B) — but the SRS has since made it a standard, not a
preference. Worth revisiting as its own Epic.

### Rules we already satisfy

- §6 diagram standards (Mermaid) — used in `system-design.md` and `data-model.md`
- §8 Spec Kit integration — each Epic maps to Spec Kit specs generating tasks
- §9 ADR requirement with `ADR-0001` format — matches EPIC-001 FR-034 and `schema.sql`
- §10 quality standards (testable, unambiguous, measurable) — enforced by the quality checklist

---

## Part 1b — PMI-DOC-003 Product Principles (added 2026-08-03)

*"These principles are mandatory for all future specifications, designs, and implementations."*

Twenty principles, `PP-001` to `PP-020`. They are unusually well matched to what this repository has
already built — **eight are satisfied by design decisions taken before this document existed** —
but three contradict deliberate deferrals, and those need resolving.

### Conformance matrix

| ID | Principle | Status | Evidence / gap |
|----|-----------|--------|----------------|
| PP-001 | Specification First, AI Second | ✅ | Constitution I — all code via Spec Kit commands |
| PP-002 | Single Source of Truth | ✅ | Constitution II — SRS is requirement authority |
| PP-003 | Human-in-the-Loop | ✅ | EPIC-002 provisional-approval override (FR-005a–c): a human must explicitly accept every provisional item before approval proceeds |
| PP-004 | End-to-End Traceability | ⚠️ **Partial** | Requirement → spec → task built. **Code, test, and release links absent** — same gap as C-02 |
| PP-005 | Modular Architecture | ✅ | Module boundaries; NestJS modules; package split |
| PP-006 | **Engine Independence** | ✅✅ | The architecture test (T047, T142) fails the build on any Spec Kit reference in `backend/`; fixture adapter proves neutrality. This principle is *exactly* our design |
| PP-007 | **API & MCP First** | ❌ **CONFLICT** | REST API built; **MCP entirely absent** from EPIC-001 — see **C-07** |
| PP-008 | Security by Design | ⚠️ Partial | Workspace isolation, audit, Argon2id, sandbox egress control. RBAC/SSO deferred to Phase 3 |
| PP-009 | Quality by Design | ✅✅ | Constitution V mandatory unit tests; quality gates; acceptance criteria on every story |
| PP-010 | **Observability by Default** | ❌ **CONFLICT** | Audit is first-class (FR-033). **Logging, metrics, and tracing were explicitly deferred** — see **C-08** |
| PP-011 | Documentation as Code | ❌ Conflict | *"Markdown … are the engineering source of truth"* — but `SRS/` is entirely `.docx`. **Second document to mandate this** (see C-04); strengthens D-5 |
| PP-012 | Everything Versioned | ⚠️ Partial | Requirements and specifications versioned; schema in git. **API versioning not specified** — `platform-api.md` has no version segment |
| PP-013 | Knowledge-Driven Engineering | ⛔ Out of scope | Catalog module M-10 Knowledge Platform — Phase 2 |
| PP-014 | Configuration over Customization | ✅ | Engine and identity-provider adapters; no per-tenant forks |
| PP-015 | Open Standards / no lock-in | ✅ | Adapter pattern; Valkey over Redis for licence reasons (RAID R-03) |
| PP-016 | Explainable AI | ✅ | Raw engine output stored verbatim (R-007); engine + model version on every artifact (FR-022) — output is reviewable and traceable to its producer |
| PP-017 | **Cost-Aware AI** | ❌ **CONFLICT** | Cost is tracked as a *risk* (RAID R-02), not a *capability*. No model selection or cost measurement — see **C-09** |
| PP-018 | Scalability First | ⚠️ Partial | Multi-tenant-ready from migration 1; stateless API. Horizontal scaling and read replicas deferred |
| PP-019 | Continuous Improvement (DORA/SPACE) | ⛔ Out of scope | Catalog module M-14 Reporting |
| PP-020 | Customer Value | ✅ | 12 measurable success criteria, all user-facing |

**Score**: 9 satisfied · 5 partial · 3 conflicts · 3 out of scope.

### What this document validates

Worth stating plainly, because it is unusual: **PMI-DOC-003 independently arrives at three
decisions this repository already made**, before the document existed.

- **PP-006 Engine Independence** — the reason `backend/tests/architecture` fails the build on a
  Spec Kit reference. The principle now makes that test a governance requirement, not just good
  practice.
- **Architecture Implications → *"Treat AI agents as governed services, not autonomous
  authorities"*** — this is precisely the reasoning behind the container sandbox (research R-006)
  and behind EPIC-002 marking every provisionally-derived artifact until a human accepts it.
- **PP-003 Human-in-the-Loop** — validates the EPIC-002 clarification that chose *warn and require
  explicit override* over both hard-blocking and silent approval.

### D-6 ruling · Principles bind the programme, not each Epic ✅ DECIDED 2026-08-03

> **Decision**: PMI-DOC-003's principles are **mandatory across the PMI Studio programme**, not
> individually binding on every Epic. Each Epic **MUST** carry a *Principle Conformance & Deferrals*
> register declaring, for all twenty principles, whether it satisfies, partially satisfies, or
> defers each — and for every deferral, the reason and the module or phase that will discharge it.
>
> **Rationale**: PP-007, PP-013, and PP-019 all require catalog modules two phases out (M-09, M-10,
> M-14). Binding them to every Epic would make EPIC-001 undeliverable by definition. An unexplained
> deferral, however, is indistinguishable from an oversight — which is what the register prevents.
> A deferral must be *argued*, not merely *absent*.
>
> **A deferral is not permission to skip.** It is a debt with a named owner, reviewed at each Epic's
> convergence gate.
>
> **Applied**:
> - `spec-template.md` now requires the register in every future spec
> - EPIC-001 and EPIC-002 registers written
> - **C-07** and **C-09** resolved by recorded deferral; **C-08** made *eligible* for deferral — but
>   D-7 still decides whether observability should actually be deferred

### C-07 · PP-007 "API & MCP First" vs the roadmap — ✅ RESOLVED by D-6 deferral

The principle states *"All core capabilities are exposed through APIs and extensible through MCP"*
and is **mandatory now**. But MCP sits in catalog module **M-09 MCP Marketplace**, which the
Blueprint roadmap places in **Phase 3**, and EPIC-001 contains no MCP surface whatsoever.

A principle that is mandatory today cannot be satisfied by a module scheduled two phases out. Either
the principle admits phased adoption, or EPIC-001's API design must anticipate MCP exposure now.

**Resolution adopted**: MCP is treated as a *presentation layer* over the existing service layer.
EPIC-001 builds no MCP surface but must design nothing that would prevent one — services stay
callable independently of the REST controllers. Deferred to catalog module **M-09 MCP Marketplace**
(Phase 3), recorded in EPIC-001's deferral register with that constraint attached.

### C-08 · PP-010 "Observability by Default" vs deferred telemetry — CONFLICT

The principle makes *"logging, metrics, tracing, and auditability"* **first-class features**.

EPIC-001 delivers auditability properly (FR-033, immutable, database-enforced). But `research.md`
and `plan.md` both explicitly **defer** operational telemetry, on the grounds that it is "an
operational choice". PMI-DOC-003 removes that latitude — three of the four named capabilities are
simply absent.

**Cost of conforming**: structured logging, metrics, and trace propagation across API, worker, and
sandbox. Realistically a new function group in M-00 or M-11 — roughly 8–12 tasks with their tests.

### C-09 · PP-017 "Cost-Aware AI" — ✅ RESOLVED by D-6 deferral

*"Optimize AI model selection for quality, latency, and cost."*

EPIC-001 treats AI cost purely as a **risk to be capped** (RAID R-02: wall-clock and resource
limits). There is no cost measurement, no per-model selection, and no budget surface. Cost tracking
exists in the catalog under **M-07 AI Platform**, which EPIC-001 does not touch.

**Resolution adopted**: deferred to catalog module **M-07 AI Platform** (Cost tracking epic).
EPIC-001 retains the *containment* half of the principle — hard wall-clock, CPU, and memory caps per
job (research R-006) bound cost even without measuring it. The *optimisation* half (model selection
by quality/latency/cost) is genuinely an AI Platform capability and cannot sensibly live in Phase 1,
which uses a single model. Recorded in EPIC-001's deferral register; RAID **R-02** continues to
track the exposure.

## Part 2 — The Epic catalog

### C-05 · Three competing module taxonomies — ✅ RESOLVED (D-3, 2026-08-02)

> **Decision**: `PMI_Studio_Module_Based_Requirements_and_Epics.docx` (16 modules, ~82 epics) is
> **authoritative** for module decomposition. The Blueprint's 24 Enterprise Modules and the
> Backlog's 12 groups are superseded for this purpose — they remain valid citations for other
> content (architecture layers, target scale), but not for how work is grouped.
>
> **Applied**: `specs/001-platform-core-phase1/tasks.md` re-cut onto catalog module numbering.
> All 197 task IDs unchanged; module and function numbering changed. See that file's
> "What changed in the D-3 re-cut" table.



`SRS/` now contains three different decompositions of the same product:

| Source | Structure | Count |
|---|---|---|
| `PMI_Studio_Enterprise_Master_Blueprint.docx` | Enterprise Modules | **24 modules** |
| `PMI_Studio_Module_Based_Requirements_and_Epics.docx` | Modules → Epics | **16 modules, ~82 epics** |
| `PMI_Studio_Enterprise_Product_Backlog_v1.docx` | Groups → Epics | **12 groups, ~67 epics** |

They overlap heavily but do not agree. Examples: the Blueprint has *Constraint Manager*, *Prompt
Registry*, and *Billing & Licensing* as peer modules; the Module doc folds these into *Constraint
Management*, *AI Platform*, and *Administration*; the Backlog has *Platform Foundation* and *MCP
Ecosystem* groups that appear in neither of the others.

`tasks.md` currently uses modules **M-00–M-09 derived from the Blueprint's 24**. If the newer
Module catalog supersedes it, that grouping needs re-cutting.

**One of the three must be declared authoritative.** Recommendation: the Module-Based catalog — it
is the newest structured decomposition, it names epics explicitly, and its "Recommended Delivery
Phases" gives a sequence the Blueprint's 4-phase roadmap lacks.

### C-06 · Delivery phase conflict

| Source | Phases |
|---|---|
| Blueprint Roadmap | 4 phases |
| Module doc "Recommended Delivery Phases" | **16 phases** |

EPIC-001 was scoped to *"Blueprint Roadmap Phase 1: Core platform + Spec Kit adapter + Project/Spec
management"* — a scope the clarification session explicitly confirmed. Under the 16-phase sequence,
EPIC-001 spans phases **Foundation, Workspace, Projects, Requirements, Specifications, Spec Kit
Adapter** — six phases, which is consistent in content but no longer matches the label "Phase 1".

### Target scale

The Backlog states the intended end state:

| Level | Target |
|---|---|
| Modules | 50+ |
| Epics | 300–500 |
| Features | 2,000–4,000 |
| Stories | 10,000+ |
| Tasks | 50,000+ |

The Charter adds **264+ product documents**. For context, EPIC-001 alone produced 197 tasks — so
50,000 tasks implies roughly 250 Epics of comparable size. This is a multi-year programme, and it
makes the identifier scheme (C-01) genuinely load-bearing rather than pedantic: three-digit,
untyped, Epic-local IDs will not survive 50,000 tasks.

---

## Part 3 — Where existing Epics sit in the new catalog

### EPIC-001 — PMI Studio Phase 1 Platform Core

Spans **7 of the 16 modules**, partially in each:

| New module | New catalog epic | EPIC-001 coverage |
|---|---|---|
| Workspace & Organization | Workspace lifecycle | ✅ Covered |
| | Multi-tenant orgs, Teams, RBAC, Branding, Portfolio dashboard | ❌ Not covered |
| Project Management | Project lifecycle | ✅ Covered |
| | Templates, Roadmaps, Milestones, Cross-project deps, Health dashboards | ❌ Not covered |
| Requirement Intelligence | Document ingestion (manual only) | ⚠️ Partial |
| | AI extraction, REG normalization, Gap analysis, Business rules, Prioritization | ❌ Not covered |
| Specification Management | Spec authoring, Versioning, Approval workflow, Traceability | ✅ Covered |
| | Visual spec editor | ❌ Not covered |
| Specification Engine | Engine interface, Spec Kit adapter, Future engine adapter, Validation | ✅ Covered |
| | Complexity estimation | ❌ Deferred (clarified) |
| Workflow & Tasks | Task generation, Progress tracking | ✅ Covered |
| | AI planning, Dependency graph, Sprint planning, Kanban | ❌ Not covered |
| Security & Governance | Authentication, Audit | ✅ Covered |
| | RBAC/ABAC, Compliance, AI governance | ❌ Not covered |

**Assessment**: EPIC-001's scope is coherent and confirmed by clarification. It is a *thin vertical
slice* across seven modules rather than one module built deep — which the new catalog's
module-by-module structure does not naturally express.

### EPIC-002 — Team Review, Access Control & External Storage

| Capability | Home in new catalog |
|---|---|
| Unattended runs with batched team review | ⚠️ Closest: Workflow & Tasks → *AI planning*. Not a real match |
| Per-artifact access control | ✅ Security & Governance → *RBAC/ABAC* |
| **External storage (Drive/Dropbox/S3)** | ❌ **Still no home in any of the three taxonomies** |

**This confirms the earlier finding.** When EPIC-002 was written I flagged that unattended runs and
third-party storage had no SRS source and required back-fill. The new catalog — 16 modules, 82
epics, plus a 67-epic backlog — **still contains neither**. The back-fill obligation stands and is
now better evidenced.

---

## Part 4 — PMI-TASK-001 Master Implementation Task Breakdown (added 2026-08-03)

38 tasks across six phases. **These are specification-production tasks, not software-build tasks** —
"Complete Business Requirement Specification", "Create user stories", "Design MCP integration". The
document describes the work of producing the 264-document corpus the Charter promises.

**The consequence is uncomfortable and worth stating plainly**: EPIC-001 is *Phase 6 — Engineering*
work, and Phases 2, 4, and 5 are substantially incomplete.

### Where the programme actually stands

| # | Task | Status | Evidence / gap |
|---|------|--------|----------------|
| **Phase 1 — Product Foundation** | | | |
| T-001 | Establish documentation repository | ⚠️ Partial | Repo exists with `specs/` and `SRS/`. **`SRS/` is `.docx`, not Markdown** — D-5 |
| T-002 | Create document templates | ⚠️ Partial | Spec/plan/tasks/checklist templates exist; **not conformant to PMI-DOC-000 §4** — D-4 |
| T-003 | Configure versioning and naming standards | ⚠️ Partial | Standard defines `PMI-DOC-XXX`; our specs use `NNN-slug` naming |
| T-004 | Define requirement ID conventions | ⚠️ Defined, not adopted | PMI-DOC-000 §3 defines them; we still use `FR-0nn` — D-1 |
| T-005 | Create ADR repository | ❌ **Not started** | **No `adr/` directory exists.** PMI-DOC-000 §9 and the Charter both mandate ADRs from day one — see **C-12** |
| T-006 | Set up Spec Kit workspace | ✅ Done | This repository |
| **Phase 2 — Business Analysis** | | | |
| T-101 | Complete Business Requirement Specification | ❌ **Not started** | **`PMI-DOC-004` is cited as a Related Document by DOC-001, DOC-002 and DOC-003 — and does not exist** |
| T-102 | Identify stakeholders and personas | ⚠️ Partial | Charter lists stakeholder groups; no personas |
| T-103 | Define business capabilities | ⚠️ Partial | Vision lists nine core capabilities |
| T-104 | Document business rules | ❌ Not started | No business rules anywhere; PMI-DOC-000 §4 requires the section — D-4 |
| T-105 | Define KPIs and success criteria | ⚠️ Partial | Vision success measures; per-Epic success criteria exist |
| T-106 | Approve business scope | ❌ Not started | Charter status is **Draft** |
| **Phase 3 — Product Backlog** | | | |
| T-201 | Identify enterprise modules | ✅ Done | Module catalog, authoritative by D-3 |
| T-202 | Break modules into epics | ✅ Done | ~82 epics in the catalog |
| T-203 | Break epics into features | ⚠️ EPIC-001 only | 57 functions in `tasks.md`; the other ~80 epics untouched |
| T-204 | Create user stories | ⚠️ EPIC-001/002 only | 8 + 7 stories against a target of 10,000+ |
| T-205 | Prioritize backlog | ❌ Not started | Backlog carries no priorities |
| T-206 | Define MVP scope | ✅ Done | EPIC-001 waves W1–W8 |
| **Phase 4 — Architecture** | | | |
| T-301 | Design enterprise architecture | ⚠️ Partial | `system-design.md` covers EPIC-001's slice, not the enterprise |
| T-302 | Design specification engine interface | ✅ Done | `contracts/specification-engine.md` |
| T-303 | Create Spec Kit adapter | ⚠️ Designed, not built | M-08 F-08.6/F-08.7 |
| T-304 | **Design MCP integration** | ❌ **Not started** | Deferred by C-07 — but this is a **Phase 4** task, due *before* engineering. See **C-11** |
| T-305 | Design AI platform | ❌ Not started | Catalog module M-07 |
| T-306 | Review architecture | ❌ Not started | Charter names an Architecture Review Board; no review held |
| **Phase 5 — Module Specifications** | | | |
| T-401–T-405 | Workspace, Project, Requirement, Specification, Workflow | ⚠️ Partial | EPIC-001 covers a thin vertical slice of each; none specified as a module |
| T-406–T-408 | AI Platform, Knowledge, Administration | ❌ Not started | Catalog modules M-07, M-10, M-15 |
| **Phase 6 — Engineering** | | | |
| T-501 | Database design | ✅ EPIC-001 scope | `schema.sql`, `data-model.md` |
| T-502 | API specification | ✅ EPIC-001 scope | `contracts/platform-api.md` |
| T-503 | UI/UX specification | ❌ Not started | No design system; awaiting SRS Volume 8 |
| T-504 | Security specification | ⚠️ Partial | Isolation, audit, sandbox specified; no security document |
| T-505 | QA specification | ✅ EPIC-001 scope | `quickstart.md` + test strategy (R-010) |
| T-506 | DevOps specification | ⚠️ Partial | `tech-stack.md`; no deployment or environment design |

**Tally**: 7 done · 15 partial · 16 not started.

### C-10 · Task ID collision — CONFLICT

`PMI-TASK-001` numbers its tasks **`T-001`, `T-101`, `T-201`…**. `EPIC-001/tasks.md` numbers its
tasks **`T001`–`T156`**. One hyphen apart, entirely different meanings:

| ID | PMI-TASK-001 | EPIC-001 tasks.md |
|---|---|---|
| `T-001` / `T001` | Establish documentation repository | Create pnpm workspace root |
| `T-101` / `T101` | Complete Business Requirement Specification | Implement task generation service |
| `T-501` / `T501` | Database design | *(does not exist)* |

In any status report, standup, or commit message, "T001" is now ambiguous. This will cause a real
mistake eventually.

**Cheapest fix**: namespace our Epic tasks — `E1-T001` — leaving `T-nnn` to mean programme tasks
exclusively. Cheap now; fold it into the D-1 renumbering pass rather than doing two sweeps.

### C-11 · Engineering ahead of the documented sequence — ✅ RESOLVED by D-10 (2026-08-03)

> **Decision (D-10): Option C — split.** Continue building the engine and sandbox, where the genuine
> unknowns are. **Hold the product surface** until `PMI-DOC-004` Business Requirement Specification
> exists and business scope is approved (T-101, T-106).
>
> **Rationale**: every finding that justified EPIC-001 so far is engine-side — Spec Kit is not a
> callable API, generation needs a sandbox, engine independence needs a build-time test. None of that
> changes when a BRS arrives. But project, requirement, and specification *behaviour* is precisely
> what a BRS exists to settle, and M-04 alone is 66 tasks. That is where rework would concentrate.
>
> **What makes this split possible**: the engine contract takes **plain data** —
> `GenerateSpecificationInput` carries `RequirementInput[]`, not database entities. The adapter,
> sandbox, and conformance suite can therefore be built and fully tested with no product surface at
> all. That is an affordance of the design, not a coincidence.

#### The proceeding slice — 66 of 201 tasks

| Function | Why it proceeds |
|---|---|
| F-00.1 – F-00.3 | Monorepo, CI, error taxonomy — no behavioural content |
| F-00.4 | Job orchestration — state machine, cancellation, timeouts. Architectural, not behavioural |
| F-01.1, F-01.2 | Workspace/user schema and scoping. Tenancy shape was settled by clarification, not by the BRS |
| F-08.1 – F-08.8 | Engine contract, registry, resolution, fixture adapter, conformance, **Spec Kit sandbox and invocation**, architecture enforcement |
| F-13.1 | Audit trail — needed to record engine invocations |

#### Held — 135 tasks

M-02 Project Management, M-03 Requirement Intelligence, M-04 Specification Management (all 66),
M-06 Workflow & Tasks, F-01.3/F-01.4 auth surface, F-08.9 engine API/UI, M-11, M-12, F-13.2 ADRs.

#### One real seam, not papered over

`GenerationJob` carries a foreign key to `Project`, so job **persistence** touches a table owned by
held work. Two honest options, to be settled when the slice starts:

1. **Project stub table** — create the table with workspace, owner, and name only; no service, no
   validation, no behaviour. The BRS cannot plausibly remove "jobs belong to a project".
2. **Defer job persistence** — build the orchestration logic and its tests against an in-memory
   store, add persistence when M-02 unfreezes.

Option 1 is cheaper and lower-risk; option 2 is purer. **Recommendation: option 1**, on the grounds
that the association is structural rather than behavioural.

Two task-level exceptions to the function-level split:

- **T138** (per-project engine selection endpoint) sits in `projects.controller.ts` — **held**,
  despite F-08.3 otherwise proceeding
- **T049** (project creation validation tests) is behavioural — **held**, despite being the paired
  test for the stub table above

### C-11 · Original finding — Engineering running ahead of the documented sequence

PMI-TASK-001 orders the work: **Foundation → Business Analysis → Backlog → Architecture → Module
Specifications → Engineering**. EPIC-001 is Engineering, and it is 201 tasks deep while:

- **T-101 Business Requirement Specification is not started.** `PMI-DOC-004` is cited as a Related
  Document by three governing documents and **does not exist**. EPIC-001's requirements were derived
  from a blueprint and clarification sessions, not from an approved BRS.
- **T-106 Approve business scope is not started** — the Charter is still `Draft`.
- **T-304 Design MCP integration is not started**, yet sits in Phase 4, *before* engineering. Our
  C-07 resolution deferred MCP to roadmap Phase 3. Note the terminology hazard: PMI-TASK-001
  "Phase 4" and the Blueprint roadmap "Phase 3" are different scales entirely.
- **T-306 Review architecture is not started** — no Architecture Review Board review, though the
  Charter names one as a governance body.

This is not necessarily wrong. Building a thin vertical slice early is a legitimate strategy, and
EPIC-001's design has already surfaced findings no amount of documentation would have (Spec Kit is
not a callable API; the engine needs a sandbox). But it **is** a deviation from the SRS's own
sequence, and Constitution II says the SRS wins unless corrected. It should be a decision, not a
drift — see **D-10**.

### C-12 · No ADR repository exists — CONFLICT

T-005 requires one. PMI-DOC-000 §9 mandates an ADR for *"every significant architectural decision"*,
with IDs `ADR-0001`, `ADR-0002`. PMI-DOC-003's Architecture Implications repeat it. The Charter lists
ADRs as a governance mechanism.

**There is no `adr/` directory in this repository**, and the decisions that plainly warrant one have
been recorded as research entries and RAID rows instead:

| Decision | Currently recorded as | Should be |
|---|---|---|
| Spec Kit behind an adapter, engine-independent | research R-001, R-009 | `ADR-0001` |
| Container sandbox for untrusted engine execution | research R-006 | `ADR-0002` |
| TypeScript/Node + NestJS + PostgreSQL stack | research R-002 to R-005 | `ADR-0003` |
| One-way publish only, platform authoritative | EPIC-002 clarification | `ADR-0004` |
| Principles bind programme, not each Epic | decision D-6 | `ADR-0005` |

Note EPIC-001 already builds ADRs **as a product feature** (FR-034, `architecture_decision_records`
table) — while the programme building it keeps none of its own.

**Cheap to fix**: five ADRs, back-filled from material that already exists. Mostly transcription.

## Part 5 — The MPS drop (26 documents, added 2026-08-03)

Six MPS volumes, eighteen module implementation specifications, a release structure, and an
engineering execution plan. This is not an increment — it **restructures the requirement base** and
supersedes decisions taken two days ago.

### ✅ First, the good news: PMI-PLAN-001 independently validates D-10

Its **Execution Lanes** are the split we chose, arrived at separately:

| PMI-PLAN-001 lane | Status | Our D-10 position |
|---|---|---|
| Foundation | Proceed | ✅ F-00.x proceeding |
| **Business** | **Blocked until PMI-DOC-004** | ✅ Held |
| **Product Surface** | **Blocked until BRS** | ✅ Held (M-02, M-03, M-04, M-06) |
| AI Platform | Proceed | — out of EPIC-001 scope |
| Infrastructure | Proceed | ✅ F-00.1, F-00.2 proceeding |

It also states the rule directly: *"Business-dependent work waits for approved BRS."* And Volume 6
§6 reinforces it: *"prevent implementation until mandatory upstream requirements are approved."*
**D-10 needs no revision.**

Its F-00.1 deliverables also list an **ADR repository** — a third document requiring what C-12 says
is missing.

### D-12 ruling · Layered authority ✅ DECIDED 2026-08-03

> **Decision**: authority is **layered by subject matter**, not by recency. No single document wins
> everything.
>
> | Layer | Authoritative document | Governs |
> |---|---|---|
> | **Product content** | **MPS** (Volumes 1–6 + module specs M01–M18) | Requirements, domains, module decomposition, lifecycles, entities, APIs, acceptance criteria |
> | **Documentation standards** | **PMI-DOC-000** | Identifier form, document structure, traceability rules, ADRs, diagram standards |
> | **Principles** | **PMI-DOC-003** | The twenty PP-* principles, binding programme-wide (D-6) |
> | **Execution sequencing** | **PMI-PLAN-001** + **PMI-TASK-001** | Lanes, phases, what may proceed |
>
> **Rationale**: the MPS claims to be *"the single authoritative source of truth for the product"* —
> and product is exactly what it contains. It says nothing about how documents are named or how
> principles bind, which is what PMI-DOC-000 and PMI-DOC-003 exist for. Reading the MPS as
> superseding those would discard governance it never attempted to replace.
>
> **Consequence for C-15**: PMI-DOC-000 governs identifier *form* (typed prefixes); the MPS module
> specs demonstrate the *scoping* convention (module-qualified). The two combine rather than
> compete: `FR-SPEC-001` is a typed prefix plus a module scope plus a sequence. **`REQ-0001` from
> the Release Structure is superseded** — it is untyped, and PMI-DOC-000 governs form.
>
> **Consequence for C-14**: the MPS 18-module taxonomy is product content, so it **supersedes D-3's
> 16-module catalog**. Application is deferred by D-13.

### C-13 · Which document is authoritative? — ✅ RESOLVED by D-12

The Release Structure declares: *"The MPS is the single authoritative source of truth for the
product. All specifications, implementation plans, tasks, code, tests, and releases are derived from
it."*

That claim collides with the authority we have already assigned:

| Document | Claims authority over | Status |
|---|---|---|
| PMI-DOC-000 | *"Every future document shall conform"* — IDs, structure, traceability | Still asserted |
| PMI-DOC-003 | Principles binding on all specs, designs, implementations | Adopted via D-6 |
| Module-Based catalog | Module decomposition | Adopted via **D-3** |
| **MPS** | **Everything** | **Newest, broadest claim** |

Constitution II says the SRS wins over specs, but gives no rule for SRS documents overriding each
other. **This needs an explicit ruling** — see D-12.

### C-14 · A fourth module taxonomy — CONFLICT, and it supersedes D-3

| Source | Structure | Count |
|---|---|---|
| Blueprint | Enterprise Modules | 24 |
| Module-Based catalog | Modules → Epics | **16** ← adopted by D-3, `tasks.md` re-cut onto it |
| Backlog | Groups | 12 |
| **MPS Volume 2** | Functional Domains | **12** |
| **MPS module specs** | **Modules M01–M18** | **18** |

The MPS is internally inconsistent too — Volume 2 lists **12 domains**, the module specs number
**18 modules**.

**Worse: the IDs collide with ours and mean different things.**

| ID | Our `tasks.md` | MPS module spec |
|---|---|---|
| `M-01` / `M01` | Workspace **& Organization** | Workspace Management *(Organization is M02)* |
| `M-03` / `M03` | Requirement Intelligence | **User Identity Management** |
| `M-04` / `M04` | Specification Management | **RBAC** |
| **`M-08` / `M08`** | **Specification Engine** | **Specification Management** |
| `M-12` / `M12` | QA | **Workflow Engine** |
| `M-13` / `M13` | Security & Governance | **Engineering Execution** |

`M-08` is the sharpest: ours is the engine, theirs is the thing the engine produces.

**Note also**: the MPS has **no Specification Engine module**. It sits in Volume 3 alongside the AI
Platform and MCP — so our largest proceeding module has no home in the new taxonomy.

### C-15 · Requirement ID schemes now number four — CONFLICT

| Scheme | Source | Example |
|---|---|---|
| Untyped 3-digit | our specs | `FR-001` |
| Typed 4-digit | PMI-DOC-000 §3 | `FR-0001`, `BR-0001`, `NFR-0001` |
| Generic sequential | MPS Release Structure | `REQ-0001` |
| **Module-scoped** | **MPS module specs** | **`FR-SPEC-001`, `BR-SPEC-001`, `API-SPEC-001`, `EV-SPEC-001`, `AC-SPEC-001`, `TC-SPEC-001`** |

D-1 was already open. It now has four candidate answers instead of two, and two of them come from
documents that each claim authority.

### C-16 · Specification lifecycle conflict — **affects built design**

`M08 §8` mandates six states:

```text
Draft → Review → Approved → Baseline → Implemented → Archived
```

EPIC-001 implements **three** (FR-011): `draft → in_review → approved`. This is not a documentation
gap — it is enforced in three places:

| Artifact | What breaks |
|---|---|
| `spec.md` FR-011 | States and permitted transitions |
| `schema.sql` | `spec_lifecycle_state` enum and the `lifecycle_permitted_transition` CHECK constraint |
| `tasks.md` T099, T106, T111 | Lifecycle machine and its guards |

M08 also requires two capabilities EPIC-001 lacks entirely: **FR-SPEC-004 Baseline** and
**FR-SPEC-006 Export**, plus domain events (`EV-SPEC-*`) and five actors (Administrator, Manager,
Engineer, Reviewer, AI Assistant) against our single-user surface.

**This is the first SRS change that invalidates working design rather than adding scope.** It is
also, usefully, **held work** — M-04 is frozen under D-10, so nothing has been built against the
three-state model yet. The cost of correcting it now is a spec and schema edit; after implementation
it would be a migration.

### C-17 · Feature ID collision with PMI-PLAN-001 — CONFLICT

PMI-PLAN-001 uses `F-00.1`–`F-00.5`. So do we. Different meanings throughout:

| ID | PMI-PLAN-001 | Our `tasks.md` |
|---|---|---|
| `F-00.1` | Project Bootstrap & Repository Initialization | Monorepo and tooling |
| `F-00.2` | Repository Standards | Local services and CI |
| `F-00.3` | **Specification Engine Interface** | Error model and failure taxonomy |
| `F-00.4` | **Spec Kit Adapter** | Generation job orchestration |
| `F-00.5` | Workflow Engine | *(does not exist)* |

This is C-10 (`T-001`/`T001`) repeating at the feature level. The namespacing decision **D-9** should
now cover modules, features, and tasks together.

### A recommendation on timing

**Do not re-cut `tasks.md` again yet.**

We adopted the 16-module catalog on 2 August and re-cut 201 tasks onto it. A fourth taxonomy arrived
on 3 August. Every MPS volume is marked **`Status: Draft`**, and Volume 6's own completion criteria
end with *"Ready for detailed module-by-module specifications"* — meaning the MPS expects further
elaboration.

Re-cutting now risks a fifth re-cut next week. The task IDs are stable and the work is unaffected;
only the grouping labels are wrong. **Wait for an MPS baseline, then re-cut once** — and fold D-9
namespacing and D-1 renumbering into the same pass so 201 tasks are touched once rather than four
times.

The exception is **C-16**: the lifecycle conflict should be fixed regardless of taxonomy, because it
changes requirements and schema rather than labels.

## Part 6 — Epic decomposition (D-15, 2026-08-03)

### D-15 ruling · EPIC-001 split into 15 epics ✅ DECIDED

> **Decision**: the single 215-task EPIC-001 is decomposed into **15 epics**, cut by MPS catalog
> epic and respecting the D-10 proceed/hold line exactly. Cross-cutting design moves to
> `specs/_shared/`; each epic owns `spec.md`, `tasks.md`, `checklists/`, and `defects/`.

**Why it was wrong before** — the SRS said so:

- **MPS Volume 6 §1** defines `Domains → Modules → Capabilities → Epics → Features → Specifications
  → Tasks`. Epics sit **below** modules. EPIC-001 spanned **ten** modules — the hierarchy was
  inverted.
- **D-10 had to cut it in half** (74 proceed / 141 held). An epic that must be half-frozen is two
  epics.
- **M-04 alone held 70 tasks** — a third of the work in one module.
- **Constitution IV** gates convergence per epic; one 215-task epic meant one enormous gate instead
  of fifteen incremental ones.
- **Constitution VI** wants a defects folder per epic; one folder for ten modules attributes nothing.
- The MPS catalog names ~82 epics. EPIC-001 was not one of them — it was a slice across many.

**What did not change**: all 215 tasks, every task ID, every requirement. This was a regrouping,
verified by assertion during the split (`215 in → 215 out`, zero duplicate IDs).

**Refinement to D-6**: the Principle Conformance register is now a **platform baseline** in
`_shared/platform-spec.md`, with each epic recording only deltas. Twenty rows × fifteen epics would
have become exactly the box-ticking ADR-0005 warned against. The intent — every deferral argued and
owned — is preserved.

**What the split made visible**: three requirement IDs are owned by two epics *because EPIC-002 has
its own `FR-001`–`FR-040` colliding with the platform set*. That is conflict **C-01** demonstrated
in practice, and it strengthens the case for **D-1**.

## Part 7 — The enhancement model (C-18, D-16, 2026-08-04)

`SRS/enhancement_module/PMI_Studio_Enhancement_Model_for_SpecKit.docx` arrived as a target-state
model: nine enhancements, twelve enterprise modules, twelve AI agent roles, a twenty-one-section
specification template, and a twelve-link traceability chain. Specified as **EPIC-017** on
2026-08-03; three questions blocked planning and were answered 2026-08-04.

### C-18 · The enhancement model contradicts PMI-DOC-000 — ✅ RESOLVED by D-16

Two direct contradictions with a governing document:

| Subject | `PMI-DOC-000` | Enhancement model |
|---|---|---|
| Specification structure | §4 — **13 sections** | **21 sections** |
| Traceability | §5 traceability rules; D-2's 9-level chain | **12-link chain**, vision → operations |

Taken at face value, adopting the enhancement model would render **every existing specification in
this repository non-conformant** at a stroke — 18 epic specs plus `_shared/`. Taken the other way,
the model's central structural proposals would be discarded.

### D-16 ruling · Authority layered by artifact population ✅ DECIDED 2026-08-04

> **Decision**: the enhancement document governs **the structure and traceability of specifications
> PMI Studio generates or manages as a product capability**. It does **not** govern documents in this
> repository. `PMI-DOC-000` continues to govern those.

This extends D-12's layering by subject matter with a layering by **which artifacts are governed**:

| Authority | Governs |
|---|---|
| **MPS** | PMI Studio product scope and requirements |
| **PMI-DOC-000** | Documentation standards for documents **inside this repository** |
| **PMI-DOC-003** | Principles |
| **Enhancement model** | Structure and traceability of specifications **PMI Studio produces** |
| PMI-PLAN-001 / PMI-TASK-001 | Sequencing |

**Consequences**:

- Repository specifications keep the `PMI-DOC-000` structure unless `PMI-DOC-000` is itself amended.
- The 21-section structure applies to product outputs — EPIC-017 `FR-ENH-020`.
- Repository traceability stays governed by `PMI-DOC-000` and the eventual resolution of **D-2**.
- The 12-link chain applies to PMI Studio's product traceability — EPIC-017 `FR-ENH-021`.
- **No existing repository specification becomes non-conformant.** This was the deciding factor.
- C-18 is resolved by layering, not supersession. Nothing is overridden; the two standards address
  different populations of artifacts.

**Effect on D-2 and D-4**: both are **scoped, not closed**. The enhancement model no longer bears on
either. D-2 still must decide this repository's traceability depth; D-4 still must decide whether the
repository's templates move to `PMI-DOC-000`'s thirteen sections. Both remain open below.

### D-17 ruling · EPIC-017 split along the product/process seam ✅ DECIDED 2026-08-04

> **Decision**: the enhancement model is delivered as **two epics**. **EPIC-017** keeps the product
> capability and stays ⏸ **held** with the rest of the product surface. **EPIC-018 Repository
> Governance Process** takes the repository half and ▶ **proceeds** immediately.

| EPIC-017 — product, held | EPIC-018 — process, proceeding |
|---|---|
| Steering Engine | Steering-file definitions for this repository |
| Living Specifications | Recommended repository paths |
| AI Review Gates | Spec Kit folder mapping |
| Product specification structure and traceability | Repository governance workflow |
| The twelve reviewing roles | Internal specification templates |
| | Internal traceability conventions |

This is the same seam that split **EPIC-013** out of **EPIC-003**: the engine proceeded, the surface
that touched `projects.controller.ts` was held. Here the product capability is held and the
repository process — which touches no product surface and waits on no BRS — proceeds.

### Phase authority · target state does not move the roadmap ✅ DECIDED 2026-08-04

> **Decision**: the enhancement model describes intended **target-state architecture**. It does
> **not** supersede approved phase and module assignments.

| Capability | Stays at |
|---|---|
| Enterprise Knowledge Graph | **M-10, Phase 2** |
| Persistent AI Memory | later knowledge-capability delivery |
| Prompt Registry · Model Registry | **M-07** |
| MCP-related capabilities | **M-09, Phase 3** |
| Agent Marketplace | its approved later-phase module |
| AI-platform and cost-optimisation controls | **M-07** |

**M-07, M-09, and M-10 are not pulled forward through EPIC-017.** EPIC-017's User Story 6, together
with `FR-ENH-017` to `FR-ENH-019` and `SC-ENH-008`, moves to the Phase 2 knowledge epic. Those
identifiers are left **deliberately vacant** in EPIC-017 rather than reused.

**Principle rulings**: **PP-013** and **PP-017** are confirmed as valid target-state principles but
remain **deferred** — PP-013 to M-10, PP-017 to M-07. Neither is contested any longer.

⚠️ **Residual exposure worth watching.** The twelve reviewing roles stay in EPIC-017 while the
cost-optimisation controls that would bound them stay in M-07. Containment falls entirely to the
platform's existing per-job caps (FR-025). **RAID R-02 must be re-scored when EPIC-017 is planned** —
this is recorded in EPIC-017's exit criteria, not left to memory.

### D-18 ruling · EPIC-017 split into four delivery epics ✅ DECIDED 2026-08-04

> **Decision**: EPIC-017's eleven functions are delivered by **four child epics**. EPIC-017 becomes a
> **parent design** carrying no tasks — the same role `_shared/` plays for the platform.

| Child epic | Functions | Requirements | Tasks |
|---|---|---|---|
| **EPIC-019** Steering Engine | F-17.1 – F-17.3 | FR-ENH-001 – 005 | T225–T250 (26) |
| **EPIC-020** Living Specifications & Impact | F-17.4 – F-17.6 | FR-ENH-006 – 011 | T251–T272 (22) |
| **EPIC-021** Review Gates & Roles | F-17.7, F-17.8, F-17.11 | FR-ENH-012 – 016, 023, 024 | T273–T295 (23) |
| **EPIC-022** Product Structure & Traceability | F-17.9, F-17.10 | FR-ENH-020 – 022 | T296–T311 (16) |

**Why**: the same argument as **D-15**. MPS Volume 6 §1 places Epics *below* Modules; EPIC-017 spanned
two modules and eleven functions clustering into four groups that share almost no entities.
Constitution IV gates convergence per epic, and one 87-task gate is worse than four incremental ones.

**What did not change**: every requirement, every success criterion, and the principle register stay
defined **once** in the parent. No requirement was renumbered. Task IDs `T225`–`T311` were allocated
fresh at the split, continuing from `T224`.

**Ordering constraint**: **EPIC-019 must land first.** F-17.1 adds a tenancy scope above workspace —
a column while no workspace rows exist, a data migration afterwards (research R-017-1).

**One open sub-decision**: **EPIC-022 is a fold candidate.** It extends EPIC-011's link model rather
than standing fully alone. Kept separate for now because folding stays cheap while both epics are held
and unimplemented, and the invariant-ID convention makes the fold a regrouping rather than a
renumbering.

⚠️ **A known cross-epic break was scheduled, not discovered**: EPIC-011 `T077a` asserts
`TraceabilityLink` permits only the two Phase 1 edge types, and fails the build the moment EPIC-022's
`T301` widens the enumeration. `T302` updates it.

### D-19 ruling · EPIC-002 split into three delivery epics ✅ DECIDED 2026-08-07

> **Decision**: EPIC-002's three capability areas are delivered by **three child epics**. EPIC-002
> becomes a **parent design** carrying no tasks — the same role EPIC-017 plays for its family, and
> `_shared/` plays for the platform.

| Child epic | Module | Requirements | Tasks |
|---|---|---|---|
| **EPIC-023** Unattended Runs & Team Review | M-06 Workflow | FR-001–FR-020 | 43 |
| **EPIC-024** Artifact Access Control | M-13 Security & Governance | FR-021–FR-028 | 21 |
| **EPIC-025** External Storage Publishing | M-11 DevOps | FR-029–FR-040 | 37 |

**Why**: the same argument as **D-15** and **D-18**. At 87 tasks across three capability areas that
EPIC-002's own build order already described as mutually independent — "three developers could work in
parallel once the epic unfreezes" — it was the shape EPIC-001 had before D-15 and EPIC-017 had before
D-18. Constitution IV gates convergence per epic, and one 87-task gate is worse than three.

**What did not change**: every requirement, success criterion, and the clarification history stay
defined **once** in the parent. No requirement was renumbered. Task IDs were preserved and routed
(`T340`→023, `T377`→024, `T391`→025); the count has since grown to 101 as later passes added
coverage. `002/tasks.md` was deleted deliberately — recreating it would duplicate all 101.

**Both SRS back-fill gates survived the split**, each landing in the epic that owes it: `T404`
(unattended runs, FR-001–FR-020) in EPIC-023, and a new `T439` (third-party storage, FR-029–FR-040)
in EPIC-025. Neither capability area has an SRS source, and both gate **approval**, not merely
closure — the largest Constitution II debt in the programme.

**Sequencing**: **EPIC-023 → EPIC-024 → EPIC-025**, which is the numbering as written.

- **EPIC-024 depends on EPIC-023**: `T381` (run-start access snapshotting, FR-028, owned by 024)
  writes the `access_snapshot` column on `Run`, and `Run` is defined by EPIC-023 `T343`.
- **EPIC-025 depends on EPIC-024**: `T392` excludes artifacts the publisher cannot access (FR-033) —
  without grants it silently becomes a no-op that still passes its test. Recorded in EPIC-025's
  `Depends on` since the split.
- **EPIC-023 depends on neither**: nothing across its 43 tasks references access or grants.

*Corrected 2026-08-08. This ruling first stated that EPIC-024 gated both siblings and that neither
recorded the dependency. Both halves were wrong: the 023 dependency runs the other way, and 025 had
always recorded its own. The `Depends on` entry EPIC-024 was genuinely missing has been added.*

⚠️ **G-02F.1 — the identifier collision extends to success criteria.** **C-01** was recorded as a
*requirement* collision. The criteria collide too and nobody had written it down: the EPIC-002 family
uses `SC-001`–`SC-014` and the platform uses `SC-001`–`SC-012`, so every identifier overlaps. Before
the split this was contained in one spec; now three separate specs each cite bare `SC-00n`, and
`SC-001` here means something different from the `SC-001` EPIC-010 owns. **Decision D-1 should be
widened to cover success criteria.** Recorded rather than renumbered — renumbering is D-1's pass.

## Decisions required

Nothing below can be resolved by reading the SRS; each needs an owner's decision.

| # | Decision | Blocks | Cost if adopted |
|---|---|---|---|
| **D-1** | Adopt PMI-DOC-000 identifier scheme (typed, 4-digit, corpus-unique)? | All future specs | Renumber + reclassify 74 requirements; update ~200 downstream citations |
| **D-2** | Amend Constitution III to the 9-level chain, with Requirement **above** Epic? | Constitution | `/speckit-constitution` amendment; restructures how Epics are scoped. 🔵 **Scoped by D-16 (2026-08-04)** — applies to *repository* traceability only; PMI Studio's 12-link product chain is settled and out of D-2's reach |
| ~~**D-3**~~ | ~~Which module taxonomy is authoritative?~~ | — | ✅ **DECIDED 2026-08-02** — Module-Based catalog (16 modules). `tasks.md` re-cut; 197 task IDs unchanged |
| **D-4** | Amend `spec-template.md` to PMI-DOC-000's 13 sections? | Repository templates; **EPIC-018** | Template change + back-fill across 18 epic specs. 🔵 **Scoped by D-16 (2026-08-04)** — the enhancement model's 21-section structure does **not** bear on this; it governs product outputs only. D-4 remains a repository-only question, now owned by EPIC-018 `FR-RGP-010`/`FR-RGP-011` |
| **D-5** | Convert `SRS/` to Markdown, per standard §7 **and PP-011**? | SRS itself | A new Epic — previously rejected scope, now mandated by **two** governing documents |
| ~~**D-6**~~ | ~~Do principles bind Phase 1 or the programme?~~ | — | ✅ **DECIDED 2026-08-03** — programme-wide, with a mandatory per-Epic deferral register. C-07 and C-09 resolved; template and both Epic specs updated |
| ~~**D-7**~~ | ~~Observability into EPIC-001?~~ | — | ✅ **DECIDED — adopted.** New function **F-00.5**; sits in PMI-PLAN-001's *Infrastructure — Proceed* lane, so it lands inside the proceeding slice |
| ~~**D-8**~~ | ~~API versioning for PP-012?~~ | — | ✅ **DECIDED — adopted.** `/v1` prefix plus a compatibility policy in `contracts/platform-api.md` |
| **D-9** | Namespace Epic task IDs (`E1-T001`) to end the `T-001`/`T001` collision? | C-10, C-17 | 🟠 Open by design — **fold into the D-1 pass** so 201 tasks are touched once, not twice |
| ~~**D-10**~~ | ~~Continue, pause, or split?~~ | — | ✅ **DECIDED 2026-08-03** — **Option C, split.** 66 tasks proceed (engine + sandbox + foundation); 135 held pending `PMI-DOC-004` BRS and scope approval |
| ~~**D-11**~~ | ~~ADR repository?~~ | — | ✅ **DECIDED — created.** `adr/` with ADR-0001 to ADR-0005, back-filled from existing research and decisions |
| ~~**D-12**~~ | ~~Which document is authoritative?~~ | — | ✅ **DECIDED — layered by subject matter.** MPS = product content; PMI-DOC-000 = documentation standards; PMI-DOC-003 = principles; PMI-PLAN-001/TASK-001 = sequencing |
| ~~**D-13**~~ | ~~Re-cut onto 18 modules now?~~ | — | ✅ **DECIDED — wait.** The MPS taxonomy supersedes D-3, but application is deferred until an MPS baseline. Re-cut once, folding in D-1 and D-9 |
| ~~**D-14**~~ | ~~Adopt the 6-state specification lifecycle?~~ | — | ✅ **DECIDED — adopted.** FR-011/FR-011a, `data-model.md`, `schema.sql`, T099/T106/T111/T111a |
| ~~**D-16**~~ | ~~Does the enhancement model override PMI-DOC-000?~~ | — | ✅ **DECIDED 2026-08-04 — layered by artifact population.** PMI-DOC-000 governs repository documents; the enhancement model governs PMI Studio's product outputs. C-18 resolved; no existing specification rendered non-conformant. D-2 and D-4 scoped, not closed |
| ~~**D-17**~~ | ~~One epic or two for the enhancement model?~~ | — | ✅ **DECIDED 2026-08-04 — two.** EPIC-017 keeps product capability (⏸ held); **EPIC-018 Repository Governance Process** takes the process half (▶ proceeding). Same seam as EPIC-003/EPIC-013 |
| ~~**D-18**~~ | ~~One epic or four for the enhancement model's product half?~~ | — | ✅ **DECIDED 2026-08-04 — four.** EPIC-017 becomes a parent design with no tasks; EPIC-019/020/021/022 deliver, 87 tasks (T225–T311). EPIC-019 must land first. EPIC-022 kept as a fold candidate into EPIC-011 |
| ~~**D-19**~~ | ~~One epic or three for EPIC-002?~~ | — | ✅ **DECIDED 2026-08-07 — three.** EPIC-002 becomes a parent design with no tasks; EPIC-023/024/025 deliver, 101 tasks. Order is EPIC-023 → 024 → 025, as numbered. Surfaced **G-02F.1**: the C-01 identifier collision extends to success criteria |

> **`D-20` to `D-41` are in [Part 8](#part-8--the-ai-native-amendment-c-19-to-c-26-d-20-to-d-41-2026-08-13)**,
> not in the table above. They arrived as one batch from the AI-native amendment and are recorded
> together with the conflicts that raised them; splitting them across two tables would make the
> largest of them — `D-31`, which commits the product to multi-tenant SaaS — findable only by
> reading both. Twelve are decided, nine open, one subsumed.

**Recommended order**: ~~D-3~~ ✅ done. Then **D-6 first among the rest** — it is a single ruling
that resolves C-07 and C-09 at once and determines whether D-7 is even in scope. Then D-1 and D-2
together (one coherent change), then D-7, D-8, D-4, and D-5 as its own Epic.

### What unblocks the held 135

Both are PMI-TASK-001 Phase 2 tasks, and both belong to the project owner:

| Blocker | PMI-TASK-001 | Status |
|---|---|---|
| `PMI-DOC-004` Business Requirement Specification | T-101 | ❌ Cited by three governing documents; does not exist |
| Business scope approved | T-106 | ❌ Charter still `Draft` |

Until both land, the held work stays held. Tracked as RAID dependency **D-K**.

**My recommendation on D-6**: principles bind the **programme**, with each Epic required to state
which principles it defers and why. A principle set that binds every Epic individually would make
EPIC-001 undeliverable — PP-013, PP-019, and PP-007 all require modules two phases out. Making
deferrals explicit and reviewable preserves the principles' force without making the first Epic
impossible.

**Recommended timing**: before `/speckit-implement`. Renumbering 74 requirements across finished
code is far more expensive than across specs.

## Immediate actions taken

- Both Epic specs' SRS Traceability tables updated to cite the new governing documents
- No requirement was renumbered, no template amended, no constitution changed — all await decisions
  above

## Part 8 — The AI-native amendment (C-19 to C-26, D-20 to D-41, 2026-08-13)

Four documents arrived in `SRS/August112026/` on 2026-08-11/12/13 — a Plan Amendment, a Native
Spec-Kit Execution Environment architecture, a recommended lifecycle, and a defect-management
workflow. Together they restate what PMI Studio *is*: an AI-native engineering operating system that
owns workflow, governance, context and evidence, and integrates commodity execution.

Reconciled as **EPIC-027**, which is analysis-only and builds nothing. The design that follows from
these decisions lives in [`_shared/ai-native-architecture.md`](_shared/ai-native-architecture.md);
the decisions themselves live here, with `C-01`–`C-18` and `D-1`–`D-19`, because that is where this
repository has always kept them.

**The amendment is explicitly evolutionary.** Plan Amendment §Purpose: *"Do NOT redesign PMI Studio
from scratch."* §19: *"This amendment is evolutionary, not a product reset."* Native §28: *"MUST NOT
invalidate already implemented EPIC-001 functionality without explicit justification."* Constitution
II makes those binding. The "start over" question was therefore answered by the source, not by
preference.

### Two premises verified rather than accepted

**Finding A — three of the "existing" Rooms were never specified.** The amendment says *"maintain
and enhance the existing Change Room"* and *"the existing Defect Room"*. Searching every epic
specification except EPIC-027's own, on 2026-08-13:

| Concept | Occurrences in `specs/*/spec.md` |
|---|---|
| Change Room · Defect Room · Requirement Room · Decision Room | **0 each** |
| Agent Gateway · Integration Hub · Context Engine · Evidence Package | **0 each** |
| "change request" (any casing) | **0** |

The word *defect* appears in all 26 specs, but always as the Constitution VI obligation that
`specs/<epic>/defects/` hold no open records — a repository process convention, not a product Defect
Room. **These are builds, not enhancements**, and the difference is a programme-sized estimate.
Settled by `D-32`.

**Finding B — EPIC-007 is a name collision.** `specs/007-requirement-intelligence/spec.md` states
its own scope plainly: *"AI-assisted analysis (REG) is Phase 2 and out of scope."* It owns six CRUD
requirements. The amendment's Requirement Intelligence Engine — ambiguity detection, options,
trade-offs, MoSCoW/WSJF, a twelve-state machine, baselines and a Decision Room — is a different and
far larger capability that happens to share a name. Settled by `D-33`.

### New conflicts

| # | Conflict | Severity | Resolved by |
|---|---|---|---|
| **C-19** | Engine independence is enforced by a build-time test; **agent independence is not**. `engine-adapters/speckit` names `claude` in four places and takes one `aiProviderToken`, so swapping the AI provider and swapping the specification engine are the same edit — the merge Native §3 forbids | 🔴 CRITICAL | ✅ `D-20` |
| **C-20** | `T447` — the next task in the programme — was about to hard-code Docker as the execution substrate, which Native §4 forbids | 🔴 CRITICAL | ✅ `D-21` |
| **C-21** | Persistent project state has no home; the current design destroys the workspace by design and never commits it | 🟠 HIGH | ✅ `D-22` |
| **C-22** | The egress allow-list (*"AI provider endpoint only"*, `ADR-0002`, asserted by test) makes implementation agents impossible. The amendment's only direct conflict with a **built and tested** control | 🟠 HIGH | ✅ `D-28` |
| **C-23** | Two sources of truth: the same specification would exist as a PostgreSQL row and as tracked markdown. Native §6 names the hazard; §22 proposes a boundary and leaves the rules undefined | 🔴 CRITICAL | ✅ `D-29` |
| **C-24** | Native §20's `waiting_for_approval` state cannot live in a BullMQ job without destroying timeout semantics and occupying worker slots indefinitely | 🟠 HIGH | ✅ `D-25` |
| **C-25** | MCP was deferred to M-09 Phase 3 as a *marketplace*; the amendment makes it the agent's least-privilege access path to governed context | 🟠 HIGH | ✅ `D-26` |
| **C-26** | §1's target market (*"organizations without dedicated internal developer-platform teams"*) implies SaaS hosting, which the corpus deliberately never decided | 🟠 HIGH | ✅ `D-31` |

**`C-07` is narrowed, not reversed**, by `D-26`. **`ADR-0002` is extended, not superseded**, by
`D-28` and `D-36`. **`PC-1` is vindicated**: MCP is a second transport over services that are already
transport-independent and tested as such, which is the condition on which `C-07`'s deferral was
accepted in the first place.
### The consolidated register

Twenty-two raised, grouped by what they gate. `D-20` onward continues the numbering of the
*Decisions required* table above; `C-19` onward continues `C-01`–`C-18`. **None can be resolved by
reading the SRS.**

**Status: 14 decided, 7 open, 1 subsumed.** 12 taken in the planning session of 2026-08-13; `D-35`
and `D-40` added by the clarification session of 2026-08-14. Every decided row is struck through
with its outcome; consequences are recorded in the section that follows the register. Two decisions
were *created* by other decisions — `D-40` and `D-41` — which is why the count grew.

**Still open**: `D-23`, `D-24`, `D-30`, `D-34`, `D-36`, `D-37`, `D-39`. None blocks EPIC-027's task
generation or EPIC-028's implementation, and each carries a recommendation. `D-36` is effectively
settled by `D-28` — `ADR-0002` is extended — and needs only to be recorded as such.

**Verified 2026-08-13**: the premise search behind `D-32` was re-run for this plan, excluding
EPIC-027's own spec. All nine terms — Change Room, Defect Room, Requirement Room, Decision Room,
Agent Gateway, Integration Hub, Context Engine, Evidence Package, change request — return **zero**
across the other 26 epic specifications. Finding A holds.

### Gate 1 — blocks the next task in the programme

| # | Decision | Why now | Outcome |
|---|---|---|---|
| ~~**D-21**~~ | ~~Is `T447` a Docker runtime, or a `ProjectExecutionEnvironment` with a Docker provider?~~ | `T447` is the next recommended task; deciding after it lands means refactoring the one component that cannot be tested without Docker | ✅ **DECIDED 2026-08-13 — PEE with a Docker provider.** `ContainerRuntime` widens per [contracts/project-execution-environment.md](027-ai-native-amendment/contracts/project-execution-environment.md); Docker registers at the worker composition root. Docker remains the Phase 1 provider per Native §4 |
| ~~**D-20**~~ | ~~Introduce `packages/agent-contract` + `agent-independence.spec.ts` now, or defer?~~ | The violation exists today and is invisible; the adapter is one file with 65 tests and no dependants | ✅ **DECIDED 2026-08-13 — now.** Contract, architecture test and fixture agent land together; `SpecKitEngine` takes an injected agent instead of naming `claude`. `C-19` closes on delivery |
| ~~**D-28**~~ | ~~Per-purpose `EgressPolicy` profiles, or one allow-list?~~ | Implementation agents cannot run a build under the current policy; `ADR-0002` is built and tested | ✅ **DECIDED 2026-08-13 — named profiles, proxy-enforced.** `generation` unchanged including its test; `implementation` explicitly enumerated. `ADR-0002` extended, not superseded (`D-36` follows) |

### Gate 2 — architecture, decidable now

| # | Decision | Recommendation |
|---|---|---|
| ~~**D-22**~~ | ~~Where does persistent project state live?~~ | ✅ **DECIDED 2026-08-13 — the git remote is the durable substrate.** Volumes are cache only and always reconstructible |
| ~~**D-25**~~ | ~~Do human-approval states live in BullMQ or a database state machine?~~ | ✅ **DECIDED 2026-08-13 — database machine; the queue serves compute segments.** A run suspends by *completing* its queue job. Temporal recorded as the rejected alternative with its trigger |
| ~~**D-27**~~ | ~~Credential model for agents that push code~~ | ✅ **DECIDED 2026-08-13 — per-run minted, purpose-scoped, short-lived.** No long-lived secret ever enters a sandbox; broker abstracted. BYOK was not bundled here and was taken separately as `D-41` |
| ~~**D-29**~~ | ~~Source-of-truth rule between PostgreSQL and repository markdown~~ | ✅ **DECIDED 2026-08-13 — Postgres authoritative; markdown is a one-way projection.** An agent editing markdown produces a proposal, never a fact |
| **D-30** | Is the AI Gateway native or integrated? | Split: agent layer native, model routing integrable |
| **D-24** | Adopt `pgvector` for similarity? | Yes, when the first similarity requirement is planned — not before |

### Gate 3 — programme shape

| # | Decision | Recommendation |
|---|---|---|
| ~~**D-31**~~ | ~~Is PMI Studio SaaS-hosted, self-hosted, or both?~~ | ✅ **DECIDED 2026-08-13 — multi-tenant SaaS first.** Consequences below |
| ~~**D-32**~~ | ~~Are the three Rooms new capability or enhancements? (Finding A)~~ | ✅ **DECIDED 2026-08-13 — new capability.** Sized as builds. `D-33` (EPIC-007) deliberately left separate and still open |
| ~~**D-33**~~ | ~~Does the Requirement Intelligence Engine belong to EPIC-007, or a new epic? (Finding B)~~ | ✅ **DECIDED 2026-08-13 — new epic.** EPIC-007 keeps `EPIC-007`, its name, and its current register-only scope. No renumbering, no mid-programme re-scope. The collision is documented so it cannot be rediscovered as a surprise |
| ~~**D-26**~~ | ~~Does MCP move from M-09 Phase 3 to core agent enablement?~~ | ✅ **DECIDED 2026-08-13 — split.** The agent-facing least-privilege context surface joins core agent enablement; discovery, third-party servers and the marketplace stay at M-09 Phase 3. `C-25` closes; `C-07`'s deferral is *narrowed*, not reversed |
| **D-23** | Does the amendment trigger the deferred 18-module re-cut (`D-13`)? | No. Record the dependency; re-cut once, folding in `D-1` and `D-9` |
| **D-34** | Does the amendment release any part of the `PMI-DOC-004` hold? | **No.** The amendment is architecture and positioning, not a BRS |
| ~~**D-40**~~ | ~~Does **self-hosted** remain a supported deployment?~~ *(created by `D-31`)* | ✅ **DECIDED 2026-08-14 — out of scope now, seams kept abstracted.** Do not build, test or claim self-hosted; keep the credential broker and egress enforcement behind ports. EPIC-028 is building those ports regardless, so the option costs almost nothing to preserve |

### Gate 4 — governance and record-keeping

| # | Decision | Recommendation |
|---|---|---|
| ~~**D-35**~~ | ~~Are the twelve Native §27 ADRs created now, or when each is decided?~~ | ✅ **DECIDED 2026-08-14 — all twelve now.** Each either decided or explicitly `open` naming what it awaits; seven are decidable immediately from the 2026-08-13 session. Native §26 forbids answering by assumption, and an ADR that exists as an open question is what prevents one |
| **D-36** | Does `ADR-0002` get extended or superseded by the egress change? | Extended. Native §27: *"Preserve existing ADRs unless explicitly superseded with documented reasoning"* |
| **D-37** | Does the Human/AI responsibility model become a platform-wide register in `_shared/`? | Yes — it is cross-cutting and belongs where the principle register already lives |
| ~~**D-38**~~ | ~~Is RAID **R-02** (AI cost) re-scored now?~~ | ✅ **Subsumed by `D-41`.** Re-scored, and mitigated structurally rather than by caps alone |
| ~~**D-41**~~ | ~~SaaS + no BYOK leaves model spend unbounded on PMI Studio's account~~ | ✅ **DECIDED 2026-08-13 — BYOK becomes a near-term requirement.** Tenant-owned AI provider keys; repository access stays per-run minted (`D-27`). Removes the exposure structurally |
| **D-39** | Should EPIC-018 gain a check comparing branch name to working epic? | Yes — the Constitution VIII lapse has now occurred three times and `G-08` structurally cannot catch it |

---

### Decisions taken 2026-08-13, and what they change

Four decided in the planning session. Each is recorded here with its consequences, because three of
them change other open decisions rather than merely closing themselves.

### D-21 · `T447` becomes a `ProjectExecutionEnvironment` with a Docker provider ✅

**Closes `C-20`.** The port widens per
[contracts/project-execution-environment.md](027-ai-native-amendment/contracts/project-execution-environment.md); Docker
registers at the worker composition root exactly as engine adapters already do. Docker remains the
Phase 1 provider, which is what Native §4 asks for.

**Consequences**:
- `T447`'s scope grows by roughly one task. It is no longer "write a Docker driver" but "widen the
  port, then write a Docker provider behind it".
- The new dependency rule — *no component reaches a container runtime directly* — becomes assertable,
  and belongs in the same architecture test as `D-20`'s.
- A `PreservedElementChange` row is now **required** for "Docker isolation" (`FR-AMD-015`), carrying
  all five §28 fields. It is a widening, not a weakening, and the row must say so.
- `D-22` (where persistent state lives) is now **downstream of a committed port** rather than an open
  architectural direction, which narrows it usefully.

### D-20 · The agent contract lands now ✅

**Closes `C-19`.** `packages/agent-contract`, `agent-adapters/fixture`, an injected agent in
`SpecKitEngine`, and `backend/tests/architecture/agent-independence.spec.ts`.

**Consequences**:
- `--integration claude` becomes `--integration <agent.specKitIntegrationName>`; the four hardcoded
  `'claude'` strings leave the engine adapter.
- `aiProviderToken` stops being a single opaque secret and becomes a credential resolved per agent —
  which makes `D-27` more urgent, not less.
- **`R-AI-001`/`R-AI-002`/`R-AI-005` still gate the real Claude and Cursor adapters.** The contract
  is provider-neutral by construction and does not wait on them; the adapters do. This is the split
  the second option in the question offered, and the recommendation absorbs it: land the boundary,
  defer the vendor work.
- The conformance suite must carry the already-aborted-signal and hung-step cases from day one
  (`R-AI-012`) — both are defects this programme has already shipped once.

### D-31 · Multi-tenant SaaS first 🔴 the largest change in this session

**Closes `C-26`**, and it is the decision with the widest blast radius. Recorded consequences:

| Area | What changes |
|---|---|
| **Credentials (`D-27`)** | Escalates from important to **blocking**. In SaaS, PMI Studio holds customer AI provider credentials and mints repository tokens on their behalf. "Secrets are an environment concern" is now definitively dead. BYOK (Native §8) moves from nice-to-have to a market requirement |
| **Egress (`D-28`)** | Becomes a **tenant-isolation control**, not just a sandbox hygiene control. A shared sandbox host means one tenant's agent must not reach another tenant's anything. Strengthens the case for named profiles and for proxy-based enforcement |
| **Tenancy** | ✅ **Already correct.** `workspace_id` on every row from the first migration, and EPIC-019 F-17.1 already adds a tenancy scope above workspace. The 2026-08-02 decision to be "multi-tenant-ready on a single-user surface" is vindicated — this is the decision it was hedging against |
| **Cost (`D-38`)** | Escalates sharply. In SaaS **you** pay for agent execution until per-tenant attribution exists. PP-017's optimisation half is deferred to M-07; the containment half (per-job caps) is now the only thing between the platform and an unbounded bill. **RAID R-02 must be re-scored, and this is the third epic to say so** |
| **Execution substrate (`D-21`)** | Unchanged for Phase 1, but the second provider is now near-certainly Kubernetes rather than a developer's Docker host. The port decision looks better in hindsight than it did an hour ago |
| **`ADR-0002`** | Its threat model widens from "the agent is untrusted" to "the agent is untrusted **and** the neighbouring tenant is untrusted". Extension, not supersession — but the reasoning changes |
| **Positioning** | §1 and §15 are now internally consistent with the architecture. An organisation without a platform team can use the product without operating it, which was the promise |

**New open question this creates**: does self-hosted remain a supported deployment at all, or is it
explicitly out of scope for now? Recorded as **`D-40`** — the answer changes how much of the
credential and egress work must be abstracted versus simply built for one environment.

### D-32 · The three Rooms are new capability, not enhancements ✅

**Resolves the amendment's false premise.** They are sized as builds. The evidence is recorded in
`premises.md` and re-verified for this plan: zero occurrences across all 26 other epic specs.

**Consequences**:
- The Rooms' epics are new epics, and they are **held** behind `PMI-DOC-004` — which is right, since
  the BRS is precisely the document that should settle requirement-approval behaviour.
- **`D-33` is deliberately still open.** The combined option was offered and not taken, so EPIC-007's
  fate is a separate decision rather than a side effect of this one. Recorded rather than assumed.
- `FR-AMD-006` and `SC-AMD-005` are satisfied for these eight capabilities: the claim was verified
  against the corpus, and the evidence — query, count, locations — is recorded rather than asserted.

### D-29 · PostgreSQL authoritative; markdown is a one-way projection ✅

**Closes `C-23`, the deepest design question in the amendment.**

```text
Postgres  ──regenerate──►  specs/*.md        Git owns implementation history.
     ▲                          │            Markdown is never merged back directly.
     │                          │ agent edits
  governed                      ▼
  transition   ◄──review──  proposal / diff
```

**Consequences**:
- Native §22's ruling is adopted verbatim: agent workspace and AI conversation are **not
  authoritative**, and generated output becomes authoritative only through a governed lifecycle
  transition.
- The `specs/` tree in a project execution environment is **read-mostly for agents**. An agent that
  edits a specification produces a diff for review, not a change.
- **Accepted cost, stated plainly**: the repository tree can visibly drift from the database between
  regenerations. Engineers will occasionally read a stale spec in the repo. The alternative — git
  authoritative for content — was rejected because approval state would then point at content the
  governance store does not hold, and "what was approved" must be answerable from one place.
- `R-AI-006` (Spec Kit's behaviour in persistent repositories) is now **narrower**: it no longer has
  to settle authority, only concurrency and cancellation mechanics.
- This decision makes `D-22` (where persistent state lives) largely a storage question rather than a
  governance one.

### D-27 · Per-run minted, purpose-scoped, short-lived credentials ✅

**No long-lived secret ever enters a sandbox.** A broker mints a token per run, scoped to one
repository and one branch, expiring with the run. The backing store — cloud KMS, Vault, or otherwise
— stays an operational choice behind an abstraction, consistent with PP-015.

**Consequences**:
- `aiProviderToken` as a single opaque string in `SpecKitAdapterOptions` is superseded by
  `ScopedCredentialRef[]` on the execution request. This is a `PreservedElementChange` candidate and
  needs its five §28 fields.
- **BYOK was deliberately not bundled into this decision**, so that repository delegation and model-
  spend ownership were decided on their own merits. It was raised immediately as **`D-41`** and
  adopted there. The two credential models coexist: delegation for repositories, ownership for spend.
- `R-AI-011` (secure git credential delegation) is the research item this decision depends on and it
  is **uninvestigated**. The decision names the model; the mechanism still has to be verified against
  what GitHub, GitLab and Bitbucket actually support.

### D-28 · Named egress profiles, proxy-enforced ✅

`generation` keeps today's policy **and today's test, unchanged**. `implementation` is a new,
explicitly enumerated profile. Enforcement is an auditing proxy, so the policy is auditable rather
than merely configured — which matters more under `D-31` because the sandbox host is now shared
between tenants.

**Consequences**:
- `ADR-0002` is **extended** with a recorded rationale, never superseded (`D-36` now has an obvious
  answer).
- A proxy is a new operational component. That is a real cost of this choice and it lands on the
  SaaS platform, not on a customer.
- The concrete destination list stays open (`R-AI-009`) — registry hostnames vary by ecosystem and
  by mirror, and guessing them produces an allow-list that fails in production.

### D-41 · BYOK becomes a near-term requirement ✅

**Closes the exposure `D-31` created.** Tenant-owned AI provider keys mean model spend lands on the
tenant's account. Repository access stays per-run minted (`D-27`); the two credential models coexist
because they solve different problems — delegation for repositories, ownership for model spend.

**Consequences**:
- Native §8's *"organization-managed credentials, BYOK, provider API credentials, cloud-provider-
  hosted models, enterprise AI gateways"* moves from an architectural aspiration to a near-term
  requirement.
- **RAID `R-02` is re-scored down**, not merely re-raised. Three epics have now flagged it; this is
  the first mitigation that is structural rather than a cap.
- `PP-017`'s optimisation half stays deferred to M-07, and that deferral is now *safe* — the platform
  is no longer paying for the optimisation it has not built.
- **Onboarding friction is the accepted cost.** A tenant must supply a key before running an agent.
  Whether a managed-key tier exists for self-serve is a product decision, not an architectural one.

### D-25 · Database run state machine; the queue serves compute segments ✅

**Closes `C-24`.**

```text
queued ─► provisioning ─► running ──┬──► validating ─► succeeded
                                    │
                                    └──► waiting_for_approval   [queue job ENDS]
                                                │
                                          approval event
                                                │
                                          new queue job ─► running
```

**Consequences**:
- BullMQ is preserved exactly as Native §28 requires, and its timeout semantics stay meaningful —
  wall-clock applies per compute segment, which is the only place it means anything.
- Restart-safety and idempotency (both §20 requirements) come free: resumption reads persisted state
  rather than in-memory continuation.
- `GenerationJob` → `AgentRun` is now a **schema** change with defined transition ownership, which is
  what §20 demands before adding states. It lands in EPIC-012 and stays held.
- **Temporal is rejected with a recorded trigger**: revisit when more than one capability needs
  multi-step compensation, or when run duration routinely exceeds a day. Under `D-31` it would also
  be a service PMI Studio operates, which raises its cost.
- Native §24's single correlation identifier must now span **multiple queue jobs** for one logical
  run. That is a real complication and it is the price of the choice — recorded, not hidden.

### D-26 · MCP splits — agent-facing core, marketplace stays at M-09 ✅

**Closes `C-25`, and narrows `C-07` rather than reversing it.**

| Moves to core agent enablement | Stays at M-09 Phase 3 |
|---|---|
| `getAllowedContext`, `getRequirement`, `getSpecification`, `getTask`, `getTraceability` | Third-party MCP server registration |
| `submitImplementationResult`, `submitTestEvidence`, `reportDefect`, `proposeChangeRequest` | Discovery and catalogue |
| The least-privilege authorization model (`R-AI-014`) | Marketplace surface and monetisation |

**Consequences**:
- **`PC-1` is vindicated.** MCP is a second transport over services that are already transport-
  independent and tested as such. C-07's deferral was accepted *on that condition*, and the condition
  held — this is the moment it paid.
- `R-AI-014` (least-privilege MCP authorization) moves from a Phase 3 research item to a near-term
  blocker, because the agent-facing surface cannot ship without it.
- `ContextScope` and `AccessSnapshot` become near-term entities, and `AccessSnapshot` already exists
  for EPIC-024. Reuse, not invention (`FR-AMD-003`).

### D-22 · The git remote is the durable substrate ✅

Volumes are cache only and always reconstructible. **No new storage tier to operate, back up, or
isolate per tenant** — which matters more under `D-31` than it would have yesterday.

**Consequences**:
- Consistent with `D-29`: git owns implementation history; Postgres owns governance state; neither
  gains a third competitor.
- **Accepted cost**: every run pays clone or fetch time. Mitigated by caching, never by treating the
  cache as authoritative — which is Native §5's invariant restated as an operational rule.
- `PersistentProjectState` is therefore a *reference plus cache policy*, not a storage entity. That
  is a materially smaller build than a managed workspace tier.
- `R-AI-007` (preserving Spec Kit state between runs) narrows to a real question: **what part of
  `.specify/` must be committed rather than cached?** Feature numbering and `feature.json` are the
  obvious candidates, and they are already committed in this repository.

### D-33 · EPIC-007 keeps its identifier and its scope ✅

**Closes Finding B.** The amendment's Requirement Intelligence Engine becomes a new, held epic.
EPIC-007 remains the requirement register — *"structured records with history and retirement, not a
wall of prose"* — with AI analysis still explicitly out of scope.

**Consequence**: the name collision is now documented rather than latent. Both scopes are stated in
the register, which is what stops two teams believing one epic covers both.
