# Contract: `@pmi/capability-contract` — capabilities, adapters, conformance

**Epic**: `EPIC-039` · **Date**: 2026-10-09 · **Research**: `R-039-2`, `R-039-3`, `R-039-4`, `R-039-9`

A new `*-contract` package — seven exist on this branch (`agent`, `engine`, `execution`,
`execution-registry`, `loop`, `room`, `storage`), and `EPIC-031`/`EPIC-032` add `decision` and
`evidence`; the ordinal is left out because it depends on merge order. It holds what a **caller** and an **adapter** must agree on and
nothing else: no Nest, no Prisma, no provider name. The backend module and every adapter package
depend on it; it depends on nothing in the repository.

```text
packages/capability-contract/
├── src/
│   ├── vocabulary.ts        CAPABILITY_NAMES (closed, v1 = 4), PLATFORM_CALLERS, PLATFORM_ENVIRONMENTS
│   ├── contract.ts          CapabilityContractVersion, ScopeRequirement, compareContractVersions
│   ├── schema.ts            the JSON Schema subset + validate() — no runtime dependency (R-039-3)
│   ├── adapter.ts           CapabilityAdapter, AdapterDescriptor, AdapterResult (never throws)
│   ├── health.ts            HEALTH_STATES, HEALTH_REASONS, HealthObservation
│   ├── errors.ts            COMMON_ERROR_CATEGORIES
│   ├── eligibility.ts       evaluateCandidates() — the resolver's pure core (R-039-7)
│   ├── fact.ts              Fact<T> — value or reason, never blank (FR-HUB-023)
│   ├── redaction.ts         re-export of the shared secret patterns (FR-HUB-045, R-039-10)
│   ├── ports.ts             PortDeclaration[] — CAPABILITY_PORTS (the decision-contract pattern)
│   └── index.ts
├── capabilities/            the non-code output — one JSON per capability version
│   ├── ReadRepository.v1.0.json
│   ├── ReadBuildStatus.v1.0.json
│   ├── ReadTestResults.v1.0.json
│   ├── SendNotification.v1.0.json
│   └── Embed.v1.0.json
├── tests/
│   ├── conformance/capability-conformance.suite.ts   exported as "./conformance"
│   └── *.spec.ts
├── package.json             "@pmi/capability-contract", exports "." and "./conformance"
└── tsconfig.json
```

## 1. The five v1 capabilities (`FR-HUB-010`)

All five are version **1.0**. Every one shares the common error categories `adapter-fault`,
`provider-throttled`, `provider-unavailable`, `credential-rejected`, `not-found`, `timed-out`.

### `ReadRepository` 1.0 — reads, `changesState: false`

- **Scope**: `{ access: 'read', resources: ['repository.contents'] }`
- **Input**: `{ revision: string, paths?: string[] (≤ 50), mode: 'tree' | 'files' }`
  - `revision` is a full commit id, a branch, or a tag. The repository identity is **not** an input
    — it is the project's binding (`EPIC-041` Assumption 5, `R-039-8`), so a caller cannot read a
    repository the project did not configure.
- **Output**:
  - `mode: 'tree'` → `{ revision: { requested, resolvedCommit }, entries: [{ path, kind: 'file'|'dir', sizeBytes? }], truncated: boolean }`
  - `mode: 'files'` → `{ revision, files: [{ path, encoding: 'utf8'|'base64', content, sizeBytes }], missing: string[] }`
  - Every file ≤ 1 MiB and every response ≤ 5 MiB; larger content is refused as
    `content-too-large` naming the path, never truncated silently.
- **Errors**: common + `revision-not-found`, `content-too-large`.

### `ReadBuildStatus` 1.0 — reads, `changesState: false`

- **Scope**: `{ access: 'read', resources: ['ci.checks'] }`
- **Input**: `{ revision: string }` — a full commit id (40 or 64 hex). A branch is refused: a
  build status for a moving name attests nothing.
- **Output**: `{ revision, state: 'pending' | 'success' | 'failure' | 'neutral' | 'none', final: boolean, checks: [{ name, state, final, url?, completedAt? }], observedAt }`
  - `state` is the roll-up: any `failure` → `failure`; any non-final → `pending`; no checks →
    `none`. `final` is `false` whenever any check is still running (`FR-HUB-054`).
- **Errors**: common + `revision-not-found`.

### `ReadTestResults` 1.0 — reads, `changesState: false`

- **Scope**: `{ access: 'read', resources: ['ci.artifacts'] }`
- **Input**: `{ revision: string }` (full commit id).
- **Output**: `{ revision, final: boolean, result: 'PASSED' | 'FAILED' | 'NONE', suites: number, passedTests: string[], failedTests: string[], skippedTests: string[], source: { runUrl?, artifactName?, format: 'junit-xml' }, observedAt }`
  - Shaped to map one-to-one onto `EPIC-032`'s test-result predicate
    (`https://in-toto.io/attestation/test-result/v0.1`: `result`, `passedTests`, `failedTests`), so
    intake does no interpretation (`R-039-11`).
  - At most 20,000 test names; beyond that `result-too-large`, never truncated.
- **Errors**: common + `revision-not-found`, `results-not-found`, `results-malformed`,
  `result-too-large`.

### `SendNotification` 1.0 — **changes state**, `changesState: true`

- **Scope**: `{ access: 'write', resources: ['notification.send'] }`
- **Input**: `{ recipients: [{ address: string }] (1–20), subject: string (≤ 200), body: { text: string (≤ 20,000) }, idempotencyKey: string }`
  - Addresses, not user ids: resolving a platform user to an address is the caller's job, done
    before the request so the adapter never reads the user store.
  - Subject and body are scanned with the shared secret patterns **before** resolution; a hit is
    refused `credential-material-in-content` (`FR-HUB-045`, `US6` AS3). Refusal, not redaction:
    a redacted notification would be delivered saying something other than what was asked.
- **Output**: `{ delivered: boolean, providerMessageId?: string, acceptedAt }`
- **Errors**: common + `recipient-rejected`, `credential-material-in-content`.

### `Embed` 1.0 — reads, `changesState: false`, **deployment scope** (`FR-HUB-080`–`FR-HUB-087`)

- **Scope**: `{ access: 'read', resources: ['model.embed'] }`
- **Input**: `{ texts: string[] }` — 1 to **64** texts, each 1 to **8,000** characters
  (`FR-HUB-083`). Over either limit → `batch-too-large` / `text-too-long` naming the limit and the
  offending index; never truncated. Each text is scanned with the shared secret patterns;
  a hit is `credential-material-in-content` naming the index (`FR-HUB-045`).
- **Output**: `{ model: { id, version, dimension }, vectors: number[][] }` — exactly one vector per
  text, in order, each of length `dimension`, every component finite, no all-zero vector
  (`FR-HUB-081`). The Hub validates all four properties and refuses the whole batch as
  `adapter-fault` on any failure (`FR-HUB-016`).
- **Errors**: common + `batch-too-large`, `text-too-long`, `model-not-present`,
  `credential-material-in-content`.
- **Descriptor addition**: an `Embed` adapter's descriptor carries `embedding: { models: [{ model,
  dimension }] }`; `dimension` is **declared**, never probed (`FR-HUB-081`), and the adapter reports
  the model **version** (weights digest) at health check and with each result (`FR-HUB-082`).

### Filling `EPIC-038`'s `EmbeddingPort` (`FR-HUB-087`)

```text
class HubEmbeddingPort implements EmbeddingPort {      // backend/src/modules/integrations/embedding/
  get modelId(): string     // `${adapterKey}:${model}@${version}` from the binding snapshot
  get dimension(): number   // the declared dimension from the bound adapter's descriptor
  embed(texts): Promise<number[][]>   // one deployment-scope resolution per call
}
```

Unbound or ineligible → throws `GovernanceSeamUnboundError('… EmbeddingPort … <Hub explanation>')`
— the same class and seam name `EPIC-038`'s `embeddingUnbound()` raises today, so its `503` contract
is untouched. The port's shape is unchanged.

## 2. Adapters

```text
interface AdapterDescriptor {
  key: string;                       // 'github-rest', 'fixture-git', …; unique in the catalog
  name: string;
  provider: string;                  // the only place a provider is named (FR-HUB-024, FR-HUB-061)
  transport: 'native-api' | 'cli' | 'mcp' | 'customer-connector';
  version: string;                   // semver of the adapter package
  implements: [{ capability, majors: number[] }];
  credentialKinds: [{ kind, narrowing: 'per-request' | 'at-issue' | 'none' }];
  bindingSchema: JsonSchema;         // the project's non-secret providerBinding
  scopeMapping: Record<ScopeResource, string[]>;   // e.g. 'ci.checks' → ['checks:read', 'statuses:read']
}

interface CapabilityAdapter {
  readonly descriptor: AdapterDescriptor;
  invoke(call: AdapterCall): Promise<AdapterResult>;          // never throws (storage-contract rule)
  checkHealth(ctx: AdapterContext): Promise<HealthObservation>;
}

interface AdapterContext {
  workspaceId, projectId, binding,
  credential: CredentialHandle | null,     // R-039-10 — use(fn) only; no value property
  scope: ScopeGrant,                       // what the resolver granted (FR-HUB-034)
  signal: AbortSignal, timeoutMs: number,
}
interface AdapterCall extends AdapterContext { capability, contractVersion, input }

type AdapterResult =
  | { ok: true, output: unknown, providerRequestId? }
  | { ok: false, errorCategory, message, retryAfterSeconds?, providerRequestId? };
```

`output: unknown` is deliberate: the **Hub** validates it against the contract's output schema and
refuses a non-conforming one as `adapter-fault` (`FR-HUB-016`). An adapter that returns typed output
would make the check look redundant, and then someone would delete it.

**`CredentialHandle.use(fn)`** is the only way to reach a secret: `fn` receives the plaintext for the
duration of one provider call. The handle has no `value`, `toString` returns `[credential]`, and
`toJSON` throws — so a handle placed in a log line or a response body fails loudly rather than
leaking (`FR-HUB-043`, `R-039-10`).

## 3. The conformance suite (`./conformance`, `FR-HUB-060`)

`capabilityConformanceSuite(name, harness)` — one suite per capability, run against **every**
adapter that implements it. The fixture adapter must be able to inject each case; a real adapter is
run against **recorded provider responses** served through an injected `fetch`, and optionally live
(`R-039-9`).

| Case | Asserts |
|---|---|
| CC-01 | The descriptor implements the capability at major 1 and declares a provider, transport and version |
| CC-02 | A valid input produces output that validates against the 1.0 output schema |
| CC-03 | A throttled provider yields `provider-throttled` with `retryAfterSeconds` |
| CC-04 | A rejected credential yields `credential-rejected`, and the message contains no credential |
| CC-05 | An unknown revision yields `revision-not-found` (read capabilities) |
| CC-06 | A non-final run yields `final: false` (`ReadBuildStatus`, `ReadTestResults`) |
| CC-07 | `checkHealth` returns one of the three written states with a reason when not healthy |
| CC-08 | The adapter never throws — every injected failure is a returned result |
| CC-09 | The adapter only calls provider endpoints its `scopeMapping` covers for the capability (asserted on the recorded requests) |
| CC-10 | `SendNotification` passes `idempotencyKey` to the provider (`R-039-13`) |
| CC-11 | `Embed`: one vector per text, in order, of the declared dimension, finite, non-zero; the same text twice yields the same vector |
| CC-12 | `Embed`: the model version is reported and changes when the injected weights digest changes |
| CC-13 | `Embed` fixture only: equals `EPIC-038`'s `letterVector` for a fixed corpus, and two texts sharing meaning but no letters are **not** nearest neighbours (`FR-HUB-086`) |

This is the **adapter-level** suite. The **caller-level** suite `SC-HUB-001` requires runs in the
backend through the real HTTP route, once per adapter binding (`R-039-9`, quickstart Q6).
