# Cross-Artifact Analysis: Local Project Workspace (`EPIC-041`)

**Session**: 2026-09-03 · **Command**: `/speckit-analyze` · `FR-ESK-019`

Analysed `spec.md` (clarified 2026-09-03), `plan.md`, `tasks.md` (`T1310`–`T1382`) against each
other, against `research.md`, `data-model.md`, the three contracts and `quickstart.md`, and against
the constitution. Coverage was computed by extraction — every `FR-LPW-`/`SC-LPW-` identifier in the
spec compared against every identifier cited in `tasks.md` — and then read for meaning, because a
citation is not coverage and an uncited requirement may still be tested (`EPIC-038` `E3`).

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage gap | **HIGH** | `spec.md` `FR-LPW-040`, `FR-LPW-042`, `SC-LPW-008`; `tasks.md` Phase 2, Phase 6 | The persistence repair is tested at the unit level (`T1320`) and the restart test (`T1332`) creates tasks and a job **directly through the stores**. No task drives `POST /projects/:id/jobs/generate-specification` → queue → worker → persisted specification through the real route and the real `createGenerationWorker`. `SC-LPW-008` says *"through the real route, with zero hand-assembled composition"* and Constitution XI Tier 1 says a mocked collaborator does not satisfy it. This is milestone `M0`'s own proof, and it is missing | Add a failing integration test in Phase 2 — `backend/tests/integration/generation-persists-through-route.spec.ts` — that boots `AppModule`, runs the worker in-process with the real `JobPersistence` and the fixture engine, submits through the route, and reads the specification back after disposing and re-booting. Cite `SC-LPW-008` on it |
| C2 | Coverage gap | MEDIUM | `spec.md` `FR-LPW-028` (added at clarify); `tasks.md` `T1355`, `T1356` | The no-self-expiry rule has no assertion. `data-model.md` §3 says *"no `expiresAt` column"* and `T1355` asserts `revokedAt` semantics, but nothing asserts that verification never compares a time or that the record type has no expiry field. A requirement added by clarification with no task is the exact shape `EPIC-038` `E1` caught | Extend `T1355`: the stored type has no `expiresAt`; a credential minted with a mocked clock ninety days in the past still verifies. Cite `FR-LPW-028` |
| C3 | Coverage gap | MEDIUM | `spec.md` `FR-LPW-031`; `tasks.md` Phase 5 | *"No rule MAY be relaxed on the basis of mode"* and `contracts/local-fabric-mode.md` says assurance is *"recorded, never consulted by policy"* — but no task asserts that nothing reads `assurance` except the registry writer and the projection. A policy check that quietly branches on it would pass every Phase 5 test | Add an architecture assertion (in `T1364` or a new `assurance-is-not-policy.spec.ts`): under `backend/src/modules/{loop,policy,decisions,reviews}` the identifier `assurance` does not appear. Cite `FR-LPW-031` |
| C4 | Coverage gap | MEDIUM | `spec.md` `FR-LPW-006`; `contracts/project-files.md` §Directory; `tasks.md` `T1339`, `T1344` | *"Nothing in provisioning MAY name one integration as the only possibility."* The contract itself shows `.claude/skills/` for the setup skill and says the location *"follows the integration"*, but no artifact says **how**: there is no integration → skills-directory mapping in `data-model.md`, `research.md` or the bundle. `T1339` copies the skill somewhere; where, for `copilot`, is undefined | Add the mapping as configuration in `@pmi/workspace-bundle` (`skillsPathFor(integration)`), document it in `contracts/project-files.md`, assert in `T1316` that every integration `specify init` supports has a mapping or a stated refusal. Cite `FR-LPW-006` on `T1339` and `T1344` |
| C5 | Coverage gap | MEDIUM | `spec.md` `FR-LPW-011`; `tasks.md` `T1352` | *"Nothing in PMI Studio MAY be written back into the directory except the files `FR-LPW-002` names."* `T1352` reads back every written file for a credential pattern but does not assert that the **set** of files written equals the contract's enumeration. A future step that writes one more file would pass | Extend `T1352`: the set of paths written by the prepare step equals exactly the five the contract lists (plus `.git/` when initialised). Cite `FR-LPW-011` |
| U1 | Underspecification | MEDIUM | `spec.md` `FR-LPW-026`; `contracts/provisioning-api.md` §Authentication; `tasks.md` `T1359` | The guard returns `403` for *"an operation outside `FR-LPW-026`'s set"*, and `T1359` tests it — but the set is defined only as *"the operations later Epics bind to it"*. In this Epic that set is `{whoami}` and nothing says how `EPIC-043` extends it. A test against an undefined set tests whatever the implementer chose | Define a `ConnectorScope` registry in `connector-auth.guard.ts` (this Epic registers `whoami`; `EPIC-043` registers its routes) and state it in the contract. `T1359` asserts an unregistered route is `403` |
| U2 | Underspecification | MEDIUM | `contracts/project-files.md` §`.pmi/project.json`, §`.mcp.json`; `research.md` `R-041-10`; `tasks.md` `T1310`, `T1337` | Both files carry `PMI_STUDIO_URL` / `platformUrl` as *"the platform address"*. In the containerised stack the API cannot infer the address the **user's machine** reaches it at (`localhost:3000` from the host is not what the container sees). No configuration variable names it; `T1310`'s list has four variables and this is not one of them | Add `PMI_PUBLIC_URL` to configuration (`.env.example`, compose, `T1310`), default `http://localhost:${PMI_APP_PORT:-3000}`; the writers read it. Note it in `research.md` `R-041-2` |
| I1 | Inconsistency | MEDIUM | `tasks.md` `T1347`; `plan.md` Technical Context; `data-model.md` §1.1 | `PMI_INITIALISE_WAIT_MS` (default 30 s) appears **only** in `T1347`. The plan says *"within a bound"*, the data model says *"within the bound"*, `.env.example` and `T1310`'s conformance list do not know it. A configuration value that exists only in a task is one nobody will find | Name it in `plan.md` Technical Context and `data-model.md` §1.1; add it to `T1310` and `T1311` |
| I2 | Inconsistency | MEDIUM | `tasks.md` `T1352`; `plan.md` Testing; `vitest.workspace.ts` | `T1352` is placed under `tests/governance/` but *"provisions into a temp root through the service"* — importing a backend service into the governance vitest project, whose checks read files and never boot application code. `vitest-projects.spec.ts` and the project boundaries exist to keep that separation | Move the check to `backend/tests/contract/project-files.spec.ts` (it is a contract test of the files the platform emits), or keep it in governance and have it read fixture output produced by `T1351`. Either way the check still blocks CI |
| I3 | Inconsistency | MEDIUM | `tasks.md` Phase Z; `.specify/templates/tasks-template.md` Phase Z; `governance/document-structure.md` | Phase Z is written as obligations without task identifiers or checkboxes, deferring allocation to *"when Phase 8 completes"*. The template and every sibling Epic (`EPIC-038` `T1297`–`T1305`) pre-allocate closure tasks, and `/speckit-implement` executes checkboxes, not prose. The `DOR` checks pass today because they read the section heading, which is the reason this is not HIGH | Allocate `T1383`–`T1391` now, one per obligation, as checkboxes. Identifiers are cheap; a closure phase nothing can tick is not |
| T1 | Traceability | LOW | `tasks.md`, 4 success criteria | `SC-LPW-001` (`T1382`), `SC-LPW-002` (`T1343`, `T1351`), `SC-LPW-005` (`T1339`, `T1351`) are **covered but not cited by identifier**; `SC-LPW-008` is `C1` | Cite each where it is proved |
| T2 | Terminology | LOW | `spec.md`, `contracts/`, `tasks.md` vs PMI-DOC-007 §3, `.mcp.json` env name | *Connector credential* (this Epic) versus *connector token* (`ConnectorToken` in PMI-DOC-007 §3; `PMI_STUDIO_TOKEN`; the `pmi_ct_` prefix reads *connector token*). Two names for one thing | Keep *connector credential* as the canonical term in this Epic's artifacts; keep `PMI_STUDIO_TOKEN` and `pmi_ct_` as the wire names and say so once in `contracts/provisioning-api.md` |
| T3 | Traceability | LOW | `tasks.md` `T1376` | Mounting four components on `Specification.tsx` carries its test inside the implementation task (*"extend `Specification.spec.tsx`"*) rather than as a separate failing-first task, unlike every other pair in the file | Split the test into its own `[P]` task preceding `T1376` |
| K1 | Constitution | MEDIUM | `plan.md` Gate XII | Gate XII is PARTIAL — the commands producing these artifacts are unregistered because the registry is mounted by `EPIC-043` behind this Epic's guard | Not CRITICAL: the constitution itself carries *"Principle XII is enforceable in full only once EPIC-037 exists"*, and this is the last Epic that can carry the row honestly. Already in Complexity Tracking |

**No CRITICAL findings.** No duplicated requirements. No unresolved placeholders (the `<ts>` in
migration paths is the repository's convention for a timestamp assigned at implementation).

## Coverage Summary

| Requirement | Has task? | Task IDs | Notes |
|---|---|---|---|
| FR-LPW-001–005, 007–010, 012, 013 | ✅ | T1333–T1352 | provisioning, fully cited |
| FR-LPW-006 | ⚠️ | T1339, T1344 (uncited) | `C4` — the integration → skills-dir mapping is undefined |
| FR-LPW-011 | ⚠️ | T1352 (uncited) | `C5` — file-set equality not asserted |
| FR-LPW-020–027 | ✅ | T1353–T1364 | credential, fully cited |
| FR-LPW-028 | ❌ | — | `C2` — added at clarify, no assertion |
| FR-LPW-030, 032–035 | ✅ | T1312–T1315, T1365–T1372 | fabric mode |
| FR-LPW-031 | ❌ | — | `C3` — "never consulted by policy" unasserted |
| FR-LPW-040–044 | ✅ | T1320–T1332, T1373–T1377 | wiring repairs; `C1` for the route-through proof |
| FR-LPW-050–053 | ✅ | T1378–T1381 | screens |
| SC-LPW-003, 004, 006, 007, 009, 010 | ✅ | T1352, T1339, T1363, T1332, T1365, Phase Z | cited |
| SC-LPW-001, 002, 005 | ⚠️ | T1382, T1343/T1351, T1339/T1351 | `T1` — covered, uncited |
| SC-LPW-008 | ❌ | — | `C1` |

**Unmapped tasks**: none. Every task cites a requirement, a research decision or a contract
section.

## Constitution Alignment

| Principle | Status |
|---|---|
| I Command gate | Conformant — `ADR-0030` and the amendments are governance records, not application code |
| II SRS source of truth | Conformant — PMI-DOC-007 is in `SRS/`; three `LR-` identifiers carry a recorded back-fill |
| III Epic → Feature → Task | Conformant — `F-041.1`–`F-041.Z` mapped |
| V Failing-first tests | Conformant, with `T3` as a formatting deviation |
| VI Defects folder | Conformant — tracked in git |
| X Interaction budget | Conformant — one questionnaire, no follow-up round |
| XI Reachability | Conformant in plan; **`C1` is a Tier 1 gap in the tasks** |
| XII Registration | PARTIAL, recorded (`K1`) |

## Metrics

| Metric | Value |
|---|---|
| Functional requirements | 37 |
| Success criteria | 10 |
| Tasks | 73 |
| FRs with ≥ 1 citing task | 33 / 37 (89 %) |
| FRs covered on reading | 35 / 37 — `FR-LPW-028` and `FR-LPW-031` have no assertion anywhere |
| SCs with ≥ 1 citing task | 6 / 10 |
| Ambiguities | 2 (`U1`, `U2`) |
| Duplications | 0 |
| CRITICAL | 0 · **HIGH 1** · MEDIUM 9 · LOW 3 |

## Why C1 is the finding that matters

The whole replan rests on `M0`: *a generation submitted from the UI persists*. Phase 2 repairs the
worker and the stores, and Phase 6 adds the screen control — and the one test that would prove the
two halves meet, through the real route with the real worker, is absent. `T1320` proves the
persistence function works; `T1332` proves the stores survive a restart; neither proves that a job
submitted by a user reaches either. That is precisely the gap Constitution XI was written for:
*"a test suite that never crosses a real entry point measures whether the parts work, not whether
the product does"* — and it is the sixth Epic in this repository to have found it in analysis
rather than in a browser, which is the better place.
