# Research: Agent & Execution Seam

**Epic**: `EPIC-028` | **Date**: 2026-08-14 | **Plan**: [plan.md](./plan.md)

Six items. Four are answerable from this repository and are answered with the evidence. Two are
vendor questions nobody here has investigated, and Native §26 is explicit: *"Do not make unsupported
assumptions where research is required."* They are marked open with what they block.

| ID | Question | Status | Blocks |
|---|---|---|---|
| **R-028-1** | How does the Docker provider talk to the daemon? | 🟢 Answered | `T646` |
| **R-028-2** | How is `T646` verified when CI cannot run a container? | 🟢 Answered | Phase Z closure |
| **R-028-3** | Where does capability validation live, given two registries exist? | 🟢 Answered | `T648`, then everything |
| **R-028-4** | What does the agent conformance suite need on day one? | 🟢 Answered | `F-28.3` |
| **R-028-5** | Is `claude -p <command>` in a container a supported execution model? | 🔴 **OPEN — not investigated** | `SC-AGT-001`, the Claude adapter's capability |
| **R-028-6** | What belongs in the `implementation` egress profile? | 🟡 Partial | `FR-AGT-011`; deferred, not guessed |

---

## R-028-1 · Docker daemon access — answered 🟢

**Decision: talk to the Docker Engine HTTP API directly over its unix socket. No `dockerode`.**

**Rationale**, in the order the reasons actually weigh:

1. **The port is tiny.** `ProjectExecutionEnvironment` needs start, exec, write file, list files, read
   file, stop. That is six daemon endpoints. A client library exists to hide surface this design does
   not use.
2. **`ADR-0002`'s controls are daemon flags** — non-root user, read-only rootfs, cpu/memory/pid caps,
   network mode. They are set on the create call directly. A wrapper adds a translation layer between
   the security contract and its enforcement, which is the worst place to have one.
3. **`dependencies.md` tracks licence and supply-chain risk per dependency.** A container-management
   library is a large transitive surface with daemon socket access, admitted for six calls.

**Alternatives considered**: `dockerode` — mature and conventional, rejected on 1–3 above. Shelling
out to the `docker` CLI — rejected because it puts argument construction in a string, which is the
category of bug the `E7` pre-flight refusals exist to prevent, and because the CLI's presence in the
worker image is another assumption.

**Consequence for `D-21`**: none. The provider is behind the port either way; this decision is
reversible in one file, which is exactly what the port was for.

## R-028-2 · Verifying `T646` when CI cannot run a container — answered 🟢

**Decision: split the task. `T646a` runs in CI against a mocked daemon; `T646b` is a manual, recorded
execution that Phase Z will not close without.**

**Rationale** — this is the single most important decision in the epic, and the evidence is in this
repository's own history:

> *"The container image has never been built… No real container has ever started. Every sandbox test
> drives a mocked runtime."* — EPIC-003 closure report

> *"`T031`, `T036` and `T034a` were `[X]` in `tasks.md` with **no test file anywhere in the
> repository**… It survived CI because an empty Vitest project passes silently."*

EPIC-003 has 65 tests on the Spec Kit adapter and an engine that cannot start. Adding a 66th mocked
test does not change that. **A task whose real verification cannot run in CI must say so in its own
structure**, or it will be marked complete on the evidence that is available rather than the evidence
that matters.

| Half | Runs where | Asserts |
|---|---|---|
| `T646a` | CI, mocked daemon | Request construction, `ADR-0002` flags present, failure mapping, cancellation, teardown idempotence |
| `T646b` | **Manual, recorded** | A container starts, the five steps run, a specification is produced, the container is destroyed |

`T646b` produces a recorded transcript committed under `specs/028-agent-execution-seam/`. Phase Z
checks the transcript exists and names the image digest. RAID **R-04** stays open; this does not
close it, it works around it honestly.

## R-028-3 · Where capability validation lives — answered 🟢

**Decision: `backend/src/modules/engines/engine-registry.service.ts` owns it. The worker's registry
delegates.**

**Evidence**: the backend service is the one `EnginesModule` wires (`T462`), the one with 20 tests,
and the one `PrismaEngineRegistrationStore` persists against (`T463`). The worker's `EngineRegistry`
in `engine-composition.ts` is a second implementation of `FR-021` with its own `assertPhase1Capabilities`
call — `T648` recorded this on 2026-08-08 and nothing owned the fix.

**Why it must land before the new registries, not after**: this epic adds an agent registry and an
execution-provider registry. Copying the current pattern would produce **six** registry
implementations where two already disagree. Fixing one duplicate is cheap; fixing three is a refactor.

**Alternatives**: keep both and document the split (rejected — `FR-021` would have two answers, and
the whole point of registration refusal is that it is unambiguous); move validation to the worker
(rejected — the backend needs it to serve the engine list over its API, and `PC-1` says services must
be callable without the transport).

## R-028-4 · The agent conformance suite's day-one cases — answered 🟢

**Decision: the suite ships with the three defects EPIC-003's engine conformance suite found, plus
capability refusal.** These are not hypothetical.

| Case | Origin | Why it transfers |
|---|---|---|
| **Already-aborted signal** | *"`addEventListener('abort')` never fires on an already-aborted signal, so a cancellation arriving in a narrow window was missed — and the run then reported a timeout for what was a cancellation"* | `T045a` was written in EPIC-001 to prevent exactly this confusion. It recurred in a different component anyway |
| **Hung step self-termination** | *"The adapter waited for a hung step instead of self-terminating. The wall-clock flag was set and nothing acted on it"* | Under autonomous execution nobody is watching a wedged agent |
| **Failure misclassification** | *"A bad correlation id was reported as `engine_unavailable`, disguising a wiring defect as an outage"* | Sends an operator to check the runtime for a code bug |
| **Capability refusal naming the gap** | Quickstart `V11` step 5, already proven for engines | `FR-AGT-003` requires negotiation *before* assignment |

**And the suite must be mutation-tested.** EPIC-003 did this — *"dropping `location` from a fixture
finding turned `C11` red, so the suite is not vacuous"* — and it is the only evidence that a
conformance suite tests anything. A task asserts it.

**Rationale for shipping all four on day one rather than after the first incident**: the engine suite
*"found three real defects in my own adapter"*, which the closure report calls the strongest evidence
it was worth building. The same suite against the same author writing a structurally similar adapter
should be expected to find the same class of defect.

## R-028-5 · Is containerised `claude -p` a supported execution model? — OPEN 🔴

**Not investigated. Inherited from `R-AI-001` and `R-AI-002`, both open since EPIC-027.**

**What the repository assumes today**: `speckit.adapter.ts` invokes `claude -p /speckit-tasks` and
`claude -p /speckit-analyze` inside a container, and `engine-image.spec.ts` asserts the image pins an
agent CLI version. **All of it is asserted by mocks.** No container has started.

**What is unknown**: whether that invocation is supported server-side, how authentication works
without an interactive session, whether long-running or multi-turn work needs a different mechanism,
and what it costs per run.

**What it blocks**: `SC-AGT-001` — the epic's headline criterion. **Not** the contract, which is
provider-neutral by construction, and **not** `T646`, which starts containers regardless of what runs
inside them.

**Deliberately not resolved by assumption.** If `T646b` reveals the invocation does not work as
mocked, that is a finding this programme has been unable to produce for eleven days, and it arrives
in the epic designed to surface it.

## R-028-6 · Contents of the `implementation` egress profile — partial 🟡

**Answered**: the shape. Named profiles, enumerated destinations, `generation` frozen. Settled by
`D-28`.

**Not answered**: the concrete destinations. Registry hostnames vary by ecosystem, by mirror and by
tenant; a guessed list produces an allow-list that fails in production, and Native §19's second
sentence is the one that gets forgotten — *"Do NOT simply open general internet access."*

**Decision: the `implementation` profile ships deliberately minimal — the AI provider endpoint only,
identical to `generation` — with the *mechanism* built and the list left to be extended by the epic
that first needs a build to run.** A profile with one destination is not useless: it proves the
abstraction, and it fails loudly rather than silently permitting.

**Alternative rejected**: shipping a plausible npm/PyPI/GitHub list now. It would be untested, would
look authoritative, and the first real implementation agent would inherit it as settled.

**Open sub-question**: network-policy versus proxy enforcement. `D-28` chose proxy, because a proxy
makes the policy auditable and the sandbox host is now shared between tenants (`D-31`). The proxy
itself is **not built by this epic** — the `EgressProfile.enforcement` field records the intent and
the Docker provider implements the network-policy half. Recorded so the gap is visible.

---

## What research does not resolve

| Looks like research | Is actually |
|---|---|
| Whether the Claude adapter should exist at all | Settled — it is the reference adapter, `D-20` |
| Whether Docker stays Phase 1 | Settled — Native §4 says so explicitly, `D-21` |
| Whether `generation`'s egress can be widened | Settled — it cannot, `SC-AGT-005` |
| Whether persistent bindings ship here | Settled — the type ships, EPIC-029 builds it |
