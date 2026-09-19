# Quickstart Results — EPIC-027

**Task**: `T639` · **Run**: 2026-08-17 · `pnpm test:governance` — 354 passed, 23 files

All fourteen scenarios in [quickstart.md](./quickstart.md). Every one is automated, because this
epic's outputs are documents and Constitution V (v1.2.0) is satisfied for a document by an
**executable conformance check** rather than by a reading.

**154 of the 354 governance assertions belong to this epic**, across nine check files.

| Scenario | Proves | Check | Result |
|---|---|---|---|
| **V1** Every clause carries exactly one verdict | `SC-AMD-001` | `G-27-01` | ✅ **PASS** — 599 clauses, 599 verdicts, zero orphaned, zero doubled |
| **V2** No verdict is unattributed | `SC-AMD-002` | `G-27-02` | ✅ **PASS** — 341 name an existing artifact, 258 carry the explicit sentinel, zero blank |
| **V3** No identifier invented where one exists | `SC-AMD-003` | `G-27-03` | ✅ **PASS** — zero new product identifiers created |
| **V4** Every capability classified; nothing removed for being external | `SC-AMD-004` | `G-27-04` | ✅ **PASS** — 45 capabilities, `removed_because_external` false throughout |
| **V5** Finding A is evidenced, not asserted | `SC-AMD-005` | `G-27-05` | ✅ **PASS** — 20 premises with the query as run; two controls returning 27 and 2 |
| **V6** The impact report is complete | `SC-AMD-006` | `G-27-06` | ✅ **PASS** — 25 sections numbered 1–25, zero placeholders |
| **V7** ADR subjects registered | `SC-AMD-007` | `G-27-07` | ✅ **PASS** — **17**, not the 12 the scenario title says; eight decided, nine open |
| **V8** Research registered; no decision past an unanswered item | `SC-AMD-008` | `G-27-08` | ✅ **PASS** — 22 items, 9 uninvestigated and recorded as such |
| **V9** Zero product code changed | `SC-AMD-009` | `G-27-09` **blocks CI** | ⚠️ **PASS WITH ONE RECORDED EXCEPTION** — see below |
| **V10** Every conflict is a decision with options | `SC-AMD-012` | `G-27-10` | ✅ **PASS** — 17 decisions, ≥2 options each, consequence on every option |
| **V11** The projection matches its sources | `R-027-1` | `G-27-11` | ✅ **PASS** — digests match; regeneration reproduces the committed file byte for byte |
| **V12** Preserved elements carry the full five-field record | `FR-AMD-015` | `G-27-12` | ✅ **PASS** — 4 rows, all five fields non-empty |
| **V13** Twenty capability areas, enumerated and counted | `SC-AMD-011` | `G-27-13` | ✅ **PASS** — 20 rows, and the figure in `spec.md` now agrees |
| **V14** No epic's posture changed without a reason | `SC-AMD-010` | `G-27-14` **blocks CI** | ✅ **PASS** — `epic_status_changes` is empty |

## V7 — the scenario title is stale, and the check is right

`quickstart.md` still says *"Twelve ADR subjects registered"*. `D-42` raised the count to **seventeen**
on 2026-08-14 when the Cosmos amendment added five more, and `G-27-07` asserts seventeen.

Left as-is deliberately: the check is authoritative and the scenario title is prose. Recorded here so
a reader comparing the two is not left wondering which is wrong. It is the same drift `DEF-027-001`
found in `SC-AMD-011`, one document over — and this time the check already had the right number.

## V9 — the one exception, stated plainly

`G-27-09` passes **with a single recorded exception**: commit `f356ba3` created
`engine-adapters/fixture/src/fixture.adapter.ts`, a product source file, in this epic's first commit.

The file is legitimate and belongs to EPIC-003 `T465`; the attribution was wrong. Recorded as
[`DEF-027-002`](./defects/DEF-027-002-analysis-only-epic-shipped-product-code.md) and listed **inside
the check** rather than excluded by a date range, so it stays visible. A separate assertion fails if
the allowlist ever grows past one entry.

**`SC-AMD-009` is reported as satisfied-with-one-recorded-exception, never clean.**

## Mutation testing — five mutations, all caught

`T637` broke the register on purpose:

| Mutation | Caught by | Message |
|---|---|---|
| Delete one verdict row | `G-27-01` | named `CLA-300` as carrying no verdict |
| Duplicate a verdict row | `G-27-01` | named `CLA-001 (2)` as classified twice |
| Blank an owner | `G-27-02` | named `CLA-002`, and told the reader to use the sentinel |
| Edit a register source without rebuilding | `G-27-11` | named the stale file and the rebuild command |
| Remove the `G-27-09` exception | `G-27-09` | named the real product file |

Every one names the offending row rather than reporting a count, which is the difference between a
check that fails and a check that is actionable.

## What the checks cannot do — `T644`

The checks verify the register is **complete and internally consistent**. They cannot verify that a
clause marked *already covered* genuinely is. That is `T644`, a human read of ten clauses, and it
**found two wrong on the first pass** — see
[`DEF-027-003`](./defects/DEF-027-003-verdict-rules-misfire-on-keyword-overlap.md).

Both were rule misfires on keyword overlap, both passed every check, and both are fixed. Ten new
clauses were then sampled and all ten survived reading.
