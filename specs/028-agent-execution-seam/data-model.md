# Data Model: Agent & Execution Seam

**Epic**: `EPIC-028` | **Date**: 2026-08-14 | **Plan**: [plan.md](./plan.md)

Mostly **types, not tables.** This epic's model is two contract packages; only one entity is
persisted, and it deliberately mirrors one that already exists.

Full signatures in [contracts/agent-contract.md](./contracts/agent-contract.md) and
[contracts/execution-contract.md](./contracts/execution-contract.md). This document records the
entities, the rules that make them safe, and the three preserved-element changes Native §28 requires.

---

## Part 1 — Execution contract (`packages/execution-contract`)

Built first: the agent contract references `ExecutionSession`, never the reverse.

### ExecutionEnvironmentDescriptor

| Field | Type | Rule |
|---|---|---|
| `provider` | string | `'docker'` · `'fixture'`; unique per registration |
| `supportedLifecycles` | `('ephemeral' \| 'persistent')[]` | Non-empty. Docker Phase 1 declares `['ephemeral']` only |
| `supportsPersistentState` | boolean | Must be false when `persistent` is absent above — asserted |
| `supportsNetworkPolicy` | boolean | **A provider declaring false cannot accept any egress profile** |
| `maxWallClockMs` | number | > 0 |

That fourth rule matters more than it reads. An environment that cannot enforce a network policy but
accepts one is a security control that silently does nothing — the failure mode `ADR-0002` exists to
prevent. Registration refuses it, naming the reason.

### WorkspaceBinding — a discriminated union, not a path

```ts
type WorkspaceBinding =
  | { kind: 'ephemeral';  scratchPath: string }
  | { kind: 'persistent'; projectRef: string; mode: 'read-only' | 'read-write'; branch: string };
```

**This type is how Native §5's invariant becomes structural** rather than a convention:

> *"No sandbox state may implicitly become authoritative project state."*

From inside a container the two bindings look identical. The union makes the ambiguity
unrepresentable: **there is no binding that is persistent and unnamed.** A persistent binding always
carries a branch, so promotion to authoritative state always goes through git — consistent with
`D-29`, where Postgres owns governance state and git owns implementation history.

EPIC-028 ships the type and validates it. **EPIC-029 builds the persistence**; the Docker provider
here refuses `kind: 'persistent'` because it declares no support for it.

### EgressProfile

| Field | Type | Rule |
|---|---|---|
| `name` | string | `'generation'` · `'implementation'` |
| `allowedDestinations` | string[] | Non-empty. **A wildcard, `*`, `0.0.0.0/0` or any general-internet form fails validation** (`FR-AGT-011`) |
| `enforcement` | `'network-policy' \| 'proxy' \| 'both'` | Phase 1 providers implement `network-policy`; `proxy` records intent (`R-028-6`) |

The `generation` profile is a **frozen constant**, not a configurable value. `SC-AGT-005` asserts it
is byte-for-byte what `ADR-0002` specifies, and its existing test runs unmodified. An epic that
widens a security boundary has to prove which half it did not touch.

### ScopedCredentialRef

| Field | Type | Rule |
|---|---|---|
| `id` | string | Opaque handle |
| `purpose` | `'ai-provider' \| 'repository'` | Closed enum |
| `scope` | string | The single repository/branch or provider it is valid for |
| `expiresAt` | ISO timestamp | **Required.** A ref without an expiry fails validation |

**A ref, never a value.** The type carries no secret, so a credential cannot leak through a logged
request object, a serialised error, or a test fixture. Resolution happens inside the provider at
container-start and nowhere else.

`D-27` decided per-run minted, purpose-scoped, short-lived credentials. **The broker is not built
here** — this epic defines the ref and resolves it from configuration for the single `ai-provider`
case that exists today. `purpose: 'repository'` is declared and unused until an agent pushes code.

---

## Part 2 — Agent contract (`packages/agent-contract`)

### AgentDescriptor

Native §7's list, plus one field the amendment does not name:

`provider` · `model` · `agentVersion?` · `executionType` · `capabilities[]` · `contextLimitTokens` ·
`toolCapabilities[]` · `supportsMcp` · `repositoryCapabilities[]` · `costMetadata?` ·
`securityClassification` · `supportsUnattended` · **`specKitIntegrationName?`**

That last field is the one that removes `--integration claude` from the engine adapter. It is
Spec-Kit-specific and lives on the *agent*, because only the agent knows what Spec Kit calls it. Any
other placement puts an engine detail in the agent or an agent detail in the engine.

`costMetadata` is optional and unused by this epic. It exists because `system-design.md` `PC-2`
recorded the same foresight for engines — *"the engine descriptor already records which model
produced each artifact… that is the data M-07 will need to do cost attribution retrospectively, so
Phase 1 is not creating a blind spot it will have to backfill."* Under `D-31` and `D-41` that
foresight is worth more, not less.

### AgentExecutionRequest · AgentExecutionRecord

The request carries Native §2's fields. The **record** carries Native §7's audit list: provider,
model, agent version, execution id, correlation id, timestamps, status, cost metadata, resulting
artifacts.

**Two exclusions, asserted by test** (`FR-AGT-012`, PC-3): no prompt and no model output in
operational logs. This is not new — `T157` already asserts engine output is never logged, because it
may contain customer requirements. The record restates it because a new component is exactly where
such a rule gets forgotten.

### AgentFailure

Reuses `EngineFailure`'s shape: closed reason enum, user-safe `message`, operator-only `diagnostics`,
**no `unknown` member**. The engine contract's own comment gives the rule and it is unchanged here:
*"a generic failure is a defect, not a fallback."*

Reasons: `agent_unavailable` · `agent_error` · `malformed_output` · `empty_output` · `timeout` ·
`cancelled` · `capability_unsupported` · `context_limit_exceeded`.

The last two are new and both are pre-flight refusals — the `E7` pattern, where a doomed run is
refused before a container starts and is therefore never billed.

---

## Part 3 — Registries

Three registries after this epic: engine (exists), agent (new), execution provider (new). All three
follow one shape — register with capability assertion, resolve by name or default, list descriptors.

**`T648` is resolved first** (`R-028-3`): `backend/src/modules/engines/engine-registry.service.ts`
owns capability validation and the worker delegates. Copying today's duplication into two new
registries would turn one disagreement into three.

### AgentRegistration — the only persisted entity

Mirrors the built `EngineRegistration` field for field. **Prisma is still not a dependency**
(EPIC-004 `T013`), so it follows the `T463` precedent: a narrow delegate with Prisma's own shape, so
it drops in unchanged when `T013` lands. An explicit null store exists for the same reason it does
for engines.

---

## Part 4 — Preserved-element changes *(Native §28, `FR-AGT-013`)*

Three elements from the sixteen are touched. Each needs all five fields; abbreviated here, recorded
in full by a Phase Z task.

| Element | Change | Compatibility |
|---|---|---|
| **`SpecificationEngine` contract** | **None.** Shape unchanged; `SpecKitEngine`'s *constructor options* change | ✅ None. `ADR-0001` untouched — worth stating, since a reader may assume the epic changes it |
| **Docker isolation** | `ContainerRuntime` moves out of the Spec Kit adapter and widens into `ProjectExecutionEnvironment`; Docker becomes a registered provider | ⚠️ Every `ADR-0002` control preserved for `ephemeral` + `generation`. The existing egress test runs unmodified. **Extended, not superseded** (`D-36`) |
| **Sandbox credential model** | `aiProviderToken: string` → `ScopedCredentialRef[]` | ⚠️ Behaviourally identical today — one AI provider credential, resolved at container start. The change is that a *value* becomes a *handle*, which removes a leak path |

**Alternatives considered**, recorded because §28 requires it: leaving `ContainerRuntime` in place and
adding a parallel abstraction (rejected — two ways to start a container is worse than one wrong one);
keeping the token as a string and adding refs alongside (rejected — the leak path survives, and a
type that permits both permits the wrong one).

---

## What this model deliberately omits

| Omitted | Why |
|---|---|
| Persistent-workspace storage schema | EPIC-029. The type ships here; nothing persists it |
| Credential broker / minting | `D-27` decided the model; `R-AI-011` is uninvestigated and no vendor mechanism is verified |
| `AgentRun` state machine with the ten Native §20 states | `D-25` places it in the database and routes it to EPIC-012, which is **held** |
| Model-routing types beneath the gateway | `D-30` — integrable layer, not this contract |
| MCP tool schemas | `D-26` — agent-facing surface, not this epic |
| Identifier form for persisted rows | **`D-1` is still open.** Choosing one here would pre-empt it |
