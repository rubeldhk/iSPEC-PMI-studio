# Quickstart: Agent & Execution Seam

**Epic**: `EPIC-028` | **Date**: 2026-08-14 | **Plan**: [plan.md](./plan.md)

Nine scenarios. Eight run in CI. **One does not, and it is the only one that proves the epic worked.**

---

## Prerequisites

```bash
pnpm install
node --version          # 22 LTS
```

For **V6 only**: a working Docker daemon on the machine running it. CI does not have one — RAID
**R-04**.

## Running

```bash
pnpm test:unit          # includes the three new projects
pnpm test:arch          # three suites: engine, transport, agent
```

⚠️ **`pnpm test:unit` names its projects explicitly**, and the EPIC-003 closure report records what
that hides: *"an empty Vitest project passes silently when sibling projects have tests"* — two
projects collected nothing, the run stayed green, and three tasks were marked complete with no test
file anywhere in the repository. **Run V0 before trusting any other result.**

---

## V0 · The test harness is not lying

```bash
pnpm test:unit 2>&1 | grep -E "agent-contract|agent-adapters|execution-providers"
```

**Expected**: all three new projects appear **with a non-zero test count**.

**Prove it can fail**: delete every test file in `packages/agent-contract` and re-run. If the suite
stays green, the guard from `T537` is not working and every scenario below is unverified.

This runs first because it is the only scenario that checks whether the other scenarios mean
anything.

## V1 · The AI provider swaps without touching the engine

```bash
pnpm test:unit --project agent-adapters -t "agent swap"
```

**Expected**: one engine-agnostic caller runs against the fixture agent and the Claude agent; identical
result shape, identical failure classification, **distinct provenance**.

This is the `V11` pattern EPIC-003 proved for engines, applied to the axis the amendment cares about.

## V2 · The build fails when a provider is named outside an agent adapter

```bash
pnpm test:arch --project architecture -t "agent independence"
```

**Expected**: pass — zero provider identifiers under `backend/src` or in any engine adapter.

**Prove it can fail**: add `const x = 'claude';` to any file under `engine-adapters/speckit/src/`.
Must go red, naming the file.

**Before this epic, this check would fail on five lines of `speckit.adapter.ts`.** That is the point
of it — the violation was legal, invisible, and in the tree.

## V3 · Capability negotiation refuses before it runs

```bash
pnpm test:unit --project agent-contract -t "capability"
```

**Expected**: an agent declaring fewer capabilities than requested is refused, **naming the missing
one**. A request exceeding `contextLimitTokens` is refused as `context_limit_exceeded` **before any
container work** — the `E7` pattern: a doomed run is never billed.

## V4 · Cancellation is never reported as a timeout

```bash
pnpm test:unit --project agent-adapters -t "conformance"
```

**Expected**: all four conformance cases pass against **every** registered adapter —
already-aborted signal, hung step, misclassification, capability refusal.

**Then mutation-test it**: break one fixture assertion and confirm the suite turns red. EPIC-003 did
exactly this and its suite *"found three real defects in my own adapter"*. A conformance suite nobody
has broken on purpose is decoration.

Three of these four cases are defects **this repository has already shipped**. `T045a` was written in
EPIC-001 to prevent the cancellation/timeout confusion, and it recurred anyway in a different
component.

## V5 · Egress and workspace bindings are validated, not trusted

```bash
pnpm test:unit --project execution-providers -t "validation"
```

**Expected**, each an individual refusal:

- a wildcard destination (`*`, `0.0.0.0/0`, `::/0`) → rejected
- an empty `allowedDestinations` → rejected
- a provider with `supportsNetworkPolicy: false` accepting a profile → rejected
- a `persistent` binding without a branch → **does not compile**
- a `ScopedCredentialRef` without `expiresAt` → rejected
- an `env` entry containing a credential value → rejected

## V6 · A real container produces a specification 🔴 **manual — never run in this programme**

```bash
# Requires a Docker daemon. NOT run in CI (RAID R-04).
docker build -t pmi-studio/speckit-engine engine-adapters/speckit/docker/
docker network create --internal pmi-egress-generation   # see the warning below
export AI_PROVIDER_TOKEN=...                             # never committed (PC-3)
pnpm v6:real-run --dry-run                               # prints the plan, starts nothing
pnpm v6:real-run
```

> **Three prerequisites this scenario did not have until `T646b` was actually run**, each of which
> failed it: the image had never been built (`DEF-028-006`), the egress network is required and
> nothing creates it (`DEF-028-007`), and the runner had no entry point (`DEF-028-005`).
> Full setup: [`docs/operator-setup.md`](../../docs/operator-setup.md).
>
> ⚠️ `--internal` gives **containment with no egress**, so generation cannot reach the AI provider.
> A network permitting exactly `api.anthropic.com` needs a proxy or CNI policy that does not exist
> yet (`R-028-8`, `D-28`). Today you can have containment or reachability, not the profile as
> specified — and a transcript produced on a bridge network must say so.

**Expected**: a container starts, the five ordered invocation steps run, a specification is produced,
and the container is destroyed. The transcript — including the **image digest** — is committed under
`specs/028-agent-execution-seam/`.

**This is `SC-AGT-001`, and it is the only scenario that proves the epic worked.** Everything else
verifies structure. Every claim this programme has ever made about the real Spec Kit engine rests on
mocks; the EPIC-003 closure report says so in as many words: *"No real container has ever started."*

**Phase Z will not close without the transcript.** A green CI run is not evidence for this scenario
and must not be reported as one.

**If it fails**: that is a finding, not a defeat. `R-028-5` records that nobody has verified
`claude -p <command>` is a supported server-side execution model. Discovering it does not work is
worth more than eleven more days of not knowing.

## V7 · Spec Kit is the default engine, and it resolves

```bash
pnpm test:unit --project worker-unit -t "composition"
```

**Expected**: `composeEngineRegistry()` returns `SpecKitEngine` as default (`T647`, `FR-018`), and
**one** registry owns capability validation (`T648`).

`FR-018` has been unsatisfied in the running system since EPIC-003 closed — the composition root
still registers the fixture as default. This is where that ends.

## V8 · The `generation` egress control is untouched

```bash
git diff main...HEAD -- engine-adapters/speckit/tests/ | grep -i egress
pnpm test:unit --project speckit-adapter -t "egress"
```

**Expected**: the `git diff` returns **nothing**, and the existing egress test passes **unmodified**.

`SC-AGT-005`. An epic that widens a security boundary has to prove which half it did not touch, and
the proof is that the old test still passes without being edited. A modified test would pass just as
green and mean nothing.

---

## What none of these check

**Whether the Claude adapter is any good.** V1 proves it satisfies the contract; V6 proves a container
starts. Neither proves the agent produces useful specifications — that is what the fixture adapter
deliberately cannot tell you, and what only real use will.

Stated here so a green board is not mistaken for a working product.

## Not yet runnable

| Scenario | Blocked by |
|---|---|
| V0–V5, V7, V8 | `/speckit-tasks` has not run; no code exists yet |
| **V6** | `T646b`, **and** a machine with Docker. Not CI |
