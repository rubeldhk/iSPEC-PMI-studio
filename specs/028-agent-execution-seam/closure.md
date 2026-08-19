# Closing Report: EPIC-028 Agent & Execution Seam

**Session**: `EPIC-028 Agent & Execution Seam` · **Branch**: `epic/003-specification-engine` ·
**Date**: 2026-08-17

Written against [`governance/closing-report.md`](../../governance/closing-report.md).
Tasks `T592`–`T596` are discharged by the sections below.

> **Constitution VIII deviation.** This ran on `epic/003-specification-engine` while working
> EPIC-028. [`tasks.md`](./tasks.md) predicted this at the top of the file — *"Current branch is
> `epic/003-specification-engine`, which does **not** match. Fifth occurrence"* — and it happened
> anyway, which is the strongest possible argument that a prediction in prose is not a control.
> `G-08` passed throughout because it checks a branch name's *format*, not whether it names the epic
> being worked. **Decision `D-39` should simply be taken.**

## Work Completed

~~**65 of 66 tasks complete.** The one open task is `T646b`, which cannot run on this machine.~~

> **Superseded 2026-08-17 — see the addendum at the foot of this document.** `T646b` **ran**: this
> machine had a Docker daemon all along, and a real container started for the first time in the
> programme. **72 of 72 tasks.** `SC-AGT-001` is still unmet — the run stops at a missing credential
> — so the epic remains **not release-eligible**.

| Task group | Outcome | Evidence |
|---|---|---|
| F-28.1 Setup (`T537`–`T544`) | done | `T539` completed here, once `T646a` gave `execution-providers` tests |
| F-28.2 Contracts (`T545`–`T554`, `T648`) | done | `execution-contract` 33 tests, `agent-contract` 24 |
| **US1** Agent swap (`T555`–`T569`) | **done** | `T557`, `T558`, `T559`, `T561`, `T564`, `T565` landed this session |
| **US2** Real container (`T570`–`T577`, `T646a`, `T647`) | ~~**done except `T646b`**~~ **done** | Docker provider 31 tests; ~~`T646b` needs a daemon~~ `T646b` ran 2026-08-18, digest in [`v6-transcript.md`](./v6-transcript.md) |
| **US3** Policy not code (`T578`–`T586`) | done | Prior session |
| Polish (`T587`–`T591`) | done | Mutation tests, preserved-elements record, quickstart results |
| Phase Z (`T592`–`T596`) | done | This document |
| **`T646b`** | **NOT done** | No container runtime on this machine. See *Not verified* |

### What this epic actually changed

**`C-19` is closed in code.** `speckit.adapter.ts` named `claude` in four places, so swapping the AI
provider and swapping the specification engine were the same edit. The agent contract, two adapters,
and a build-failing architecture test now make that impossible.

**`C-20` is closed by construction.** `T646` was about to hard-code Docker as *the* execution
substrate inside the engine adapter. `ContainerRuntime` and `SandboxSession` are deleted from there;
`ProjectExecutionEnvironment` lives in a contract package and Docker is a provider behind it.

**`FR-018` is satisfied in the running system for the first time.** Spec Kit is the default engine.
EPIC-003 built the adapter and could not register it, because it needed a runtime that did not exist
and an agent it named as a literal.

### Four defects, all found by writing the tests that were supposed to already cover them

| Defect | What it was | How it was found |
|---|---|---|
| [`DEF-028-001`](./defects/DEF-028-001-hung-step-case-tested-a-flag-not-a-hang.md) | Conformance case C2 — *"a hung step self-terminates at the wall clock"* — was driven by a **constructor flag**, not a hang. The real path awaited `session.exec` directly and hung **forever** | Extracting the suite so it could run against a second adapter (`T565`) |
| [`DEF-028-002`](./defects/DEF-028-002-execution-id-embeds-the-prompt.md) | `executionId` was `` `${correlationId}:${command}` `` — and `command` is the prompt. The customer's project name went verbatim into a field designed to be logged, on both success and failure paths | `T559`, on its first run |
| [`DEF-028-003`](./defects/DEF-028-003-frozen-egress-check-cannot-run.md) | The `SC-AGT-005` freeze check compared against `main`, and **neither frozen file exists on `main`**. It printed SKIPPED on every run, everywhere, including CI | `T591`, running quickstart `V8` |
| (`T577` design) | A transcript check that hard-failed would have reddened every epic's build for a task CI structurally cannot run | Deciding its severity rather than defaulting it |

**All three defect records were written before any fix** (Constitution VI), and all three are CLOSED.

**They share one shape**, and it is the same shape as `DEF-001-001` and `DEF-018-001` found earlier
this week: *a check that names the right condition and cannot observe it.* An installation check
that read one of two processes. A conformance record that validated absences and not presences. A
hung-step case driven by a flag. A freeze check with no baseline. Four in one week is a pattern in
how checks get written here, not four coincidences — and it is worth a governance follow-up rather
than four separate fixes.

### Two of my own new assertions could not fail

Found by mutation-testing them. `toMatch(/reportGenerationResult/)` and `toMatch(/buildObservability/)`
were both satisfied by the **import statement**, so the call sites could be deleted and the checks
stayed green. Corrected to assert the call. Recorded because it is the same failure mode as the
defects above, committed while fixing them.

## Verified

Every gate CI runs, executed locally on 2026-08-17:

| Gate | Command | Result |
|---|---|---|
| Package typecheck | `pnpm -r typecheck` | **pass** — 14 packages |
| Governance typecheck | `pnpm typecheck:governance` | **pass** |
| Lint | `pnpm lint` | **pass** — 0 errors, 0 warnings |
| Unit tests | `pnpm test:unit` | **601 passed**, 53 files |
| Architecture tests | `pnpm test:arch` | **22 passed** |
| Governance checks | `pnpm test:governance` | **200 passed**, 14 files |
| Integration tests | `pnpm test:integration` | **29 passed**; `audit-immutability` **fails** — see below |

**`T592` — no Vitest project collects zero tests.** Verified per project, which is the check that
would have caught the EPIC-003 correction:

```
backend-unit 179 · worker-unit 37 · engine-contract 16 · observability 30 · fixture-adapter 45
speckit-adapter 156 · execution-contract 33 · agent-contract 24 · agent-adapters 38
execution-providers 31 · scripts 12
```

### Mutation testing — nine mutations, all caught

**`T587`, the agent conformance suite** — one mutation per case, each caught by its own case:

| Mutation | Caught by |
|---|---|
| Already-aborted pre-check removed | C1 · *does no session work at all* |
| Wall-clock race removed | C2 · both assertions |
| Non-zero exit reclassified as `agent_unavailable` | C3 · *a non-zero exit is agent_error* |
| Capability pre-flight refusal removed | C4 · *refuses a capability … naming it* |

**Other checks written this session**, also mutation-verified: `G-28-02` (a preserved-element field
emptied → red), `T549a` (`deny-all` → `allow-all` in `sandbox.json` → red; **before the
`DEF-028-003` fix this mutation was not caught, because the check never ran**), and the two
installation checks described above.

### Requirement coverage

`FR-AGT-001` … `FR-AGT-013`: **all satisfied**, each by a named test.
`SC-AGT-002`, `003`, `004`, `005`, `006`, `007`, `008`: **satisfied and asserted**.
**`SC-AGT-001`: NOT satisfied** — it requires a real container. See below.

## Not verified

> **Corrected 2026-08-19.** Every statement below was true when written; four have since been
> overtaken, two of them by work done on 2026-08-19. **Struck rather than deleted** — a closure
> report records what was verified on the day, and erasing the original would remove the evidence
> that the question was ever open. Each correction names what changed and how it was checked.

- ~~**`SC-AGT-001` — no real container has started.** `T646b` needs a Docker daemon and this machine
  has none.~~ `T646a` is complete and its request construction is asserted field-by-field against a
  mocked daemon (31 assertions covering every `ADR-0002` control), which proves the request is the
  one `ADR-0002` specifies and proves **nothing** about whether Docker accepts it. ~~EPIC-003's
  closure said *"No real container has ever started."* **That is still true.**~~

  > **A real container HAS started** — `T646b` ran 2026-08-18 and
  > [`v6-transcript.md`](./v6-transcript.md) records the image digest
  > `sha256:c9e1f7e4d95b3414b1be2be83be3f6e76dcc6e39eead4f9b1bec926a9f00e16f`. The sentence carried
  > down from EPIC-003's closure is no longer true.
  >
  > **`SC-AGT-001` is still NOT satisfied, for a different reason.** The transcript's outcome is
  > `FAILED` at `generate_specification`: *"Refusing to start a sandbox without an AI provider
  > credential."* The blocker moved from *no daemon* to *no `AI_PROVIDER_TOKEN`* — and the refusal is
  > the sandbox behaving correctly under `ADR-0002`, not a fault. Owner: operator.

- ~~**`pnpm test:integration` fails** on `audit-immutability.spec.ts` — *"Could not find a working
  container runtime strategy."* That is EPIC-004 `T649`, pre-existing and not this epic's gate.~~

  > **Passes.** 43 tests across 5 files, against real PostgreSQL via Testcontainers. The runtime this
  > machine was said to lack is the same one that started the container above.

- ~~**CI has not run.** Every gate above was executed locally.~~

  > **CI runs on every push**, and since 2026-08-19 (`T688`/`T689`) it executes the integration suite
  > too — the gap that let these five statements go stale unnoticed for two days.

- ~~**The `T549a` secondary `main` comparison still skips**, because `main` predates these files.~~ The
  frozen-hash assertion runs and is authoritative; the secondary one activates after a merge.

  > **It activated.** `main` now carries `packages/execution-contract/src/index.ts`, the suite reports
  > no `SECONDARY CHECK SKIPPED`, and all 6 assertions run. This one needed no fix — it said it would
  > activate after a merge, and it did.

## Deferred

| Item | Owner | Awaiting |
|---|---|---|
| ~~**`T646b`** — the real container run~~ **ran 2026-08-18**; `SC-AGT-001` remains open | operator | ~~a machine with a Docker daemon~~ **`AI_PROVIDER_TOKEN`** — the container starts and the run stops at the credential refusal (`ADR-0002`). RAID `R-04` blocks it in CI by design |
| `R-028-5` — is `claude -p <command>` a supported server-side model? | tech-lead | ~~`T646b`~~ **the credentialled run** — `T646b` reached the sandbox but not the vendor invocation, so the question is still unanswered. `invocationFor()` is exported so a finding lands in one reviewable place |
| The egress **proxy** (`D-28`, `enforcement: 'proxy'`) | unowned | Not built by this epic; the Docker provider implements the network-policy half only |
| The credential **broker** (`D-27`, `D-41` BYOK) | unowned | `R-AI-011`, uninvestigated. The `ScopedCredentialRef` seam is declared and validated; the array is empty |
| A conformance check for `specs/_shared/*.md` | EPIC-018 follow-up | **Corpus-wide gap**, recorded in `T590` rather than fixed locally — no `_shared` document has one, and adding a check for one paragraph would create a standard seven siblings fail |
| Decision **`D-39`** (branch-vs-epic check) | project-owner | nothing. **Sixth occurrence** this week |

## Constitution and principle conformance

| Principle | Verdict |
|---|---|
| I Spec Kit Command Gate | pass — executed via `/speckit-implement`; no code changed outside a task |
| II SRS as Source of Truth | pass — every requirement traces to Native §2–§7, §28 via the epic spec |
| III Epic → Feature → Task | pass — 3 user stories, 6 phases, ~~66~~ **72** tasks *(count corrected 2026-08-19 by `T686`; [tasks.md](./tasks.md) is where it is counted, never restated)* |
| IV Convergence Gate | pass — `T593` run; ~~no unbuilt work remains except `T646b`, explicitly deferred to a named owner~~ **no unbuilt work remains at all: `T646b` ran 2026-08-18 and the task list is 72/72** |
| V Mandatory Unit Tests | pass — 601 unit tests; every new check confirmed red first and mutation-verified |
| VI Defect Traceability | pass — 3 defects recorded **before** any fix, all CLOSED; `defects/` holds no open records |
| VII Promotion Pipeline | not applicable — no promotion attempted |
| VIII Session Labelling | **fail** — branch named the wrong epic. Sixth occurrence. Recorded, not erased |
| IX Mandatory Closing Report | pass — this document |

## Epic Exit Criteria

- [x] Every implementation task has a passing unit test (Constitution V) — 601 passing
- [x] No Vitest project collects zero tests (`T592`) — verified per project
- [x] `/speckit-converge` reports no unbuilt work, or the remainder is deferred to a named owner
- [x] `specs/028-agent-execution-seam/defects/` contains no open records — 3 raised, 3 CLOSED
- [x] Preserved-element changes carry all five §28 fields (`SC-AGT-008`) — asserted by `G-28-02`
- [ ] **`SC-AGT-001` — a real container produces a specification.** **NOT met.** ~~`T646b` is deferred
      to an operator with a Docker daemon~~ **The container half is met**: `T646b` ran 2026-08-18 and
      [`v6-transcript.md`](./v6-transcript.md) carries the image digest. The **specification** half is
      not: the run stops at *"Refusing to start a sandbox without an AI provider credential"*. Awaiting
      `AI_PROVIDER_TOKEN` (`ADR-0002`), owner operator
- [x] Closing report published (Constitution IX) — this document

**EPIC-028 is NOT release-eligible.** ~~One success criterion is unmet and one task is outstanding.~~
**One success criterion is unmet; no task is outstanding** — the task list is 72/72 and the remaining
gap is an input, not work. Constitution IV permits closure on an explicitly deferred remainder, and
that remainder now has a name: a credential, owned by the operator. But `SC-AGT-001` is the epic's
headline outcome, and reporting the epic as complete while its headline outcome is unverified is
exactly what EPIC-003's closure report warned against.

> **Corrected 2026-08-19.** The verdict is unchanged and deliberately so — what moved is the
> *reason*, from "a task nobody could run" to "an input nobody has supplied". Both block release; only
> one of them is work. Distinguishing them is the difference between an epic that is unfinished and
> one that is waiting.
**Recorded as 65/66, deliberately.**

## Recommended Next Task

**Run `T646b` on a machine with a Docker daemon**:

```bash
node scripts/v6-real-run.mjs
# then commit specs/028-agent-execution-seam/v6-transcript.md
```

It is one command, everything else is green, and it is the only thing standing between this
programme and the first specification ever produced by a real container. Everything being green
first was deliberate: a `T646b` failure is now unambiguously about the container or the vendor
invocation, not about the seam. **If it fails because `claude -p` is not a supported server-side
model (`R-028-5`), that is a finding, not a defeat.**

Then **`/speckit-implement for EPIC-003`** — only `T138` remains, and it is blocked by held product
surface, so EPIC-003 closes with it deferred to EPIC-006.

**Above both**: `PMI-DOC-004` and approved business scope. **393 tasks across 19 epics** wait on two
owner deliverables — see [`_shared/programme-status.md`](../_shared/programme-status.md). No
engineering sequence changes that number.

Also worth taking now, on its sixth data point: **decision `D-39`**.

---

# Addendum — `T646b` ran. 2026-08-17.

**A real container started. It is the first in this programme's history**, and it retires the
sentence EPIC-003's closure has carried since 2026-08-08: *"No real container has ever started."*

The machine had a Docker daemon all along. The assumption that it did not — carried for eleven days
across two epics' closing reports — was never tested. That is worth recording on its own.

## What the run did

```text
[PASS] resolve_environment — docker
[PASS] resolve_agent — anthropic/claude-opus-5
[PASS] start_container
[PASS] record_image_digest — sha256:c9e1f7e4d95b3414b1be2be83be3f6e76dcc6e39eead4f9b1bec926a9f00e16f
[FAIL] generate_specification — Refusing to start a sandbox without an AI provider credential.
[PASS] stop_container
```

**`SC-AGT-001` is still NOT satisfied**, and the epic is still **not release-eligible**. The
criterion requires a specification generated end to end; none was. The run stops at a credential this
machine does not hold — which is `E7` behaving correctly, refusing a doomed run before it is billed,
not a defect.

`T646b` itself is complete: the task was *run it and commit the transcript with the image digest*,
and both are done. The distinction matters. A task and a success criterion are not the same claim,
and collapsing them is how "we ran it" becomes evidence for something that did not work.

## Six defects, none of which any test could have found

`T646b` was expected to be a formality — one command on a machine with a daemon. It took **six
rounds** of failure and fix to reach a container:

| Defect | What it was | The seam it lived at |
|---|---|---|
| [`DEF-028-004`](./defects/DEF-028-004-docker-api-cannot-reach-a-windows-daemon.md) | the provider could not reach a daemon on Windows at all | the transport a mocked daemon stands in for |
| [`DEF-028-005`](./defects/DEF-028-005-v6-runner-has-no-entry-point.md) | `runV6` was tested and **never called** — the script did nothing | the caller a test supplies itself |
| [`DEF-028-006`](./defects/DEF-028-006-engine-image-has-never-been-built.md) | **the image had never been built**; `specify-cli==0.0.17` does not exist | a pin read from a file, never resolved |
| [`DEF-028-007`](./defects/DEF-028-007-egress-network-is-required-and-never-created.md) | the egress network is required and nothing creates or documents it | a network name constructed correctly, never looked up |
| [`DEF-028-008`](./defects/DEF-028-008-404-always-reads-as-a-missing-image.md) | every 404 reported as a missing image — including a missing network | a fixture labelled by the same assumption as the code |
| [`DEF-028-009`](./defects/DEF-028-009-entrypoint-swallows-the-idle-command.md) | `ENTRYPOINT ["/bin/sh","-c"]` turned `['sleep','300']` into `sleep` with no operand | **neither artifact** — only their combination |
| [`DEF-028-010`](./defects/DEF-028-010-nothing-can-report-the-image-digest.md) | nothing could report the image digest `T577` requires | a field the stub invented and the system lacked |

All seven recorded **before** any fix (Constitution VI). All seven CLOSED, each with a unit test
confirmed red by mutation (`T668`–`T673`).

**Every one was invisible to 658 passing unit tests.** `DEF-028-009` is the sharpest: the image was
right, the provider was right, and the two could not work together. No check on either side could
have seen it, because the fault existed only in their combination. That is the answer to *"what does
a manual run buy that CI does not"* — and it is why splitting `T646b` from `T646a` was correct.

`DEF-028-006` reaches back further: `T088` was marked complete in EPIC-003 on an image that could
never build, and EPIC-003 closed with it. An addendum records it there.

## What still stands between here and `SC-AGT-001`

1. **An `AI_PROVIDER_TOKEN`.** Owner: project-owner. Not obtainable by this session, and correctly
   refused rather than worked around.
2. **`R-028-8` — an egress network that permits exactly `api.anthropic.com`.** Not expressible with
   `docker network create`; it needs the proxy `D-28` records as undelivered. Today an operator has
   containment (`--internal`, no egress) **or** reachability (a bridge, full egress), never the
   profile as specified. This run used `--internal`, so even with a credential it could not have
   reached the provider.
3. **`R-028-5`** — whether `claude -p <command>` works inside the sandbox — remains untested for the
   same reason. It is now the *only* unknown left in the chain.

## Gates re-run after the fixes

| Gate | Result |
|---|---|
| `pnpm lint` | pass, 0 warnings |
| `pnpm typecheck` | pass |
| `pnpm test:unit` | **658 passed**, 58 files |
| `pnpm test:arch` | 22 passed |
| `pnpm test:governance` | **359 passed**, 24 files |
| `pnpm test:integration` | 35 passed, 4 files — including a real PostgreSQL testcontainer |
| `pnpm v6:real-run` | exits 1, transcript `FAILED` — **the exit status and the transcript agree** |

`G-28-01` now finds a transcript and passes on its content rather than reporting an absence.

**Tasks: 72 of 72.** `SC-AGT-001` is unmet, so the epic stays **not release-eligible** — unchanged,
and for a reason that is now one credential and one proxy rather than an untested assumption.
