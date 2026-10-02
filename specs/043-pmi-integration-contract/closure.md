# EPIC-043 — PMI Integration Contract: Epic closing report

**Task**: `T1464` (report published; the promotion it also names is **not** performed — see *Work not
done*) · **Session**: 2026-09-04 · **Constitution IX**

**Status**: `Implemented` — 66 of 69 tasks complete; **three open, each named below with its
reason**. Every implementation task carries a unit test, contract test, integration test or
conformance check that was observed failing before its implementation and passing after
(Constitution V), with two ordering exceptions recorded honestly under *Assumptions*.

## What the Epic delivered — milestone M1

`EPIC-037` specified one contract for governed execution and could mount neither its REST surface
(`DEF-037-001`: nothing could authenticate a non-human caller) nor its MCP binding (`ADR-0010`:
the authorisation model was open). `EPIC-041` built a project-scoped connector credential. This
Epic binds the contract to it, so a governed command run by the user's own agent on the user's own
machine is registered, reported and completed in PMI Studio and shown on the project's execution
timeline — **the first execution seen from a developer's machine**.

| Phase | Tasks | What it established |
|---|---|---|
| 1 Setup | `T1398`–`T1407` | `@pmi/mcp-server` as a package that may import only the SDK, `zod` and the contract packages (lint rule + architecture test); `PMI_MCP_SERVER_COMMAND` as the checkout override; `CONTRACT_VERSION`, the three header names and seven connector-facing refusal codes in the contract package |
| 2 Foundational | `T1408`–`T1421`, `T1465`–`T1466` | A credential completes the registry's identity at mint (snapshot, registration per surface kind, four delegations on the project; lazy completion for older credentials); the registry resolves a delegation through the execution's project; **the EPIC-037 controller is mounted** behind the guard with identity, workspace, project, surface and assurance derived server-side and refused from a body; contract version negotiated; reads verify the execution's project; `comment` gains a facade method and a route; `sync` is reserved by name; `executions-unmounted.spec.ts` replaced by `executions-mounted.spec.ts` |
| 3 US1 | `T1422`–`T1436` | The `pmi-studio` stdio server: fourteen tools (nine live, five reserved), a platform client that carries the credential only in the `Authorization` header, a registry adapter over a real MCP `Client` that the fixture conformance suite passes against unchanged; the session-scoped execution timeline (list with filters and page tokens; events) and its panel on the project screen; parity across `managed-sandbox`, `mcp-client`, `local-cli` and `ci-cd` against the composed application |
| 4 US2 | `T1437`–`T1441` | Every error body and audit detail scrubbed of credential shapes; one refusal for absent, malformed, unknown and other-project credentials on all eight routes, byte-identical, nothing performed; an audit entry per accepted call; revocation effective on the next request |
| 5 US3 | `T1442`–`T1443` | A repeated registration key with the same content and principal replays the original; a different payload or a second credential conflicts; registry refusals reach HTTP as coded platform errors carrying the registry's own word |
| 6 US4 | `T1444`–`T1447` | `pmi.project.context` and `pmi.requirements.list`, this project only, the Epic list and the baseline state stated as unavailable until the Epics that supply them; the guard accepts `me` as the credential's project; reserved tools validate their arguments before refusing |
| 7 US5 | `T1448`–`T1452` | `pmi.health` records one workstation connection per credential (durable store asserted); the session route and the Local workspace panel show them with the credential's label and state |
| 8 Polish | `T1453`–`T1455` | README and the operator guide explain the server, the override and M1; the M1 e2e harness; quickstart §Results with the measured figures |
| Z Closure | `T1456`, `T1457`, `T1459`–`T1461`, `T1463` | This report, the counts, the inversion, the mutation observations, the Constitution XII record, the records, the register |

## Found on the way — repairs this Epic did not plan and could not leave

| Finding | What was true | What is true now |
|---|---|---|
| Two `EPIC-037` vocabularies stopped at `agent, service` | `executions.initiatorType` and `execution_comments.authorType` CHECK constraints refused `connector`; the first registration from a credential was a 500 | Both widened in this Epic's migration and asserted by `integration-contract-schema.spec.ts`; the same for `principal_identity_snapshots` (EPIC-028), which refused the first snapshot of a connector principal |
| The projection never advanced | `execution_state` was written at registration and never again; a snapshot after completion still said `registered` | The facade rebuilds the projection on read — the "materialised on read" posture PMI-DOC-007 §3 takes |
| A repeated registration key was a conflict, not a replay | The registry created a new execution id first, so the `registered` event's key collided and the retry was refused as "a different event" | The registry replays a same-content, same-principal registration and conflicts otherwise (`T1443`, `SC-PIC-006`) |
| Registry refusals reached HTTP as 500 | `RegistryRefusedError` is not a `PlatformError` | Translated at the mounted boundary to 409 / 403 / 400 with the registry's code in `details.refusal`; the server prefers that word as its code |
| The comment operation had no facade method and no route | `EPIC-037` built the service only | Both added (analysis `C1`, `T1465`/`T1466`) |
| `cursor` is a provider name | The pagination token tripped `agent-independence.spec.ts` | Renamed `after` in the API, the client and the contract |

## Constitution XI Tier 1 — proved by inversion (`T1457`)

`T1435`, `T1439`, `T1446` and `T1436` drive the mounted registry, the server through a real MCP
client, the reads and the timeline against the composed `AppModule`. Inversion, observed
2026-09-04: with `ConnectorModule` removed from `executions.module.ts`'s imports, the application
**failed to initialise** (`handleInitializationError`, the guard and the credential store
unresolvable) and `mounted-registry.spec.ts` could not run its `beforeAll` — 5 skipped, the worker
exited. Restored; green again.

## The mutation observations (`T1459`)

| Proof | The mutation | The test did not survive it |
|---|---|---|
| `SC-PIC-003` | `sanitise()` in `packages/mcp-server/src/refusals.ts` made an identity | `refusals.spec.ts`: 2 failed |
| `SC-PIC-003` | `scrubCredentials()` in `backend/src/core/errors.ts` made an identity | `refusal-sanitisation.spec.ts`: 4 failed |
| `SC-PIC-004` | `requireOwn()` in `executions.controller.ts` made a no-op | `mounted-registry.spec.ts` *another project's credential*: expected 404, got 200 |
| `SC-PIC-004` | the reads' project-scope check removed from `connector-auth.guard.ts` | `connector-reads.spec.ts` *absent, not forbidden*: expected 404, got 200 |
| `SC-PIC-009` | `@UseGuards(ConnectorAuthGuard)` removed from `executions.controller.ts` | `executions-mounted.spec.ts`: 2 failed (the static half); the live half stayed green because the controller itself refuses a request without a connector context — the static half is the one that catches the mutation |

Each restored with `git checkout`; each suite re-run green. Note on `SC-PIC-004`: the spec named
"the project-scope check" as one thing; there are two — the guard's, for routes addressed by
project, and the controller's `requireOwn`, for routes addressed by execution — and both were
mutated and both observed.

## Constitution XII — execution registration (`T1460`)

The commands that produced this Epic's artifacts ran **unregistered**: the registration path did
not exist until this Epic built it. The `M1` transcript's execution (`T1458`, owed) will be the
**first registered execution from a developer's machine**. From `EPIC-042` on, its extension
registers every governed command through this server; this is the last Epic whose Gate XII row
reads *partial* for want of a path.

## Measured (`quickstart.md` §Results)

| Target | Bound | Measured |
|---|---|---|
| Timeline latency after the completion call (`SC-PIC-005`) | < 5 s | **118 ms** in-process, composed `AppModule` |
| Credential verification per call | < 1 ms | **0.024 ms** p95 (`EPIC-041`, unchanged path) |
| Fixture conformance over MCP (`SC-PIC-001`) | 100 % | 5 of 5 |
| Parity across four surfaces (`SC-PIC-002`) | zero differences | zero |

## The counts (`T1456`)

| Suite | Files | Tests | Not green |
|---|---|---|---|
| `pnpm test:unit` | 440 of 441 passed | 4,229 passed | 2 unhandled errors in one file under the combined run, not reproduced when the projects run individually (the same posture `EPIC-041` recorded) |
| `pnpm test:contract` | 23 passed | 225 passed | — |
| `pnpm test:arch` | 22 of 24 passed | 272 passed, 5 skipped | `T999u` (EPIC-035 Tier 2 transcript, known-red before this Epic) |
| `pnpm test:governance` | 72 of 74 passed | 1,039 passed | `T884` ×2 (EPIC-029 manual pass, known-red before this Epic); `G-26-14` on `T1454` naming the transcript before its run — task reworded |
| `pnpm test:integration` | 97 passed, 1 skipped | 888 passed, 2 skipped | — (including `scale.spec.ts` on this run) |
| `pnpm lint` | — | — | 20 pre-existing errors: unused imports in older tests, a missing `react-hooks` rule definition, `engine-default.spec.ts` importing the worker (the EPIC-041 boundary), three design-token literals in `shell.css`; none in files this Epic touched |
| `pnpm -r typecheck` | all packages | clean | — |

## Assumptions taken autonomously (Constitution X)

- **Two tests were written after their implementation**, not before: `T1437`/`T1438` (the
  server's refusal uniformity and argument scan were built in Phase 3 as part of the server and
  the tests written in Phase 4 passed on first run) and `T1465`/`T1466` (the comment facade method
  and route were needed by the mounted-controller test in Phase 2 and written before their own
  test). Both are recorded here rather than re-ordered to look otherwise.
- `pmi.execution.history` returns `{ snapshot, events }` (two reads) so the registry adapter can
  implement `snapshot()` without a tool the contract does not name.
- The `me` alias in the guard: the server never knows a project id; `me` is the credential's own.
- `baselineState` is `null` with its source stated: baselines are specification-level and no
  requirement link exists.
- The Epic list is `[]` with `epicSource: 'unavailable-until-EPIC-044'` (Assumption 5 of the spec,
  unchanged).

## Work not done, and why

- **`T1458`** Tier 2 transcript: no running stack was brought up in this session. The harness
  `e2e/tests/epic-043-m1.spec.ts` is written and typechecks; the run is owed.
- **`T1462`** `/speckit-converge`: a separate command, to be run next.
- **`T1464`** Promotion `local → dev`: needs an explicit instruction naming the environment, and
  the publication of `@pmi/mcp-server` (or the documented override) for that environment.
- Scenario 12 of the quickstart (M1 on a running stack) is therefore recorded as pending.

## Recommended next task

`/speckit-converge` for `EPIC-043`; then `/speckit-specify` for `EPIC-042` (the extension, the
setup skill, the constitution sync), which fills `pmi.constitution.get` and `pmi.project.decompose`
in this server.

## The register (`T1463`)

`pnpm register:update` (run twice, per its known first-run failure on `T884`) derives EPIC-043 as
**`Ready` — every DOR condition passes**. The register derives no stage past `Ready` from evidence on
disk; `Implemented` is this report's claim, and `/speckit-converge` (`T1462`) is what turns it into a
derived one.
