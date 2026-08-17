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

**65 of 66 tasks complete.** The one open task is `T646b`, which cannot run on this machine.

| Task group | Outcome | Evidence |
|---|---|---|
| F-28.1 Setup (`T537`–`T544`) | done | `T539` completed here, once `T646a` gave `execution-providers` tests |
| F-28.2 Contracts (`T545`–`T554`, `T648`) | done | `execution-contract` 33 tests, `agent-contract` 24 |
| **US1** Agent swap (`T555`–`T569`) | **done** | `T557`, `T558`, `T559`, `T561`, `T564`, `T565` landed this session |
| **US2** Real container (`T570`–`T577`, `T646a`, `T647`) | **done except `T646b`** | Docker provider 31 tests; `T646b` needs a daemon |
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

- **`SC-AGT-001` — no real container has started.** `T646b` needs a Docker daemon and this machine
  has none. `T646a` is complete and its request construction is asserted field-by-field against a
  mocked daemon (31 assertions covering every `ADR-0002` control), which proves the request is the
  one `ADR-0002` specifies and proves **nothing** about whether Docker accepts it. EPIC-003's
  closure said *"No real container has ever started."* **That is still true.**
- **`pnpm test:integration` fails** on `audit-immutability.spec.ts` — *"Could not find a working
  container runtime strategy."* That is EPIC-004 `T649`, pre-existing and not this epic's gate.
- **CI has not run.** Every gate above was executed locally.
- **The `T549a` secondary `main` comparison still skips**, because `main` predates these files. The
  frozen-hash assertion runs and is authoritative; the secondary one activates after a merge.

## Deferred

| Item | Owner | Awaiting |
|---|---|---|
| **`T646b`** — the real container run | operator | a machine with a Docker daemon. RAID `R-04` blocks it in CI by design |
| `R-028-5` — is `claude -p <command>` a supported server-side model? | tech-lead | `T646b`. `invocationFor()` is exported so a finding lands in one reviewable place |
| The egress **proxy** (`D-28`, `enforcement: 'proxy'`) | unowned | Not built by this epic; the Docker provider implements the network-policy half only |
| The credential **broker** (`D-27`, `D-41` BYOK) | unowned | `R-AI-011`, uninvestigated. The `ScopedCredentialRef` seam is declared and validated; the array is empty |
| A conformance check for `specs/_shared/*.md` | EPIC-018 follow-up | **Corpus-wide gap**, recorded in `T590` rather than fixed locally — no `_shared` document has one, and adding a check for one paragraph would create a standard seven siblings fail |
| Decision **`D-39`** (branch-vs-epic check) | project-owner | nothing. **Sixth occurrence** this week |

## Constitution and principle conformance

| Principle | Verdict |
|---|---|
| I Spec Kit Command Gate | pass — executed via `/speckit-implement`; no code changed outside a task |
| II SRS as Source of Truth | pass — every requirement traces to Native §2–§7, §28 via the epic spec |
| III Epic → Feature → Task | pass — 3 user stories, 6 phases, 66 tasks |
| IV Convergence Gate | pass — `T593` run; no unbuilt work remains except `T646b`, explicitly deferred to a named owner |
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
- [ ] **`SC-AGT-001` — a real container produces a specification.** **NOT met.** `T646b` is deferred
      to an operator with a Docker daemon
- [x] Closing report published (Constitution IX) — this document

**EPIC-028 is NOT release-eligible.** One success criterion is unmet and one task is outstanding.
Constitution IV permits closure on an explicitly deferred remainder, and `T646b` is deferred with a
named owner — but `SC-AGT-001` is the epic's headline outcome, and reporting the epic as complete
while its headline outcome is unverified is exactly what EPIC-003's closure report warned against.
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
