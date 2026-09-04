# Analysis — EPIC-043 PMI Integration Contract

**Session**: 2026-09-04 · **Artifacts**: `spec.md` (clarified 2026-09-04), `plan.md`, `research.md`,
`data-model.md`, `contracts/` (3), `quickstart.md`, `tasks.md` (`T1398`–`T1464`, 67 tasks) ·
**Constitution**: v1.6.0

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 ✅ | Coverage gap / Inconsistency | **HIGH** | `spec.md` `FR-PIC-001`, `FR-PIC-034`; `contracts/mcp-tool-surface.md` §1; `contracts/mounted-registry-api.md` §2; `tasks.md` `T1419`, `T1425` | The spec promises *"exactly the seven execution tools `EPIC-037` names, unchanged"*, but the registry `EPIC-037` delivered exposes **five**: `ExecutionRegistryFacade` has no `comment` and no `sync`, `executions.controller.ts` has no `/comments` and no `/sync` route, and `EPIC-037`'s sync intake (`T1060`–`T1065`, US4 provisional → pending_sync → governed) is **unbuilt**. Comment exists only as `ExecutionCommentService.add`, off the facade. `T1419` and `T1425` mount and translate routes that do not exist, and `FR-PIC-034` requires a sync that nothing accepts | Amend `FR-PIC-001` to *six live tools; `pmi.execution.sync` reserved* and `FR-PIC-034` to *reserved until `EPIC-037` US4 lands, refusing `not_available_until { epic: 'EPIC-037' }`*; add `comment` to the facade and `POST /v1/executions/:id/comments` to the controller through `ExecutionCommentService` as two tasks (failing test, implementation) in Phase 2; update both contract documents |
| I1 ✅ | Inconsistency | MEDIUM | `contracts/mounted-registry-api.md` §2 vs `specs/037-governed-execution-registry/contracts/execution-contract.md` §2 | This Epic's routes follow the **built** controller (`/completion`, `/proposals`, `GET /:id/history`); `EPIC-037`'s contract document says `/complete`, `/status-proposals`, `GET /:id/events` and an artifact-history query. Two documents now describe one surface differently | Add a *Deviations from `EPIC-037` §2* table to `contracts/mounted-registry-api.md` naming each pair and stating that the built controller is authoritative; raise the drift in `EPIC-037`'s document as a note for its owner (outside this command) |
| U1 ✅ | Underspecification | MEDIUM | `research.md` `R-043-6`; `tasks.md` `T1406`, `T1407`, `T1422`; `packages/execution-registry-contract/src/contract.ts` | `R-043-6` pins *"`CONTRACT_VERSION` from `@pmi/execution-registry-contract`"*, but no such export exists — the fixture connector hard-codes `'1.0'`. `T1407` does not add it, so `T1422`'s version negotiation has no source of truth | Extend `T1406`/`T1407`: export `CONTRACT_VERSION = '1.0'` from the contract package and make the fixture connector use it |
| C2 ✅ | Coverage gap | MEDIUM | `spec.md` `FR-PIC-032`; `tasks.md` `T1420`, `T1421`, `T1439` | The read routes must verify the execution belongs to the credential's project *"never trusted"*; `T1420` tests body refusals and headers but names no case for `GET …/history` or `GET /:id` on an execution of **another project in the same workspace** (the facade's `history(workspaceId, executionId)` has no project dimension) | Add to `T1420`: reads of an execution whose `projectId` is not the credential's are `404`; add to `T1421`: the controller checks the snapshot's `projectId` before answering |
| K1 | Constitution | MEDIUM | `plan.md` Gate XII, Complexity Tracking | Gate XII is PARTIAL — the commands producing this Epic run unregistered because this Epic **is** the registration path. Same posture `EPIC-041` recorded; the constitution itself carries the *"enforceable in full only once …"* clause | Not CRITICAL. Already in Complexity Tracking; `T1460` records the first registered execution |
| C3 ✅ | Coverage gap | LOW | `spec.md` `FR-PIC-036`; `tasks.md` `T1444`, `T1448` | Audit entries are tasked for the execution routes (`T1439`, `T1440`) but not named for the reads and the health route (`contracts/reads-api.md` §1 says health is audited as `connector.health`) | Name the audit assertion in `T1444` and `T1448` |
| A1 ✅ | Ambiguity | LOW | `spec.md` `FR-PIC-006`; `research.md` `R-043-6` | *"The server MUST declare the contract version it speaks"* is met in `R-043-6` by the `initialize` result's `instructions` text, which a client cannot read programmatically; the programmatic answer is `pmi.health`'s `contractVersion` | Have `T1422` assert both: `instructions` names the version for a person, `pmi.health` returns it for a program |
| I2 | Inconsistency | LOW | `data-model.md` §7 | `not_available_until` is given REST status `501`, but no REST route serves a reserved operation — until C1 reserves `POST /v1/executions/sync`, the row has nothing to apply to | Keep the row; C1's amendment gives it its route |
| T1 | Terminology | LOW | PMI-DOC-007 §2.4, §3 (`ConnectorToken`, *token*) vs `spec.md`, `plan.md` (*credential*) | The SRS says *token*; every artifact of `EPIC-041` and this Epic says *credential*, deliberately (a token is what the environment holds; the record is a credential) | No change; noted once so `/speckit-converge` does not read it as drift |
| F1 | Traceability | LOW | `tasks.md` | Tasks cite `SC-` identifiers and research decisions but few `FR-PIC-` identifiers by name; coverage below is mapped by content | Optional: add the governing `FR-PIC-` to each implementation task at `/speckit-implement` |

**Remediation applied 2026-09-04** (approved by the requester): `C1` — `FR-PIC-001` and `FR-PIC-034` amended, both contract documents updated, `T1465`/`T1466` appended to Phase 2; `I1` — deviations table added to `contracts/mounted-registry-api.md`; `U1` — `T1406`/`T1407` export `CONTRACT_VERSION`; `C2` — `T1420`/`T1421` carry the project check on reads; `C3` — `T1444`/`T1448` assert the audit entries; `A1` — `T1422` asserts both declarations. `K1`, `I2`, `T1`, `F1` stand as recorded. **Every blocking finding is resolved.**

**No CRITICAL findings.** No duplicated requirements. No unresolved placeholders. Every user story
has acceptance scenarios and every scenario maps to at least one test task.

## Coverage summary

| Requirement key | Has task? | Task IDs | Notes |
|---|---|---|---|
| `FR-PIC-001` server, the seven tools | ⚠ | T1422, T1425, T1428 | **C1** — five exist; comment and sync need tasks or reservation |
| `FR-PIC-002` reads + reserved | ✅ | T1422, T1425, T1445, T1447 | |
| `FR-PIC-003` fixture conformance over MCP | ✅ | T1428, T1429 | `SC-PIC-001` |
| `FR-PIC-004` idempotency + correlation + audit actor | ✅ | T1423, T1424, T1439, T1440 | |
| `FR-PIC-005` tool-surface contract check | ✅ | T1430 | |
| `FR-PIC-006` contract version declared | ✅ | T1406, T1407, T1422 | **U1**, **A1** |
| `FR-PIC-007` env only, no project file | ✅ | T1426, T1427 | |
| `FR-PIC-010` parity `AC-EXR-01`–`04` | ✅ | T1435 | `SC-PIC-002` |
| `FR-PIC-011` no business rule in the server | ✅ | T1400, T1401 | |
| `FR-PIC-012` names no engine or agent | ✅ | T1400 (extend the scan) | |
| `FR-PIC-020`–`023` guard, one refusal, scopes, per-call | ✅ | T1416, T1417, T1418, T1419, T1437, T1439 | |
| `FR-PIC-024` no body identity | ✅ | T1412, T1413, T1420, T1421 | |
| `FR-PIC-025` surface and assurance derived | ✅ | T1419, T1420, T1435 | |
| `FR-PIC-026`, `027` no credential material; structured refusals | ✅ | T1437, T1438, T1440, T1441 | `SC-PIC-003` |
| `FR-PIC-030`, `031` mounted; replaced check | ✅ | T1418, T1419 | `SC-PIC-009` |
| `FR-PIC-032` reads scoped to the project | ⚠ | T1439 | **C2** |
| `FR-PIC-033` no apply/approve | ✅ | T1420, T1433 | |
| `FR-PIC-034` sync intake | ⚠ | T1425 | **C1** |
| `FR-PIC-035` session timeline read | ✅ | T1431, T1432, T1436 | |
| `FR-PIC-036` audit entries | ⚠ | T1439, T1440 | **C3** for reads/health |
| `FR-PIC-040`–`043` context and requirements reads | ✅ | T1444, T1445, T1446 | |
| `FR-PIC-044`, `046` health and connection record | ✅ | T1448, T1449, T1452 | |
| `FR-PIC-045` reserved tools validate | ✅ | T1447 | |
| `FR-PIC-050`–`054` timeline screen | ✅ | T1433, T1434, T1450, T1451 | |
| `FR-PIC-060`, `061` records closed | ✅ | done at plan; T1461 | |
| `FR-PIC-062` package, publication, override | ✅ | T1398, T1399, T1402–T1405, T1464 | |
| `SC-PIC-001`–`009` | ✅ | T1428, T1435, T1437/T1441, T1439, T1454, T1442, T1439, T1435, T1418/T1459 | all buildable criteria tasked |

**Unmapped tasks**: none — every task names a story, a requirement group or a closure obligation.

**Metrics**: Requirements **43** FR + **9** SC · Tasks **67** · Coverage **43/43** by content (3 with
a finding) · Ambiguities **1** · Duplications **0** · CRITICAL **0** · HIGH **1** · MEDIUM **3** ·
LOW **5**.
