# Quickstart: validating the Integration Hub

**Epic**: `EPIC-039` · **Contracts**: [integration-hub-api.md](./contracts/integration-hub-api.md),
[capability-contract.md](./contracts/capability-contract.md) · **Model**: [data-model.md](./data-model.md)

## Prerequisites

- `pnpm install` at the repository root.
- Docker running for the `backend-integration` scenarios (Testcontainers PostgreSQL 16); without it
  they are skipped under `DOCKER_UNAVAILABLE=1`, and **a skipped scenario is reported as not run**.
- Environment for any stack run: `PMI_ENVIRONMENT=local`, `PMI_INTEGRATION_KEYS` and
  `PMI_INTEGRATION_ACTIVE_KEY` (a 32-byte test key generated for the run — never a real secret),
  `PMI_INTEGRATION_SCHEDULER=off` in tests.
- Scenarios marked **(after `EPIC-031`)**, **(after `EPIC-032`)**, **(after `EPIC-038`)** need that
  Epic merged to `main` and this Epic's adapter phase done (`research.md` `R-039-13`). Before that,
  each must produce its documented `503` naming the port — itself a scenario.
- Live scenarios (**live**) are opt-in: a GitHub App installed on a test repository
  (`PMI_LIVE_GITHUB_APP_ID`, `…_INSTALLATION_ID`, `…_PRIVATE_KEY_FILE`, `PMI_LIVE_GITHUB_REPO`), a
  Resend sending-only key (`PMI_LIVE_RESEND_KEY`) with a test recipient, and Ollama on
  `127.0.0.1:11434` with `nomic-embed-text` pulled. None is needed in CI.

## Run

```bash
npx vitest run --project capability-contract --project capability-adapters
npx vitest run --project backend-unit backend/tests/unit/integrations-
npx vitest run --project architecture backend/tests/architecture/capability-independence.spec.ts backend/tests/architecture/integrations-
npx vitest run --project backend-integration backend/tests/integration/integrations- --no-file-parallelism
npx vitest run --project frontend frontend/tests/unit/pages/integrations
pnpm --filter e2e test -- epic-039-m1          # Tier 2, against the reference-local stack
```

## Scenarios

| # | Scenario | Expected |
|---|---|---|
| Q1 | Run the capability-contract conformance check after renaming a field in `ReadBuildStatus.v1.0.json`'s output without a new major | Fails, naming the field and the version (`FR-HUB-011`, Constitution V) |
| Q2 | Run each adapter's conformance suite (fixture, GitHub recordings, Resend recordings, Ollama recordings) | All CC cases pass for every adapter of every capability it implements (`FR-HUB-060`) |
| Q3 | `GET /integrations/registry?projectId=` in a fresh workspace | `pmi-studio` first, then the four `EPIC-037` surfaces, then outbound entries; every field a value or *not applicable* with a reason; `fixture` surface named in `omitted` (`SC-HUB-003`) |
| Q4 | Request `ReadBuildStatus` with only `fixture-ci` configured, healthy, policy-permitted (in-test policy binding) | `200 resolved`; names `fixture-ci`, its version, every condition that held (`US1` AS1) |
| Q5 | Request `ReadSecrets` | `200 refused`, `unknown-capability` naming it (`US1` AS2) |
| Q6 | **Caller-level suite × 2** — the same suite for `ReadRepository`, `ReadBuildStatus`, `ReadTestResults` against `fixture-*` then against `github-rest` (recorded responses), switching only the configuration | Same contract shapes; `git diff --stat backend/src/modules` empty between the runs (`SC-HUB-001`, `US2`) |
| Q7 | Request with `"adapter": "github-rest"` in the body | `200 refused`, `provider-pinned` (`US1` AS3) |
| Q8 | Configure `fixture-ci` and `github-rest` at the same preference (seeded directly as a migration would leave it) | `ambiguous` naming both (`FR-HUB-032`) |
| Q9 | Make every candidate ineligible a different way (unhealthy, not configured, credential missing, environment) | `no-eligible-adapter` listing each candidate with its own reason; no queue, no retry (`US1` AS4, `SC-HUB-002`) |
| Q10 | `SendNotification` through `fixture-notify`, then with injected provider failure | One `delivered` row; then `failed` with the provider's reason and the cause untouched (`US6`) |
| Q11 | The capability-requests route called with a project connector credential (`pmi_ct_…`) | `403 surface_not_accepted`, nothing resolved (`FR-HUB-004`, `US1` AS5) |
| Q12 | Set a `github-token` credential as a non-owner | `403`; audit `access_refused` (`US4` AS2) |
| Q13 | Set it as the owner; read credential status; resolve for project B | `204`; status `configured` with no value; project B never uses it — and decrypting A's row with B's AAD fails (`US4` AS1/AS3, `SC-HUB-005`) |
| Q14 | **Canary**: set `pmi-canary-<uuid>`, then exercise every route, the screen, audit, the three decision tables, execution events, logs, a forced provider error and `pmi-studio`'s reads | The canary (raw, base64, URL-encoded) appears nowhere (`SC-HUB-004`) — **this is the mutation-proof suite** |
| Q15 | Drive `runDueHealthChecks` with the manual ticker; advance past the interval without a check | `healthy`, then `unknown (stale)` and ineligible (`FR-HUB-027`) |
| Q16 | Fixture throttles; fixture rejects the credential | `degraded / provider-throttled` with retry hint; `unhealthy / credential-rejected`, the credential absent from the reason (`FR-HUB-047`) |
| Q17 | **(after `EPIC-032`)** Bind a task to a contract requiring a test result; enqueue intake for a revision whose fixture run is still running, then completes | `pending` → re-read → `contributed`; the item moves unmet → met at `CompletionGate.evaluate`; source `pmi-adapter:fixture-ci` with its version (`SC-HUB-006`). Before merge: `refused / evidence-seam-unbound`, item unmet |
| Q18 | **(after `EPIC-031`)** `PUT …/configuration/ReadBuildStatus`, then read the decision; approve in the Decision Inbox; request | Decision requested with `integration.adapter.use.ReadBuildStatus`; `policy-pending` until approved; then resolved, the decision's explanation embedded. Before merge: `503` naming `CapabilityPolicy` |
| Q19 | **(after `EPIC-038`)** Bind `Embed` to `fixture-embed`; `POST /context/index/reindex`, `POST /context/packages`; unbind; repeat | Answers without the `EmbeddingPort` `503`; after unbinding, the `503` names `EmbeddingPort` with the Hub's explanation (`SC-HUB-009`) |
| Q20 | **(after `EPIC-038`, live)** `CONTEXT_EMBEDDING_MODULE=<repo>/packages/capability-adapters/ollama/src/embedding-module.ts` and run `EPIC-038`'s `context-relevance.spec.ts` | `T1282` **runs** (not skipped); result recorded as observed (`SC-HUB-009`) |
| Q21 | `Embed` with 65 texts; with one text of 8,001 characters; switch the bound model | `batch-too-large`; `text-too-long` naming index; `reindexRequired: true` and `EPIC-038` search refusing foreign entries until re-indexed (`US7`) |
| Q22 | **Tier 2** — `pnpm --filter e2e test -- epic-039-m1` against the reference-local stack | Writes `docs/uat/EPIC-039-m1-transcript.md`: navigation → Integrations → unhealthy reason → refused resolution's explanation → no configuration control → 360 px (`SC-HUB-007`, Constitution XI Tier 2) |
| Q23 | **live** — the caller-level suite against a real GitHub App installation and a real Resend send | Same results as Q6/Q10; recorded in the Tier 2 session, not CI |

Q3–Q16 through the **real HTTP routes and job handlers against `AppModule`** satisfy Constitution XI
Tier 1 for everything on this branch; Q17–Q19 complete it after the merges. Q22 is Tier 2.
