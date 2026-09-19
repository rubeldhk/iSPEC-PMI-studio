# Contract: Storage Provider

**Epic**: `EPIC-002` | **Date**: 2026-08-05 | **Package**: `packages/storage-contract`

Deliberately modelled on
[`../../_shared/contracts/specification-engine.md`](../../_shared/contracts/specification-engine.md).
The SRS applies the adapter pattern to engines — *"Spec Kit becomes the first implementation, not the
core dependency"* — and this epic's assumptions extend it to storage. Same shape, same reasoning,
same enforcement.

## The rule this contract exists to protect

> An additional storage provider type can be supported with **zero changes to platform behaviour
> outside the storage integration layer** — FR-PUB-030, FR-PUB-039, SC-011, PP-015.

Without a contract and a second provider, SC-011 is a claim nobody can test. That is exactly the
situation SC-008 was in before the fixture engine existed.

## Capabilities

| Capability | Required | Purpose |
|---|---|---|
| `connect` | yes | Authorise and validate a destination |
| `checkHealth` | yes | Distinguish healthy / needs-reauthorisation / unavailable (FR-PUB-031) |
| `putFile` | yes | Write one file to the destination |
| `listDestination` | yes | Compute the republish preview (FR-PUB-036) |
| `deleteFile` | **no** | Publishing is one-way, and disconnection leaves published files untouched (FR-PUB-038, clarified 2026-08-08) — so nothing in this epic ever deletes at the provider. A write-only provider is supportable |

A provider missing any **required** capability is **refused at connection time, naming the missing
capability** (FR-PUB-039) — mirroring the engine registry's capability refusal.

## Shape

`StorageProvider`:

| Method | Returns |
|---|---|
| `connect(config)` | `StorageResult<ConnectionDescriptor>` |
| `checkHealth(connection)` | `StorageResult<HealthStatus>` |
| `putFile(connection, file)` | `StorageResult<PutOutcome>` |
| `listDestination(connection, path)` | `StorageResult<DestinationEntry[]>` |

`StorageResult<T>` is a **discriminated union** — success or a named failure. Plain data throughout:
no platform entities, no database identifiers a provider could dereference.

`StorageFailureReason` — the closed taxonomy of FR-PUB-035:

```text
provider_unavailable | authorisation_expired | quota_exceeded
size_limit_exceeded  | destination_missing
```

**There is deliberately no `unknown` member**, matching `job_failure_reason` in
`_shared/schema.sql`. A generic failure is a defect (SC-009).

## Rules

- **S1** — Adapters **return** failures; they never throw. This is what makes the taxonomy
  enforceable rather than dependent on exception hygiene (engine contract rule E2).
- **S2** — An adapter MUST map every provider-specific error into `StorageFailureReason`. A Dropbox
  error code must never reach `backend/`. Mapping is the adapter's entire job.
- **S3** — `backend/src/**` MUST NOT name a provider SDK, package, or provider string. Enforced by a
  **build-failing architecture test**, mirroring `T047` for engines. Without it this boundary erodes
  under delivery pressure exactly as engine independence would have (RAID **R-05**).
- **S4** — Publishing is **one-way** (ADR-0004). The contract exposes no read-back or import
  capability, and adding one later is an ADR-level decision, not an adapter feature.
- **S5** — `checkHealth` MUST distinguish `unavailable` from `healthy`. A provider that cannot be
  reached is never reported healthy (FR-PUB-031).
- **S6** — `putFile` MUST report a file skipped for exceeding a provider size limit **without failing
  the whole publish** (edge case: "that file is skipped and reported; the rest continue").
- **S7** — Adapters hold **no platform credentials** and perform no database access, matching the
  sandbox posture of ADR-0002.
- **S8** — Destination naming: where an artifact name is invalid at the destination, the adapter
  **adapts the name and reports the adaptation** (edge case). It never fails silently and never
  writes an unreported name.

## Conformance suite

One suite, run against **every** provider. A provider is not conformant until all cases pass. The
fixture must be able to inject each failure on demand.

| Case | Assertion |
|---|---|
| **SC-01** | A provider missing a required capability is refused, naming it — FR-PUB-039 |
| **SC-02** | `checkHealth` returns three distinct states — FR-PUB-031, S5 |
| **SC-03** | Each of the five failure reasons is returned distinctly — FR-PUB-035, SC-009 |
| **SC-04** | An oversized file is skipped and reported; the publish continues — S6 |
| **SC-05** | An invalid destination name is adapted and the adaptation reported — S8 |
| **SC-06** | Authorisation expiring mid-publish stops it, reports re-authorisation, and states what was published |
| **SC-07** | No read-back capability is exposed — S4 |
| **SC-08** | Switching providers preserves publish history — FR-PUB-038, SC-010 |

## Fixture provider

`packages/storage-adapters/fixture` — deliberately trivial, in-memory, with injectable failures for
every reason in the taxonomy. It exists for the same three reasons the fixture engine does:

1. It makes **SC-011** testable — a second provider is required to prove interchangeability.
2. It keeps the test suite **fast, deterministic, and offline** — no Google Drive calls in CI.
3. It lets every downstream consumer be proven correct **before** a real provider SDK is integrated,
   which is the slowest and least certain part of the work.

## What this contract does not do

- It does not hold credentials. Authorisation is **delegated OAuth-style** (FR-PUB-029, clarified
  2026-08-08) and the refresh token lives on `StorageConnection`, encrypted at rest — never in the
  adapter, which runs sandboxed with no platform credentials (rule **S7**, ADR-0002). An adapter
  receives a short-lived access token per call and nothing more.
- It does not define retry or rate-limit policy beyond requiring that rate limiting "slows or defers
  rather than failing outright" (edge case). Concrete policy belongs to the adapter.
- It does not govern *what* is published — artifact selection and access-based exclusion (FR-PUB-033)
  are platform concerns, above this boundary.
