# Analysis — EPIC-042 PMI Spec Kit Extension, Setup Skill and Constitution Sync

**Session**: 2026-09-04 · **Artifacts**: [spec.md](./spec.md) (clarified 2026-09-04) ·
[plan.md](./plan.md) · [tasks.md](./tasks.md) (`T1471`–`T1540`) · constitution v1.6.1

Read-only cross-artifact analysis (`FR-ESK-019`). Seven findings; none CRITICAL or HIGH.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage | MEDIUM | spec.md `SC-EXT-010`; tasks.md `T1523`, `T1537` | The setup skill's idempotency (*a second run on a green machine changes zero files*) has no task producing evidence: `T1523` checks the skill's text, `T1533`'s harness does not run the skill, and `T1537` names only the hook sequences | Extend `T1537` so the Tier 2 run records two consecutive `/setup-PMIStudio` runs on the reference-local stack — the table twice and a clean `git status` — in the transcript's second section, citing `SC-EXT-010` |
| C2 | Coverage | MEDIUM | spec.md `FR-EXT-070`, `FR-EXT-071`; tasks.md Phase Z | The `ADR-0030` amendment and the constitution `1.6.1` PATCH were written at the plan step, but no closure task confirms them the way `EPIC-043`'s `T1461` confirmed `ADR-0010` | Append `T1541` to Phase Z: confirm `adr/ADR-0030` carries the 2026-09-04 `EPIC-042` amendment and `.specify/memory/constitution.md` reads `1.6.1` with the Directory-contract sentence, recorded in `closure.md` |
| U1 | Underspecification | MEDIUM | spec.md `FR-EXT-004`; contracts/setup-skill.md §2 row 3 and row 5; tasks.md `T1523` | `FR-EXT-004` requires the setup skill to verify the pinned toolkit tag **satisfies the extension's `requires.speckit_version` range**; the contract's rows check the tag against `.pmi/project.json` and the extension against the reported version, but never the range, and `T1523` does not name it | Add to `contracts/setup-skill.md` row 5: *read `requires.speckit_version` from `extension.yml` and confirm the pinned tag satisfies it; report `refused` naming both when it does not*; add the same clause to `T1523` |
| I1 | Inconsistency | LOW | spec.md §Key Entities *Offline mode*; data-model.md §2 | The spec lists *Offline mode* as its own entity; the data model folds it into `decomposition_policies.offlineMode` per Assumption 3 (*beside the decomposition policy*, confirmed) | Terminology only. Note in data-model.md §2 that the spec's *Offline mode* entity is this column, so the two documents name one thing |
| I2 | Inconsistency | LOW | tasks.md `T1502`, `T1503` | The left-open recovery (`FR-EXT-018`) is a hook-sequence behaviour that lives in `begin.md` and the harness, yet `T1502` places its test under `backend/tests/unit/governance/`, where nothing of the backend implements it; `T1500` already asserts the same behaviour through the round trip | Retarget `T1502` to extend `backend/tests/integration/governed-command-roundtrip.spec.ts` (the left-open block) and pair `T1503` with it as an integration test |
| A1 | Ambiguity | LOW | spec.md `FR-EXT-042`; research.md `R-042-12` | *The begin hook MUST ask the agent for one estimate per Epic* is a prompt behaviour; the conformance test can only assert the step is present, and the harness supplies estimates. Accepted and stated in `R-042-12` | None beyond what `R-042-12` and the transcript already say; recorded so the limitation is visible to `DOR-09` |
| D1 | Dependency | LOW | plan.md §Technical Context; tasks.md `T1472` | `T1472` adds `yaml` as a **dev** dependency of `@pmi/workspace-bundle` for its tests; `specs/_shared/dependencies.md` treats runtime dependencies as plan decisions. This one is dev-only and named in the plan | None; recorded |

**Overflow**: none.

## Coverage Summary

Tasks cite research decisions (`R-042-n`) and contract sections rather than requirement ids;
coverage below is by concept, the way `EPIC-043`'s analysis mapped it.

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-EXT-001–006 (the extension) | Yes | T1494, T1495, T1496, T1497, T1498, T1499 | `FR-EXT-004`'s range check is `U1` |
| FR-EXT-010–018 (registration through the hooks) | Yes | T1495, T1500, T1501, T1502, T1503, T1530, T1531 | `FR-EXT-018` placement is `I2` |
| FR-EXT-020–028 (the generated constitution) | Yes | T1477, T1478, T1479–T1484, T1517, T1518, T1521, T1522 | |
| FR-EXT-030–038 (the setup skill) | Yes | T1523–T1528 | `SC-EXT-010` evidence is `C1` |
| FR-EXT-040–048 (first-run decomposition) | Yes | T1481, T1482, T1485, T1486, T1504–T1512 | |
| FR-EXT-050–056 (provisional operation) | Yes | T1529, T1530, T1531 | |
| FR-EXT-060–068 (reads, screens, records) | Yes | T1475, T1476, T1487–T1493, T1513–T1516, T1519, T1520 | |
| FR-EXT-070–071 (governance records) | Written at plan | — (closure confirmation missing: `C2`) | |
| SC-EXT-001 | Yes | T1498, T1538 | mutation |
| SC-EXT-002 | Yes | T1500, T1533 | |
| SC-EXT-003, SC-EXT-008 | Yes | T1509, T1510, T1533, T1537 | |
| SC-EXT-004 | Yes | T1517, T1519, T1538 | mutation |
| SC-EXT-005 | Yes | T1523, T1538 | mutation |
| SC-EXT-006, SC-EXT-007 | Yes | T1531, T1533 | |
| SC-EXT-009 | Yes | T1477, T1517, T1538 | mutation |
| SC-EXT-010 | Partial | T1523 | `C1` |
| US1/AC1–AC5 | Yes | T1494–T1503, T1531 | |
| US2/AC1–AC5 | Yes | T1504–T1512 | |
| US3/AC1–AC5 | Yes | T1513–T1522 | |
| US4/AC1–AC5 | Yes | T1523–T1528 | |
| US5/AC1–AC4 | Yes | T1529–T1531 | |

**Constitution Alignment Issues**: none. Gate XII is PARTIAL by design and justified in the
plan's Complexity Tracking (this Epic is the registration hook); Gate XI Tier 2 is honest about
prompts versus sequences (`R-042-12`). Gate I: the ADR amendment and the constitution PATCH were
made by the plan step as `FR-EXT-070`/`071` direct, the PATCH through `/speckit-constitution`.

**Unmapped Tasks**: none. Every task traces to a story phase, the setup/foundational scope, or
Phase Z.

**Metrics**

- Total Requirements: 60 functional (`FR-EXT-`), 10 success criteria, 24 acceptance scenarios
- Total Tasks: 70 (`T1471`–`T1540`)
- Coverage: 100% of functional requirements and acceptance scenarios have ≥ 1 task by concept;
  `SC-EXT-010` partial (`C1`)
- Ambiguity Count: 1 (`A1`, accepted)
- Duplication Count: 0
- Critical Issues Count: 0

## Remediation applied — 2026-09-04

*(recorded when the remediation is approved and applied)*
