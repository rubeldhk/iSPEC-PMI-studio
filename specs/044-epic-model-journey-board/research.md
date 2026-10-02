# Research — EPIC-044 Epic Model and Spec Journey Board

**Session**: 2026-09-05 · **Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) (clarified
2026-09-05)

Thirteen decisions. Each names what was chosen, why, what lost, and which documents were consulted
(Context7 library IDs recorded so `/speckit-implement` and `/speckit-converge` query the same
source without re-resolving).

## `R-044-1` — What is extracted into `packages/epic-stage`, and what stays

**Decision**: the package holds (a) the stage configuration document, (b) the pure derivation
rule — the *highest contiguous stage* over an evidence map, with `nextReaches` for Epic kinds — as
`deriveStageFromEvidence(evidence, config, kind)`, (c) the readiness resolver `resolveReadiness`
(pure over failures and waivers), (d) two **evidence adapters**: the file-tree adapter this
repository's register uses today (`enumerateEpics`, `evidenceFor`, `hasClarificationSession`,
`checklistsResolved`) and a new **execution adapter** `evidenceFromExecutions(rows, config)` the
product uses, and (e) the types. The twelve DOR **conditions** (`dor.ts` `evaluateCondition`),
declarations, waiver validation, severities, render and drift stay in `tests/governance/epic-stage/`:
they read this repository's tree and `governance/epic-declarations.json` and have no product
counterpart yet (readiness conditions for customer projects are out of scope). The governance
modules `derive.ts` and the readiness half of `dor.ts` become **re-export shims** over the package so
the 32 governance specs that import them are unchanged.

**Rationale**: `R-06` forbids two copies of a stage *rule*; it does not require the product to
carry the repository's file checks. The rule and the configuration are what both consumers must
agree on; the evidence source is what differs. Shims keep the register's tests byte-for-byte
unchanged, which is the proof `SC-EPB-002` asks for.

**Alternatives considered**: moving everything including DOR into the package — carries
repository-only concerns (declarations, waivers, the twelve conditions) into a product dependency
for no product use; copying `deriveStage` into the backend — the drift itself.

**Docs consulted**: none needed (`tests/governance/epic-stage/derive.ts`, `dor.ts`, `build.ts`).

## `R-044-2` — One configuration file, in the package, mirrored under `governance/`

**Decision**: the canonical stage configuration moves to
`packages/epic-stage/epic-stage.config.json`; the package exports `loadStageConfig()` reading it.
`governance/epic-stage.config.json` **remains** as a byte-identical mirror, asserted by a new
governance check (`G-44-01`) so a person editing either file is told at once; the register's
generator reads through the package. The seven existing stages gain a `reachedBy` field (the
governed command whose completed execution reaches the stage: `specify`, `clarify`, `checklist`,
`plan`, `tasks`, `analyze`; `Ready` has none — it is the readiness verdict). The two new stages
live under a new `productStages` key — `Implementing` (order 8, `reachedBy: implement`, next
`/speckit-converge`) and `Converged` (order 9, `reachedBy: converge`, next `—`) — because
`G-26-01` asserts that `stages` has **exactly seven** entries (`FR-ESK-001`) and the register's
columns are those seven. The product profile is `stages` followed by `productStages`.

**Rationale**: the platform runs in a container that has no `governance/` directory, so the
configuration must ship inside the package; every existing reference — the register skill,
EPIC-026's checks, docs — names `governance/epic-stage.config.json`, so it stays readable there;
a mirror kept identical by a failing test is a conformance check, not silent drift. Extending the
model in the document rather than in code is `FR-ESK-015` and `FR-EPB-011`.

**Alternatives considered**: a symlink (fragile on Windows, the reference workstation); a build
step copying the file (a copy nobody sees fail); adding the two stages to `stages` (breaks
`G-26-01` and would add two columns to the register for a state the repository never reaches).

**Docs consulted**: none needed.

## `R-044-3` — Executions are bound to an Epic by their input target binding

**Decision**: the product's evidence for an Epic is the set of governed executions whose
**input** target binding has `targetType = 'epic'` and a `targetId` that resolves to the Epic:
a plain integer resolves by `number`; `<number><letter>` resolves to the child Epic whose
`parentEpicId` is the Epic with that number and whose `splitSuffix` is the letter (`R-044-5`).
No column is added to `executions`; the binding rows `EPIC-037` already writes are the source.
A `targetId` that resolves to no Epic is **unbound** (`FR-EPB-008`) and listed as such.

**Rationale**: the hooks already write `targetType: epic, targetId: <number or number+suffix>`
(`begin.md` step 8, `contracts/extension-and-hooks.md` §4); nothing in the hooks changes. The
suffix form is what a first-run child is registered under (`EPIC-042` `FR-EXT-045`); mapping it
through the parent link keeps the child's own number an integer (clarified 2026-09-05).

**Alternatives considered**: `Execution.epicId` (PMI-DOC-007 §3 named it for `043`; `EPIC-043`
did not add it and the binding already carries the identity — a second column is a second
source); changing the hooks to send an Epic id (the hooks do not know entity ids and must not
change here).

**Docs consulted**: none needed (`execution-registration.service.ts`, the binding rows).

## `R-044-4` — The evidence rules over executions, including *Implementing* and *Converged*

**Decision**: per Epic, the adapter reads its executions newest first and derives an evidence
map: a stage with `reachedBy: <command>` is present when **any** execution of that command
completed (`completed`; for `implement` also `partially-completed`). `Implementing` is present
when the latest `implement` is non-terminal (`registered`, `started`, `blocked`) or completed
`partially-completed`. `Converged` is present when the latest `converge` completed **and its
completion comment names neither `tasks.md` as changed nor as new** (`finish.md` step 5 writes
`Changed: …. New: ….` or `Nothing changed.`), and no `implement` was registered after it. The
contiguous rule then applies: the highest stage whose predecessors are all present; a gap is
named (*missing: specify*). `Ready` (order 7) is layered as the readiness verdict: with the empty
customer condition set, `resolveReadiness({ failures: [] })` answers `Ready`, and the board carries
the note *no readiness conditions configured* (clarified 2026-09-05). Failed, cancelled and
timed-out executions are evidence of nothing but are reported as the last execution when latest.
Provisional records are not executions the platform holds and move nothing (`FR-EPB-002`).

**Rationale**: it consumes exactly what the hooks record — lifecycle events and the completion
comment whose format `EPIC-042` fixed — and adds no event or tool. *Converged* from an unchanged
`tasks.md` is the same fact `/speckit-converge` reports as *byte-for-byte unchanged*.

**Alternatives considered**: a dedicated `convergence-reported` event (changes the hooks, out of
scope); reading the synced `tasks.md` (`EPIC-045`'s artifact store does not exist yet); every
completed `converge` is *Converged* (rejected by the requester on 2026-09-05).

**Docs consulted**: none needed (`packages/workspace-bundle/extension/commands/finish.md`,
`contracts/extension-and-hooks.md` §5).

## `R-044-5` — The Epic entity, its number, and split children

**Decision**: table `epics` — `id, workspaceId, projectId, number Int, slug, title, description,
status (active|split|closed), parentEpicId?, splitSuffix?, decisionCommentId?, createdById,
createdAt, updatedAt, closedAt?`; unique `(projectId, number)`; unique
`(decisionCommentId, splitSuffix)` for idempotent decision processing; a self-relation
`parent`/`children`. The number is allocated inside the create transaction as `max(number) + 1`
for the project, with the unique index as the guard and one retry on conflict; numbers are never
reused (a closed Epic keeps its number). `requirements` and `specifications` gain a nullable
`epicId` with an index. A child created from a decision takes the next free numbers in child
order, the recorded slug (suffixed by its number on collision), the recorded requirements moved
from the parent, `parentEpicId` and `splitSuffix`; the parent becomes `split`.

**Rationale**: PMI-DOC-007 §3 names the shape; the requester confirmed integer numbers with a
parent link (2026-09-05). Allocation inside the transaction with a unique guard is the pattern the
repository uses for `(projectId, reference)` on requirements.

**Alternatives considered**: a sequence per project (a second object to migrate and reset);
suffixed identifiers on the Epic (rejected 2026-09-05).

**Docs consulted**: Context7 `/prisma/web` — *one-to-many self-relation with an optional parent
foreign key* (`teacher`/`students` pattern: the foreign key is nullable and carries no `@unique`, the
back-relation list is virtual) — applied to `parent`/`children` on `Epic`.

## `R-044-6` — Decomposition decisions are processed on read, idempotently

**Decision**: `EpicsService.reconcileDecisions(projectId)` runs at the start of every Epic-list,
board and stage read for the project: it lists `decomposition-decision` comments on the project's
executions whose `commentId` no Epic references, validates each body with the bundle's
`validateDecompositionDecision`, and creates the children (`R-044-5`) in one transaction per
decision; a *rejected* decision is recorded on the parent (`lastDecisionCommentId`) and creates
nothing. A body that fails validation is reported on the parent as *decision unreadable* and
skipped, never guessed.

**Rationale**: it needs no cross-module event, is idempotent by the unique constraint, heals a
missed processing on the next read, and the board is what a person opens after a first run.
`ExecutionsModule` already exports the comment reads; `EpicsModule` imports it without a cycle.

**Alternatives considered**: an observer attached to the comment service after boot (the
`attachConstitutionRenderer` pattern — a second mechanism for the same outcome, and a missed
event stays missed); processing in the hook (the hook does not know entity ids).

**Docs consulted**: none needed (`execution-comment.service.ts`, `@pmi/workspace-bundle`
`validateDecompositionDecision`).

## `R-044-7` — A fifth-and-sixth module pair: `epics/` with an `EpicStoresModule`

**Decision**: new backend module `backend/src/modules/epics/` — `epic.store.ts` (Prisma and
in-memory, `EPIC_STORE` token), `epic.service.ts` (create, edit, close, assign requirement,
assign specification, reconcile decisions; owner gate; audit), `epic-stage.service.ts` (the
execution adapter: one query over `executions` joined to input bindings for the project, fed to
the package), `epics.controller.ts` (session routes). An `EpicStoresModule` exports the store
token only, imported by `ConnectorModule` so `ProjectContextService` reads Epics without importing
the controller — the `GovernanceStoresModule` pattern `EPIC-042` established.

**Rationale**: the entity has a human surface (Requirement Room), a board surface
(Specifications) and a connector read surface; none should import another's controller. The
stores-only module is how the connector reads governance records today without a cycle.

**Alternatives considered**: folding Epics into `requirements/` (`EPIC-007`'s module would own a
board) or `governance/` (constraints are owner policy; Epics are structure).

**Docs consulted**: none needed.

## `R-044-8` — Routes: session CRUD, two stage reads, no new connector scope

**Decision** (`contracts/epics-api.md`): session routes `GET/POST /v1/projects/{id}/epics`,
`GET /v1/epics/{eid}`, `PATCH /v1/epics/{eid}`, `POST /v1/epics/{eid}/close`,
`PUT /v1/requirements/{rid}/epic` `{ epicId | null }`, `PUT /v1/specifications/{sid}/epic`,
`GET /v1/epics/{eid}/stage` (PMI-DOC-007 §4.2) and `GET /v1/projects/{id}/epics/stages` (the
board read: every Epic's stage, last, next, readiness, plus `unbound` executions,
`derivedFrom: 'executions'` and `packageVersion`). The connector reads change **content, not
shape**: `pmi.project.context` lists the entity's Epics with `epicSource: 'epic.entity'`;
`pmi.requirements.list?groupBy=epic` groups by `epicId`; `pmi.project.decompose` returns the
entity's bundles. No new scope: the existing `project.read` and `requirements.read` cover them.

**Rationale**: `FR-PIC-043` designed the reads to swap source without changing shape; the
scope registry stays at `EPIC-043`'s thirteen (the `connector-boundary` list is untouched).

**Alternatives considered**: a `pmi.epic.stage` tool (PMI-DOC-007 §4.1 lists none for `044`;
the board is a human surface).

**Docs consulted**: none needed.

## `R-044-9` — Screens: Epics in the Requirement Room, the board in Specifications

**Decision**: the Requirement Room area gains `/requirement-room/epics` (the **Epic list**: a
filtered table — number, title, status, requirements, stage — with a create form) and
`/requirement-room/epics/{eid}` (the **Epic detail**: description with edit, requirements with
assign/unassign against the project's unassigned list, specifications, stage card, timeline
link). The Specifications area gains `/specifications/board` (the **Spec Journey Board**: one
column per stage of the product profile, cards per `FR-EPB-042`–`FR-EPB-045`, an *unbound
executions* group, filters by title and stage, the four states, the footer *derived from
executions · epic-stage v<version>*). `SpecificationList` gains **Epic** and **Stage** columns
from a `listSpecifications` response extended with `epicId`, `epicNumber`, `epicTitle` and the
board read. `frontend/src/services/api.ts` gains the client methods. Both areas are already
`delivered`; the delivery matrix does not move.

**Rationale**: clarified 2026-09-05 (Epic list in the Room, board in Specifications). Sub-routes
inside delivered areas are the smallest change to the shell; the `T442t` route table gains two
lines.

**Alternatives considered**: a new *Journey* area (PMI-DOC-007 §6: *no new area is invented*).

**Docs consulted**: none needed (design components `Table`, `FormField`, `Button`, `PageHeader`).

## `R-044-10` — Performance: one query per board read

**Decision**: the board read issues **one** SQL statement for the project — executions joined to
their input binding (`targetType = 'epic'`) and their latest lifecycle event and completion
comment — and derives every Epic in memory; the Epic list is a second statement. Target: a
project with 50 Epics and 500 executions answers in under **2 s** end to end and the derivation
itself in under **50 ms** (measured by a unit test over generated rows).

**Rationale**: `SC-EPB-005`; the derivation is a projection and must stay one.

**Alternatives considered**: a materialised `epic_stages` table (a written stage — forbidden by
`FR-EPB-001`); per-Epic queries (N+1).

**Docs consulted**: none needed.

## `R-044-11` — Tier 1 and Tier 2 evidence

**Decision**: Tier 1 — every route through the composed `AppModule` (integration tests with
Testcontainers: Epic CRUD and grants, assignment, decision reconciliation, the stage reads over
real executions registered through a real `pmi-studio` server via the sequence harness, the
connector reads returning the entity). Tier 2 — `e2e/tests/epic-044-m3.spec.ts` on the
reference-local stack: Playwright creates Epics and assigns requirements, the harness runs a first
run over them (`runFirstRun`) with one confirmed split, Playwright opens the board and asserts
every Epic at *Specified* with `/speckit-clarify` next and the children present; recorded as
`docs/uat/EPIC-044-m3-transcript.md`. The extraction is proved by the register's byte-identity
(`SC-EPB-002`) and by the 32 unchanged governance specs.

**Rationale**: Constitution XI; the harness is what `EPIC-042` built for exactly this.

**Alternatives considered**: none.

**Docs consulted**: none needed (`e2e/tests/epic-042-m2.spec.ts`).

## `R-044-12` — Governance records and repository checks this Epic touches

**Decision**: `adr/ADR-0030` gains the 2026-09-05 amendment (`FR-EPB-070`, written at this step);
`governance/repository-layout.md` registers `packages/epic-stage/` at implement time (the check
requires the path to exist); `vitest.workspace.ts` gains the `epic-stage` project;
`backend/tests/unit/core/universal-columns.spec.ts` gains `epics`;
`backend/tests/architecture/durable-stores.spec.ts` gains `EPIC_STORE`; `scripts/update-register.mjs`
is unchanged (the register spec imports the shim). `tests/governance/epic-stage/derive.ts` and the
readiness half of `dor.ts` become re-exports; `G-44-01` asserts the config mirror.

**Rationale**: the closure runs of `EPIC-042` showed that whole-project checks catch what an
Epic's own suites do not; naming them in the plan puts them in `tasks.md`.

**Alternatives considered**: none.

**Docs consulted**: none needed.

## `R-044-13` — Numbers on the wire, names on the screen

**Decision**: every read that names an Epic returns `number`, `slug` and `title`; screens print
*Epic 7 · Intake*; the hooks continue to receive `number` and `slug` only (the `pmi.project.context`
shape is unchanged). `slug` is derived from the title at creation (`kebab-case`, ASCII, ≤ 40
chars) and editable with the title; the slug the decompose read returns is what the hook uses for
the directory name, so a slug edit after a first run is recorded and not propagated to disk
(`FR-EPB-022`, `EPIC-045`'s concern).

**Rationale**: the existing contract shape; the directory name is the toolkit's and the platform
does not rename files on a developer's machine.

**Alternatives considered**: none.

**Docs consulted**: none needed.
