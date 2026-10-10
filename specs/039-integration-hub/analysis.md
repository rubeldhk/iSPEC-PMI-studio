# EPIC-039 Integration Hub — cross-artifact analysis

**Date**: 2026-10-09 · **Command**: `/speckit-analyze` · **Artifacts**: `spec.md`, `plan.md`, `tasks.md`
(and `research.md`, `data-model.md`, `contracts/`) · **Non-destructive**: no artifact was changed by
this analysis.

> **I1 resolved 2026-10-09.** The Project Owner chose option (a): the `Embed` binding is deployment
> configuration recorded at boot (spec Clarifications, `FR-HUB-084`). data-model §8a, API §4a and
> `T2200`–`T2203` follow in the implementation's remediation step.

## Metrics

| Measure | Value |
|---|---|
| Functional requirements | 66 |
| Success criteria | 9 |
| Tasks | 142 (`T2100`–`T2241`); `T2242`–`T2299` free for remediation |
| Requirement coverage | 73 / 75 (97%) — `FR-HUB-015` and the `SC-HUB-008` measurement have no task |
| Findings | CRITICAL 0 · HIGH 1 · MEDIUM 6 · LOW 6 |
| Underspecified items | 2 |
| Duplications | 1 |
| Constitution MUST violations | none |
| Unmapped tasks | none |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
|---|---|---|---|---|---|
| I1 | Inconsistency | HIGH | `FR-HUB-084`, data-model §8a, API §4a, `T2200`–`T2203` | The `Embed` binding and credential are stored per workspace, but `HubEmbeddingPort` takes no workspace: with two workspaces there is no rule for which binding applies, and an editor in one workspace can change the model every workspace's index depends on | Single owner: (a) deployment configuration recorded at boot, or (b) a designated platform workspace. **Resolved: (a)** |
| U1 | Underspecification | MEDIUM | API §5, `R-039-12`, `T2149` | `caller` is client-declared, so any session can claim to be `evidence-intake` or `loop` | Accept only `room:*` callers over HTTP; derive the others from in-process calls |
| U2 | Underspecification | MEDIUM | `R-039-6`, data-model §5 | The health lease conflicts with the append-only health table and its required `state` | Insert the check row after the check with `ON CONFLICT DO NOTHING`, or add a claim table |
| C1 | Coverage | MEDIUM | `FR-HUB-015` | No task audits contract definitions or changes | Have the migration seed write audit rows, or declare git history the record and check it |
| C2 | Coverage | MEDIUM | `SC-HUB-008` | The five-minute target is never measured | Add a timed route test with an injected clock |
| C3 | Coverage | MEDIUM | `SC-HUB-001`, `T2161` | `Embed` has no caller-level suite run against both its adapters | Drive `HubEmbeddingPort` against both adapters now |
| C4 | Coverage | MEDIUM | `T2102`, `TS-001` | No task adds dependency-register rows for `fast-xml-parser` and `fflate` | Add a register task before `T2102` |
| C5 | Coverage | LOW | `FR-HUB-063` | No task cites `EPIC-028`'s agent seam as the evidence | Add the citation to `T2238` |
| C6 | Coverage | LOW | `FR-HUB-050` | Enforced only indirectly | Note in `T2152` that its provider-name rule covers it |
| I2 | Inconsistency | LOW | User Story 7/8 numbering | The screen story moved from US7 to US8 when `Embed` was added | Mention in the closing report |
| I3 | Inconsistency | LOW | `T2218`, `T2219`, `T2221` | Three tasks edit `EPIC-038`'s files | Name them in the closing report |
| D1 | Duplication | LOW | `T2232`, `T2240` | Overlap | Fold `T2240` into `T2232` |
| P1 | Constitution V | LOW | `T2213`, `T2237` | Neither names an executable test | Name the test file for each |

## Coverage

Every FR group is mapped to tasks. The evidence group (`FR-HUB-050`–`055`) and the `Embed` group
(`FR-HUB-080`–`087`) are blocked end to end on the `EPIC-032` and `EPIC-038` merges respectively.
Gaps: `FR-HUB-015` (C1) and the `SC-HUB-008` measurement (C2).

## Constitution alignment

No MUST violation. IX: the Delivery Board is declared stale. XII: partial for the commands that
produced this Epic's own artifacts — the programme-wide gap `EPIC-038` and `EPIC-047` recorded.

## Recommended next

No CRITICAL finding: Phases 1–3 (the MVP) may start. Resolve I1 before Phase 9 (done — option a),
and remediate C1–C4, U1 and U2 with tasks from `T2242`–`T2299`.
