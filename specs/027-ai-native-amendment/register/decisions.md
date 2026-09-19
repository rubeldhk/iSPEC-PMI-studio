# Register: Decisions

**Epic**: `EPIC-027` | **Schema**: [../contracts/reconciliation-register.md](../contracts/reconciliation-register.md)

Conflicts raised as decisions for a human (`FR-AMD-008`).

`options` is `label :: consequence` pairs separated by ` ;; `, **two or more**. A conflict recorded
without options is a conflict resolved silently by whoever wrote it down.

This register **cites** `srs-alignment.md` Part 8; it does not restate it (PP-002).

> **Generated projection**: `register.json` is built from this file by `pnpm register:build`.
> Never hand-edit the projection — `G-27-11` compares its digest to this file and fails on drift.

## Conflicts are decisions, not resolutions

`FR-AMD-008` requires every conflict raised as a decision **with options and the consequence of
each**, never resolved silently in favour of either side. `G-27-10` asserts two or more options per
decision and a consequence on each, because one option is a conclusion wearing a decision's clothes.

Rows prefixed `C-`, `FINDING-` and `DOC-CONFLICT-` are conflicts; rows prefixed `D-` are the open
decisions carried forward from [`srs-alignment.md`](../../srs-alignment.md) Part 8.

**This register cites Part 8; it does not restate it** (PP-002). That register has held `C-01`..`C-29`
and `D-1`..`D-42` since 2026-08-02 and is where this repository keeps its decisions. A second copy
would be a second answer to "what was decided".

## Seven decisions remain open, and none blocks this epic

`D-23`, `D-24`, `D-30`, `D-34`, `D-36`, `D-37`, `D-39` — each carries a recommendation. `D-36` is
effectively settled by `D-28` and needs only to be recorded as such.

Two further open rows are this epic's own findings: **`UNOWNED-1`** (three capability areas with no
epic) and **`UNOWNED-2`** (four decided architectural components with no home — the SaaS substrate,
the egress proxy, the credential broker and BYOK). Both are `§18.25` material: decisions only a human
may take.

## No decision is decided on unanswered research

`G-27-10` asserts it directly. `C-19` cites `R-AI-008` and `C-20` cites `R-AI-010`, and both of those
research items are `answered` — EPIC-028 answered them by building. A decision citing an
uninvestigated item would fail the check, which is Native §26 made mechanical.

## Epic status changes

`FR-AMD-017` requires work in flight to continue unless a named clause conflicts with it. The table
below is **empty**, and `G-27-14` **blocks CI** if this epic's diff changes any other epic's
**Delivery posture** line without a matching row here.

Empty is the finding, not the absence of one: this reconciliation classified 599 clauses across
twenty capability areas and **changed no epic's posture**. The scope-creep concern the project owner
named is answered by a table with nothing in it.

## Epic status changes

| epic | from | to | reason | clause |
|---|---|---|---|---|

## Register

| id | question | options | recommendation | owner | status | blocking_research |
|---|---|---|---|---|---|---|
| D-23 | Does the amendment trigger the deferred 18-module re-cut (D-13)? | Re-cut now :: touches 729 tasks across 26 lists for a taxonomy change nothing currently blocks ;; Record the dependency and re-cut once, folding in D-1 and D-9 :: one pass over the corpus instead of three | Record the dependency; re-cut once | project-owner | open | — |
| D-24 | Adopt pgvector for similarity search? | Adopt now :: a database extension and an operational surface for a capability nothing yet requires ;; Adopt when the first similarity requirement is planned :: the Context Engine epic decides it with a real requirement in hand | Adopt when the first similarity requirement is planned | tech-lead | open | R-027-4 ; R-027-6 |
| D-30 | Is the AI Gateway native or integrated? | Fully native :: PMI Studio builds model routing, cost attribution and failover itself ;; Fully integrated :: an external gateway owns routing and PMI Studio loses per-tenant cost attribution ;; Split — agent layer native, model routing integrable :: keeps authorization and provenance native while leaving routing replaceable | Split: agent layer native, model routing integrable | tech-lead | open | R-AI-013 |
| D-34 | Does the amendment release any part of the PMI-DOC-004 hold? | Release the held epics the amendment touches :: 393 tasks proceed against business rules nobody approved ;; Hold stands :: the amendment is architecture and positioning, not a Business Requirement Specification | No — the hold stands | project-owner | open | — |
| D-36 | Is ADR-0002 extended or superseded by the egress change? | Superseded :: discards a built, tested and still-correct control to record one addition ;; Extended :: the generation profile and its test are unchanged, and the implementation profile is added beside them | Extended — effectively settled by D-28 | tech-lead | open | — |
| D-37 | Does the Human/AI responsibility model become a platform-wide register in _shared/? | Per-epic :: each epic restates the split, and they diverge at the first amendment ;; Platform-wide in _shared/ :: cross-cutting, and it belongs where the principle register already lives | Platform-wide in _shared/platform-spec.md | project-owner | open | R-027-8 |
| D-39 | Should EPIC-018 gain a check comparing branch name to working epic? | No :: G-08 already checks the format, and the lapse has now occurred seven times ;; Yes :: compare the branch to the epic being worked, which is what G-08 structurally cannot do | Yes — seven occurrences is enough | project-owner | open | — |
| C-19 | CONFLICT: engine independence is enforced by a build-time test; agent independence is not | Defer :: the violation stays invisible while every new adapter inherits it ;; Land the agent contract now :: one file, 65 tests, no dependants — the cheapest moment it will ever be | Land it now | tech-lead | decided | R-AI-008 |
| C-20 | CONFLICT: T646 was about to hard-code Docker as the execution substrate | Implement ContainerRuntime in the engine adapter :: makes Docker the abstraction, which Native section 4 forbids ;; Widen to ProjectExecutionEnvironment with a Docker provider :: Docker becomes Phase 1 provider behind a port | Widen the port | tech-lead | decided | R-AI-010 |
| C-22 | CONFLICT: the egress allow-list makes implementation agents impossible | Open general internet access :: Native section 19 forbids it outright ;; Named profiles, proxy-enforced :: generation stays frozen, implementation is explicitly enumerated | Named profiles | tech-lead | decided | — |
| C-23 | CONFLICT: two sources of truth between PostgreSQL and repository markdown | Git authoritative for content :: approval state would point at content the governance store does not hold ;; PostgreSQL authoritative, markdown a one-way projection :: the repo tree can visibly drift between regenerations | PostgreSQL authoritative | tech-lead | decided | — |
| C-26 | CONFLICT: the target market implies a hosting decision the corpus never made | Self-hosted first :: contradicts section 1 target market of organizations without platform teams ;; Multi-tenant SaaS first :: escalates credentials, egress and cost, and makes the second execution provider near-certainly Kubernetes | Multi-tenant SaaS first | project-owner | decided | — |
| FINDING-A | CONFLICT: the amendment calls the three Rooms existing and the corpus contains none of them | Treat as enhancements :: sizes three builds as modifications, a programme-level estimate error ;; Treat as new capability :: sized as builds, held behind PMI-DOC-004 which is the document that should settle them | New capability, sized as builds | project-owner | decided | — |
| FINDING-B | CONFLICT: EPIC-007 Requirement Intelligence is a name collision, not the amendment capability | Re-scope EPIC-007 to the amendment capability :: renumbering and re-scoping an epic mid-programme, and EPIC-007 owns six shipped CRUD requirements ;; EPIC-007 keeps its identifier and scope; the Engine becomes a new held epic :: the collision is documented rather than latent | EPIC-007 unchanged; new epic for the Engine | project-owner | decided | — |
| DOC-CONFLICT-1 | CONFLICT: the lifecycle document and Native section 17 disagree on a passing defect test | Follow the lifecycle document :: every passing reproduction test becomes a Change Request, which Native section 17 explicitly forbids ;; Follow Native section 17 and Defect section 7 :: a PASS routes to an evidence check first, because the test may simply be wrong | The later and more specific text governs — Native section 17 | tech-lead | decided | — |
| UNOWNED-1 | Who owns Governed Engineering Loops, Governed Learning and the Specification Compliance Agent? | Fold into existing held epics :: three genuinely new capabilities disappear into epics scoped before they existed ;; Create three new held epics when PMI-DOC-004 lands :: they stay visible as unowned until someone decides | Create new held epics; record as unowned until then | project-owner | open | — |
| UNOWNED-2 | Who owns the SaaS hosting substrate, the egress proxy and the credential broker? | Assign to EPIC-014 DevOps :: EPIC-014 is held, so a live architectural dependency would be parked ;; New infrastructure epic :: D-31, D-27, D-28 and D-41 are all decided and none has a home | New infrastructure epic — all four decisions are taken and unbuilt | project-owner | open | R-AI-009 ; R-AI-011 |
