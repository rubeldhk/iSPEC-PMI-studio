# Implementation Plan: Integration Hub

**Branch**: `epic/039-integration-hub` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Epic**: `EPIC-039` | **SRS References**: `SRS/PMI-DOC-004_Business_Requirement_Specification_v2.0.md`
§6.13 (`BR-0120`, `BR-0121`, `BR-0123`, `BR-0125`, `BR-0126`; `BR-0122`, `BR-0124` consumed), §6.10
(`BR-0091`, consumed through `EPIC-038`), §6.14 (`BR-0135`), §6.18 (`BR-0174`), §2 (`BG-04`);
`SRS/PMI-DOC-004A_V2_Gap_Analysis_and_Amendment_Package_v1.1.md` (`G-14`, `G-15`, Amendment E);
`SRS/PMI-DOC-006_Application_UX_Architecture_v1.0.md` §4 (Platform › Integrations, `U-13`);
`SRS/PMI-DOC-007_Local_First_Replan_v0.1.md` §9.4; `ADR-0023`, `ADR-0012`

**Input**: Feature specification from `specs/039-integration-hub/spec.md` (66 FR-HUB, 9 SC-HUB,
8 user stories; Clarifications 2026-10-09, amended the same day to add `Embed`)

## Summary

Platform workflows ask for **capabilities**, never providers. This Epic builds the three layers
`ADR-0023` decided: versioned capability contracts, a policy-aware Capability Resolver, and a
registry that lists every outbound adapter and every inbound connector with the same lifecycle facts.
v1 is a slice of **five** capabilities — `ReadRepository`, `ReadBuildStatus`, `ReadTestResults`,
`SendNotification`, `Embed` — each with a fixture adapter and one real adapter, which is what makes
`BR-0126` testable rather than claimed.

The technical approach, from Phase 0:

- **A contract package and three provider packages**: `@pmi/capability-contract` holds the
  vocabulary, the adapter interface, the resolver's pure eligibility core and an exported
  conformance suite (the `storage-contract` pattern); `@pmi/capability-adapter-{fixture,github,resend,ollama}`
  are the only code that names a provider; one composition file wires them (`R-039-1`, `R-039-2`).
- **Real providers** (deferred to this plan): **GitHub** REST for the three reads — with a GitHub
  App credential the resolver mints a per-request token narrowed to exactly the capability's
  permission; **Resend** for notifications, whose send-only keys make `SendNotification` narrowable;
  **Ollama** (local model server) for `Embed`, chosen for local-first (`R-039-9`, `R-039-18`).
- **Policy is decided at configuration, read at resolution**: `EPIC-031` has no non-recording
  query, so configuring an adapter requests one decision, and every resolution reads its outcome —
  derived, never cached (`R-039-7`).
- **Credentials** are AES-256-GCM with the project bound into the AAD, reachable only through a
  handle with no value property; the repository had no encryption at rest until now (`R-039-10`).
- **External evidence** fills `EPIC-032`'s already-declared `AttestationSource` seam and contributes
  inline in-toto test-result statements through its service (`R-039-11`).
- **`Embed` fills `EPIC-038`'s `EmbeddingPort` with no shape change** by resolving at deployment
  scope — the only scope the port's shape and `EPIC-038`'s one-vector-space-per-workspace index
  support (`R-039-18`).

## Technical Context

**Language/Version**: TypeScript 5.7, Node ≥ 22

**Primary Dependencies**: NestJS 10, Prisma 5, Node's built-in `fetch` and `node:crypto`. **Two new
runtime dependencies**, both in `@pmi/capability-adapter-github` only: `fast-xml-parser`
(JUnit XML, `processEntities: false`) and `fflate` (artifact zip, size-bounded). No HTTP client, no
GitHub SDK, no mail SDK, no scheduler library. Consumes `EPIC-024` (access), `EPIC-004` (audit),
`EPIC-037` (execution events), `EPIC-041`/`EPIC-042` (owner grant), `EPIC-043` (`pmi-studio`
facts), `EPIC-036` (shell) — on this branch; and **`EPIC-031`** (decisions), **`EPIC-032`**
(evidence), **`EPIC-038` retrieval** (`EmbeddingPort`) — **not on this branch**, consumed through
ports bound refusing until they merge (`R-039-13`).

**Storage**: PostgreSQL 16 via Prisma (`ADR-0003`). **10 new tables** in one migration
`backend/prisma/migrations/20261009120000_epic039_integration_hub/` ([data-model.md](./data-model.md));
three append-only via the shared `reject_mutation()`, one write-once trigger on approved contract
versions. One additive event type in `packages/execution-registry-contract`.

**Testing**: Vitest 2.1 — `backend-unit`, `backend-integration` (Testcontainers, gated by
`DOCKER_UNAVAILABLE=1`), `architecture`, `frontend`, `governance`, plus two new projects
`capability-contract` and `capability-adapters`. Playwright (`e2e/`) for the Tier 2 walk.

**Target Platform**: Linux server + browser. A journey is delivered (the Integrations screen), so
Constitution XI **Tier 2 applies**.

**Project Type**: workspace packages + backend module + one application-shell area (`/integrations`,
already declared in `frontend/src/shell/areas.ts` as `declared-not-delivered`, owner `EPIC-039`).

**Performance Goals** *(deferred to this plan by spec Assumption 10; `R-039-15`, `R-039-18`)*:

| Operation | p95 target |
|---|---|
| Resolution decision (no provider call) | **< 40 ms** |
| Hub overhead per capability request, excluding provider time | **< 120 ms** |
| Hub overhead per `embed()` call | **< 15 ms** |
| Single-query embed, warm, reference-local CPU | **< 150 ms** (inside `EPIC-038`'s 800 ms retrieval budget) |
| `Embed` batch, 32 × 1,000 chars | **< 2.5 s** (inside `EPIC-038`'s 5 s incremental re-index) |
| JUnit parse at 20,000 cases / 50 MiB expanded | **< 2 s** |
| Registry read (50 entries) / entry detail (100 health + 50 resolutions) | **< 250 ms** / **< 350 ms** |
| Integrations screen first render | **< 1.2 s** |

Provider timeouts: 10 s per HTTP call, 30 s per `ReadTestResults`, 20 s per `Embed` batch. Health:
300 s default interval (60–3600), ≤ 50 checks per 30 s tick, concurrency 4. Evidence intake re-reads
every 120 s, gives up at 30 min. Volume design point: 10,000 resolutions/day/project.

**Constraints**: callers never name a provider (boundary check, `FR-HUB-061`); no credential value
in any read, log, event or screen (canary suite, `FR-HUB-043`); refusal is immediate and explained —
no queue, retry or fallback (`FR-HUB-035`); policy status and health are derived, never cached
(`R-039-6`, `R-039-7`); approved contract versions and the three decision tables are immutable by
trigger; `EmbeddingPort`'s shape is not changed (`FR-HUB-087`).

**Scale/Scope**: **66 functional requirements in nine groups**, 9 success criteria, 8 user stories,
10 tables, 5 capabilities, **7 adapters** — 4 fixture adapters in one package (`fixture-git`,
`fixture-ci`, `fixture-notify`, `fixture-embed`) and 3 real ones in three packages (`github-rest`
serving three capabilities, `resend-email`, `ollama-embed`) — so every capability has exactly two;
5 inbound connector entries (`pmi-studio` + four `EPIC-037` surfaces); 20 HTTP routes; 6 declared
ports + 2 filled; 1 screen.

> Counted from the artifacts, not asserted (the `EPIC-032` rule): requirements from `spec.md`
> (`grep -c '^- \*\*FR-HUB-'` = 66), tables from `data-model.md`, routes and ports from
> [contracts/integration-hub-api.md](./contracts/integration-hub-api.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status |
|---|------|--------|
| I | All code changes in this plan will be produced only via Spec Kit commands — no direct edits | **PASS** — this run edited only `specs/039-integration-hub/**` (exempt). The two spec edits — the `Embed` amendment and the Status line — were made on the Project Owner's instruction and are recorded in Clarifications |
| II | Every requirement traces to a cited `SRS/` document; untraced items listed in Assumptions | **PASS** — every FR group traces to §6.13; `Embed` additionally to §6.10 `BR-0091` through `EPIC-038` `FR-CTX-013`; screen requirements to PMI-DOC-006 §4 |
| III | Work is decomposed Epic → Feature → Task; Epic ID assigned and `specs/<epic-id>/` exists | **PASS** — `EPIC-039`, `specs/039-integration-hub/` |
| IV | `/speckit-converge` is scheduled as the Epic exit gate before any promotion | **PASS** — Epic Exit Criteria; Phase Z of tasks |
| V | Every implementation task carries a mandatory unit-test task, written to fail first — or, for document/configuration outputs, an executable conformance check that can fail | **PASS** — the non-code outputs are the five capability contract JSON files; `capabilities-conformance.spec.ts` fails on a name/content mismatch, an unsupported schema keyword, a minor that removes or retypes a field, an undeclared state-changing capability, or seed rows that differ from the files (`R-039-3`) |
| VI | `specs/<epic-id>/defects/` exists and is the sole intake for defects in this Epic | **PASS** — created with this plan (`defects/.gitkeep`) |
| VII | Changes land in the local Claude repo first; promotion follows local → dev → stage → prod | **PASS** — local worktree only; nothing committed or pushed |
| VIII | Session/clone is labelled with the working Epic | **PASS** — worktree `.claude/worktrees/epic-039-integration-hub`, branch `epic/039-integration-hub` |
| IX | Every stop ends with an executable next action; the Delivery Board is refreshed or declared stale | **PASS, with a declared staleness** — this run cannot reach the board artifact; the closing report names the delta (`EPIC-039` planned, tasked and analysed; `Embed` added; `EPIC-038` `T1282`/`T1301` now have an owner) |
| X | Decision-phase questions batched; execution phases run without confirmation pauses | **PASS** — the spec's six decisions were asked at once; the `Embed` amendment arrived as one Project Owner decision; this plan asked nothing |
| XI | Tier 1 always; Tier 2 for a journey | **PASS (planned)** — Tier 1: every capability through `POST /projects/:id/capability-requests` against `AppModule`, intake through its job handler, health through `runDueHealthChecks`, `Embed` through `EPIC-038`'s own routes (quickstart Q4–Q19). Tier 2: run-generated Playwright transcript `docs/uat/EPIC-039-m1-transcript.md` (`R-039-16`, quickstart Q22), **blocking** closure |
| XII | Governed commands this plan causes are registered; history append-only; transitions proposed | **PASS for what the Hub causes** — the Hub runs no governed Spec Kit command; where a caller acts inside an execution, every resolution is an append-only `capability-resolved` governance event on it (`FR-HUB-038`), and nothing the Hub reads applies a transition. **PARTIAL** for the commands producing this Epic's own artifacts — see Complexity Tracking |
| — | Repository was synced from GitHub before this work started | **PASS** — worktree branched from `main` at `e47e96e` |
| — | No other Claude session is active on this checkout | **PASS** — dedicated worktree; sibling Epics run in their own |

**Post-Phase-1 re-check (2026-10-09)**: **no gate changed status.** Gate V strengthened: Phase 1
moved three guarantees into types and schema — `Fact<T>` has no blank shape (`FR-HUB-023`),
`CredentialHandle` has no value property and throws on `toJSON` (`FR-HUB-043`), and
`capability_resolutions` has no update path (`FR-HUB-036`). Gate XI gained a Tier 1 entry point it
did not have before the `Embed` amendment: `EPIC-038`'s routes, which cannot be exercised until
`EPIC-038`'s retrieval merges — recorded below, not hidden.

## Project Structure

### Documentation (this feature)

```text
specs/039-integration-hub/
├── spec.md
├── plan.md                         ← this file
├── research.md                     R-039-1 … R-039-18, Context7 IDs recorded
├── data-model.md                   10 tables, 1 event type, 1 new contract package
├── contracts/
│   ├── integration-hub-api.md      routes, entry shape, ports declared and filled
│   └── capability-contract.md      @pmi/capability-contract: 5 capabilities, adapters, conformance
├── quickstart.md                   Q1 … Q23
├── checklists/requirements.md
├── defects/                        Constitution VI intake
├── tasks.md                        /speckit-tasks
├── analysis.md                     /speckit-analyze
└── mutation-proofs.md              written at implementation, SC-HUB-001 and SC-HUB-004
```

### Source Code (repository root)

```text
packages/capability-contract/                      NEW — @pmi/capability-contract (R-039-2)
├── src/{vocabulary,contract,schema,adapter,health,errors,eligibility,fact,redaction,ports,index}.ts
├── capabilities/{ReadRepository,ReadBuildStatus,ReadTestResults,SendNotification,Embed}.v1.0.json
└── tests/{conformance/capability-conformance.suite.ts, *.spec.ts}

packages/capability-adapters/                      NEW — the only code naming a provider (R-039-1)
├── fixture/   @pmi/capability-adapter-fixture     fixture-git, fixture-ci, fixture-notify, fixture-embed
├── github/    @pmi/capability-adapter-github      github-rest: ReadRepository, ReadBuildStatus, ReadTestResults
├── resend/    @pmi/capability-adapter-resend      resend-email: SendNotification
└── ollama/    @pmi/capability-adapter-ollama      ollama-embed: Embed (+ ./embedding-module for EPIC-038 T1282)

backend/src/composition/integration-adapters.ts    the AdapterCatalog — the one backend file importing adapters

backend/src/modules/integrations/                  NEW
├── integrations.module.ts                         registered in app.module.ts (before ServeStaticModule)
├── integrations.tokens.ts                         CAPABILITY_PORTS: what each absent port does
├── catalog.service.ts                             catalog ↔ registry join; version-change detection (R-039-4)
├── registry.service.ts                            FR-HUB-020…029; connector seed (R-039-5)
├── registry.controller.ts                         §1–§2 of the API contract
├── configuration.service.ts                       FR-HUB-031/032/062; decision request (R-039-7)
├── configuration.controller.ts                    §3
├── credentials/{credential.vault.ts, credential.cipher.ts, keyring.ts, credential.service.ts, credentials.controller.ts}
├── resolver/{resolver.service.ts, scope.ts, explanation.ts}   FR-HUB-030…039 (pure core in the package)
├── requests/{capability-requests.service.ts, capability-requests.controller.ts, output-validation.ts}
├── health/{health.service.ts, ticker.ts, health-scheduler.ts}  R-039-6
├── evidence/{evidence-intake.service.ts, intake.job.ts, attestation-source.adapter.ts, evidence-sink.adapter.ts}  R-039-11
├── notifications/notification.service.ts          US6
├── embedding/{hub-embedding-port.ts, deployment-binding.service.ts, deployment.controller.ts}  R-039-18
├── policy/capability-policy.adapter.ts            EPIC-031 (blocked until merge)
├── integrations.store.ts                          interfaces + in-memory (unit tests only)
└── integrations.store.prisma.ts                   PostgreSQL; the only file naming `ciphertext` besides the vault

packages/execution-registry-contract/src/events.ts  + 'capability-resolved' in GOVERNANCE_EVENTS (R-039-12)
packages/mcp-server/                                  unchanged (asserted: no capability tool)

backend/prisma/schema.prisma                         + 10 models
backend/prisma/migrations/20261009120000_epic039_integration_hub/   tables, triggers, v1 contract seed

backend/tests/architecture/capability-independence.spec.ts   FR-HUB-061 (mutation proof SC-HUB-001)
backend/tests/architecture/integrations-credentials-boundary.spec.ts   only the vault reads ciphertext
backend/tests/integration/integrations-*.spec.ts             Tier 1 through AppModule
backend/tests/integration/integrations-credential-canary.spec.ts   SC-HUB-004 (mutation proof)

frontend/src/pages/Integrations.tsx, frontend/src/services/integrations.client.ts
frontend/src/shell/areas.ts                          integrations → delivered, element IntegrationsArea
frontend/src/shell/area-views.tsx                    + IntegrationsArea
e2e/tests/epic-039-m1.spec.ts                        Tier 2 → docs/uat/EPIC-039-m1-transcript.md
```

**Structure Decision**: the `packages/<x>-contract` + `packages/<x>-adapters/<name>` +
`backend/src/modules/<x>` split, as storage has it, with one deliberate divergence: capability
adapters are **runtime** dependencies of the backend (the callers are backend workflows), where
engine and agent adapters are composed in the worker. `R-039-1` records why, so analysis does not
read it as drift. The `EPIC-031`, `EPIC-032` and `EPIC-038` adapters (`policy/`,
`evidence/*.adapter.ts`, `embedding/hub-embedding-port.ts` binding) are one last task phase,
blocked on those merges.

## Phase 0 — Research

Complete: [research.md](./research.md). Context7 consulted for GitHub REST
(`/websites/github_en_rest`), Resend (`/websites/resend`), Ollama (`/ollama/ollama`),
fast-xml-parser (`/naturalintelligence/fast-xml-parser`) and fflate (`/101arrowz/fflate`). No
`NEEDS CLARIFICATION` remained after Phase 0.

## Phase 1 — Design & Contracts

Complete: [data-model.md](./data-model.md), [contracts/integration-hub-api.md](./contracts/integration-hub-api.md),
[contracts/capability-contract.md](./contracts/capability-contract.md), [quickstart.md](./quickstart.md).

| Guarantee | The shape that carries it |
|---|---|
| A caller cannot pin a provider | The request type has no adapter field; the route refuses one by name; the boundary check fails a core module naming a provider |
| A connector is never resolved | The candidate query filters `direction = outbound`; inbound entries have no implementation to invoke |
| No adapter serves while ineligible | `evaluateCandidates` is pure and total — every condition for every candidate, the first failure named |
| No field is blank | `Fact<T>` — a value or a reason, no third shape |
| A credential is never readable | Ciphertext only in one table, read by one file; the handle has no value; the status type has no value field; a canary searched everywhere |
| Least privilege binds at resolution | GitHub App tokens minted per request with exactly the capability's permissions; Resend scope verified by probe; *not narrowable* recorded, and refused by default for state-changing capabilities |
| No evidence by default | Intake contributes only final results with a revision; `EPIC-032`'s gate is fail-closed anyway |
| `EmbeddingPort` unchanged | `HubEmbeddingPort` implements the existing interface; an unbound Hub raises the same `503` naming the same seam |

## Constitution XI — reachability plan

**Tier 1 — through real entry points against `AppModule`**

| Capability | Real entry point | Quickstart |
|---|---|---|
| Registry read (both directions, `pmi-studio` first) | `GET /integrations/registry` | Q3 |
| Each read capability, fixture and GitHub-recorded | `POST /projects/:id/capability-requests` | Q4–Q9 |
| `SendNotification` | the same route, caller `notification-dispatch` | Q10 |
| Credentials set / status / remove; owner grant | `PUT/GET/DELETE /projects/:id/integrations/credentials/…` | Q12–Q14 |
| Health interval and staleness | the `runDueHealthChecks` job handler driven by the manual ticker | Q15 |
| Evidence intake → `EPIC-032` | `POST …/evidence-intake` and the `integrations.evidence-intake` job **(after `EPIC-032` merges)** | Q17 |
| `Embed` → `EPIC-038` | `POST /context/packages`, `POST /context/index/reindex` **(after `EPIC-038` retrieval merges)** | Q19 |
| Local agent cannot run a capability | the same route with a connector credential → `403` | Q11 |

**Tier 2 — the view-only Integrations screen.** A Playwright walk (`e2e/tests/epic-039-m1.spec.ts`)
against the reference-local stack writes `docs/uat/EPIC-039-m1-transcript.md` (run-generated,
never hand-written): navigation → Integrations → `pmi-studio` first → the unhealthy adapter's
reason → a refused resolution's per-candidate explanation → no configuration control, the *"through
the API"* note → the list at 360 px. Setup goes through the API. The walk is a **closure-blocking**
task: `EPIC-044`–`046` closed with transcripts *"authored, not yet measured"*, and this plan does
not allow that.

## Mutation proofs (spec Exit Criteria)

Both are applied by hand from a copy, observed, reverted and recorded in
`specs/039-integration-hub/mutation-proofs.md` at the moment of observation, on the
`specs/034-change-room/mutation-proofs.md` template.

| Proof | Mutation | Must be observed failing | Then |
|---|---|---|---|
| **`SC-HUB-001`** / `FR-HUB-061` | (a) insert `const PROVIDER = 'github';` in `backend/src/modules/integrations/resolver/resolver.service.ts`; (b) insert `import '@pmi/capability-adapter-github';` in `backend/src/modules/loop/loop.service.ts` | `capability-independence.spec.ts` — the *no provider names* and *no adapter imports* cases, each **naming the file and line** | revert; green. Plus the caller-level suite run twice, once per adapter binding, with `git diff --stat backend/src/modules` empty between runs |
| **`SC-HUB-004`** / `FR-HUB-043` | make `credential.service.ts → status()` return the decrypted value alongside the status | `integrations-credential-canary.spec.ts` — the credential status case at minimum; the record lists every failing case by name | revert; green |

A proof that cannot be observed failing is a defect in the check, recorded in `defects/` before
anything else.

## Risks

| Risk | Effect | Handling |
|---|---|---|
| **Three dependencies off-branch** (`EPIC-031`, `EPIC-032`, `EPIC-038` retrieval) | Policy-permitted resolution, evidence intake and the `EmbeddingPort` binding cannot be exercised end-to-end here | Ports bound refusing; adapters in one last blocked phase; `SC-HUB-006` and `SC-HUB-009` reported **unverifiable**, not passing, until merged (`R-039-13`) |
| **Every configuration waits for a human until `EPIC-031` has a rule** | Unmatched actions classify `high` → human approval, so `SC-HUB-008`'s 5 minutes depends on an approver | Contribute `integration.adapter.use.Read*` → `low` to `EPIC-031`'s default rules after merge (`R-039-7`) |
| **`DEF-032-006`** — the loop consumes none of its evidence seams | External evidence moves `EPIC-032`'s gate state, not a loop transition | `SC-HUB-006` measured at `CompletionGate.evaluate`; stated in the closing report |
| **No workspace-level artifact or administrator role exists** | `integration-registry` grants are seeded to the workspace creator; a departed creator leaves no one to register adapters | Recorded; an administrator role has no owning Epic (spec Out of Scope) |
| **`PMI_ENVIRONMENT` is new** | Boot of the module refuses without it | Added to `.env.example`; named in the closing report |
| **Real-adapter tests use recordings** | A provider API change passes CI until a live run | Opt-in live runs in the Tier 2 session; recordings dated in their file names |
| **Ollama not in CI** | `T1282` runs only where the model is served | Reported as *skipped in CI, observed in Tier 2* — never as passed in CI |
| **Process death mid-call** | A resolution with no invocation | Read as *outcome unknown*, never success (`data-model.md` §6) |
| **`EPIC-025`'s `MarkerTokenCipher` is base64, not encryption** | Storage refresh tokens are not encrypted at rest | Out of scope; reported as a finding for `EPIC-025`, with this Epic's `CredentialCipher` as the drop-in |
| **Event-count parity collides with `EPIC-047`** | Both add one governance event type; the parity test counts | Whichever merges second rebases the count (`R-039-12`) |

## Complexity Tracking

| Item | Why it is here | Disposition |
|---|---|---|
| **Three dependencies are not on this branch** | `EPIC-031`, `EPIC-032` (open PRs); `EPIC-038` retrieval (its own branch) | Ports bound refusing; adapters in a last phase blocked on merge (`R-039-13`, `R-039-18`) |
| **Edits to other Epics' packages** | `execution-registry-contract` (+1 event type); `evidence-contract` `AttestationSource.filledBy` → `EPIC-039` and `decision-contract` default rules — both after merge | Additive, each asserted in the owner's own suite |
| **A new contract package and four adapter packages** | `BR-0126` needs two adapters per capability behind one contract | The storage pattern; a barrel was rejected for `EPIC-030`–`032` (`R-039-2`) |
| **Two new runtime dependencies** | JUnit XML and zip parsing for `ReadTestResults` on GitHub | Confined to `@pmi/capability-adapter-github`; both small, pure JS, configured for untrusted input (`R-039-9`) |
| **First real encryption at rest in the repository** | Adapters must *present* credentials, so hashing does not work | `node:crypto` AES-256-GCM behind a keyring port; KMS is a later binding (`R-039-10`) |
| **A periodic ticker** | `FR-HUB-027` requires interval health; nothing periodic exists | A `Ticker` port and a lease; BullMQ rejected because its queue is optional (`R-039-6`) |
| **`Embed` at deployment scope** — a stated exception to per-project configuration | `EmbeddingPort` takes no project and `EPIC-038` keeps one vector space per workspace | `FR-HUB-084`; per-project would need an `EPIC-038` port change, rejected (`R-039-18`) |
| **Gate XII is PARTIAL for authoring commands** | The commands producing these artifacts run outside a registered execution | The programme-level gap `EPIC-038` and `EPIC-047` recorded |
